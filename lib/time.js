export const LOCAL_TZ = process.env.QUOTA_WATCH_TZ || "Europe/Warsaw";

const fmtCache = new Map();

function formatter(options) {
  const key = JSON.stringify(options);
  if (!fmtCache.has(key)) {
    fmtCache.set(key, new Intl.DateTimeFormat("en-CA", { timeZone: LOCAL_TZ, ...options }));
  }
  return fmtCache.get(key);
}

export function nowLocal() {
  return new Date();
}

/** YYYY-MM-DD HH:MM in local TZ */
export function formatAsof(date = nowLocal()) {
  const parts = formatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** YYYY-MM-DD */
export function formatDate(date) {
  if (!date) return "unknown";
  const parts = formatter({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** MM-DD HH:MM */
export function formatShort(date) {
  if (!date) return "unknown";
  const parts = formatter({
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function parseIso(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).replace("Z", "+00:00"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function jwtExpiryDate(token) {
  try {
    const payload = token.split(".")[1];
    const padded = payload + "=".repeat((-payload.length) % 4);
    const claims = JSON.parse(Buffer.from(padded, "base64url").toString("utf8"));
    if (!claims.exp) return "unknown";
    return formatDate(new Date(claims.exp * 1000));
  } catch {
    return "unknown";
  }
}

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
