import { readJsonCred } from "../paths.js";
import { formatAsof, formatReset, formatResetTime, parseResetDate, windowMeta } from "../time.js";
import { pct, requestJson } from "./common.js";

// Undocumented internal endpoints Z.ai's own subscription UI uses.
const QUOTA_URL = "https://api.z.ai/api/monitor/usage/quota/limit";
const SUBSCRIPTION_URL = "https://api.z.ai/api/biz/subscription/list";

const PERCENT_QUOTA = (l) => l.type === "CREDIT_LIMIT" || l.type === "TOKENS_LIMIT";

// Window length is a (unit, number) pair: 3 = hours, 6 = weeks. Sub-daily
// percentage quotas are the 5-hour session meter, multi-day ones the weekly.
// A percentage entry may omit nextResetTime for the active window (seen on
// CREDIT_LIMIT plans) — then reset is "unknown" and no pace marker shows.
export function parseGlmQuota(payload) {
  const limits = payload && payload.data && payload.data.limits;
  if (!Array.isArray(limits)) {
    const msg = (payload && payload.msg) || "unexpected quota response";
    throw new Error(`glm: ${msg}`);
  }

  const five = limits.find((l) => PERCENT_QUOTA(l) && l.unit === 3);
  const week = limits.find((l) => PERCENT_QUOTA(l) && l.unit === 6);
  const fiveReset = parseResetDate(five && five.nextResetTime);
  const weekReset = parseResetDate(week && week.nextResetTime);

  return {
    fiveHour: five
      ? {
          pct: pct(five.percentage),
          reset: formatResetTime(fiveReset),
          ...windowMeta(fiveReset, { period: "fiveHour" }),
        }
      : null,
    weekly: week
      ? {
          pct: pct(week.percentage),
          reset: formatReset(weekReset),
          ...windowMeta(weekReset, { period: "weekly" }),
        }
      : null,
  };
}

export async function fetchGlm() {
  const cred = readJsonCred("glm.json");
  const headers = {
    accept: "application/json",
    authorization: "Bearer " + cred.apiKey,
  };

  const quota = await requestJson("glm", QUOTA_URL, {
    headers,
    staleNote: "API key rejected",
  });
  const { fiveHour, weekly } = parseGlmQuota(quota);

  // Best-effort plan name (e.g. "GLM Coding Lite"); a failure here must not
  // blank the meters.
  let plan = "";
  try {
    const subs = await requestJson("glm", SUBSCRIPTION_URL, { headers });
    const list = Array.isArray(subs.data) ? subs.data : [];
    plan = (list.find((s) => s.productName) || {}).productName || "";
  } catch (_) {}

  return {
    asof: formatAsof(),
    fiveHour,
    weekly,
    plan,
  };
}
