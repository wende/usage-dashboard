import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT } from "./lib/paths.js";
import { fetchKimi } from "./lib/fetchers/kimi.js";
import { fetchClaude } from "./lib/fetchers/claude.js";
import { fetchCursor } from "./lib/fetchers/cursor.js";
import { fetchChatgpt } from "./lib/fetchers/chatgpt.js";
import { fetchMinimax } from "./lib/fetchers/minimax.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 3847);
const REFRESH_MS = Number(process.env.QUOTA_WATCH_INTERVAL_MS || 15 * 60 * 1000);

const PROVIDERS = {
  kimi: fetchKimi,
  claude: fetchClaude,
  cursor: fetchCursor,
  chatgpt: fetchChatgpt,
  minimax: fetchMinimax,
};

/** @type {Record<string, { status: string, data: object|null, error?: string, updatedAt?: string }>} */
const cache = Object.fromEntries(
  Object.keys(PROVIDERS).map((k) => [k, { status: "pending", data: null }])
);

let refreshing = false;

async function refreshOne(name) {
  const fn = PROVIDERS[name];
  try {
    const data = await fn();
    cache[name] = {
      status: "ok",
      data,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    const prev = cache[name];
    cache[name] = {
      status: "error",
      data: prev?.data ?? null,
      error: err.message || String(err),
      updatedAt: new Date().toISOString(),
    };
    console.error(`[${name}]`, err.message || err);
  }
}

export async function refreshAll() {
  if (refreshing) return cache;
  refreshing = true;
  for (const name of Object.keys(PROVIDERS)) {
    cache[name] = { ...cache[name], status: "running" };
  }
  try {
    await Promise.all(Object.keys(PROVIDERS).map(refreshOne));
  } finally {
    refreshing = false;
  }
  return cache;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC, safe);
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];

  if (req.method === "GET" && url === "/api/status") {
    sendJson(res, 200, {
      refreshing,
      providers: cache,
    });
    return;
  }

  if (req.method === "POST" && url === "/api/refresh") {
    refreshAll().catch((err) => console.error("refresh failed", err));
    sendJson(res, 202, { ok: true, refreshing: true });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`AI Quota Watch → http://localhost:${PORT}`);
  refreshAll().catch((err) => console.error("initial refresh failed", err));
  setInterval(() => {
    refreshAll().catch((err) => console.error("interval refresh failed", err));
  }, REFRESH_MS);
});
