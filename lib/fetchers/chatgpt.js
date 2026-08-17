import { readJsonCred } from "../paths.js";
import { formatAsof, formatReset, jwtExpiryDate, parseResetDate, windowMeta } from "../time.js";
import { pct, requestJson, titleCase } from "./common.js";

const API_URL = "https://chatgpt.com/backend-api/wham/usage";

export async function fetchChatgpt() {
  const cred = readJsonCred("chatgpt.json");

  const data = await requestJson("chatgpt", API_URL, {
    headers: {
      accept: "*/*",
      authorization: "Bearer " + cred.bearer,
      "oai-device-id": cred.deviceId,
      "oai-language": "en-US",
      referer: "https://chatgpt.com/",
      ...(cred.sessionCookie ? { cookie: cred.sessionCookie } : {}),
    },
    staleStatuses: [401],
    staleNote: "bearer token rejected",
  });

  const primary = data.rate_limit?.primary_window || {};
  const resetDate = parseResetDate(primary.reset_at);

  return {
    asof: formatAsof(),
    // ponytail: never computed today (frontends' banner branch is unreachable);
    // compute from jwtExpMs if the expired banner is ever wanted
    tokenExpired: false,
    weekly: {
      pct: pct(primary.used_percent),
      reset: formatReset(resetDate),
      ...windowMeta(resetDate, { period: "weekly" }),
    },
    plan: titleCase(data.plan_type || "unknown"),
    tokenExpires: jwtExpiryDate(cred.bearer),
  };
}
