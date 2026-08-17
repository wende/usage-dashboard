import assert from "node:assert/strict";
import test from "node:test";

import { StaleError } from "../lib/errors.js";
import { pct, request, requestJson, titleCase } from "../lib/fetchers/common.js";
import { UA } from "../lib/time.js";

function stubFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

test("pct rounds numbers to 2 decimals", () => {
  assert.equal(pct(12.345), 12.35);
  assert.equal(pct(0), 0);
  assert.equal(pct(100), 100);
});

test("pct parses strings with or without a % suffix", () => {
  assert.equal(pct("45.678%"), 45.68);
  assert.equal(pct("12.5"), 12.5);
});

test("pct coerces missing and non-finite values to 0", () => {
  assert.equal(pct(null), 0);
  assert.equal(pct(undefined), 0);
  assert.equal(pct(""), 0);
  assert.equal(pct(NaN), 0);
});

test("titleCase capitalizes the first letter and lowers the rest", () => {
  assert.equal(titleCase("PLUS"), "Plus");
  assert.equal(titleCase("free"), "Free");
  assert.equal(titleCase(""), "");
  assert.equal(titleCase(null), "");
});

test("request throws StaleError on stale statuses", async () => {
  const restore = stubFetch(async () => ({ status: 403, ok: false }));
  try {
    await assert.rejects(request("test", "http://x"), (err) => {
      assert.ok(err instanceof StaleError);
      assert.match(err.message, /test session rejected \(HTTP 403\)/);
      return true;
    });
  } finally {
    restore();
  }
});

test("request honors staleStatuses override", async () => {
  const restore = stubFetch(async () => ({ status: 401, ok: false }));
  try {
    await assert.rejects(
      request("test", "http://x", { staleStatuses: [] }),
      (err) => {
        assert.ok(!(err instanceof StaleError));
        assert.match(err.message, /test request failed: HTTP 401/);
        return true;
      }
    );
  } finally {
    restore();
  }
});

test("request throws plain Error on other non-2xx", async () => {
  const restore = stubFetch(async () => ({ status: 500, ok: false }));
  try {
    await assert.rejects(request("test", "http://x"), (err) => {
      assert.ok(!(err instanceof StaleError));
      assert.match(err.message, /HTTP 500/);
      return true;
    });
  } finally {
    restore();
  }
});

test("request sends UA, a timeout signal, and merged headers", async () => {
  let seen;
  const restore = stubFetch(async (url, opts) => {
    seen = { url, opts };
    return { status: 200, ok: true };
  });
  try {
    const res = await request("test", "http://x", {
      headers: { accept: "*/*", "user-agent": "override" },
    });
    assert.equal(res.ok, true);
    assert.equal(seen.url, "http://x");
    assert.equal(seen.opts.headers["user-agent"], "override");
    assert.ok(seen.opts.signal instanceof AbortSignal);
  } finally {
    restore();
  }
  // default UA when not overridden
  const restore2 = stubFetch(async (url, opts) => {
    seen = { url, opts };
    return { status: 200, ok: true };
  });
  try {
    await request("test", "http://x");
    assert.equal(seen.opts.headers["user-agent"], UA);
  } finally {
    restore2();
  }
});

test("requestJson parses the JSON body", async () => {
  const restore = stubFetch(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ hello: "world" }),
  }));
  try {
    assert.deepEqual(await requestJson("test", "http://x"), { hello: "world" });
  } finally {
    restore();
  }
});
