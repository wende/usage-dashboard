# Übersicht desktop widget

Renders the dashboard cards directly on the macOS desktop wallpaper.

[Übersicht](https://tracesof.net/uebersicht/) draws HTML/CSS/JS widgets on the
desktop layer. `ai-quota.widget/index.jsx` polls the same `/api/status`
endpoint the web dashboard uses, so both stay in sync.

## Install

1. Install Übersicht:

```bash
brew install --cask ubersicht
```

2. Link this widget into Übersicht's widget folder:

```bash
ln -s "$PWD/ubersicht/ai-quota.widget" ~/Library/Application\ Support/Übersicht/widgets/ai-quota.widget
```

(run from the repo root — the symlink keeps the widget version-controlled here)

3. Launch Übersicht. It picks the widget up automatically and reloads on save.

The quota server must be running (`npm start`); when it isn't, the widget shows
a "Quota server unreachable" card instead of going blank.

## Behaviour

| | |
|---|---|
| Data source | `curl http://localhost:3847/api/status` |
| Refresh | every 30 s (`refreshFrequency`) |
| Position | top-right, 306 px wide (edit `className`) |
| Appearance | follows system light/dark automatically |

Cards mirror the web dashboard: a hero percentage with a 34-cell pixel rail,
sub-rows at 26 cells, amber fill at ≥70 %, red at ≥90 %. Kimi gift entries and
Claude scoped model limits appear only when the API returns them.

State handling:

- credential/token rejected (HTTP 401/403, expired JWT, malformed token file)
  → `stale` dot, last known values kept
- other request failures (network, timeout, HTTP 5xx, parse) → `error` dot,
  last known values kept
- provider with no payload yet → card stays visible with the error or a
  "Waiting for first refresh…" note
- ChatGPT `tokenExpired` → red banner pointing at `chatgpt.json`
- Grok `tokenExpired` → red banner pointing at `grok.json`

Per-card refresh:

- Each card has a refresh button in its header. It POSTs `/api/refresh/:name`
  and immediately re-polls `/api/status` so the card updates without waiting
  for the 30 s background tick. The button spins while `status` is `running`
  or `pending`. Click events require Übersicht's interaction accessibility
  permission (System Settings → Privacy & Security → Accessibility).

## Editing

Übersicht compiles the JSX itself; there is no build step. To check a change
compiles before saving over a working widget:

```bash
esbuild ubersicht/ai-quota.widget/index.jsx --loader:.jsx=jsx --jsx-factory=h --outfile=/dev/null
```

To move the widget, change `top` / `right` / `width` at the top of
`className`. To show fewer providers, drop the matching `<XCard />` from
`render`.
