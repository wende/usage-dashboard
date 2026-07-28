(function () {
  "use strict";

  var STORAGE_KEY = "quota-watch-layout-v1";
  var COLS = 12;
  var ROW_H = 40;
  var GAP = 12;
  var MIN_W = 3;
  var MIN_H = 4;

  /** Default layout matching the screenshot grid (12-col). */
  var DEFAULTS = {
    "card-kimi": { x: 0, y: 0, w: 4, h: 14 },
    "card-claude": { x: 4, y: 0, w: 4, h: 7 },
    "card-cursor": { x: 8, y: 0, w: 4, h: 7 },
    "card-chatgpt": { x: 4, y: 7, w: 4, h: 7 },
    "card-minimax": { x: 8, y: 7, w: 4, h: 7 },
  };

  var board = document.getElementById("dashboard");
  if (!board) return;

  var tiles = Array.prototype.slice.call(board.querySelectorAll(".card[id]"));
  var layout = loadLayout();
  var active = null;
  var zTop = 10;

  function loadLayout() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      var parsed = JSON.parse(raw);
      var out = Object.assign({}, DEFAULTS);
      Object.keys(DEFAULTS).forEach(function (id) {
        if (parsed[id] && typeof parsed[id].x === "number") {
          out[id] = clampTile(parsed[id]);
        }
      });
      return out;
    } catch (_) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveLayout() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch (_) {}
  }

  function clampTile(t) {
    var w = Math.max(MIN_W, Math.min(COLS, Math.round(t.w)));
    var x = Math.max(0, Math.min(COLS - w, Math.round(t.x)));
    var h = Math.max(MIN_H, Math.round(t.h));
    var y = Math.max(0, Math.round(t.y));
    return { x: x, y: y, w: w, h: h };
  }

  function cellSize() {
    var width = board.clientWidth;
    var col = (width - GAP * (COLS - 1)) / COLS;
    return { col: col, row: ROW_H, gap: GAP };
  }

  function applyTile(el, t) {
    var cs = cellSize();
    var left = t.x * (cs.col + cs.gap);
    var top = t.y * (cs.row + cs.gap);
    var width = t.w * cs.col + (t.w - 1) * cs.gap;
    var height = t.h * cs.row + (t.h - 1) * cs.gap;
    el.style.left = left + "px";
    el.style.top = top + "px";
    el.style.width = width + "px";
    el.style.height = height + "px";
  }

  function boardHeight() {
    var max = 0;
    Object.keys(layout).forEach(function (id) {
      var t = layout[id];
      max = Math.max(max, t.y + t.h);
    });
    var cs = cellSize();
    return max * cs.row + Math.max(0, max - 1) * cs.gap + 8;
  }

  function renderAll() {
    tiles.forEach(function (el) {
      var t = layout[el.id] || DEFAULTS[el.id];
      if (!t) return;
      layout[el.id] = t;
      applyTile(el, t);
    });
    board.style.height = boardHeight() + "px";
  }

  function bringFront(el) {
    zTop += 1;
    el.style.zIndex = String(zTop);
  }

  function pointerPos(e) {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function startDrag(el, e) {
    if (e.button != null && e.button !== 0) return;
    var header = e.target.closest(".card-header");
    if (!header || !el.contains(header)) return;
    if (e.target.closest("a,button,input,select,textarea")) return;

    e.preventDefault();
    var t = layout[el.id];
    var cs = cellSize();
    var p = pointerPos(e);
    bringFront(el);
    el.classList.add("is-dragging");
    active = {
      mode: "drag",
      el: el,
      startX: p.x,
      startY: p.y,
      orig: Object.assign({}, t),
      cs: cs,
    };
  }

  function startResize(el, e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    var t = layout[el.id];
    var cs = cellSize();
    var p = pointerPos(e);
    bringFront(el);
    el.classList.add("is-resizing");
    active = {
      mode: "resize",
      el: el,
      startX: p.x,
      startY: p.y,
      orig: Object.assign({}, t),
      cs: cs,
    };
  }

  function onMove(e) {
    if (!active) return;
    e.preventDefault();
    var p = pointerPos(e);
    var dx = p.x - active.startX;
    var dy = p.y - active.startY;
    var cs = active.cs;
    var stepX = cs.col + cs.gap;
    var stepY = cs.row + cs.gap;
    var next;

    if (active.mode === "drag") {
      var nx = active.orig.x + dx / stepX;
      var ny = active.orig.y + dy / stepY;
      next = clampTile({
        x: Math.round(nx),
        y: Math.round(ny),
        w: active.orig.w,
        h: active.orig.h,
      });
    } else {
      var nw = active.orig.w + dx / stepX;
      var nh = active.orig.h + dy / stepY;
      next = clampTile({
        x: active.orig.x,
        y: active.orig.y,
        w: Math.round(nw),
        h: Math.round(nh),
      });
    }

    layout[active.el.id] = next;
    applyTile(active.el, next);
    board.style.height = boardHeight() + "px";
  }

  function onUp() {
    if (!active) return;
    active.el.classList.remove("is-dragging", "is-resizing");
    saveLayout();
    active = null;
    renderAll();
  }

  tiles.forEach(function (el) {
    el.classList.add("tile");
    var handle = document.createElement("div");
    handle.className = "resize-handle";
    handle.title = "Resize";
    handle.setAttribute("aria-hidden", "true");
    el.appendChild(handle);

    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".resize-handle")) {
        startResize(el, e);
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {}
        return;
      }
      startDrag(el, e);
      if (active) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    });
  });

  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", function () {
    renderAll();
  });

  var resetBtn = document.getElementById("reset-layout");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      layout = Object.assign({}, DEFAULTS);
      saveLayout();
      renderAll();
    });
  }

  board.classList.add("is-editable");
  renderAll();
})();
