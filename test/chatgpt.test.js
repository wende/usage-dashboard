import assert from "node:assert/strict";
import test from "node:test";

import { parseChatgptRateLimit } from "../lib/fetchers/chatgpt.js";

const FIXTURE = {
  primary_window:   { used_percent: 3,  limit_window_seconds: 18000,  reset_at: 1787692045 },
  secondary_window: { used_percent: 0,  limit_window_seconds: 604800, reset_at: 1788278845 },
};

test("maps primary=5h, secondary=weekly", () => {
  const { fiveHour, weekly } = parseChatgptRateLimit(FIXTURE);
  assert.equal(fiveHour.pct, 3);
  assert.equal(weekly.pct, 0);
  // 5h uses HH:MM only (always resets same day); weekly uses MM-DD HH:MM.
  assert.match(fiveHour.reset, /^resets \d{2}:\d{2}$/);
  assert.match(weekly.reset, /^resets \d{2}-\d{2} \d{2}:\d{2}$/);
  // fiveHour window is 5h; weekly window is 7d.
  assert.equal(Date.parse(fiveHour.resetAt) - Date.parse(fiveHour.startAt), 5 * 60 * 60 * 1000);
  assert.equal(Date.parse(weekly.resetAt) - Date.parse(weekly.startAt), 7 * 24 * 60 * 60 * 1000);
});

test("still identifies windows when the slot order is swapped", () => {
  const swapped = {
    primary_window:   FIXTURE.secondary_window,
    secondary_window: FIXTURE.primary_window,
  };
  const { fiveHour, weekly } = parseChatgptRateLimit(swapped);
  assert.equal(fiveHour.pct, 3);
  assert.equal(weekly.pct, 0);
});

test("returns null for a missing window", () => {
  const only = { primary_window: FIXTURE.primary_window };
  const { fiveHour, weekly } = parseChatgptRateLimit(only);
  assert.equal(fiveHour.pct, 3);
  assert.equal(weekly, null);
});

test("ignores windows with an unrecognised length", () => {
  const weird = {
    primary_window:   { used_percent: 99, limit_window_seconds: 60, reset_at: 1787692045 },
    secondary_window: FIXTURE.primary_window,
  };
  const { fiveHour, weekly } = parseChatgptRateLimit(weird);
  assert.equal(fiveHour.pct, 3);
  assert.equal(weekly, null);
});
