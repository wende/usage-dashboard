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

/** resets MM-DD HH:MM */
export function formatReset(date) {
  return "resets " + formatShort(date);
}

/** resets HH:MM (use for windows that always reset the same day, e.g. 5-hour). */
export function formatResetTime(date) {
  if (!date) return "unknown";
  const parts = formatter({
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return "resets " + get("hour") + ":" + get("minute");
}

export function parseIso(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).replace("Z", "+00:00"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Tolerant reset-date parser: ISO string, epoch seconds, or epoch ms. */
export function parseResetDate(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (Number.isFinite(n)) {
    // ponytail: 1e12 separates epoch s from ms; wrong only for pre-2001 epoch-ms APIs
    const d = new Date(n < 1e12 ? n * 1000 : n);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseIso(value);
}

export function toIso(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Infer period start when the API only gives a reset instant. */
export function inferPeriodStart(resetDate, period = "weekly") {
  if (!resetDate || Number.isNaN(resetDate.getTime())) return null;
  if (period === "monthly") {
    const start = new Date(resetDate.getTime());
    const day = start.getUTCDate();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 1);
    const last = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)
    ).getUTCDate();
    start.setUTCDate(Math.min(day, last));
    return start;
  }
  if (period === "fiveHour") {
    return new Date(resetDate.getTime() - 5 * 60 * 60 * 1000);
  }
  return new Date(resetDate.getTime() - 7 * 24 * 60 * 60 * 1000);
}

export function windowMeta(resetDate, { startDate, period } = {}) {
  const start = startDate || inferPeriodStart(resetDate, period || "weekly");
  return {
    resetAt: toIso(resetDate),
    startAt: toIso(start),
  };
}

export function elapsedPct(startAt, resetAt, now = Date.now()) {
  const start = startAt instanceof Date ? startAt.getTime() : Date.parse(startAt);
  const end = resetAt instanceof Date ? resetAt.getTime() : Date.parse(resetAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const t = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100));
}

/** First future (short) cell. 58% of 40 cells → index 23; 100% → 40 (none). */
export function paceCell(cells, pacePct) {
  if (pacePct == null || !Number.isFinite(pacePct) || cells <= 0) return -1;
  const p = Math.max(0, Math.min(100, pacePct));
  return Math.round((cells * p) / 100);
}

/** Base64url pad length in [0, 3]. JS `%` is sign-following, so do not use `(-n) % 4`. */
export function base64UrlPadLen(len) {
  return (4 - (len % 4)) % 4;
}

/** JWT exp claim as epoch ms, or null when unreadable/missing. */
export function jwtExpMs(token) {
  try {
    const payload = token.split(".")[1];
    const padded = payload + "=".repeat(base64UrlPadLen(payload.length));
    const claims = JSON.parse(Buffer.from(padded, "base64url").toString("utf8"));
    return claims.exp ? claims.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function jwtExpiryDate(token) {
  const ms = jwtExpMs(token);
  return ms ? formatDate(new Date(ms)) : "unknown";
}

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36";
