import { readJsonCred } from "../paths.js";
import { formatAsof, formatReset, formatResetTime, parseResetDate, windowMeta } from "../time.js";
import { pct, requestJson } from "./common.js";

// Undocumented endpoint Devin's own settings/usage page calls.
export function parseDevinQuota(payload) {
  if (
    !payload ||
    typeof payload.daily_percentage !== "number" ||
    typeof payload.weekly_percentage !== "number"
  ) {
    throw new Error("devin: unexpected quota response");
  }

  const dailyReset = parseResetDate(payload.daily_reset_at);
  const weeklyReset = parseResetDate(payload.weekly_reset_at);

  return {
    // Orgs on weekly-only billing set hide_daily_quota; a null window paints
    // an empty hero row instead of a bogus 0% meter.
    daily: payload.hide_daily_quota
      ? null
      : {
          pct: pct(payload.daily_percentage),
          reset: formatResetTime(dailyReset),
          ...windowMeta(dailyReset, { period: "daily" }),
        },
    weekly: {
      pct: pct(payload.weekly_percentage),
      reset: formatReset(weeklyReset),
      ...windowMeta(weeklyReset, { period: "weekly" }),
    },
  };
}

export async function fetchDevin() {
  const cred = readJsonCred("devin.json");
  const quota = await requestJson(
    "devin",
    `https://app.devin.ai/api/${cred.orgId}/billing/quota/usage`,
    {
      headers: {
        accept: "application/json",
        authorization: "Bearer " + cred.token,
        "x-cog-org-id": cred.orgId,
      },
      staleNote: "session token rejected",
    }
  );

  return {
    asof: formatAsof(),
    ...parseDevinQuota(quota),
  };
}
