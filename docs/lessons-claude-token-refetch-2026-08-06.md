---
name: lessons-claude-token-refetch-2026-08-06
description: >-
  Lessons learned from a live Claude credential refresh on 2026-08-06. Captures
  what worked, what failed, and concrete corrections to the refetch skill
  (`docs/refetch-quota-credentials.md`).
---

# Lessons — Claude token refresh, 2026-08-06

Live session where the Claude card on the usage dashboard reported `401 Token expired`.
Goal: refresh `~/.quota-watch/claude.json` and get `/api/status` back to `ok`.

## What worked

1. **Health check first.** `~/.kimi-webbridge/bin/kimi-webbridge status` →
   `running: true` but `extension_connected: false`. Per the skill's operations
   reference, that's the "tell the user to open the browser" state. After the
   user opened Dia, `extension_connected: true` and the agent had real control
   of the existing session.
2. **WebBridge confirms login without trying to read cookies.** An in-page
   `fetch("/api/organizations/{orgId}/usage", {credentials:"include"})` that
   returns `200` is the cheapest and most reliable "is this session live?"
   check. The agent ran it *before* deciding whether to fall back to a
   manual harvest.
3. **orgId is in the URL, not the cookie.** Every captured request URL
   contained it:
   `/api/organizations/a17f7eca-dd36-4999-88c3-e66ba550a045/...`. The
   `lastActiveOrg` cookie also had it. Either is fine.
4. **Manual `Cookie` header paste is the fastest path for Claude.** The cookie
   string is what `document.cookie` would surface if `sessionKey` weren't
   HttpOnly — paste the full value, drop it into a JSON `cookies` field, and
   it's done. WebBridge alone cannot recover the `Cookie` request header
   (see "what failed" below), so for this provider the agent almost always
   ends up asking the user to paste it.

## What failed

1. **WebBridge `network detail` does not expose request headers.** It returns
   the response body and a requestId, but no `Cookie` header. The skill
   `kimi-webbridge` SKILL.md and the `refetch-quota-credentials` SKILL.md
   both implicitly assume headers are available — they are not. **Lesson:**
   assume the agent must read the cookie from somewhere other than the
   captured request.
2. **Option B (decrypt the cookie DB) does not work for this Dia build.** The
   skill's recipe (`Dia Safe Storage` password + PBKDF2-HMAC-SHA1, 1003 iter,
   salt `saltysalt`, AES-128-CBC, IV = 16 spaces, strip 32-byte host-hash
   prefix) was applied faithfully, and so were the variants — `Chrome Safe
   Storage` password, 1 iteration, `pbkdf2(...salt="")`, plain SHA1 first
   16 bytes. None produced a ciphertext whose last byte was a valid PKCS#7
   pad. The cookie DB has 3020 entries, all prefix `v10`, so the format is
   not the issue — the key derivation is. Newer Chromium-on-macOS builds
   can use app-bound encryption where the keychain item is not a raw
   password; the standard recipe cannot decrypt those without further
   unwrapping. **Lesson:** if Option B fails on the first attempt, do not
   burn more iterations on key derivation — switch to manual paste.
3. **`macbeth` cannot read Chromium web content.** The accessibility tree
   surfaces only opaque `group` nodes for web pages. `document.cookie`,
   `cookieStore`, and network headers are all unreachable from macbeth. The
   correct tool for "drive a real browser session" is Kimi WebBridge (or a
   Playwright persistent context), not macbeth.

## Concrete corrections to the skill

These are the edits the agent should make to
`docs/refetch-quota-credentials.md` (and the duplicate in
`.cursor/skills/refetch-quota-credentials/SKILL.md`) so the next run goes
straight to the manual path on Claude.

- **Section "Automated harvest → Option A — Kimi WebBridge", step 5.** The
  current text says "Network detail may omit Cookie headers. Fall back to
  Option B." Replace *Option B* with **manual paste** for Claude. Option B
  is the right fallback for Cursor (where the cookie value is short and the
  DB still decrypts), but not for Claude on this Dia build.

- **Section "Option B — Decrypt Chromium cookie DB (HttpOnly)".** Add a
  guardrail before step 5: after the first `v10` decryption fails PKCS#7
  unpad, **do not** iterate through alternative key derivations. Modern
  Chromium-on-macOS encrypts cookie values with a key derived from the
  user's login keychain in a way that the standard `find-generic-password -w`
  result will not decrypt. Stop and fall back to manual harvest.

- **Add a new "Option D — Manual HttpOnly cookie paste (Claude preferred)."**
  Document the flow that succeeded here:
  1. The agent runs the in-page `fetch("/api/organizations/{orgId}/usage",
     {credentials:"include"})` check to confirm the session is live and to
     recover the `orgId` from the URL.
  2. The agent asks the user to paste the full `Cookie` header from
     DevTools → Network → any `/api/organizations/...` request.
  3. **Strip the leading `cookie=` literal if present** before assigning
     to the JSON `cookies` field — the user's paste will include the
     header name.
  4. Trim the cookies to the auth-relevant ones if the dashboard starts
     refusing the long string (Cloudflare `cf_clearance`, `__cf_bm`, and
     `_dd_s*` are often safe to drop; **never** drop `sessionKey`,
     `sessionKeyLC`, `__Host-ant_trusted_device`, `anthropic-device-id`,
     or `lastActiveOrg`).

- **Add a "JSON escaping" callout to the credential-files section.**
  Claude's cookie string contains literal double quotes (e.g.
  `g_state={"i_l":0,...}`). A naive `printf '{"cookies":"%s",...}'` will
  produce invalid JSON. Write the file with `json.dump(..., f, indent=2)`
  in Python (or equivalent in another language) — never hand-format the
  JSON with shell string interpolation.

- **Add a "don't poll until `ok`" reminder to the Validation checklist.**
  `POST /api/refresh` returns before the refresh finishes. The next
  `GET /api/status` may still report the old status. Poll for ~5–8s before
  declaring failure.

## Operational notes

- `kimi-webbridge` version mismatch (`extension_version: 1.11.5`,
  daemon `1.11.3`) was benign for this session. The skill says not to
  auto-upgrade. Worth checking next time the daemon is restarted.
- Kimi is currently in `error: fetch failed` state on `/api/status`. That
  is unrelated to the Claude refresh, but `kimi-token.txt` may need the
  same treatment next.
- The temp file `/tmp/claude-cookies.db` (a copy of the Dia `Cookies` DB
  made during the failed Option B attempt) was removed at the end of the
  session. No session key was ever written outside `~/.quota-watch/claude.json`.

## TL;DR for next time

For Claude specifically, the fastest correct path is:

1. Confirm session with an in-page fetch and recover `orgId` from the URL.
2. Ask the user to paste the full `Cookie` header from DevTools.
3. Write `~/.quota-watch/claude.json` with `json.dump` (not `printf`).
4. `chmod 600`, `POST /api/refresh/claude`, poll `/api/status` for `ok`.

Do not try Option B on this Dia build — the key derivation is unreachable.
