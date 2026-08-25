import assert from "node:assert/strict";
import test from "node:test";

import {
  elapsedPct,
  formatReset,
  formatResetTime,
  inferPeriodStart,
  jwtExpMs,
  paceCell,
  parseResetDate,
  windowMeta,
} from "../lib/time.js";

test("infers five-hour start 5 hours before reset", () => {
  const reset = new Date("2026-08-17T20:09:00.000Z");
  assert.equal(
    inferPeriodStart(reset, "fiveHour").toISOString(),
    "2026-08-17T15:09:00.000Z"
  );
});

test("infers weekly start 7 days before reset", () => {
  const reset = new Date("2026-08-20T12:00:00.000Z");
  assert.equal(
    inferPeriodStart(reset, "weekly").toISOString(),
    "2026-08-13T12:00:00.000Z"
  );
});

test("infers monthly start one month before reset, clamping month-end", () => {
  const reset = new Date("2026-03-31T00:00:00.000Z");
  assert.equal(
    inferPeriodStart(reset, "monthly").toISOString(),
    "2026-02-28T00:00:00.000Z"
  );
});

test("elapsedPct is ~57% with 3 days left in a 7-day window", () => {
  const start = new Date("2026-08-13T12:00:00.000Z");
  const reset = new Date("2026-08-20T12:00:00.000Z");
  const now = new Date("2026-08-17T12:00:00.000Z");
  const pct = elapsedPct(start, reset, now);
  assert.ok(pct != null);
  assert.ok(Math.abs(pct - (4 / 7) * 100) < 1e-9);
});

test("elapsedPct clamps outside the window and rejects bad bounds", () => {
  const start = new Date("2026-08-13T12:00:00.000Z");
  const reset = new Date("2026-08-20T12:00:00.000Z");
  assert.equal(elapsedPct(start, reset, new Date("2026-08-12T12:00:00.000Z")), 0);
  assert.equal(elapsedPct(start, reset, new Date("2026-08-21T12:00:00.000Z")), 100);
  assert.equal(elapsedPct(reset, start, Date.now()), null);
  assert.equal(elapsedPct(null, reset.toISOString()), null);
});

test("paceCell is the first short cell, matching the usage fill scale", () => {
  assert.equal(paceCell(40, (4 / 7) * 100), 23);
  assert.equal(paceCell(40, 0), 0);
  assert.equal(paceCell(40, 100), 40);
  assert.equal(paceCell(28, (4 / 7) * 100), 16);
  assert.equal(paceCell(40, null), -1);
  assert.ok(paceCell(40, 70) > paceCell(40, 50));
});

test("windowMeta uses an explicit start when provided", () => {
  const start = new Date("2026-08-01T00:00:00.000Z");
  const reset = new Date("2026-09-01T00:00:00.000Z");
  assert.deepEqual(windowMeta(reset, { startDate: start, period: "monthly" }), {
    resetAt: "2026-09-01T00:00:00.000Z",
    startAt: "2026-08-01T00:00:00.000Z",
  });
});

test("windowMeta is empty when reset is missing", () => {
  assert.deepEqual(windowMeta(null, { period: "weekly" }), {
    resetAt: null,
    startAt: null,
  });
});

test("parseResetDate parses ISO strings", () => {
  assert.equal(
    parseResetDate("2025-01-01T00:00:00Z").toISOString(),
    "2025-01-01T00:00:00.000Z"
  );
});

test("parseResetDate parses epoch seconds and epoch ms", () => {
  assert.equal(parseResetDate(1735689600).toISOString(), "2025-01-01T00:00:00.000Z");
  assert.equal(parseResetDate("1735689600").toISOString(), "2025-01-01T00:00:00.000Z");
  assert.equal(parseResetDate(1735689600000).toISOString(), "2025-01-01T00:00:00.000Z");
});

test("parseResetDate returns null for missing or garbage input", () => {
  assert.equal(parseResetDate(null), null);
  assert.equal(parseResetDate(undefined), null);
  assert.equal(parseResetDate(""), null);
  assert.equal(parseResetDate("garbage"), null);
});

test("jwtExpMs reads the exp claim as epoch ms", () => {
  const payload = Buffer.from(JSON.stringify({ exp: 1735689600 })).toString("base64url");
  assert.equal(jwtExpMs(`aaa.${payload}.bbb`), 1735689600000);
});

test("jwtExpMs returns null for garbage or missing exp", () => {
  assert.equal(jwtExpMs("not-a-jwt"), null);
  const payload = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
  assert.equal(jwtExpMs(`aaa.${payload}.bbb`), null);
});

test("formatReset is 'resets MM-DD HH:MM'", () => {
  assert.match(formatReset(new Date("2026-08-25T23:07:00Z")), /^resets \d{2}-\d{2} \d{2}:\d{2}$/);
});

test("formatResetTime is 'resets HH:MM'", () => {
  assert.match(formatResetTime(new Date("2026-08-25T23:07:00Z")), /^resets \d{2}:\d{2}$/);
});
