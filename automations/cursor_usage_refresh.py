"""Fetch Cursor usage-summary and emit a widget artifact."""

import json
import os
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

CRED_PATH = "/Users/wende/Documents/kimi/workspace/.quota-watch/cursor.json"
API_URL = "https://cursor.com/api/usage-summary"
LOCAL_TZ = ZoneInfo("Europe/Warsaw")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36")


def run(ctx):
    cred = json.load(open(CRED_PATH, "r", encoding="utf-8"))
    req = urllib.request.Request(API_URL, method="GET", headers={
        "accept": "*/*",
        "referer": "https://cursor.com/dashboard",
        "user-agent": UA,
        "cookie": cred["cookie"],
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"cursor request failed: {exc}")

    plan_usage = (data.get("individualUsage") or {}).get("plan") or {}
    total_pct = plan_usage.get("totalPercentUsed")
    api_pct = plan_usage.get("apiPercentUsed")

    def parse_dt(value):
        try:
            return (datetime.fromisoformat(str(value).replace("Z", "+00:00"))
                    .astimezone(LOCAL_TZ).strftime("%Y-%m-%d"))
        except Exception:
            return None

    start = parse_dt(data.get("billingCycleStart"))
    end = parse_dt(data.get("billingCycleEnd"))
    cycle = None
    if start and end:
        cycle = f"cycle {start} -> {end}"

    now = datetime.now(LOCAL_TZ)
    artifact = {
        "asof": now.strftime("%Y-%m-%d %H:%M"),
        "plan": (data.get("membershipType") or "unknown").capitalize(),
        "cycle": cycle,
        "total": {
            "pct": round(float(total_pct or 0), 2),
            "label": "included usage",
        },
        "api": {
            "pct": round(float(api_pct or 0), 2),
            "label": "API usage (named model)",
        },
    }
    wrapper = {"artifact": artifact}
    output_file = os.environ.get("DAIMON_BLUEPRINT_AUTOMATION_OUTPUT_FILE")
    if output_file:
        with open(output_file, "w", encoding="utf-8") as handle:
            json.dump(wrapper, handle)
    return wrapper
