import { readJsonCred } from "../paths.js";
import { formatAsof, formatReset, formatResetTime, parseIso, windowMeta } from "../time.js";
import { pct, requestJson } from "./common.js";

export async function fetchClaude() {
  const cred = readJsonCred("claude.json");
  const url = `https://claude.ai/api/organizations/${cred.orgId}/usage`;

  const data = await requestJson("claude", url, {
    headers: {
      accept: "*/*",
      "content-type": "application/json",
      cookie: cred.cookies,
      referer: "https://claude.ai/new",
    },
  });

  const five = data.five_hour || {};
  const seven = data.seven_day || {};
  const fiveReset = parseIso(five.resets_at);
  const sevenReset = parseIso(seven.resets_at);

  const scoped = [];
  for (const limit of data.limits || []) {
    if (limit.kind === "weekly_scoped" && limit.scope) {
      const model = limit.scope.model?.display_name;
      if (model) {
        scoped.push({ name: model, pct: pct(limit.percent) });
      }
    }
  }

  return {
    asof: formatAsof(),
    fiveHour: {
      pct: pct(five.utilization),
      reset: formatResetTime(fiveReset),
      ...windowMeta(fiveReset, { period: "fiveHour" }),
    },
    sevenDay: {
      pct: pct(seven.utilization),
      reset: formatReset(sevenReset),
      ...windowMeta(sevenReset, { period: "weekly" }),
    },
    scoped,
    tokenExpires: "session",
  };
}
