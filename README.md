# Usage Dashboard

Self-hostable single-page dashboard for Kimi, Claude, Cursor, ChatGPT, MiniMax, and Grok quota usage.

```
+------------------+------------------+------------------+
|                  | Claude usage     | Cursor usage     |
|  Kimi quota      |                  |                  |
|  (tall)          +------------------+------------------+
|                  | ChatGPT usage    | MiniMax quota    |
|                  |                  |                  |
+------------------+------------------+------------------+
```

Cards are **draggable** and **resizable**; layout is saved in `localStorage`.

## Quick start

Requires **Node.js 18+**.

1. Put credentials in `~/.quota-watch/` (preferred):

```
~/.quota-watch/kimi-token.txt
~/.quota-watch/claude.json
~/.quota-watch/cursor.json
~/.quota-watch/chatgpt.json
~/.quota-watch/minimax.json
~/.quota-watch/grok.json
```

Templates live in [`credentials/`](credentials/). For how to obtain or refresh tokens (DevTools or browser automation), see the agent skill:

[`.cursor/skills/refetch-quota-credentials/SKILL.md`](.cursor/skills/refetch-quota-credentials/SKILL.md)

2. Start the server:

```bash
npm start
```

Open [http://localhost:3847](http://localhost:3847).

The server refreshes all providers every **15 minutes**, serves the dashboard from `public/`, and exposes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Cached provider payloads |
| `/api/refresh` | POST | Trigger an immediate refresh of all providers |
| `/api/refresh/:provider` | POST | Refresh one provider (`kimi`, `claude`, `cursor`, `chatgpt`, `minimax`, `grok`) |

Optional env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3847` | HTTP port |
| `QUOTA_WATCH_CRED_DIR` | `~/.quota-watch` (if present) else `./credentials` | Credential directory |
| `QUOTA_WATCH_TZ` | `Europe/Warsaw` | Timestamp timezone |
| `QUOTA_WATCH_INTERVAL_MS` | `900000` | Refresh interval |

## Credentials

### Kimi (`kimi.json` preferred; `kimi-token.txt` legacy)
```json
{
  "accessToken": "eyJ…",
  "refreshToken": "eyJ…"
}
```
- **accessToken** (~15 min): from `localStorage.access_token` on https://www.kimi.com, or `Authorization: Bearer` on a `MembershipService` request
- **refreshToken** (~90 days): from `localStorage.refresh_token` — required so the server can rotate access tokens automatically
- Legacy `kimi-token.txt` (access JWT only) still works until it expires; without a refresh token the card will go stale after ~15 minutes

### Claude (`claude.json`)
```json
{
  "cookies": "sessionKey=...; otherCookie=...",
  "orgId": "your-org-uuid"
}
```
- `cookies`: copy cookies from a logged-in https://claude.ai request
- `orgId`: from `https://claude.ai/api/organizations/{orgId}/usage`

### Cursor (`cursor.json`)
```json
{
  "cookie": "WorkosCursorSessionToken=..."
}
```
- Session cookie from a logged-in https://cursor.com request (HttpOnly — copy from Network headers)

### ChatGPT (`chatgpt.json`)
```json
{
  "bearer": "eyJhbGci...",
  "deviceId": "uuid-here",
  "sessionCookie": "__Secure-next-auth.session-token=..."
}
```
- `bearer`: JWT from `Authorization`
- `deviceId`: from `oai-device-id`
- `sessionCookie`: optional; full session cookie if needed

On HTTP 401 the dashboard shows a **Token expired** banner instead of crashing.

### MiniMax (`minimax.json`)
```json
{
  "token": "eyJhbGci...",
  "groupId": "your-group-id"
}
```
- `token`: JWT from `_token` cookie on https://platform.minimax.io
- `groupId`: from `x-group-id`

### Grok (`grok.json`)
```json
{
  "sso": "your-sso-cookie-value",
  "plan": "SuperGrok Lite"
}
```
- `sso`: value of the `sso` cookie from a logged-in https://grok.com request
- `plan`: optional display label
- The fetcher calls Grok's private gRPC-Web `GetGrokCreditsConfig` endpoint. It does not need the analytics, Stripe, or Cloudflare cookies included by DevTools' **Copy as cURL**.

## Project layout

```
server.js              # static file server + refresh loop
lib/paths.js           # credential path resolution
lib/time.js            # timezone helpers
lib/fetchers/          # provider API clients
public/                # single-page dashboard
credentials/           # templates only (gitignored secrets)
.cursor/skills/        # agent skill for refetching credentials
ubersicht/             # macOS desktop widget (Übersicht)
automations/           # original Python automations (reference)
```

## macOS desktop widget

The same cards can render straight onto the desktop via
[Übersicht](https://tracesof.net/uebersicht/) — see
[`ubersicht/README.md`](ubersicht/README.md). It reads the same `/api/status`
endpoint, so the server needs to be running either way.

The `automations/` folder is kept as the original Kimi Canvas migration pack. The runnable app is the Node server + `public/` page.
