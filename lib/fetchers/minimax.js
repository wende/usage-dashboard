import { readJsonCred } from "../paths.js";
import { formatAsof, formatReset, jwtExpiryDate, parseResetDate, windowMeta } from "../time.js";
import { pct, requestJson } from "./common.js";

const API_URL =
  "https://platform.minimax.io/backend/account/token_plan/remains_percent";

export async function fetchMinimax() {
  const cred = readJsonCred("minimax.json");

  const data = await requestJson("minimax", API_URL, {
    headers: {
      accept: "application/json, text/plain, */*",
      cookie: "_token=" + cred.token,
      "x-group-id": cred.groupId,
      referer: "https://platform.minimax.io/console/usage",
    },
    staleNote: "token rejected",
  });

  const models = data.model_remains || [];
  const general =
    models.find((m) => m.model_name === "general") || models[0] || null;
  if (!general) {
    throw new Error(`no model quota in response: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return {
    asof: formatAsof(),
    weekly: {
      pct: pct(general.current_weekly_used_percent),
      reset: formatReset(parseResetDate(general.weekly_end_time)),
      ...windowMeta(parseResetDate(general.weekly_end_time), { period: "weekly" }),
    },
    window: {
      pct: pct(general.current_interval_used_percent),
      reset: formatReset(parseResetDate(general.end_time)),
    },
    tokenExpires: jwtExpiryDate(cred.token),
  };
}
