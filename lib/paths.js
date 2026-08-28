import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");

function hasRealCreds(dir) {
  try {
    return (
      fs.existsSync(path.join(dir, "claude.json")) ||
      fs.existsSync(path.join(dir, "cursor.json")) ||
      fs.existsSync(path.join(dir, "grok.json")) ||
      fs.existsSync(path.join(dir, "kimi.json")) ||
      fs.existsSync(path.join(dir, "kimi-token.txt")) ||
      fs.existsSync(path.join(dir, "glm.json")) ||
      fs.existsSync(path.join(dir, "token.txt"))
    );
  } catch {
    return false;
  }
}

export function credDir() {
  if (process.env.QUOTA_WATCH_CRED_DIR) {
    return path.resolve(process.env.QUOTA_WATCH_CRED_DIR);
  }
  const homeDir = path.join(os.homedir(), ".quota-watch");
  if (hasRealCreds(homeDir)) return homeDir;
  return path.join(ROOT, "credentials");
}

export function credPath(...parts) {
  return path.join(credDir(), ...parts);
}

export function readJsonCred(filename) {
  const full = credPath(filename);
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch (err) {
    throw new Error(`${filename} unreadable at ${full}: ${err.message}`);
  }
}

export function readTextCred(filename) {
  const candidates =
    filename === "kimi-token.txt"
      ? ["kimi-token.txt", "token.txt"]
      : [filename];
  let lastErr;
  for (const name of candidates) {
    const full = credPath(name);
    try {
      return fs.readFileSync(full, "utf8").trim();
    } catch (err) {
      lastErr = err;
    }
  }
  const full = credPath(filename);
  throw new Error(
    `${filename} unreadable at ${full}: ${lastErr?.message || "not found"}`
  );
}

/** Write JSON credentials with mode 600. Never log contents. */
export function writeJsonCred(filename, obj) {
  const full = credPath(filename);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(obj, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(full, 0o600);
  } catch {
    // best-effort on platforms that ignore mode on write
  }
  return full;
}

/** Write a text credential file with mode 600. Never log contents. */
export function writeTextCred(filename, text) {
  const full = credPath(filename);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, String(text).trim() + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    fs.chmodSync(full, 0o600);
  } catch {
    // best-effort
  }
  return full;
}
