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
| Kimi | `kimi-token.txt` | raw JWT (no `Bearer `) |
| Claude | `claude.json` | `cookies`, `orgId` |
| Cursor | `cursor.json` | `cookie` = `WorkosCursorSessionToken=...` |
| ChatGPT | `chatgpt.json` | `bearer`, `deviceId`, optional `sessionCookie` |
| MiniMax | `minimax.json` | `token` (JWT from `_token`), `groupId` |
| Grok | `grok.json` | `sso`, optional `plan` |

`chmod 600` credential files after writing.

## Manual harvest (always works)

1. Sign in to the provider site in a normal browser.
2. DevTools → **Network**.
3. Reload or open the usage/billing page.
4. Pick an authenticated API request and copy:

### Kimi — https://www.kimi.com
- Request containing `MembershipService`
- Header `Authorization: Bearer <jwt>` → write **jwt only** to `kimi-token.txt`

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

### MiniMax — https://platform.minimax.io/console/usage
- Cookie `_token=<jwt>` → `token` (jwt only)
- Header `x-group-id` → `groupId`

### Grok — https://grok.com/?_s=usage
- Find `grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig` in Network.
- Copy only the value of the `sso` cookie into `grok.json`; the other cookies from **Copy as cURL** are unnecessary.
- The request is gRPC-Web protobuf with an empty message. Verify via the dashboard or `POST /api/refresh/grok` rather than expecting readable JSON from curl.

## Automated harvest (agent)

Prefer the user's **already logged-in** browser. Fresh Playwright profiles usually fail (2FA/CAPTCHA).

### Option A — Kimi WebBridge (real browser session)

1. Health check: `~/.kimi-webbridge/bin/kimi-webbridge status`  
   Need `running: true` and `extension_connected: true`.
2. Navigate (new tab) to the provider usage page, session name per site.
3. Confirm login via `list_tabs` / `snapshot` (not a sign-in URL).
4. Start `network` capture → trigger the usage API → `network list` / `detail`.
5. If the token is **HttpOnly** (Cursor), Network detail may omit Cookie headers. Fall back to Option B.
6. Write `~/.quota-watch/...`, `chmod 600`, call `/api/refresh`.
7. `close_session` when done.

If the tab is on a sign-in page, ask the user to sign in, then continue.

### Option B — Decrypt Chromium cookie DB (HttpOnly)

Used successfully for **Cursor** in Dia (`WorkosCursorSessionToken`):

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
9. **Verify** with a live request before declaring success:

```bash
# expect HTTP 200 from usage-summary when cookie is valid
```

Do **not** print tokens/cookies in chat logs. Confirm only status codes and non-secret fields (plan name, percentages).

### Option C — Playwright

Only if WebBridge is unavailable. Use a persistent context / existing user-data-dir for a profile that is already logged in. Do not attempt password login unless the user explicitly provides credentials and 2FA is handled by them.

## Validation checklist

After writing credentials:

1. `POST /api/refresh`
2. `GET /api/status` → provider `status` is `ok` (or ChatGPT `tokenExpired` banner path)
3. Dashboard live-dot shows a time, not `stale` / `expired`

## Safety

- Never commit `~/.quota-watch/*` or `credentials/*.{json,txt}` (non-template).
- Never echo full JWTs or cookie strings into the conversation.
- Treat harvested sessions as passwords.
