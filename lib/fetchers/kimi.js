import {
  readJsonCred,
  readTextCred,
  writeJsonCred,
  writeTextCred,
} from "../paths.js";
import {
  UA,
  formatAsof,
  formatDate,
  formatReset,
  formatResetTime,
  jwtExpMs,
  jwtExpiryDate,
  parseIso,
  windowMeta,
} from "../time.js";
import { StaleError } from "../errors.js";
import { pct } from "./common.js";

const API_URL =
  "https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats";

// Connect-RPC AuthService.RefreshToken (from kimi-web request bundle).
// Access JWTs are short-lived (~15 min); refresh JWTs last ~90 days.
const REFRESH_URL =
  "https://auth.kimi.com/api/account.gateway.v1.AuthService/RefreshToken";

/** Refresh access token this many ms before JWT exp. */
const REFRESH_SKEW_MS = 60_000;

function isJwt(token) {
  return typeof token === "string" && token.split(".").length === 3;
}

function needsRefresh(accessToken) {
  if (!isJwt(accessToken)) return true;
  const expMs = jwtExpMs(accessToken);
  if (expMs == null) return true;
  return Date.now() >= expMs - REFRESH_SKEW_MS;
}

/**
 * Load Kimi credentials.
 * Preferred: ~/.quota-watch/kimi.json { accessToken, refreshToken }
 * Legacy: kimi-token.txt (access JWT only — cannot auto-refresh)
 */
function loadKimiCreds() {
  try {
    const j = readJsonCred("kimi.json");
    const accessToken = j.accessToken || j.access_token || "";
    const refreshToken = j.refreshToken || j.refresh_token || "";
    if (accessToken || refreshToken) {
      return { accessToken, refreshToken, source: "kimi.json" };
    }
  } catch {
    // fall through to legacy text file
  }

  try {
    const accessToken = readTextCred("kimi-token.txt");
    return { accessToken, refreshToken: "", source: "kimi-token.txt" };
  } catch (err) {
    throw new StaleError(
      `kimi credentials missing (need kimi.json with refreshToken, or kimi-token.txt): ${err.message}`
    );
  }
}

function saveKimiCreds({ accessToken, refreshToken }) {
  writeJsonCred("kimi.json", { accessToken, refreshToken });
  // Keep legacy file in sync for older tools / manual copies.
  writeTextCred("kimi-token.txt", accessToken);
}

const commonHeaders = {
  accept: "*/*",
  "connect-protocol-version": "1",
  "content-type": "application/json",
  origin: "https://www.kimi.com",
  referer: "https://www.kimi.com/membership/subscription?tab=quota",
  "user-agent": UA,
  "x-language": "en-US",
  "x-msh-platform": "web",
  "x-msh-version": "2.0.0",
};

async function refreshTokens(refreshToken) {
  if (!isJwt(refreshToken)) {
    throw new StaleError("kimi refresh token missing or not a JWT");
  }

  const res = await fetch(REFRESH_URL, {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
    headers: commonHeaders,
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new StaleError(
      `kimi refresh token rejected (HTTP ${res.status}) — re-login on kimi.com and re-harvest`
    );
  }
  if (!res.ok) {
    throw new Error(`kimi token refresh failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const accessToken = data.accessToken || data.access_token;
  const nextRefresh = data.refreshToken || data.refresh_token;
  if (!isJwt(accessToken) || !isJwt(nextRefresh)) {
    throw new Error(
      `kimi refresh response missing tokens: keys=${Object.keys(data || {}).join(",")}`
    );
  }
  return { accessToken, refreshToken: nextRefresh };
}

async function fetchQuota(accessToken) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: "{}",
    headers: {
      ...commonHeaders,
      authorization: `Bearer ${accessToken}`,
      // These were in the original fetcher; harmless if stale.
      "x-msh-device-id": "7613748204189960704",
      "x-traffic-id": "d44d3nms1rh2id9egmpg",
    },
    signal: AbortSignal.timeout(30000),
  });
  return res;
}

function parseQuota(data, accessToken) {
  if (!data || typeof data !== "object" || !data.subscriptionBalance) {
    throw new Error(
      `unexpected API response: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  const balance = data.subscriptionBalance;
  const totalReset = parseIso(balance.expireTime);
  const five = data.ratelimitCode5h || {};
  const seven = data.ratelimitCode7d || {};
  const fiveReset = parseIso(five.resetTime);
  const sevenReset = parseIso(seven.resetTime);

  const gifts = (data.giftBalances || []).map((gift) => {
    const exp = parseIso(gift.expireTime);
    return {
      pct: pct(gift.amountUsedRatio * 100),
      expires: exp ? formatDate(exp) : "unknown",
    };
  });

  return {
    asof: formatAsof(),
    total: {
      pct: pct(balance.amountUsedRatio * 100),
      reset: formatReset(totalReset),
      ...windowMeta(totalReset, { period: "monthly" }),
    },
    fiveHour: {
      pct: pct(five.ratio * 100),
      reset: formatResetTime(fiveReset),
    },
    sevenDay: {
      pct: pct(seven.ratio * 100),
      reset: formatReset(sevenReset),
      ...windowMeta(sevenReset, { period: "weekly" }),
    },
    gifts,
    tokenExpires: jwtExpiryDate(accessToken),
  };
}

export async function fetchKimi() {
  let { accessToken, refreshToken } = loadKimiCreds();

  // Proactive refresh: access JWTs live ~15 minutes.
  if (needsRefresh(accessToken)) {
    if (!refreshToken) {
      throw new StaleError(
        "kimi access token expired/missing and no refreshToken in kimi.json — re-harvest both tokens"
      );
    }
    const next = await refreshTokens(refreshToken);
    saveKimiCreds(next);
    accessToken = next.accessToken;
    refreshToken = next.refreshToken;
  }

  let res = await fetchQuota(accessToken);

  // Reactive refresh once on auth failure (clock skew, early revoke, etc.).
  if ((res.status === 401 || res.status === 403) && refreshToken) {
    const next = await refreshTokens(refreshToken);
    saveKimiCreds(next);
    accessToken = next.accessToken;
    refreshToken = next.refreshToken;
    res = await fetchQuota(accessToken);
  }

  if (res.status === 401 || res.status === 403) {
    throw new StaleError(`kimi token rejected (HTTP ${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`quota request failed: HTTP ${res.status}`);
  }

  return parseQuota(await res.json(), accessToken);
}
