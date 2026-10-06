# Surface kitchen display

A Snoopy-themed, always-on kitchen dashboard for a Surface Pro 7 running Ubuntu
(linux-surface kernel) in Chromium kiosk mode. One local web app: a small Python
backend that holds keys and fetches data, and a Svelte page that only draws.

Status: **Home screen shell.** Clock, live weather, a sky that follows the real
sun and weather, the leave-for-work countdown, quick settings and sleep mode all
work. The brief shows sample data behind a clean interface; Todoist and Google
Calendar connect from Settings > Connections (see below). Keep, the Obsidian
cookbook and YouTube come next.

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

### Phone preview (GitHub Pages)

`.github/workflows/pages.yml` publishes `npm run build:pages` on every push:
the web app on sample calendar and to-dos, with live weather fetched straight
from Open-Meteo. Turn it on once under Settings > Pages > Source: GitHub
Actions. It's served at https://peytonvdg.github.io/Surface-base-station-/.

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
| GET | `/api/art/search` | Search the art library (`q`, `holiday`, `placement`, `vector`, `transparent`, `animated`) |
| GET, POST | `/api/art/status`, `/api/art/reindex` | Library counts and the `_inbox` queue; rebuild the index |
| GET, PATCH, DELETE | `/api/settings` | Read, partial update, reset |
| PUT | `/api/backlight` | `{"percent": 40}` |

## Art library

`art/` holds the images the display draws on (holiday props, characters, scenes) and a
`manifest.json` describing each one: subject, tags, holidays, seasons, where it sits on
screen (`ground`, `sky`, `overlay`, `corner`, `full-background`), vector/transparent/animated
flags, and a caption. The server builds a search index (`index.sqlite`) from that, so
looking something up never opens an image. Search it first; only go to the web when
nothing fits, then add what you found.

The repo ships ~50 freely licensed placeholder props (OpenMoji, see `art/CREDITS.md`).
On the Surface, point `art_dir` in `config.toml` at the microSD card (for example
`/media/art`) using the same layout (`characters/`, `props/`, `scenes/`, `animated/`).
Real Peanuts art goes only on that card, never in this public repo.

```
kitchen-art search ghost --holiday halloween   # find images
kitchen-art pending                            # files waiting in _inbox/
kitchen-art add dancing.gif --folder characters/snoopy --subject snoopy \
    --caption "Snoopy dances" --holidays birthday --placement overlay
kitchen-art reindex                            # after editing manifest.json by hand
```

## Connecting Todoist and Google Calendar

The repository is public, so no account data, token or secret is ever stored in
it. You sign in on the Surface itself and the backend keeps the result in
`~/.local/share/kitchen-display/credentials.json` (owner-only, outside the repo).
The GitHub Pages preview has no sign-in and only ever shows sample data.

**Todoist** (one minute): in Todoist open Settings > Integrations > Developer,
copy the API token. On the display: swipe down > All settings > Connections,
paste it, tap Connect.

**Google Calendar** (one-time setup, about 10 minutes, free):

1. Go to https://console.cloud.google.com/projectcreate, name it "Kitchen display", Create.
2. Open https://console.cloud.google.com/apis/library/calendar-json.googleapis.com and click Enable.
3. Open https://console.cloud.google.com/auth/branding, fill in an app name and your email, then Save. Under Audience choose External and add your own Gmail address as a test user.
4. Open https://console.cloud.google.com/auth/clients, Create client, type "Desktop app", Create. Copy the client ID and client secret.
5. On the display: Connections > paste both > Save > Sign in with Google, pick your account, Allow. The only permission asked for is read-only calendar access.

While the Google project is in "Testing" mode, Google expires the sign-in after
7 days. Fix: on the Audience page click Publish app (no review is needed for a
personal app that only you use; Google shows an "unverified app" warning you can
click through).

Alternatively put `google_client_id` / `google_client_secret` in `config.toml`.
Sign-in reaches the backend at `http://127.0.0.1:8787`, so do it in the
Surface's own browser. API: `GET /api/connections` reports connected or not and
never returns a secret.

## Adding an integration

Implement the matching protocol in `server/kitchen/providers/base.py` and swap
it in `build_providers()` in `app.py`. The routes and the web app don't change.
