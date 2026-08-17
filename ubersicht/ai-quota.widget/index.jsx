// AI Quota Watch — Übersicht desktop widget.
// Reads the same /api/status endpoint the dashboard polls. The server must be
// running (`npm start` in the repo root); when it is not, the widget says so.

import { run } from "uebersicht";

const ENDPOINT = "http://localhost:3847/api/status";

export const command = `curl -s -m 5 ${ENDPOINT}`;

export const refreshFrequency = 30000;

export const className = `
  top: 24px;
  right: 24px;
  width: 306px;
  font-family: "SF Pro Text", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  color: #111;

  --card-bg: rgba(255, 255, 255, 0.86);
  --card-border: rgba(0, 0, 0, 0.07);
  --text: #111;
  --text-secondary: #5c5c66;
  --text-tertiary: #8b8b96;
  --border: rgba(0, 0, 0, 0.08);
  --rail-empty: rgba(17, 17, 17, 0.11);
  --rail-fill: rgba(17, 17, 17, 0.46);
  --warn: #f5a623;
  --hot: #e5484d;
  --positive: #30a46c;

  @media (prefers-color-scheme: dark) {
    color: #f2f2f4;
    --card-bg: rgba(30, 30, 33, 0.78);
    --card-border: rgba(255, 255, 255, 0.09);
    --text: #f2f2f4;
    --text-secondary: #b4b4bd;
    --text-tertiary: #8a8a94;
    --border: rgba(255, 255, 255, 0.1);
    --rail-empty: rgba(255, 255, 255, 0.14);
    --rail-fill: rgba(255, 255, 255, 0.55);
  }

  * { box-sizing: border-box; }

  .stack { display: flex; flex-direction: column; gap: 10px; }

  .card {
    background: var(--card-bg);
    -webkit-backdrop-filter: blur(22px) saturate(160%);
    backdrop-filter: blur(22px) saturate(160%);
    border: 1px solid var(--card-border);
    border-radius: 13px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10);
    padding: 12px 14px 13px;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .brand { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
  .title { margin: 0; font-size: 12.5px; font-weight: 500; white-space: nowrap; }
  .logo { display: inline-flex; flex: 0 0 auto; width: 17px; height: 17px; }
  .logo svg { display: block; width: 100%; height: 100%; }

  .header-right { display: inline-flex; align-items: center; gap: 8px; }
  .plan { font-size: 10px; color: var(--text-tertiary); }

  .live-dot {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    color: var(--text-tertiary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .live-dot::before {
    content: "";
    width: 5px; height: 5px;
    border-radius: 999px;
    background: var(--positive);
  }
  .live-dot.err::before { background: var(--hot); }

  .refresh-btn {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 5px;
    background: transparent;
    color: var(--text-tertiary);
    cursor: pointer;
    flex: 0 0 auto;
  }
  .refresh-btn:hover {
    color: var(--text-secondary);
    background: rgba(127, 127, 127, 0.16);
  }
  .refresh-btn:active { color: var(--text); }
  .refresh-btn:disabled,
  .refresh-btn.is-busy {
    cursor: default;
    color: var(--text-tertiary);
    background: transparent;
  }
  .refresh-btn svg {
    display: block;
    width: 12px;
    height: 12px;
    fill: currentColor;
  }
  .refresh-btn.is-busy svg {
    animation: aqw-refresh-spin 0.7s linear infinite;
  }
  @keyframes aqw-refresh-spin {
    to { transform: rotate(360deg); }
  }

  .hero { display: flex; flex-direction: column; gap: 5px; }
  .hero-line { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
  .hero .pct {
    font-size: 26px;
    font-weight: 500;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  .hero .pct.hot { color: var(--hot); }
  .hero .name { font-size: 11.5px; font-weight: 500; color: var(--text-secondary); }
  .hero .reset { font-size: 10px; color: var(--text-tertiary); }

  .pxrail { display: grid; gap: 2px; }
  .pxrail > i { display: block; border-radius: 2px; background: var(--rail-empty); }
  .pxrail > i.fill { background: var(--rail-fill); }
  .pxrail > i.fill.warn { background: var(--warn); }
  .pxrail > i.fill.hot { background: var(--hot); }
  .pxrail > i.future { align-self: center; border-radius: 999px; }
  .pxrail.hero-rail > i { height: 11px; }
  .pxrail.hero-rail > i.future { height: 5px; }
  .pxrail.sub-rail > i { height: 7px; }
  .pxrail.sub-rail > i.future { height: 4px; }

  .row { display: flex; flex-direction: column; gap: 4px; }
  .row-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .row-head .label { font-size: 11px; color: var(--text-secondary); }
  .row-head .val { font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }
  .row-head .val.hot { color: var(--hot); }
  .row-sub { font-size: 9.5px; color: var(--text-tertiary); }
  .nodata { margin: 0; font-size: 10.5px; }

  .divider { height: 1px; background: var(--border); }
  .group-label { margin: 0; font-size: 9.5px; font-weight: 500; color: var(--text-tertiary); }
  .section { display: flex; flex-direction: column; gap: 6px; }

  .banner {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border-radius: 7px;
    background: rgba(229, 72, 77, 0.12);
    border: 1px solid rgba(229, 72, 77, 0.28);
  }
  .banner .banner-title { margin: 0; font-size: 11.5px; font-weight: 600; color: var(--hot); }
  .banner .banner-body { margin: 0; font-size: 10px; color: var(--text-secondary); line-height: 1.45; }
  .banner code {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 9.5px;
    background: rgba(127, 127, 127, 0.18);
    padding: 1px 3px;
    border-radius: 3px;
  }
`;

/* ---------- helpers ---------- */

const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

const fmtPct = (p) => Math.round(Number(p || 0) * 10) / 10 + "%";

const tone = (pct) => (pct >= 90 ? "hot" : pct >= 70 ? "warn" : "");

function elapsedPct(window) {
  if (!window || !window.resetAt || !window.startAt) return null;
  const start = Date.parse(window.startAt);
  const end = Date.parse(window.resetAt);
  if (!isFinite(start) || !isFinite(end) || end <= start) return null;
  return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
}

function fmtRefresh(asof) {
  if (!asof) return "--";
  const m = String(asof).match(/(\d{1,2}:\d{2})(?::\d{2})?/);
  if (m) return m[1];
  const d = new Date(asof);
  if (!isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return String(asof);
}

function railCellClass(i, filled, fillClass, firstFuture) {
  var name = i < filled ? fillClass : "";
  if (firstFuture >= 0 && i >= firstFuture) {
    name = name ? name + " future" : "future";
  }
  return name;
}

function Rail({ cells, pct, variant, pacePct }) {
  const value = clamp(pct);
  const filled = Math.round((cells * value) / 100);
  const fillClass = ("fill " + tone(value)).trim();
  const firstFuture =
    pacePct != null && isFinite(pacePct)
      ? Math.round((cells * clamp(pacePct)) / 100)
      : -1;
  const title =
    pacePct != null && isFinite(pacePct)
      ? Math.round(pacePct) + "% of period elapsed"
      : undefined;
  return (
    <div
      className={"pxrail " + variant}
      style={{ gridTemplateColumns: "repeat(" + cells + ", minmax(0, 1fr))" }}
      title={title}
    >
      {Array.from({ length: cells }, (_, i) => (
        <i key={i} className={railCellClass(i, filled, fillClass, firstFuture)} />
      ))}
    </div>
  );
}

function Live({ entry }) {
  const status = entry && entry.status;
  const asof = entry && entry.data && entry.data.asof;
  if (status === "running" || status === "pending") {
    return <span className="live-dot">refreshing</span>;
  }
  if (status === "stale") {
    return <span className="live-dot err">stale</span>;
  }
  if (status === "error" || status === "degraded") {
    return <span className="live-dot err">error</span>;
  }
  return <span className="live-dot">{fmtRefresh(asof)}</span>;
}

const REFRESH_ICON = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M13.65 2.35A7 7 0 0 0 2.1 6.5H.5l2.55 2.55L5.6 6.5H3.15a4.9 4.9 0 0 1 8.2-2.85l1.3-1.3ZM3.35 13.65A7 7 0 0 0 13.9 9.5h1.6l-2.55-2.55L10.4 9.5h2.45a4.9 4.9 0 0 1-8.2 2.85l-1.3 1.3Z" />
  </svg>
);

// Per-card refresh button. POSTs /api/refresh/:name and then dispatches
// OUTPUT_UPDATED with a fresh /api/status fetch so the widget re-renders
// immediately rather than waiting for the next refreshFrequency tick.
function RefreshButton({ name, entry, dispatch }) {
  const status = entry && entry.status;
  const busy = status === "running" || status === "pending";
  const onClick = () => {
    if (busy) return;
    run(`curl -s -m 5 -X POST http://localhost:3847/api/refresh/${name}`)
      .catch((err) => console.error(`refresh ${name} failed`, err))
      .then(() =>
        run(`curl -s -m 5 http://localhost:3847/api/status`).then(
          (output) => dispatch({ type: "OUTPUT_UPDATED", output }),
          (err) => console.error("status poll failed", err)
        )
      );
  };
  return (
    <button
      type="button"
      className={`refresh-btn${busy ? " is-busy" : ""}`}
      disabled={busy}
      title={`Refresh ${name}`}
      aria-label={`Refresh ${name}`}
      onClick={onClick}
    >
      {REFRESH_ICON}
    </button>
  );
}

function Header({ logo, title, entry, plan, name, dispatch }) {
  return (
    <header className="card-header">
      <div className="brand">
        <span className="logo">{logo}</span>
        <h2 className="title">{title}</h2>
      </div>
      <span className="header-right">
        {plan ? <span className="plan">{plan}</span> : null}
        <RefreshButton
          name={name}
          entry={entry}
          dispatch={dispatch}
        />
        <Live entry={entry} />
      </span>
    </header>
  );
}

function Hero({ pct, name, reset, cells = 34, pacePct }) {
  const value = clamp(pct);
  return (
    <div className="hero">
      <div className="hero-line">
        <span className={`pct ${value >= 90 ? "hot" : ""}`}>{fmtPct(pct)}</span>
        <span className="name">{name}</span>
        {reset ? <span className="reset">{reset}</span> : null}
      </div>
      <Rail cells={cells} pct={pct} variant="hero-rail" pacePct={pacePct} />
    </div>
  );
}

function Row({ label, pct, reset, cells = 26, pacePct }) {
  const value = clamp(pct);
  return (
    <div className="row">
      <div className="row-head">
        <span className="label">{label}</span>
        <span className={`val ${value >= 90 ? "hot" : ""}`}>{fmtPct(pct)}</span>
      </div>
      <Rail cells={cells} pct={pct} variant="sub-rail" pacePct={pacePct} />
      {reset ? <span className="row-sub">{reset}</span> : null}
    </div>
  );
}

// A provider the server knows about but has no payload for yet (first fetch
// failed, or still pending). Keep the card visible so a broken credential is
// obvious instead of the card just disappearing.
function NoData({ entry }) {
  const status = entry && entry.status;
  const message =
    status === "pending" || status === "running"
      ? "Waiting for first refresh…"
      : (entry && entry.error) || "No data";
  return <p className="row-sub nodata">{message}</p>;
}

function ListSection({ title, items, labelFn }) {
  const list = items || [];
  if (list.length === 0) return null;
  return (
    <div className="section">
      <div className="divider" />
      <p className="group-label">{title}</p>
      {list.map((item, i) => (
        <Row key={i} label={labelFn(item)} pct={item.pct} />
      ))}
    </div>
  );
}

/* ---------- logos ---------- */

const KimiLogo = (
  <svg viewBox="0 0 24 24">
    <rect width="24" height="24" rx="5" fill="#111" />
    <text
      x="12" y="16.5"
      textAnchor="middle"
      fontFamily="system-ui, sans-serif"
      fontSize="13"
      fontWeight="700"
      fill="#fff"
    >K</text>
  </svg>
);

const ClaudeLogo = (
  <svg viewBox="0 0 24 24">
    <rect width="24" height="24" rx="5" fill="#D97757" />
    <g stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
      <line x1="7.2" y1="12" x2="16.8" y2="12" />
      <line x1="12" y1="7.2" x2="12" y2="16.8" />
      <line x1="8.6" y1="8.6" x2="15.4" y2="15.4" />
      <line x1="8.6" y1="15.4" x2="15.4" y2="8.6" />
    </g>
  </svg>
);

const CursorLogo = (
  <svg viewBox="0 0 24 24">
    <defs>
      <linearGradient id="aqwCursorGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#111111" />
        <stop offset="1" stopColor="#4A4A4A" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="5" fill="url(#aqwCursorGrad)" />
    <path
      d="M6 5.5 L12 9 L18 5.5 M6 5.5 V13 L12 16.5 L18 13 V5.5 M12 9 V16.5"
      stroke="#fff"
      strokeWidth="1.6"
      strokeLinejoin="round"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const ChatgptLogo = (
  <svg viewBox="0 0 24 24">
    <defs>
      <linearGradient id="aqwGptGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8B5CF6" />
        <stop offset="1" stopColor="#2F5BEA" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="5" fill="url(#aqwGptGrad)" />
    <g fill="#fff">
      <circle cx="16.6" cy="12" r="3" />
      <circle cx="14.3" cy="15.98" r="3" />
      <circle cx="9.7" cy="15.98" r="3" />
      <circle cx="7.4" cy="12" r="3" />
      <circle cx="9.7" cy="8.02" r="3" />
      <circle cx="14.3" cy="8.02" r="3" />
      <circle cx="12" cy="12" r="3" />
    </g>
    <g stroke="#3B5BE8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <polyline points="9.2,9.4 11.6,12 9.2,14.6" />
      <line x1="13" y1="14.7" x2="16.2" y2="14.7" />
    </g>
  </svg>
);

const GrokLogo = (
  <svg viewBox="0 0 24 24">
    <rect width="24" height="24" rx="5" fill="#111" />
    <text
      x="12" y="16.5"
      textAnchor="middle"
      fontFamily="system-ui, sans-serif"
      fontSize="13"
      fontWeight="700"
      fill="#fff"
    >G</text>
  </svg>
);

const MinimaxLogo = (
  <svg viewBox="0 0 24 24">
    <rect width="24" height="24" rx="5" fill="#EA3F45" />
    <g fill="#fff">
      <rect x="4.5" y="9" width="1.7" height="6" rx="0.85" />
      <rect x="6.72" y="7" width="1.7" height="10" rx="0.85" />
      <rect x="8.93" y="5.25" width="1.7" height="13.5" rx="0.85" />
      <rect x="11.15" y="8" width="1.7" height="8" rx="0.85" />
      <rect x="13.37" y="5.25" width="1.7" height="13.5" rx="0.85" />
      <rect x="15.58" y="7" width="1.7" height="10" rx="0.85" />
      <rect x="17.8" y="9" width="1.7" height="6" rx="0.85" />
    </g>
  </svg>
);

/* ---------- cards ---------- */

// Per-provider card config. Hero always shows pace; rows only with pace: true.
const PROVIDERS = [
  { name: "kimi", title: "Kimi", logo: KimiLogo,
    hero: { key: "total", name: "Monthly usage" },
    rows: [
      { key: "fiveHour", label: "5-hour usage" },
      { key: "sevenDay", label: "7-day usage", pace: true },
    ],
    list: { key: "gifts", title: "Gift usage",
      labelFn: (g) => `Gift · expires ${g.expires || "unknown"}` } },
  { name: "claude", title: "Claude", logo: ClaudeLogo,
    hero: { key: "fiveHour", name: "5-hour usage" },
    rows: [{ key: "sevenDay", label: "7-day usage", pace: true }],
    list: { key: "scoped", title: "Model limits · weekly", labelFn: (s) => s.name } },
  { name: "cursor", title: "Cursor", logo: CursorLogo, plan: true,
    hero: { key: "total", name: "Monthly usage", resetKey: "cycle" },
    rows: [{ key: "api", label: "API usage" }] },
  { name: "chatgpt", title: "ChatGPT", logo: ChatgptLogo, plan: true,
    expired: { title: "Token expired",
      body: <>Update <code>bearer</code> in <code>chatgpt.json</code> and refresh.</> },
    hero: { key: "weekly", name: "Weekly usage" } },
  { name: "grok", title: "Grok", logo: GrokLogo, plan: true,
    expired: { title: "Session expired",
      body: <>Update the <code>sso</code> cookie in <code>grok.json</code> and refresh.</> },
    hero: { key: "weekly", name: "Weekly usage" } },
  { name: "minimax", title: "MiniMax", logo: MinimaxLogo,
    hero: { key: "weekly", name: "Weekly usage" },
    rows: [{ key: "window", label: "5-hour usage" }] },
];

function ProviderCard({ cfg, entry, dispatch }) {
  if (!entry) return null;
  const d = entry.data;
  if (!d) {
    return (
      <article className="card">
        <Header logo={cfg.logo} title={cfg.title} name={cfg.name} entry={entry} dispatch={dispatch} />
        <NoData entry={entry} />
      </article>
    );
  }
  if (cfg.expired && d.tokenExpired) {
    return (
      <article className="card">
        <Header logo={cfg.logo} title={cfg.title} name={cfg.name} entry={{ status: "stale" }} dispatch={dispatch} />
        <div className="banner">
          <p className="banner-title">{cfg.expired.title}</p>
          <p className="banner-body">{cfg.expired.body}</p>
        </div>
      </article>
    );
  }
  const heroWindow = d[cfg.hero.key];
  return (
    <article className="card">
      <Header logo={cfg.logo} title={cfg.title} name={cfg.name} entry={entry}
        plan={cfg.plan ? d.plan : null} dispatch={dispatch} />
      <Hero pct={heroWindow.pct} name={cfg.hero.name}
        reset={cfg.hero.resetKey ? d[cfg.hero.resetKey] : heroWindow.reset}
        pacePct={elapsedPct(heroWindow)} />
      {(cfg.rows || []).map((r) => (
        <Row key={r.key} label={r.label} pct={d[r.key].pct} reset={d[r.key].reset}
          pacePct={r.pace ? elapsedPct(d[r.key]) : undefined} />
      ))}
      {cfg.list && (
        <ListSection title={cfg.list.title} items={d[cfg.list.key]} labelFn={cfg.list.labelFn} />
      )}
    </article>
  );
}

/* ---------- render ---------- */

function Offline({ detail }) {
  return (
    <div className="stack">
      <article className="card">
        <div className="banner">
          <p className="banner-title">Quota server unreachable</p>
          <p className="banner-body">
            Start it with <code>npm start</code> in the usage_widget repo.
            {detail ? ` (${detail})` : ""}
          </p>
        </div>
      </article>
    </div>
  );
}

export const render = ({ output, error }, dispatch) => {
  if (error) return <Offline detail={String(error)} />;
  if (!output || !String(output).trim()) return <Offline />;

  let payload;
  try {
    payload = JSON.parse(output);
  } catch (e) {
    return <Offline detail="bad response" />;
  }

  const p = (payload && payload.providers) || {};

  return (
    <div className="stack">
      {PROVIDERS.map((cfg) => (
        <ProviderCard key={cfg.name} cfg={cfg} entry={p[cfg.name]} dispatch={dispatch} />
      ))}
    </div>
  );
};
