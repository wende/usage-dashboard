"""Fetch ChatGPT (wham) usage and emit a widget artifact."""

import base64
import json
import os
import urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

CRED_PATH = "/Users/wende/Documents/kimi/workspace/.quota-watch/chatgpt.json"
API_URL = "https://chatgpt.com/backend-api/wham/usage"
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


def run(ctx):
    cred = json.load(open(CRED_PATH, "r", encoding="utf-8"))
    token = cred["bearer"]
    req = urllib.request.Request(API_URL, method="GET", headers={
        "accept": "*/*",
        "authorization": "Bearer " + token,
        "oai-device-id": cred["deviceId"],
        "oai-language": "en-US",
        "referer": "https://chatgpt.com/",
        "user-agent": UA,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            now = datetime.now(LOCAL_TZ)
            artifact = {
                "asof": now.strftime("%Y-%m-%d %H:%M"),
                "tokenExpired": True,
                "tokenExpires": jwt_expiry(token),
                "weekly": {"pct": 0, "reset": ""},
                "plan": "unknown",
            }
            wrapper = {"artifact": artifact}
            output_file = os.environ.get("DAIMON_BLUEPRINT_AUTOMATION_OUTPUT_FILE")
            if output_file:
                with open(output_file, "w", encoding="utf-8") as handle:
                    json.dump(wrapper, handle)
            return wrapper
        raise RuntimeError(f"chatgpt request failed: {exc}")
    except Exception as exc:
        raise RuntimeError(f"chatgpt request failed: {exc}")

    rate = data.get("rate_limit") or {}
    primary = rate.get("primary_window") or {}
    reset_at = primary.get("reset_at")
    reset_dt = datetime.fromtimestamp(reset_at, tz=LOCAL_TZ) if reset_at else None
    reset_label = reset_dt.strftime("%Y-%m-%d %H:%M") if reset_dt else "unknown"
    start_dt = (reset_dt - timedelta(days=7)) if reset_dt else None

    def to_iso(dt):
        if not dt:
            return None
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    now = datetime.now(LOCAL_TZ)
    artifact = {
        "asof": now.strftime("%Y-%m-%d %H:%M"),
        "weekly": {
            "pct": round(float(primary.get("used_percent") or 0), 2),
            "reset": "resets " + reset_label,
            "resetAt": to_iso(reset_dt),
            "startAt": to_iso(start_dt),
        },
        "plan": (data.get("plan_type") or "unknown").capitalize(),
        "tokenExpires": jwt_expiry(token),
    }
    wrapper = {"artifact": artifact}
    output_file = os.environ.get("DAIMON_BLUEPRINT_AUTOMATION_OUTPUT_FILE")
    if output_file:
        with open(output_file, "w", encoding="utf-8") as handle:
            json.dump(wrapper, handle)
    return wrapper
