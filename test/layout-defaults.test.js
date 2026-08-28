// Regression guard for public/layout.js DEFAULTS.
//
// A card present in public/index.html but missing from DEFAULTS renders
// unpositioned, and startDrag/startResize read `layout[id]` → undefined →
// NaN coords — the card is silently undraggable and unresizable (found when
// card-glm shipped without a DEFAULTS entry).

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const layout = await readFile(new URL("../public/layout.js", import.meta.url), "utf8");

const cardIds = [...html.matchAll(/class="card[^"]*" id="(card-[\w-]+)"/g)].map((m) => m[1]);
const defaultsIds = [...layout.matchAll(/"(card-[\w-]+)":\s*\{/g)].map((m) => m[1]);

test("every dashboard card has a DEFAULTS layout entry", () => {
  assert.ok(cardIds.length > 0, "no cards found in index.html — selector rotted");
  assert.deepEqual(
    cardIds.filter((id) => !defaultsIds.includes(id)),
    [],
    "cards missing from layout.js DEFAULTS"
  );
});

test("DEFAULTS has no stale entries for removed cards", () => {
  assert.deepEqual(
    defaultsIds.filter((id) => !cardIds.includes(id)),
    [],
    "layout.js DEFAULTS references cards no longer in index.html"
  );
});
