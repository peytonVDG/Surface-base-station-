# Surface kitchen display

A Snoopy-themed, always-on kitchen dashboard for a Surface Pro 7 running Ubuntu
(linux-surface kernel) in Chromium kiosk mode. One local web app: a small Python
backend that holds keys and fetches data, and a Svelte page that only draws.

Status: **Home screen shell.** Clock, live weather, a sky that follows the real
sun and weather, the leave-for-work countdown, quick settings and sleep mode all
work. Calendar, to-dos and the brief show sample data behind clean interfaces;
Todoist, Google Calendar, Keep, the Obsidian cookbook and YouTube come next.

## Layout

```
server/   Python (FastAPI) backend on 127.0.0.1:8787
  kitchen/app.py              API routes; serves web/dist in production
  kitchen/providers/base.py   Interfaces each integration implements
  kitchen/providers/weather.py  Open-Meteo, polled every 15 min, cached to disk
  kitchen/providers/samples.py  Placeholder calendar, to-dos, brief
  kitchen/settings.py         settings.json: preferences + schedule
  kitchen/display.py          Backlight via brightnessctl (no-op off-device)
web/      Svelte 5 + TypeScript (Vite)
  src/App.svelte              Stage scaling, sleep/wake, brightness, layout
  src/lib/schedule.ts         When the screen sleeps; the morning countdown
  src/lib/sky/                suncalc positions, palette, canvas renderer
  src/components/             Home cards, quick settings, sleep clock
deploy/   systemd unit and Chromium kiosk launcher
```

The page is laid out on a fixed 1368×912 stage (the Surface's 2736×1824 screen
at 200% scaling) and scaled to fit, so it looks the same in any browser window.

## Run it

Needs Python 3.11+ and Node 20+.

```bash
# backend
cd server
python3 -m venv .venv && .venv/bin/pip install -e ".[dev]"
cp config.example.toml config.toml   # set latitude/longitude for real weather
.venv/bin/python -m kitchen           # http://127.0.0.1:8787

# web app, in another terminal
cd web
npm install
npm run dev                           # http://localhost:5173, proxies /api to the backend
```

For the device, `npm run build` once and the backend serves `web/dist` itself,
so only the backend runs. `deploy/kitchen-display.service` starts it at login
and `deploy/kiosk.sh` opens Chromium fullscreen.

### Demo build (no backend)

`npm run build:demo` writes `web/dist-demo/demo.html`, one self-contained page
on sample data with the sky set for Middleville. It runs anywhere, including a
phone browser; turn the phone sideways.

Without a location the weather is sample data and the sky guesses your
longitude from the time zone.

### Trying different times and weather

Add query parameters to the URL:

- `?at=2026-10-06T05:20` runs the clock from that moment (try a weekday 4:30 to
  6:10 for the countdown ring, after midnight for sleep mode)
- `?wx=rain` forces the sky: `clear`, `partly`, `cloudy`, `fog`, `rain`, `storm`, `snow`

### Tests

```bash
cd server && .venv/bin/python -m pytest
cd web && npm test && npm run check
```

## How Home behaves

- **Sky:** colours blend continuously with the sun's real altitude (suncalc), so
  dawn and dusk land at the real times. Cloud count follows cloud cover; rain and
  snow follow the precipitation rate; the moon shows its real phase. 30 fps by
  day, 15 at night, 6 in calm mode, a still frame every 30 s with animations off,
  and fully stopped while asleep.
- **Schedule** (Settings → `schedule` in settings.json): weekdays wake 4:30,
  leave 6:10, sleep while at work until 3:00, sleep at midnight. Weekends wake at
  7:00 and skip the daytime sleep, as does an all-day "Off"/"PTO"/"Vacation"
  event. A tap wakes it for 2 minutes after the last touch.
- **Sleep mode:** black screen, dim clock that moves every minute, backlight at
  its lowest.
- **Quick settings:** swipe down from the top edge, or press and hold the clock.
  Brightness, volume, Dim now, Sleep now, 24-hour, Night look, Calm motion, Mute
  mic. "Dim now" and "Sleep now" last until the schedule's next change.
- **Countdown:** weekday mornings a ring drains clockwise around the screen from
  green to red; the card turns amber at 20 minutes and red at 10. The rest of the
  day the card counts down to the next calendar event.

## API

| Method | Path | |
|---|---|---|
| GET | `/api/config` | Location and whether a hardware backlight exists |
| GET | `/api/weather` | Current, today, next 12 hours (`status`: live, stale, sample) |
| GET | `/api/calendar` | Today's and tomorrow's events |
| GET, PATCH | `/api/todos`, `/api/todos/{id}` | List; `{"done": true}` to check off |
| GET | `/api/brief` | Link to the daily-brief artifact |
| GET, PATCH, DELETE | `/api/settings` | Read, partial update, reset |
| PUT | `/api/backlight` | `{"percent": 40}` |

## Adding an integration

Implement the matching protocol in `server/kitchen/providers/base.py` and swap
it in `build_providers()` in `app.py`. The routes and the web app don't change.
