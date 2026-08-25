import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readJsonCred } from "../paths.js";
import { formatAsof, formatReset, formatResetTime, jwtExpiryDate, parseResetDate, windowMeta } from "../time.js";
import { pct, titleCase } from "./common.js";

const execFileP = promisify(execFile);
const API_URL = "https://chatgpt.com/backend-api/wham/usage";

// ponytail: chatgpt.com blocks undici's TLS fingerprint (Node fetch → 401 even with
// a valid bearer). Curl with a LibreSSL/AppleTLS fingerprint is accepted, so chatgpt
// alone shells out to curl instead of using fetch. Upgrade when chatgpt stops
// fingerprint-blocking (e.g. add a tls-client dep).
async function curlJson(url, headers) {
  const args = ["-sS", "-m", "30", url];
  for (const [k, v] of Object.entries(headers)) {
    args.push("-H", `${k}: ${v}`);
  }
  const { stdout, stderr } = await execFileP("curl", args);
  if (stderr && /curl: \(/.test(stderr)) throw new Error(stderr.trim());
  return JSON.parse(stdout);
}

export async function fetchChatgpt() {
  const cred = readJsonCred("chatgpt.json");

  let data;
  try {
    data = await curlJson(API_URL, {
      accept: "*/*",
      authorization: "Bearer " + cred.bearer,
      "oai-device-id": cred.deviceId,
      "oai-language": "en-US",
      referer: "https://chatgpt.com/",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      ...(cred.sessionCookie ? { cookie: cred.sessionCookie } : {}),
    });
  } catch (err) {
    const msg = String(err?.message || err);
    const statusMatch = msg.match(/HTTP\s+(\d{3})/) || (msg.includes("401") ? ["", "401"] : null);
    const status = statusMatch ? Number(statusMatch[1]) : 0;
    if (status === 401) {
      const e = new Error("chatgpt bearer token rejected (HTTP 401)");
      e.code = "stale";
      throw e;
    }
    throw new Error(`chatgpt request failed: ${msg}`);
  }

  const rl = data.rate_limit || {};
  const { fiveHour, weekly } = parseChatgptRateLimit(rl);

  return {
    asof: formatAsof(),
    // ponytail: never computed today (frontends' banner branch is unreachable);
    // compute from jwtExpMs if the expired banner is ever wanted
    tokenExpired: false,
    fiveHour,
    weekly,
    plan: titleCase(data.plan_type || "unknown"),
    tokenExpires: jwtExpiryDate(cred.bearer),
  };
}

// ponytail: identify the 5h vs weekly window by its length, not its slot name.
// OpenAI has swapped which slot carries which limit before; mapping by
// limit_window_seconds is robust to either ordering or a single window missing.
export function parseChatgptRateLimit(rl) {
  const FIVE_H = 5 * 60 * 60;
  const SEVEN_D = 7 * 24 * 60 * 60;
  const periodOf = (w) => {
    const s = w?.limit_window_seconds;
    if (s === FIVE_H) return "fiveHour";
    if (s === SEVEN_D) return "weekly";
    return null;
  };
  const slots = { fiveHour: null, weekly: null };
  for (const w of [rl?.primary_window, rl?.secondary_window]) {
    const p = periodOf(w);
    if (p) slots[p] = w;
  }

  const build = (w, period) => {
    if (!w) return null;
    const resetDate = parseResetDate(w.reset_at);
    const fmt = period === "fiveHour" ? formatResetTime : formatReset;
    return {
      pct: pct(w.used_percent),
      reset: fmt(resetDate),
      ...windowMeta(resetDate, { period }),
    };
  };

  return { fiveHour: build(slots.fiveHour, "fiveHour"), weekly: build(slots.weekly, "weekly") };
}
