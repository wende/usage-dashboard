// Distinct error type for credential/token problems. Anything that reaches the
// HTTP layer with a 401 (or an expired/invalid local token) is "stale": the
// cached data may still be there, but it can't be trusted and needs the user
// to refresh credentials. Other failures (network, 5xx, parse errors, etc.)
// are surfaced as plain Error so the server reports "error" rather than
// "stale" — they are not credential issues.
export class StaleError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "StaleError";
    this.code = "stale";
    if (cause) this.cause = cause;
  }
}