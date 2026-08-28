import assert from "node:assert/strict";
import test from "node:test";

import { parseGlmQuota } from "../lib/fetchers/glm.js";

// Captured live shapes (anonymized): TOKENS_LIMIT is the pre-2026-08 name for
// the percentage quotas, CREDIT_LIMIT the current one. Lite plans omit
// nextResetTime on the active 5-hour window.
const TOKENS_FIXTURE = {
  code: 200, msg: "Operation successful", success: true,
  data: {
    level: "pro",
    limits: [
      { type: "TOKENS_LIMIT", unit: 3, number: 5, percentage: 17, nextResetTime: 1782724971179 },
      { type: "TOKENS_LIMIT", unit: 6, number: 1, percentage: 3, nextResetTime: 1783305486997 },
      { type: "TIME_LIMIT", unit: 5, number: 1, usage: 1000, currentValue: 0,
        remaining: 1000, percentage: 0, nextResetTime: 1785292686976 },
    ],
  },
};

const CREDIT_FIXTURE = {
  code: 200, msg: "Operation successful", success: true,
  data: {
    level: "lite",
    limits: [
      { type: "CREDIT_LIMIT", unit: 3, number: 5, usage: 2000, currentValue: 0,
        remaining: 2000, percentage: 0 },
      { type: "CREDIT_LIMIT", unit: 6, number: 1, usage: 10000, currentValue: 9855,
        remaining: 145, percentage: 98, nextResetTime: 1786685679998 },
    ],
  },
};

test("maps unit=3 to 5h and unit=6 to weekly (TOKENS_LIMIT)", () => {
  const { fiveHour, weekly } = parseGlmQuota(TOKENS_FIXTURE);
  assert.equal(fiveHour.pct, 17);
  assert.equal(weekly.pct, 3);
  assert.match(fiveHour.reset, /^resets \d{2}:\d{2}$/);
  assert.match(weekly.reset, /^resets \d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(Date.parse(fiveHour.resetAt) - Date.parse(fiveHour.startAt), 5 * 60 * 60 * 1000);
  assert.equal(Date.parse(weekly.resetAt) - Date.parse(weekly.startAt), 7 * 24 * 60 * 60 * 1000);
});

test("maps CREDIT_LIMIT quotas and tolerates a missing 5h reset time", () => {
  const { fiveHour, weekly } = parseGlmQuota(CREDIT_FIXTURE);
  assert.equal(fiveHour.pct, 0);
  assert.equal(weekly.pct, 98);
  assert.equal(fiveHour.reset, "unknown");
  assert.equal(fiveHour.resetAt, null);
  assert.notEqual(weekly.resetAt, null);
});

test("throws the API message on a no-coding-plan body", () => {
  const body = { success: false, code: 500, msg: "no active coding plan" };
  assert.throws(() => parseGlmQuota(body), /glm: no active coding plan/);
});

test("throws on an unexpected body", () => {
  assert.throws(() => parseGlmQuota({}), /glm:/);
});
