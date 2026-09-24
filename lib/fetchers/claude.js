import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readJsonCred, credPath } from "../paths.js";
import { UA, formatAsof, formatReset, formatResetTime, parseIso, windowMeta } from "../time.js";
import { pct, requestJson } from "./common.js";
import { StaleError } from "../errors.js";

const execFileP = promisify(execFile);

// Cloudflare 403s Node's TLS fingerprint from some IPs (the Mac Studio) while
// python urllib passes with the same cookies. Last-resort fetch via python.
async function fetchViaPython(url) {
  const script = `
import json, sys, urllib.request
cred = json.load(open(sys.argv[2]))
req = urllib.request.Request(sys.argv[1], headers={
    "cookie": cred["cookies"],
    "user-agent": ${JSON.stringify(UA)},
    "accept": "*/*",
})
with urllib.request.urlopen(req, timeout=30) as r:
    sys.stdout.write(r.read().decode("utf-8"))
`;
  const { stdout } = await execFileP(
    "python3",
    ["-c", script, url, credPath("claude.json")],
    { timeout: 40000, maxBuffer: 10 * 1024 * 1024 }
  );
  return JSON.parse(stdout);
}

export async function fetchClaudeWith(fetchPrimary, fetchFallback) {
  let data;
  try {
    data = await fetchPrimary();
  } catch (err) {
    if (!(err instanceof StaleError)) throw err;
    data = await fetchFallback();
  }
  return mapUsage(data);
}

function mapUsage(data) {

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

export async function fetchClaude() {
  const cred = readJsonCred("claude.json");
  const url = `https://claude.ai/api/organizations/${cred.orgId}/usage`;
  return fetchClaudeWith(
    () =>
      requestJson("claude", url, {
        headers: {
          accept: "*/*",
          "content-type": "application/json",
          cookie: cred.cookies,
          referer: "https://claude.ai/new",
        },
      }),
    () => fetchViaPython(url)
  );
}
