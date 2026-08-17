"""Fetch Kimi subscription quota and emit a widget artifact.

Managed runner contract: expose run(ctx) and return the AutomationOutput
wrapper {"artifact": {...}}. The wrapper is also written to
DAIMON_BLUEPRINT_AUTOMATION_OUTPUT_FILE when available.
"""

import base64
import json
import os
import urllib.request
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TOKEN_PATH = "/Users/wende/Documents/kimi/workspace/.kimi-quota/token.txt"
API_URL = "https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats"
LOCAL_TZ = ZoneInfo("Europe/Warsaw")


def read_token():
    try:
        with open(TOKEN_PATH, "r", encoding="utf-8") as handle:
            token = handle.read().strip()
    except OSError as exc:
        raise RuntimeError(f"token file unreadable: {exc}")
    if token.count(".") != 2:
        raise RuntimeError("token file does not contain a JWT")
    return token


def token_expiry(token):
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))
        return datetime.fromtimestamp(claims["exp"], tz=LOCAL_TZ).strftime("%Y-%m-%d")
    except Exception:
        return "unknown"


def call_api(token):
    request = urllib.request.Request(
        API_URL,
        data=b"{}",
        method="POST",
        headers={
            "accept": "*/*",
            "authorization": f"Bearer {token}",
            "connect-protocol-version": "1",
            "content-type": "application/json",
            "origin": "https://www.kimi.com",
            "referer": "https://www.kimi.com/membership/subscription?tab=quota",
            "user-agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
            ),
            "x-language": "en-US",
            "x-msh-device-id": "7613748204189960704",
            "x-msh-platform": "web",
            "x-msh-version": "2.0.0",
            "x-traffic-id": "d44d3nms1rh2id9egmpg",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"quota request failed: {exc}")


def pct(ratio):
    return round(float(ratio or 0) * 100, 2)


def parse_ts(iso):
    if not iso:
        return None
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(LOCAL_TZ)


def to_iso(dt):
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def infer_start(reset_dt, period="weekly"):
    if not reset_dt:
        return None
    if period == "monthly":
        month = reset_dt.month - 1 or 12
        year = reset_dt.year if reset_dt.month > 1 else reset_dt.year - 1
        day = min(reset_dt.day, monthrange(year, month)[1])
        return reset_dt.replace(year=year, month=month, day=day)
    return reset_dt - timedelta(days=7)


def window_meta(reset_dt, start_dt=None, period="weekly"):
    start = start_dt or infer_start(reset_dt, period)
    return {"resetAt": to_iso(reset_dt), "startAt": to_iso(start)}


def run(ctx):
    token = read_token()
    data = call_api(token)
    if not isinstance(data, dict) or "subscriptionBalance" not in data:
        raise RuntimeError(f"unexpected API response: {json.dumps(data)[:200]}")

    now = datetime.now(LOCAL_TZ)
    balance = data["subscriptionBalance"]
    total_reset = parse_ts(balance.get("expireTime"))

    five = data.get("ratelimitCode5h") or {}
    seven = data.get("ratelimitCode7d") or {}
    five_reset = parse_ts(five.get("resetTime"))
    seven_reset = parse_ts(seven.get("resetTime"))

    gifts = []
    for gift in data.get("giftBalances") or []:
        exp = parse_ts(gift.get("expireTime"))
        gifts.append(
            {
                "pct": pct(gift.get("amountUsedRatio")),
                "expires": exp.strftime("%Y-%m-%d") if exp else "unknown",
            }
        )

    artifact = {
        "asof": now.strftime("%Y-%m-%d %H:%M"),
        "total": {
            "pct": pct(balance.get("amountUsedRatio")),
            "reset": "resets " + (total_reset.strftime("%Y-%m-%d") if total_reset else "unknown"),
            **window_meta(total_reset, period="monthly"),
        },
        "fiveHour": {
            "pct": pct(five.get("ratio")),
            "reset": "resets " + (five_reset.strftime("%m-%d %H:%M") if five_reset else "unknown"),
        },
        "sevenDay": {
            "pct": pct(seven.get("ratio")),
            "reset": "resets " + (seven_reset.strftime("%m-%d %H:%M") if seven_reset else "unknown"),
            **window_meta(seven_reset, period="weekly"),
        },
        "gifts": gifts,
        "tokenExpires": token_expiry(token),
    }

    wrapper = {"artifact": artifact}
    output_file = os.environ.get("DAIMON_BLUEPRINT_AUTOMATION_OUTPUT_FILE")
    if output_file:
        with open(output_file, "w", encoding="utf-8") as handle:
            json.dump(wrapper, handle)
    return wrapper
