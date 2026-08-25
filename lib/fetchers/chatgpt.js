import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readJsonCred } from "../paths.js";
import { formatAsof, formatReset, jwtExpiryDate, parseResetDate, windowMeta } from "../time.js";
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
