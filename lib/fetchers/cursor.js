import { readJsonCred } from "../paths.js";
import { UA, formatAsof, formatDate, parseIso } from "../time.js";

const API_URL = "https://cursor.com/api/usage-summary";

export async function fetchCursor() {
  const cred = readJsonCred("cursor.json");

  const res = await fetch(API_URL, {
    method: "GET",
    headers: {
      accept: "*/*",
      referer: "https://cursor.com/dashboard",
      "user-agent": UA,
      cookie: cred.cookie,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`cursor request failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const planUsage = data.individualUsage?.plan || {};
  const totalPct = planUsage.totalPercentUsed;
  const apiPct = planUsage.apiPercentUsed;

  const startDt = parseIso(data.billingCycleStart);
  const endDt = parseIso(data.billingCycleEnd);
  let cycle = null;
  if (startDt && endDt) {
    cycle = `cycle ${formatDate(startDt)} -> ${formatDate(endDt)}`;
  }

  const membership = data.membershipType || "unknown";
  const plan =
    membership.charAt(0).toUpperCase() + membership.slice(1).toLowerCase();

  return {
    asof: formatAsof(),
    plan,
    cycle,
    total: {
      pct: Math.round(Number(totalPct || 0) * 100) / 100,
      label: "included usage",
    },
    api: {
      pct: Math.round(Number(apiPct || 0) * 100) / 100,
      label: "API usage (named model)",
    },
  };
}
