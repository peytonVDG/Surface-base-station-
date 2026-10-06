#!/usr/bin/env bash
# Opens the display fullscreen in Chromium kiosk mode once the backend is up.
# Alt+F4 (or a keyboard) exits back to the normal desktop.
set -euo pipefail
URL="${KITCHEN_URL:-http://127.0.0.1:8787/}"
until curl -fsS "${URL}api/health" >/dev/null; do sleep 1; done
exec chromium --kiosk --noerrdialogs --disable-infobars --check-for-update-interval=31536000 \
  --overscroll-history-navigation=0 --disable-pinch --force-device-scale-factor=2 "$URL"
