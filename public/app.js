(function () {
  "use strict";

  var POLL_MS = 30000;
  var $ = function (id) {
    return document.getElementById(id);
  };

  function buildRail(el, cells) {
    if (!el) return;
    if (el.childElementCount === cells) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    for (var i = 0; i < cells; i++) el.appendChild(document.createElement("i"));
  }

  function elapsedPct(window) {
    if (!window || !window.resetAt || !window.startAt) return null;
    var start = Date.parse(window.startAt);
    var end = Date.parse(window.resetAt);
    if (!isFinite(start) || !isFinite(end) || end <= start) return null;
    return Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));
  }

  function paintRail(el, cells, pct, pacePct) {
    if (!el) return;
    buildRail(el, cells);
    var filled = Math.round((cells * Math.max(0, Math.min(100, pct))) / 100);
    var cls = pct >= 90 ? "fill hot" : pct >= 70 ? "fill warn" : "fill";
    var firstFuture = -1;
    if (pacePct != null && isFinite(pacePct)) {
      firstFuture = Math.round((cells * Math.max(0, Math.min(100, pacePct))) / 100);
    }
    for (var i = 0; i < cells; i++) {
      var name = i < filled ? cls : "";
      if (firstFuture >= 0 && i >= firstFuture) name = (name ? name + " " : "") + "future";
      el.children[i].className = name;
    }
    if (pacePct != null && isFinite(pacePct)) {
      el.title = Math.round(pacePct) + "% of period elapsed";
    } else {
      el.removeAttribute("title");
    }
  }

  function fmtPct(p) {
    return Math.round(Number(p || 0) * 10) / 10 + "%";
  }

  function fmtRefresh(asof) {
    if (!asof) return "--";
    var m = String(asof).match(/(\d{1,2}:\d{2})(?::\d{2})?/);
    if (m) return m[1];
    var d = new Date(asof);
    if (!isNaN(d.getTime())) {
      return (
        ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2)
      );
    }
    return String(asof);
  }

  function setRefreshBusy(name, busy) {
    var btn = document.querySelector('[data-refresh="' + name + '"]');
    if (!btn) return;
    btn.disabled = !!busy;
    btn.classList.toggle("is-busy", !!busy);
  }

  function setLive(name, status, asof) {
    var dot = document.querySelector('[data-live="' + name + '"]');
    if (!dot) return;
    if (status === "running" || status === "pending") {
      dot.textContent = "refreshing";
      dot.classList.remove("err");
      setRefreshBusy(name, true);
    } else if (status === "stale") {
      dot.textContent = "stale";
      dot.classList.add("err");
      setRefreshBusy(name, false);
    } else if (status === "error" || status === "degraded") {
      dot.textContent = "error";
      dot.classList.add("err");
      setRefreshBusy(name, false);
    } else {
      dot.textContent = fmtRefresh(asof);
      dot.classList.remove("err");
      setRefreshBusy(name, false);
    }
  }

  function renderList(wrapId, sectionId, items, labelFn) {
    var wrap = $(wrapId);
    var section = $(sectionId);
    if (!wrap || !section) return;
    while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
    var list = items || [];
    section.hidden = list.length === 0;
    list.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "row";
      var head = document.createElement("div");
      head.className = "row-head";
      var label = document.createElement("span");
      label.className = "label";
      label.textContent = labelFn(item);
      var val = document.createElement("span");
      val.className = "val" + (item.pct >= 90 ? " hot" : "");
      val.textContent = fmtPct(item.pct);
      head.appendChild(label);
      head.appendChild(val);
      var rail = document.createElement("div");
      rail.className = "pxrail sub-rail";
      rail.setAttribute("aria-hidden", "true");
      row.appendChild(head);
      row.appendChild(rail);
      wrap.appendChild(row);
      paintRail(rail, 28, item.pct);
    });
  }

  // Per-provider card config. DOM id convention: <name>-<id>Rail|Pct|Reset.
  // Hero rows always show pace; sub-rows only with pace: true.
  var PROVIDERS = [
    { name: "kimi",
      hero: { key: "total", id: "total", cells: 40 },
      rows: [
        { key: "fiveHour", id: "five", cells: 28 },
        { key: "sevenDay", id: "seven", cells: 28, pace: true },
      ],
      list: { key: "gifts", wrapId: "kimi-giftWrap", sectionId: "kimi-giftSection",
        label: function (g) { return "Gift · expires " + (g.expires || "unknown"); } } },
    { name: "claude",
      hero: { key: "fiveHour", id: "five", cells: 40 },
      rows: [{ key: "sevenDay", id: "seven", cells: 28, pace: true }],
      list: { key: "scoped", wrapId: "claude-scopedWrap", sectionId: "claude-scopedSection",
        label: function (s) { return s.name; } } },
    { name: "cursor",
      hero: { key: "total", id: "total", cells: 40, resetId: "cursor-cycle", resetKey: "cycle" },
      rows: [{ key: "api", id: "api", cells: 40, hotPct: true }],
      plan: true },
    { name: "chatgpt",
      hero: { key: "fiveHour", id: "five", cells: 40 },
      rows: [{ key: "weekly", id: "weekly", cells: 28 }],
      plan: true, expired: true },
    { name: "minimax",
      hero: { key: "fiveHour", id: "five", cells: 40 },
      rows: [{ key: "weekly", id: "weekly", cells: 28 }] },
    { name: "grok",
      hero: { key: "weekly", id: "weekly", cells: 40 },
      plan: true, expired: true },
  ];

  function paintWindow(cfg, part, w, resetText) {
    // ponytail: a window may be missing (cached payload from before a fetcher
    // rewrite, or API returning only one of two slots). Paint an empty row
    // instead of crashing the poll loop.
    var pct = w ? w.pct : 0;
    var rail = $(cfg.name + "-" + part.id + "Rail");
    paintRail(rail, part.cells, pct,
      w && (part.pace || part === cfg.hero) ? elapsedPct(w) : null);
    var pctEl = $(cfg.name + "-" + part.id + "Pct");
    if (pctEl) pctEl.textContent = fmtPct(pct);
    if (part.hotPct && pctEl) pctEl.className = pct >= 90 ? "hot" : "";
    var resetEl = $(part.resetId || cfg.name + "-" + part.id + "Reset");
    if (resetEl) resetEl.textContent = resetText != null ? resetText : (w && w.reset || "");
  }

  function renderProvider(cfg, entry) {
    var d = entry && entry.data;
    setLive(cfg.name, entry && entry.status, d && d.asof);
    if (!d) return;
    if (cfg.expired) {
      var expired = !!d.tokenExpired;
      $(cfg.name + "-expiredBanner").classList.toggle("active", expired);
      $(cfg.name + "-hero").style.display = expired ? "none" : "";
      if (expired) {
        if (cfg.plan) $(cfg.name + "-plan").textContent = "";
        var dot = document.querySelector('[data-live="' + cfg.name + '"]');
        if (dot) {
          dot.textContent = "expired";
          dot.classList.add("err");
        }
        setRefreshBusy(cfg.name, false);
        return;
      }
    }
    paintWindow(cfg, cfg.hero, d[cfg.hero.key],
      cfg.hero.resetKey ? d[cfg.hero.resetKey] : undefined);
    (cfg.rows || []).forEach(function (part) {
      paintWindow(cfg, part, d[part.key]);
    });
    if (cfg.list) {
      renderList(cfg.list.wrapId, cfg.list.sectionId, d[cfg.list.key], cfg.list.label);
    }
    if (cfg.plan) $(cfg.name + "-plan").textContent = d.plan || "";
  }

  function renderAll(payload) {
    var p = (payload && payload.providers) || {};
    PROVIDERS.forEach(function (cfg) {
      renderProvider(cfg, p[cfg.name]);
    });
  }

  async function poll() {
    try {
      var res = await fetch("/api/status", { cache: "no-store" });
      if (!res.ok) throw new Error("status " + res.status);
      renderAll(await res.json());
    } catch (err) {
      console.error("poll failed", err);
    }
  }

  async function refreshProvider(name) {
    if (!name) return;
    setLive(name, "running");
    try {
      var res = await fetch("/api/refresh/" + encodeURIComponent(name), {
        method: "POST",
      });
      if (!res.ok) throw new Error("refresh " + res.status);
    } catch (err) {
      console.error("refresh failed", err);
      setRefreshBusy(name, false);
      return;
    }
    var tries = 0;
    while (tries < 40) {
      await new Promise(function (resolve) {
        setTimeout(resolve, 400);
      });
      try {
        var statusRes = await fetch("/api/status", { cache: "no-store" });
        if (!statusRes.ok) {
          tries++;
          continue;
        }
        var payload = await statusRes.json();
        renderAll(payload);
        var entry = payload.providers && payload.providers[name];
        if (entry && entry.status !== "running") break;
      } catch (_) {}
      tries++;
    }
  }

  document.querySelectorAll("[data-refresh]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      refreshProvider(btn.getAttribute("data-refresh"));
    });
  });

  // Empty rails as placeholders
  PROVIDERS.forEach(function (cfg) {
    paintRail($(cfg.name + "-" + cfg.hero.id + "Rail"), cfg.hero.cells, 0);
    (cfg.rows || []).forEach(function (part) {
      paintRail($(cfg.name + "-" + part.id + "Rail"), part.cells, 0);
    });
  });

  poll();
  setInterval(poll, POLL_MS);
})();
