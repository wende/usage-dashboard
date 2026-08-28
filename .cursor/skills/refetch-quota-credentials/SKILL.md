---
name: refetch-quota-credentials
description: >-
  Refresh AI Usage Dashboard provider credentials (Kimi, Claude, Cursor,
  ChatGPT, MiniMax, Grok) via DevTools or browser automation. Use when quota cards
  show stale/expired/401, or the user asks to refetch tokens or cookies.
---

# Refetch Quota Credentials

Credentials live in `~/.quota-watch/` (preferred) or `./credentials/`.
Never commit real secrets — only `*.template` files belong in git.

After updating files, trigger a refresh:

```bash
curl -s -X POST http://localhost:3847/api/refresh
```

Or restart `npm start`.

## Credential files

| Provider | File | Fields |
|----------|------|--------|
| Kimi | `kimi.json` (preferred) | `accessToken`, `refreshToken` (both JWTs) |
| Kimi | `kimi-token.txt` (legacy) | access JWT only — **cannot** auto-refresh; expires ~15 min |
| Claude | `claude.json` | `cookies`, `orgId` |
| Cursor | `cursor.json` | `cookie` = `WorkosCursorSessionToken=...` |
| ChatGPT | `chatgpt.json` | `bearer`, `deviceId`, optional `sessionCookie` |
| MiniMax | `minimax.json` | `token` (JWT from `_token`), `groupId` |
| GLM | `glm.json` | `apiKey` (Z.ai key from https://z.ai/manage-apikey) |
| Grok | `grok.json` | `sso`, optional `plan` |

`chmod 600` credential files after writing.

## Manual harvest (always works)

1. Sign in to the provider site in a normal browser.
2. DevTools → **Network**.
3. Reload or open the usage/billing page.
4. Pick an authenticated API request and copy:

### Kimi — https://www.kimi.com
- **Always harvest both tokens.** Access JWT is ~**15 minutes**; refresh JWT is ~**90 days**. The fetcher auto-rotates access via refresh.
- Write **`~/.quota-watch/kimi.json`**:
  ```json
  { "accessToken": "<jwt>", "refreshToken": "<jwt>" }
  ```
  Also write access-only to `kimi-token.txt` for legacy tools (fetcher does this on refresh).
- Manual: `MembershipService` → `Authorization: Bearer` is the **access** JWT only — still grab `localStorage.refresh_token`.
- Verify quota:  
  `POST https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats`  
  body `{}`, `Authorization: Bearer <access>`, expect **200** + `subscriptionBalance`
- Auto-refresh endpoint used by `lib/fetchers/kimi.js`:  
  `POST https://auth.kimi.com/api/account.gateway.v1.AuthService/RefreshToken`  
  body `{ "refresh_token": "<refresh jwt>" }` → `{ accessToken, refreshToken }` (persist **both**; refresh may rotate)

**Faster agent method (WebBridge, verified 2026-08-10):** once on `https://www.kimi.com` (any app page; membership/quota works) and logged in, **skip network sniffing**:

```js
// evaluate
JSON.stringify({
  accessToken: localStorage.getItem("access_token"),
  refreshToken: localStorage.getItem("refresh_token"),
})
```

Write `kimi.json` (mode 600). Confirm only HTTP status + non-secret fields (usage %). Decode JWT `typ`: access must be `"access"`, refresh `"refresh"`.

**Kimi pitfalls (do not waste time on these):**

| Dead end | Why | Do instead |
|----------|-----|------------|
| Saving **only** `access_token` / `kimi-token.txt` | Access JWT lifetime is **exactly ~15 min** (`exp - iat = 900s`) | Always save `refresh_token` in `kimi.json` |
| WebBridge `network detail` on MembershipService | Returns **response body only** — no `Authorization` headers | `localStorage.access_token` + `refresh_token` |
| Decrypt Dia/Chrome cookie `kimi-auth` | Cookie often holds an **already-expired** access JWT while UI still looks logged in | **localStorage**, not the cookie DB |
| `document.cookie` / `kimi-auth` | Not exposed to page JS | `localStorage` |
| Using refresh JWT as Bearer on membership API | 401 `token type mismatch: got "refresh", want "access"` | Bearer = access only; refresh only via AuthService/RefreshToken |
| Cookie-only API call without Bearer | 401 `REASON_INVALID_AUTH_TOKEN` | `Authorization: Bearer <access_token>` |

WebBridge bootstrap: if `status` has `running: false`, run `kimi-webbridge start`. If `extension_connected: false`, wait for the user’s browser with the extension open (poll status) — do not invent Playwright login.

### Claude — https://claude.ai
- Any `claude.ai` API request → full `Cookie` header → `cookies`
- URL like `/api/organizations/{orgId}/usage` → `orgId`

### Cursor — https://cursor.com/dashboard
- Request to `/api/usage-summary`
- Cookie `WorkosCursorSessionToken=...` → entire `cookie` string value in JSON  
  (`WorkosCursorSessionToken` is **HttpOnly** — copy from Network request headers, not `document.cookie`)

### ChatGPT — https://chatgpt.com
- Request to `/backend-api/`…
- `Authorization: Bearer <jwt>` → `bearer`
- `oai-device-id` → `deviceId`
- Optional `__Secure-next-auth.session-token=...` → `sessionCookie`

**Faster agent method (WebBridge, verified 2026-08):** once on chatgpt.com and logged in,
skip network sniffing entirely:
- `evaluate`: `(await (await fetch("/api/auth/session")).json()).accessToken` → `bearer`
- `evaluate`: `document.cookie.match(/oai-did=([^;]+)/)[1]` → `deviceId`
- Keep the existing `sessionCookie` from the old `chatgpt.json` if present.
- Verify with `curl https://chatgpt.com/backend-api/wham/usage` + `Authorization: Bearer …`
  + `oai-device-id: …` — expect **200**. (Note: `/api/auth/session` and `/backend-api/settings/user`
  return 403 to curl even with a valid token — only trust the wham/usage check.)

**Critical pitfall — TLS fingerprint blocks the Node fetcher (2026-08-24):** chatgpt.com
returns `401 token_expired` to Node undici `fetch` even with a freshly-harvested, valid
bearer. The same bearer via `curl` or Python `urllib` returns `200`. `lib/fetchers/chatgpt.js`
now shells out to `/usr/bin/curl` (LibreSSL fingerprint passes). Symptom: dashboard says
`chatgpt stale` right after a "successful" refresh; `node -e "fetch(...)"` returns 401
while `curl` with identical headers returns 200.

| Verification | Expectation |
|--------------|-------------|
| `curl -sS -m 30 https://chatgpt.com/backend-api/wham/usage` + Bearer | `200` (use this as ground truth) |
| `node -e "fetch(...wham/usage...)"` + same Bearer | `401 token_expired` (fingerprint block, NOT a real failure) |
| `/api/status` after restart + `/api/refresh/chatgpt` | `status=ok`, `plan=Plus` |

So **never** declare a refresh successful based on a Node `fetch` round-trip alone —
curl, or restart the server and check `/api/status`. If the fetcher itself fails with
`401 token_expired` even though curl works, the chatgpt fetcher code regressed; re-apply
the `execFile("curl", …)` pattern from `lib/fetchers/chatgpt.js`.

**Restart the server after any fetcher edit.** `node server.js` caches imported modules
in memory; a stale fetcher keeps reading the old code path until restart. After editing
`lib/fetchers/chatgpt.js` (or any fetcher), kill the running server and `npm start` again
before testing via `/api/status`.

**`sessionCookie` from disk can silently rot.** `__Secure-next-auth.session-token` is
HttpOnly, so the agent can't refresh it from page JS — only the browser session
re-rotates it. If the saved cookie no longer matches the live browser session, `/api/auth/session`
from Node with that cookie returns `403` HTML (not a JSON 401). Re-harvest by signing
out and back in to chatgpt.com in the browser, or skip the field — `lib/fetchers/chatgpt.js`
only sends `cookie:` if `cred.sessionCookie` is non-empty.

### MiniMax — https://platform.minimax.io/console/usage
- Cookie `_token=<jwt>` → `token` (jwt only)
- Header `x-group-id` → `groupId`

### Grok — https://grok.com/?_s=usage
- Find `grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig` in Network.
- Copy only the value of the `sso` cookie into `grok.json`; analytics, Stripe, and Cloudflare cookies are not needed.
- The request is gRPC-Web protobuf with an empty message. Verify via `POST /api/refresh/grok` and check the Grok card.

### GLM — https://z.ai/manage-apikey
- No network sniffing needed: copy the API key shown on the manage-apikey page into `glm.json`.
- Verify the key: `curl -s -H "Authorization: Bearer <key>" https://api.z.ai/api/monitor/usage/quota/limit` → expect `success:true` with a `data.limits` array.

## Automated harvest (agent)

Prefer the user's **already logged-in** browser. Fresh Playwright profiles usually fail (2FA/CAPTCHA).

### Option A — Kimi WebBridge (real browser session)

1. Health check: `~/.kimi-webbridge/bin/kimi-webbridge status`  
   Need `running: true` and `extension_connected: true`.  
   - `running: false` → `~/.kimi-webbridge/bin/kimi-webbridge start`  
   - `extension_connected: false` → user must open the browser with the WebBridge extension; poll status (do not loop forever — ask the user).
2. Navigate (new tab) to the provider usage page, **session name per site** (e.g. `"session":"kimi-token"`).
3. Confirm login via `list_tabs` / `snapshot` (not a sign-in URL). Logged-in Kimi shows app chrome (New Chat, sidebar), not a login form.
4. Harvest credentials — **prefer site-specific evaluate** (see ChatGPT / Kimi sections above) over network capture.
5. Network capture is a fallback only:
   - `network start` → reload / hit usage API → `network list` → `network detail`.
   - **WebBridge `network detail` often omits request headers** (Authorization / Cookie). If detail has only `body`/`status`, stop and use evaluate / Option B.
   - Cursor’s `WorkosCursorSessionToken` is **HttpOnly** — evaluate/cookie JS will fail; use Option B.
6. Write `~/.quota-watch/...`, `chmod 600`, call `/api/refresh`.
7. `close_session` when done. Wipe any temp files that held JWTs (`/tmp/...`).

If the tab is on a sign-in page, ask the user to sign in, then continue.

### Option B — Decrypt Chromium cookie DB (HttpOnly)

Used successfully for **Cursor** in Dia (`WorkosCursorSessionToken`).

For **Kimi**, cookie decrypt of `kimi-auth` is **unreliable as a refresh path**: the cookie JWT can already be expired while `localStorage.access_token` is still valid (or freshly rotated). Prefer WebBridge evaluate. Only decrypt Kimi cookies if WebBridge is unavailable **and** you immediately check JWT `exp`.

1. Locate the browser profile that is logged in (WebBridge extension path often reveals it), e.g.  
   `~/Library/Application Support/Dia/User Data/Default/Cookies`
2. Copy the SQLite DB to a temp file (browser may lock the original).
3. Read `encrypted_value` for the target cookie name.
4. On macOS, get the safe-storage password from Keychain, e.g.  
   `security find-generic-password -s "Dia Safe Storage" -w`  
   (Chrome uses `"Chrome Safe Storage"`.)
5. Derive key: PBKDF2-HMAC-SHA1, password, salt `saltysalt`, **1003** iterations, 16-byte key.
6. AES-128-CBC decrypt `encrypted_value[3:]` when prefix is `v10`, IV = 16 spaces.
7. Strip PKCS#7 padding, then strip the leading **32-byte** Chromium host-hash prefix.
8. Remaining UTF-8 is the cookie value. Prefix `WorkosCursorSessionToken=` for `cursor.json`.
9. **Verify** with a live request before declaring success (and for JWTs, decode `exp` first):

```bash
# Cursor: expect HTTP 200 from usage-summary when cookie is valid
# Kimi: expect HTTP 200 from MembershipService/GetSubscriptionStats with Bearer token
```

Do **not** print tokens/cookies in chat logs. Confirm only status codes and non-secret fields (plan name, percentages).

### Option C — Playwright

Only if WebBridge is unavailable. Use a persistent context / existing user-data-dir for a profile that is already logged in. Do not attempt password login unless the user explicitly provides credentials and 2FA is handled by them.

## Validation checklist

After writing credentials:

1. `POST /api/refresh`
2. `GET /api/status` → provider `status` is `ok` (or ChatGPT `tokenExpired` banner path)
3. Dashboard live-dot shows a time, not `stale` / `expired`

**ChatGPT-only:** always cross-check via `curl` after a refresh. The Node fetcher's
TLS fingerprint gets blocked by chatgpt.com (`401 token_expired` on a valid bearer),
so a clean `/api/status` is the proof, but if it shows `stale`, debug with curl before
touching the creds file — see the ChatGPT section. If the fetcher code itself is the
suspect (e.g. after an edit), restart `node server.js` so the new fetcher module loads.

## Safety

- Never commit `~/.quota-watch/*` or `credentials/*.{json,txt}` (non-template).
- Never echo full JWTs or cookie strings into the conversation.
- Treat harvested sessions as passwords.
