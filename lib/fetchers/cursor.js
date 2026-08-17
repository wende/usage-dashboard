import { readJsonCred } from "../paths.js";
import { formatAsof, formatReset, parseIso, windowMeta } from "../time.js";
import { pct, requestJson, titleCase } from "./common.js";

const API_URL = "https://cursor.com/api/usage-summary";

export async function fetchCursor() {
  const cred = readJsonCred("cursor.json");

  const data = await requestJson("cursor", API_URL, {
    headers: {
      accept: "*/*",
      referer: "https://cursor.com/dashboard",
      cookie: cred.cookie,
    },
  });

  const planUsage = data.individualUsage?.plan || {};
  const startDt = parseIso(data.billingCycleStart);
  const endDt = parseIso(data.billingCycleEnd);

  return {
    asof: formatAsof(),
    plan: titleCase(data.membershipType || "unknown"),
    cycle: formatReset(endDt),
    total: {
      pct: pct(planUsage.totalPercentUsed),
      label: "included usage",
      ...windowMeta(endDt, { startDate: startDt, period: "monthly" }),
    },
    api: {
      pct: pct(planUsage.apiPercentUsed),
      label: "API usage (named model)",
    },
  };
}
