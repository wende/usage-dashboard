import { readJsonCred } from "../paths.js";
import { UA, formatAsof, jwtExpiryDate, LOCAL_TZ } from "../time.js";

const API_URL = "https://chatgpt.com/backend-api/wham/usage";

function formatResetFromUnix(resetAt) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LOCAL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(Number(resetAt) * 1000));
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export async function fetchChatgpt() {
  const cred = readJsonCred("chatgpt.json");
  const token = cred.bearer;

  const res = await fetch(API_URL, {
    method: "GET",
    headers: {
      accept: "*/*",
      authorization: "Bearer " + token,
      "oai-device-id": cred.deviceId,
      "oai-language": "en-US",
      referer: "https://chatgpt.com/",
      "user-agent": UA,
      ...(cred.sessionCookie ? { cookie: cred.sessionCookie } : {}),
    },
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 401) {
    return {
      asof: formatAsof(),
      tokenExpired: true,
      tokenExpires: jwtExpiryDate(token),
      weekly: { pct: 0, reset: "" },
      plan: "unknown",
    };
  }

  if (!res.ok) {
    throw new Error(`chatgpt request failed: HTTP ${res.status}`);
  }

  const data = await res.json();
  const rate = data.rate_limit || {};
  const primary = rate.primary_window || {};
  const resetAt = primary.reset_at;
  const resetLabel = resetAt ? formatResetFromUnix(resetAt) : "unknown";

  const planType = data.plan_type || "unknown";
  const plan =
    planType.charAt(0).toUpperCase() + planType.slice(1).toLowerCase();

  return {
    asof: formatAsof(),
    weekly: {
      pct: Math.round(Number(primary.used_percent || 0) * 100) / 100,
      reset: "resets " + resetLabel,
    },
    plan,
    tokenExpires: jwtExpiryDate(token),
  };
}
