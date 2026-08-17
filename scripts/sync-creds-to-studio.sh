#!/usr/bin/env bash
# Pushes locally-refreshed credentials (~/.quota-watch) to the Mac Studio,
# where the dashboard runs 24/7 as a launchd agent so it's reachable from
# iPhone without the MacBook being on.
#
# Run this after re-fetching any token via
# .cursor/skills/refetch-quota-credentials/SKILL.md — the remote server
# picks up new files on its next refresh cycle (or immediately via the
# curl call below), no restart needed.
#
# Note: claude.json may get a Cloudflare 403 ("stale") right after copy —
# Cloudflare flags the session cookie moving to a new IP. Usually clears up
# on its own after a bit of normal traffic from the Mac Studio.

set -euo pipefail

REMOTE_HOST="wende@krzysztofs-mac-studio.tail657ea.ts.net"
REMOTE_CRED_DIR="~/.quota-watch"
LOCAL_CRED_DIR="$HOME/.quota-watch"

FILES=(chatgpt.json claude.json cursor.json kimi.json kimi-token.txt minimax.json)

echo "Syncing credentials to $REMOTE_HOST..."
existing=()
for f in "${FILES[@]}"; do
  [ -f "$LOCAL_CRED_DIR/$f" ] && existing+=("$LOCAL_CRED_DIR/$f")
done

scp "${existing[@]}" "$REMOTE_HOST:$REMOTE_CRED_DIR/"
ssh "$REMOTE_HOST" "chmod 600 $REMOTE_CRED_DIR/*"

echo "Triggering remote refresh..."
curl -s -X POST "http://krzysztofs-mac-studio.tail657ea.ts.net:3847/api/refresh" -o /dev/null

echo "Done. Check http://krzysztofs-mac-studio.tail657ea.ts.net:3847/api/status"
