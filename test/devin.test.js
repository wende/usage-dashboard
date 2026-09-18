import assert from "node:assert/strict";
import test from "node:test";

import { parseDevinQuota } from "../lib/fetchers/devin.js";

// Captured live shape (2026-09-17, org on a quota plan, 0% used).
const FIXTURE = {
  is_quota_plan: true,
  has_quota_allocation: true,
  daily_percentage: 12.5,
  weekly_percentage: 3,
  daily_reset_at: "2026-09-18T00:00:00-08:00",
  weekly_reset_at: "2026-09-20T00:00:00-08:00",
  overage_balance: 10.0,
  hide_daily_quota: false,
};

test("maps daily/weekly percentages and reset windows", () => {
  const { daily, weekly } = parseDevinQuota(FIXTURE);
  assert.equal(daily.pct, 12.5);
  assert.equal(weekly.pct, 3);
  assert.match(daily.reset, /^resets \d{2}:\d{2}$/);
  assert.match(weekly.reset, /^resets \d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(Date.parse(daily.resetAt) - Date.parse(daily.startAt), 24 * 60 * 60 * 1000);
  assert.equal(Date.parse(weekly.resetAt) - Date.parse(weekly.startAt), 7 * 24 * 60 * 60 * 1000);
});

test("hide_daily_quota drops the daily window", () => {
  const { daily, weekly } = parseDevinQuota({ ...FIXTURE, hide_daily_quota: true });
  assert.equal(daily, null);
  assert.equal(weekly.pct, 3);
});

test("throws on an unexpected body", () => {
  assert.throws(() => parseDevinQuota({}), /devin: unexpected quota response/);
  assert.throws(() => parseDevinQuota(null), /devin: unexpected quota response/);
});
