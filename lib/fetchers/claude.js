import { readJsonCred } from "../paths.js";
import { UA, formatAsof, formatDate, formatShort, parseIso } from "../time.js";
import { StaleError } from "../errors.js";

function fmtReset(ts, kind) {
  if (!ts) return "resets unknown";
  return "resets " + (kind === "short" ? formatShort(ts) : formatDate(ts));
}

export async function fetchClaude() {
  const cred = readJsonCred("claude.json");
  const url = `https://claude.ai/api/organizations/${cred.orgId}/usage`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "*/*",
      "content-type": "application/json",
      cookie: cred.cookies,
      referer: "https://claude.ai/new",
      "user-agent": UA,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new StaleError(`claude session rejected (HTTP ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(`claude request failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const five = data.five_hour || {};
  const seven = data.seven_day || {};
  const fiveReset = parseIso(five.resets_at);
  const sevenReset = parseIso(seven.resets_at);

  const scoped = [];
  for (const limit of data.limits || []) {
    if (limit.kind === "weekly_scoped" && limit.scope) {
      const model = limit.scope.model?.display_name;
      if (model) {
        scoped.push({
          name: model,
          pct: Math.round(Number(limit.percent || 0) * 100) / 100,
        });
      }
    }
  }

  return {
    asof: formatAsof(),
    fiveHour: {
      pct: Math.round(Number(five.utilization || 0) * 100) / 100,
      reset: fmtReset(fiveReset, "short"),
    },
    sevenDay: {
      pct: Math.round(Number(seven.utilization || 0) * 100) / 100,
      reset: fmtReset(sevenReset, "date"),
    },
    scoped,
    tokenExpires: "session",
  };
}
