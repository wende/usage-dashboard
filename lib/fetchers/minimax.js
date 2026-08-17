import { readJsonCred } from "../paths.js";
import { UA, formatAsof, formatDate, formatShort, jwtExpiryDate } from "../time.js";
import { StaleError } from "../errors.js";

const API_URL =
  "https://platform.minimax.io/backend/account/token_plan/remains_percent";

function parsePct(value) {
  if (value == null) return 0;
  if (typeof value === "number") return Math.round(value * 100) / 100;
  return Math.round(Number(String(value).replace("%", "").trim() || 0) * 100) / 100;
}

function fmtMs(ms, kind) {
  if (!ms) return "unknown";
  const d = new Date(Number(ms));
  return kind === "short" ? formatShort(d) : formatDate(d);
}

export async function fetchMinimax() {
  const cred = readJsonCred("minimax.json");
  const token = cred.token;

  const res = await fetch(API_URL, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
      cookie: "_token=" + token,
      "x-group-id": cred.groupId,
      referer: "https://platform.minimax.io/console/usage",
      "user-agent": UA,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new StaleError(`minimax token rejected (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(`minimax request failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const models = data.model_remains || [];
  const general =
    models.find((m) => m.model_name === "general") || models[0] || null;
  if (!general) {
    throw new Error(`no model quota in response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return {
    asof: formatAsof(),
    weekly: {
      pct: parsePct(general.current_weekly_used_percent),
      reset: "resets " + fmtMs(general.weekly_end_time, "date"),
    },
    window: {
      pct: parsePct(general.current_interval_used_percent),
      reset: "resets " + fmtMs(general.end_time, "short"),
    },
    tokenExpires: jwtExpiryDate(token),
  };
}
