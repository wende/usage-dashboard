# Usage Dashboard

Self-hostable single-page dashboard for Kimi, Claude, Cursor, ChatGPT, and MiniMax quota usage.

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
| `/api/refresh` | POST | Trigger an immediate refresh |

Optional env vars:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3847` | HTTP port |
| `QUOTA_WATCH_CRED_DIR` | `~/.quota-watch` (if present) else `./credentials` | Credential directory |
| `QUOTA_WATCH_TZ` | `Europe/Warsaw` | Timestamp timezone |
| `QUOTA_WATCH_INTERVAL_MS` | `900000` | Refresh interval |

## Credentials

### Kimi (`kimi-token.txt`)
- Log in to https://www.kimi.com
- Open DevTools → Network → find any request to `MembershipService`
- Copy the JWT from `Authorization: Bearer <token>` (token only, no `Bearer ` prefix)

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

## Project layout

```
server.js              # static file server + refresh loop
lib/paths.js           # credential path resolution
lib/time.js            # timezone helpers
lib/fetchers/          # provider API clients
public/                # single-page dashboard
credentials/           # templates only (gitignored secrets)
.cursor/skills/        # agent skill for refetching credentials
widgets/               # original Kimi Canvas widgets (reference)
automations/           # original Python automations (reference)
```

The `widgets/` and `automations/` folders are kept as the original Kimi Canvas migration pack. The runnable app is the Node server + `public/` page.
