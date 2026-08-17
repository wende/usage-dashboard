"""Fetch MiniMax token-plan remaining quota and emit a widget artifact."""

import base64
import json
import os
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

CRED_PATH = "/Users/wende/Documents/kimi/workspace/.quota-watch/minimax.json"
API_URL = "https://platform.minimax.io/backend/account/token_plan/remains_percent"
LOCAL_TZ = ZoneInfo("Europe/Warsaw")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36")


def jwt_expiry(token):
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return datetime.fromtimestamp(claims["exp"], tz=LOCAL_TZ).strftime("%Y-%m-%d")
    except Exception:
        return "unknown"


def parse_pct(value):
    """'7%' -> 7.0 ; numbers pass through."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    return round(float(str(value).replace("%", "").strip() or 0), 2)


def fmt_ms(ms, pattern):
    if not ms:
        return "unknown"
    return datetime.fromtimestamp(int(ms) / 1000, tz=LOCAL_TZ).strftime(pattern)


def run(ctx):
    cred = json.load(open(CRED_PATH, "r", encoding="utf-8"))
    token = cred["token"]
    req = urllib.request.Request(API_URL, method="GET", headers={
        "accept": "application/json, text/plain, */*",
        "cookie": "_token=" + token,
        "x-group-id": cred["groupId"],
        "referer": "https://platform.minimax.io/console/usage",
        "user-agent": UA,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"minimax request failed: {exc}")

    models = data.get("model_remains") or []
    general = next((m for m in models if m.get("model_name") == "general"), models[0] if models else None)
    if not general:
        raise RuntimeError(f"no model quota in response: {json.dumps(data)[:200]}")

    def to_iso(ms):
        if not ms:
            return None
        dt = datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
        return dt.isoformat().replace("+00:00", "Z")

    weekly_end_ms = general.get("weekly_end_time")
    weekly_start_ms = (int(weekly_end_ms) - 7 * 24 * 60 * 60 * 1000) if weekly_end_ms else None

    now = datetime.now(LOCAL_TZ)
    artifact = {
        "asof": now.strftime("%Y-%m-%d %H:%M"),
        "weekly": {
            "pct": parse_pct(general.get("current_weekly_used_percent")),
            "reset": "resets " + fmt_ms(general.get("weekly_end_time"), "%Y-%m-%d"),
            "resetAt": to_iso(weekly_end_ms),
            "startAt": to_iso(weekly_start_ms),
        },
        "window": {
            "pct": parse_pct(general.get("current_interval_used_percent")),
            "reset": "resets " + fmt_ms(general.get("end_time"), "%m-%d %H:%M"),
        },
        "tokenExpires": jwt_expiry(token),
    }
    wrapper = {"artifact": artifact}
    output_file = os.environ.get("DAIMON_BLUEPRINT_AUTOMATION_OUTPUT_FILE")
    if output_file:
        with open(output_file, "w", encoding="utf-8") as handle:
            json.dump(wrapper, handle)
    return wrapper
