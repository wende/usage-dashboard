import { UA } from "../time.js";
import { StaleError } from "../errors.js";

export async function request(name, url, {
  method = "GET",
  headers = {},
  body,
  staleStatuses = [401, 403],
  staleNote = "session rejected",
} = {}) {
  const res = await fetch(url, {
    method,
    headers: { "user-agent": UA, ...headers },
    body,
    signal: AbortSignal.timeout(30000),
  });
  if (staleStatuses.includes(res.status)) {
    throw new StaleError(`${name} ${staleNote} (HTTP ${res.status})`);
  }
  if (!res.ok) {
    throw new Error(`${name} request failed: HTTP ${res.status}`);
  }
  return res;
}

export async function requestJson(name, url, opts) {
  return (await request(name, url, opts)).json();
}

export function pct(value) {
  if (value == null) return 0;
  if (typeof value !== "number") {
    value = Number(String(value).replace("%", "").trim() || 0);
  }
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function titleCase(s) {
  s = String(s || "");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
