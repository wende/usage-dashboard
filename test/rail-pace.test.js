// Regression guard for the pace marker ("future" thin cells) on sub-rows.
//
// chatgpt.weekly and minimax.weekly rendered all-wide rails while
// claude.sevenDay and kimi.sevenDay showed the marker, because sub-rows only
// opted in via a per-row `pace: true` flag that those two configs lacked.
// Both renderers now derive pace from the window itself — elapsedPct returns
// null when startAt/resetAt are missing, so no flag is needed.
//
// Neither file is importable (public/app.js is an IIFE, the widget is JSX for
// Übersicht's runtime), so this asserts over the source text.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const FILES = [
  new URL("../public/app.js", import.meta.url),
  new URL("../ubersicht/ai-quota.widget/index.jsx", import.meta.url),
];

for (const url of FILES) {
  const label = url.pathname.split("/").slice(-2).join("/");

  test(`${label} has no per-row pace opt-in`, async () => {
    const src = await readFile(url, "utf8");
    assert.equal(
      /\bpace\s*:\s*true/.test(src),
      false,
      "a `pace: true` row flag is back — sub-rows without it silently lose " +
        "the pace marker. Derive it from the window instead."
    );
  });

  test(`${label} derives pace from the window, not the row config`, async () => {
    const src = await readFile(url, "utf8");
    assert.equal(
      /part\.pace|r\.pace\b/.test(src),
      false,
      "the rail painter reads a row-level pace flag again"
    );
  });
}
