import { readTextCred } from "../paths.js";
import {
  UA,
  formatAsof,
  formatDate,
  formatShort,
  jwtExpiryDate,
  parseIso,
} from "../time.js";

const API_URL =
  "https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats";

function pct(ratio) {
  return Math.round(Number(ratio || 0) * 10000) / 100;
}

export async function fetchKimi() {
  const token = readTextCred("kimi-token.txt");
  if (token.split(".").length !== 3) {
    throw new Error("token file does not contain a JWT");
  }

  const res = await fetch(API_URL, {
    method: "POST",
    body: "{}",
    headers: {
      accept: "*/*",
      authorization: `Bearer ${token}`,
      "connect-protocol-version": "1",
      "content-type": "application/json",
      origin: "https://www.kimi.com",
      referer: "https://www.kimi.com/membership/subscription?tab=quota",
      "user-agent": UA,
      "x-language": "en-US",
      "x-msh-device-id": "7613748204189960704",
      "x-msh-platform": "web",
      "x-msh-version": "2.0.0",
      "x-traffic-id": "d44d3nms1rh2id9egmpg",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`quota request failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data || typeof data !== "object" || !data.subscriptionBalance) {
    throw new Error(`unexpected API response: ${JSON.stringify(data).slice(0, 200)}`);
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
      pct: pct(gift.amountUsedRatio),
      expires: exp ? formatDate(exp) : "unknown",
    };
  });

  return {
    asof: formatAsof(),
    total: {
      pct: pct(balance.amountUsedRatio),
      reset: "resets " + (totalReset ? formatDate(totalReset) : "unknown"),
    },
    fiveHour: {
      pct: pct(five.ratio),
      reset: "resets " + (fiveReset ? formatShort(fiveReset) : "unknown"),
    },
    sevenDay: {
      pct: pct(seven.ratio),
      reset: "resets " + (sevenReset ? formatShort(sevenReset) : "unknown"),
    },
    gifts,
    tokenExpires: jwtExpiryDate(token),
  };
}
