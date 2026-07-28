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

  function paintRail(el, cells, pct) {
    if (!el) return;
    buildRail(el, cells);
    var filled = Math.round((cells * Math.max(0, Math.min(100, pct))) / 100);
    var cls = pct >= 90 ? "fill hot" : pct >= 70 ? "fill warn" : "fill";
    for (var i = 0; i < cells; i++) {
      el.children[i].className = i < filled ? cls : "";
    }
  }

  function fmtPct(p) {
    return Math.round(Number(p || 0) * 100) / 100 + "%";
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

  function setLive(name, status, asof) {
    var dot = document.querySelector('[data-live="' + name + '"]');
    if (!dot) return;
    if (status === "running" || status === "pending") {
      dot.textContent = "refreshing";
      dot.classList.remove("err");
    } else if (status === "error" || status === "degraded") {
      dot.textContent = "stale";
      dot.classList.add("err");
    } else {
      dot.textContent = fmtRefresh(asof);
      dot.classList.remove("err");
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

  function renderKimi(entry) {
    var d = entry && entry.data;
    setLive("kimi", entry && entry.status, d && d.asof);
    if (!d) return;
    paintRail($("kimi-totalRail"), 40, d.total.pct);
    $("kimi-totalPct").textContent = fmtPct(d.total.pct);
    $("kimi-totalReset").textContent = d.total.reset || "";
    paintRail($("kimi-fiveRail"), 28, d.fiveHour.pct);
    $("kimi-fivePct").textContent = fmtPct(d.fiveHour.pct);
    $("kimi-fiveReset").textContent = d.fiveHour.reset || "";
    paintRail($("kimi-sevenRail"), 28, d.sevenDay.pct);
    $("kimi-sevenPct").textContent = fmtPct(d.sevenDay.pct);
    $("kimi-sevenReset").textContent = d.sevenDay.reset || "";
    renderList("kimi-giftWrap", "kimi-giftSection", d.gifts, function (g) {
      return "Gift · expires " + (g.expires || "unknown");
    });
  }

  function renderClaude(entry) {
    var d = entry && entry.data;
    setLive("claude", entry && entry.status, d && d.asof);
    if (!d) return;
    paintRail($("claude-fiveRail"), 40, d.fiveHour.pct);
    $("claude-fivePct").textContent = fmtPct(d.fiveHour.pct);
    $("claude-fiveReset").textContent = d.fiveHour.reset || "";
    paintRail($("claude-sevenRail"), 28, d.sevenDay.pct);
    $("claude-sevenPct").textContent = fmtPct(d.sevenDay.pct);
    $("claude-sevenReset").textContent = d.sevenDay.reset || "";
    renderList("claude-scopedWrap", "claude-scopedSection", d.scoped, function (s) {
      return s.name;
    });
  }

  function renderCursor(entry) {
    var d = entry && entry.data;
    setLive("cursor", entry && entry.status, d && d.asof);
    if (!d) return;
    paintRail($("cursor-totalRail"), 40, d.total.pct);
    $("cursor-totalPct").textContent = fmtPct(d.total.pct);
    $("cursor-cycle").textContent = d.cycle || "";
    paintRail($("cursor-apiRail"), 40, d.api.pct);
    var apiOut = $("cursor-apiPct");
    apiOut.textContent = fmtPct(d.api.pct);
    apiOut.className = d.api.pct >= 90 ? "hot" : "";
    $("cursor-plan").textContent = d.plan || "";
  }

  function renderChatgpt(entry) {
    var d = entry && entry.data;
    setLive("chatgpt", entry && entry.status, d && d.asof);
    if (!d) return;
    var expired = !!d.tokenExpired;
    $("chatgpt-expiredBanner").classList.toggle("active", expired);
    $("chatgpt-hero").style.display = expired ? "none" : "";
    if (expired) {
      $("chatgpt-plan").textContent = "";
      var dot = document.querySelector('[data-live="chatgpt"]');
      if (dot) {
        dot.textContent = "expired";
        dot.classList.add("err");
      }
      return;
    }
    paintRail($("chatgpt-weeklyRail"), 40, d.weekly.pct);
    $("chatgpt-weeklyPct").textContent = fmtPct(d.weekly.pct);
    $("chatgpt-weeklyReset").textContent = d.weekly.reset || "";
    $("chatgpt-plan").textContent = d.plan || "";
  }

  function renderMinimax(entry) {
    var d = entry && entry.data;
    setLive("minimax", entry && entry.status, d && d.asof);
    if (!d) return;
    paintRail($("minimax-weeklyRail"), 40, d.weekly.pct);
    $("minimax-weeklyPct").textContent = fmtPct(d.weekly.pct);
    $("minimax-weeklyReset").textContent = d.weekly.reset || "";
    paintRail($("minimax-windowRail"), 28, d.window.pct);
    $("minimax-windowPct").textContent = fmtPct(d.window.pct);
    $("minimax-windowReset").textContent = d.window.reset || "";
  }

  function renderAll(payload) {
    var p = (payload && payload.providers) || {};
    renderKimi(p.kimi);
    renderClaude(p.claude);
    renderCursor(p.cursor);
    renderChatgpt(p.chatgpt);
    renderMinimax(p.minimax);
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

  // Empty rails as placeholders
  ["kimi-totalRail", "claude-fiveRail", "cursor-totalRail", "chatgpt-weeklyRail", "minimax-weeklyRail"].forEach(function (id) {
    paintRail($(id), 40, 0);
  });
  ["kimi-fiveRail", "kimi-sevenRail", "claude-sevenRail", "minimax-windowRail"].forEach(function (id) {
    paintRail($(id), 28, 0);
  });
  paintRail($("cursor-apiRail"), 40, 0);

  poll();
  setInterval(poll, POLL_MS);
})();
