import assert from "node:assert/strict";
import test from "node:test";

import { StaleError } from "../lib/errors.js";
import { fetchClaudeWith } from "../lib/fetchers/claude.js";

const FIXTURE = {
  five_hour: { utilization: 12.34, resets_at: "2026-09-24T12:59:59.864Z" },
  seven_day: { utilization: 65, resets_at: "2026-09-25T14:59:59.865Z" },
  limits: [
    { kind: "weekly_scoped", percent: 41.5, scope: { model: { display_name: "Opus" } } },
    { kind: "other", percent: 99, scope: { model: { display_name: "Ignored" } } },
  ],
};

test("returns primary fetch data when it succeeds", async () => {
  const calls = { primary: 0, fallback: 0 };
  const result = await fetchClaudeWith(
    async () => {
      calls.primary += 1;
      return FIXTURE;
    },
    async () => {
      calls.fallback += 1;
      throw new Error("fallback must not run");
    }
  );
  assert.equal(calls.primary, 1);
  assert.equal(calls.fallback, 0);
  assert.equal(result.fiveHour.pct, 12.34);
  assert.deepEqual(result.scoped, [{ name: "Opus", pct: 41.5 }]);
});

test("falls back on StaleError (403) and maps fallback data", async () => {
  const calls = { primary: 0, fallback: 0 };
  const result = await fetchClaudeWith(
    async () => {
      calls.primary += 1;
      throw new StaleError("claude session rejected (HTTP 403)");
    },
    async () => {
      calls.fallback += 1;
      return FIXTURE;
    }
  );
  assert.equal(calls.primary, 1);
  assert.equal(calls.fallback, 1);
  assert.equal(result.fiveHour.pct, 12.34);
  assert.equal(result.tokenExpires, "session");
});

test("rethrows non-stale errors instead of falling back", async () => {
  await assert.rejects(
    fetchClaudeWith(
      async () => {
        throw new Error("claude request failed: HTTP 500");
      },
      async () => {
        throw new Error("fallback must not run");
      }
    ),
    /HTTP 500/
  );
});
