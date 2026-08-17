import { readJsonCred } from "../paths.js";
import { UA, formatAsof, formatShort } from "../time.js";
import { StaleError } from "../errors.js";

const USAGE_URL =
  "https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig";

const PERIOD_NAMES = { 1: "monthly", 2: "weekly" };
const PRODUCT_NAMES = { 1: "chat", 2: "build", 3: "imagine", 4: "voice" };

class ProtoReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  get done() {
    return this.offset >= this.buffer.length;
  }

  uint64() {
    let value = 0n;
    let shift = 0n;
    while (this.offset < this.buffer.length) {
      const byte = this.buffer[this.offset++];
      value |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return value;
      shift += 7n;
      if (shift > 63n) throw new Error("protobuf varint is too long");
    }
    throw new Error("truncated protobuf varint");
  }

  bytes() {
    const length = Number(this.uint64());
    const end = this.offset + length;
    if (!Number.isSafeInteger(length) || end > this.buffer.length) {
      throw new Error("truncated protobuf bytes field");
    }
    const value = this.buffer.subarray(this.offset, end);
    this.offset = end;
    return value;
  }

  float32() {
    if (this.offset + 4 > this.buffer.length) {
      throw new Error("truncated protobuf float field");
    }
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  skip(wireType) {
    if (wireType === 0) {
      this.uint64();
      return;
    }
    if (wireType === 1) this.offset += 8;
    else if (wireType === 2) {
      this.bytes();
      return;
    } else if (wireType === 5) this.offset += 4;
    else throw new Error(`unsupported protobuf wire type ${wireType}`);

    if (this.offset > this.buffer.length) {
      throw new Error("truncated protobuf field");
    }
  }
}

function readFields(buffer, handlers) {
  const reader = new ProtoReader(buffer);
  while (!reader.done) {
    const tag = Number(reader.uint64());
    const field = tag >>> 3;
    const wireType = tag & 7;
    const handler = handlers[field];
    if (handler) handler(reader, wireType);
    else reader.skip(wireType);
  }
}

function parseTimestamp(buffer) {
  let seconds = 0n;
  let nanos = 0;
  readFields(buffer, {
    1(reader, wireType) {
      if (wireType !== 0) throw new Error("invalid timestamp seconds field");
      seconds = reader.uint64();
    },
    2(reader, wireType) {
      if (wireType !== 0) throw new Error("invalid timestamp nanos field");
      nanos = Number(reader.uint64());
    },
  });
  return new Date(Number(seconds) * 1000 + Math.floor(nanos / 1e6));
}

function parsePeriod(buffer) {
  const period = { type: "unknown", start: null, end: null };
  readFields(buffer, {
    1(reader, wireType) {
      if (wireType !== 0) throw new Error("invalid usage period type field");
      const type = Number(reader.uint64());
      period.type = PERIOD_NAMES[type] || "unknown";
    },
    2(reader, wireType) {
      if (wireType !== 2) throw new Error("invalid usage period start field");
      period.start = parseTimestamp(reader.bytes());
    },
    3(reader, wireType) {
      if (wireType !== 2) throw new Error("invalid usage period end field");
      period.end = parseTimestamp(reader.bytes());
    },
  });
  return period;
}

function parseProductUsage(buffer) {
  const usage = { product: "unknown", pct: 0 };
  readFields(buffer, {
    1(reader, wireType) {
      if (wireType !== 0) throw new Error("invalid product usage type field");
      const product = Number(reader.uint64());
      usage.product = PRODUCT_NAMES[product] || `product-${product}`;
    },
    2(reader, wireType) {
      if (wireType !== 5) throw new Error("invalid product usage percent field");
      usage.pct = reader.float32();
    },
  });
  return usage;
}

function parseConfig(buffer) {
  const config = {
    creditUsagePercent: 0,
    currentPeriod: null,
    productUsage: [],
  };
  readFields(buffer, {
    1(reader, wireType) {
      if (wireType !== 5) throw new Error("invalid credit usage percent field");
      config.creditUsagePercent = reader.float32();
    },
    7(reader, wireType) {
      if (wireType !== 2) throw new Error("invalid product usage field");
      config.productUsage.push(parseProductUsage(reader.bytes()));
    },
    8(reader, wireType) {
      if (wireType !== 2) throw new Error("invalid current period field");
      config.currentPeriod = parsePeriod(reader.bytes());
    },
  });
  return config;
}

function parseGrpcWeb(buffer) {
  let offset = 0;
  let message = null;
  let grpcStatus = 0;
  let grpcMessage = "";

  while (offset + 5 <= buffer.length) {
    const flags = buffer[offset];
    const length = buffer.readUInt32BE(offset + 1);
    const end = offset + 5 + length;
    if (end > buffer.length) throw new Error("truncated gRPC-Web frame");
    const payload = buffer.subarray(offset + 5, end);

    if ((flags & 0x80) !== 0) {
      const trailers = payload.toString("utf8");
      const statusMatch = trailers.match(/(?:^|\r\n)grpc-status:\s*(\d+)/i);
      const messageMatch = trailers.match(/(?:^|\r\n)grpc-message:\s*([^\r\n]*)/i);
      if (statusMatch) grpcStatus = Number(statusMatch[1]);
      if (messageMatch) grpcMessage = decodeURIComponent(messageMatch[1]);
    } else if (flags === 0) {
      message = payload;
    }
    offset = end;
  }

  return { message, grpcStatus, grpcMessage };
}

export function decodeGrokUsageResponse(buffer) {
  const { message, grpcStatus, grpcMessage } = parseGrpcWeb(buffer);
  if (grpcStatus !== 0) {
    const error = new Error(grpcMessage || `gRPC status ${grpcStatus}`);
    error.grpcStatus = grpcStatus;
    throw error;
  }
  if (!message) throw new Error("Grok usage response contained no message");

  let config = null;
  readFields(message, {
    1(reader, wireType) {
      if (wireType !== 2) throw new Error("invalid Grok usage config field");
      config = parseConfig(reader.bytes());
    },
  });
  if (!config) throw new Error("Grok usage response contained no config");
  return config;
}

export async function fetchGrok() {
  const cred = readJsonCred("grok.json");
  const cookie = cred.sso ? `sso=${cred.sso}` : cred.cookies;
  if (!cookie) throw new Error("grok.json must contain sso or cookies");

  const res = await fetch(USAGE_URL, {
    method: "POST",
    headers: {
      accept: "*/*",
      "content-type": "application/grpc-web+proto",
      cookie,
      origin: "https://grok.com",
      referer: "https://grok.com/?_s=usage",
      "user-agent": UA,
      "x-grpc-web": "1",
      "x-user-agent": "connect-es/2.1.1",
    },
    body: Buffer.alloc(5),
    signal: AbortSignal.timeout(30000),
  });

  if (res.status === 401 || res.status === 403) {
    throw new StaleError(`grok session rejected (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(`grok request failed: HTTP ${res.status}`);

  const headerStatus = Number(res.headers.get("grpc-status") || 0);
  const headerMessage = decodeURIComponent(res.headers.get("grpc-message") || "");
  if (headerStatus === 16) {
    throw new StaleError(headerMessage || "grok session rejected");
  }
  if (headerStatus !== 0) {
    throw new Error(headerMessage || `grok request failed: gRPC ${headerStatus}`);
  }

  let config;
  try {
    config = decodeGrokUsageResponse(Buffer.from(await res.arrayBuffer()));
  } catch (err) {
    if (err?.grpcStatus === 16) throw new StaleError(err.message, err);
    throw err;
  }

  const pct = Math.round(config.creditUsagePercent * 100) / 100;
  const resetDate = config.currentPeriod?.end;
  return {
    asof: formatAsof(),
    weekly: {
      pct,
      reset: resetDate ? `resets ${formatShort(resetDate)}` : "resets unknown",
    },
    plan: cred.plan || "",
    period: config.currentPeriod?.type || "unknown",
    productUsage: config.productUsage,
    tokenExpires: "session",
  };
}
