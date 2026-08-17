import assert from "node:assert/strict";
import test from "node:test";

import { decodeGrokUsageResponse } from "../lib/fetchers/grok.js";

test("decodes Grok's gRPC-Web credits response", () => {
  const fixture = Buffer.from(
    "00000000520a500d0000004012001a00220b08b78583d40610a0b2b65b2a0b08b7faa7d40610a0b2b65b3a0708021500000040421c0802120b08b78583d40610a0b2b65b1a0b08b7faa7d40610a0b2b65b580162006801800000000f677270632d7374617475733a300d0a",
    "hex"
  );

  const usage = decodeGrokUsageResponse(fixture);
  assert.equal(usage.creditUsagePercent, 2);
  assert.equal(usage.currentPeriod.type, "weekly");
  assert.equal(usage.currentPeriod.start.toISOString(), "2026-08-15T19:49:11.191Z");
  assert.equal(usage.currentPeriod.end.toISOString(), "2026-08-22T19:49:11.191Z");
  assert.deepEqual(usage.productUsage, [{ product: "build", pct: 2 }]);
});
