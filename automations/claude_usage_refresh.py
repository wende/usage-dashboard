"""Fetch Claude.ai usage and emit a widget artifact."""

import json
import os
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

CRED_PATH = "/Users/wende/Documents/kimi/workspace/.quota-watch/claude.json"
LOCAL_TZ = ZoneInfo("Europe/Warsaw")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36")


def parse_ts(iso):
    if not iso:
        return None
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(LOCAL_TZ)


def fmt_reset(ts, pattern):
    return "resets " + (ts.strftime(pattern) if ts else "unknown")


def to_iso(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def window_meta(reset_dt, hours=None, days=7):
    if not reset_dt:
        start = None
    elif hours is not None:
        start = reset_dt - timedelta(hours=hours)
    else:
        start = reset_dt - timedelta(days=days)
    return {"resetAt": to_iso(reset_dt), "startAt": to_iso(start)}


def run(ctx):
    cred = json.load(open(CRED_PATH, "r", encoding="utf-8"))
    url = f"https://claude.ai/api/organizations/{cred['orgId']}/usage"
    req = urllib.request.Request(url, method="GET", headers={
        "accept": "*/*",
        "content-type": "application/json",
        "cookie": cred["cookies"],
        "referer": "https://claude.ai/new",
        "user-agent": UA,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"claude request failed: {exc}")

    five = data.get("five_hour") or {}
    seven = data.get("seven_day") or {}
    five_reset = parse_ts(five.get("resets_at"))
    seven_reset = parse_ts(seven.get("resets_at"))

    scoped = []
    for limit in data.get("limits") or []:
        if limit.get("kind") == "weekly_scoped" and limit.get("scope"):
            model = (limit["scope"].get("model") or {}).get("display_name")
            if model:
                scoped.append({"name": model, "pct": round(float(limit.get("percent") or 0), 2)})

    now = datetime.now(LOCAL_TZ)
    artifact = {
        "asof": now.strftime("%Y-%m-%d %H:%M"),
        "fiveHour": {
            "pct": round(float(five.get("utilization") or 0), 2),
            "reset": fmt_reset(five_reset, "%m-%d %H:%M"),
            **window_meta(five_reset, hours=5),
        },
        "sevenDay": {
            "pct": round(float(seven.get("utilization") or 0), 2),
            "reset": fmt_reset(seven_reset, "%Y-%m-%d"),
            **window_meta(seven_reset, days=7),
        },
        "scoped": scoped,
        "tokenExpires": "session",
    }
    wrapper = {"artifact": artifact}
    output_file = os.environ.get("DAIMON_BLUEPRINT_AUTOMATION_OUTPUT_FILE")
    if output_file:
        with open(output_file, "w", encoding="utf-8") as handle:
            json.dump(wrapper, handle)
    return wrapper
