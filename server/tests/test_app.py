import json
import time
from datetime import datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient

from kitchen.app import Providers, create_app
from kitchen.config import Config, load_config
from kitchen.display import Backlight
from kitchen.providers.samples import ConfiguredBrief, SampleCalendar, SampleTodos  # noqa
from kitchen.providers.weather import OpenMeteoWeather, SampleWeather, condition_for
from kitchen.settings import SettingsStore


def forecast_payload(now: int) -> dict:
    hours = [now - 3600 + i * 3600 for i in range(30)]
    return {
        "current": {"temperature_2m": 12.3, "weather_code": 61, "cloud_cover": 90, "precipitation": 1.2,
                    "wind_speed_10m": 14.0, "is_day": 1},
        "hourly": {"time": hours, "temperature_2m": [10.0 + i * 0.1 for i in range(30)],
                   "weather_code": [61] * 30, "precipitation_probability": [70] * 30},
        "daily": {"temperature_2m_max": [15.0, 16.0], "temperature_2m_min": [7.0, 8.0],
                  "sunrise": [now - 20000, now + 66000], "sunset": [now + 20000, now + 106000]},
    }


@pytest.fixture
def client(tmp_path):
    cfg = Config(data_dir=tmp_path, web_dist=tmp_path / "nope")
    app = create_app(cfg, Providers(SampleWeather(), SampleCalendar(), SampleTodos(), ConfiguredBrief("")),
                     SettingsStore(tmp_path / "settings.json"), Backlight())
    with TestClient(app) as c:
        yield c


def test_condition_codes():
    assert condition_for(0) == "clear"
    assert condition_for(2) == "partly"
    assert condition_for(45) == "fog"
    assert condition_for(63) == "rain"
    assert condition_for(81) == "rain"
    assert condition_for(75) == "snow"
    assert condition_for(95) == "storm"


def test_sample_endpoints(client):
    w = client.get("/api/weather").json()
    assert w["status"] == "sample" and len(w["hourly"]) == 12
    cal = client.get("/api/calendar").json()
    assert cal["status"] == "sample" and cal["events"]
    brief = client.get("/api/brief").json()
    assert brief == {"status": "sample", "url": "", "updated_at": None}


def test_todo_toggle(client):
    items = client.patch("/api/todos/2", json={"done": True}).json()["items"]
    assert next(t for t in items if t["id"] == "2")["done"] is True
    assert client.patch("/api/todos/nope", json={"done": True}).status_code == 404


def test_settings_patch_persists_and_validates(client, tmp_path):
    s = client.patch("/api/settings", json={"clock_24h": True, "schedule": {"leave_for_work": "06:20"}}).json()
    assert s["clock_24h"] is True
    assert s["schedule"]["leave_for_work"] == "06:20"
    assert s["schedule"]["weekday_wake"] == "04:30"  # untouched nested field kept
    saved = json.loads((tmp_path / "settings.json").read_text())
    assert saved["schedule"]["leave_for_work"] == "06:20"

    assert client.patch("/api/settings", json={"schedule": {"sleep_at": "25:00"}}).status_code == 422
    assert client.patch("/api/settings", json={"brightness": 0}).status_code == 422
    assert client.get("/api/settings").json()["schedule"]["sleep_at"] == "00:00"

    assert client.delete("/api/settings").json()["clock_24h"] is False


def test_settings_salvages_bad_file(tmp_path):
    p = tmp_path / "settings.json"
    p.write_text(json.dumps({"clock_24h": True, "brightness": 900, "bogus": 1}))
    s = SettingsStore(p).get()
    assert s.clock_24h is True and s.brightness == 100


def test_backlight_without_hardware(client):
    assert client.put("/api/backlight", json={"percent": 40}).json()["hardware"] is False


def test_config_from_env(tmp_path):
    cfg = load_config(tmp_path / "missing.toml", {"KITCHEN_LATITUDE": "40.5", "KITCHEN_LONGITUDE": "-111.9"})
    assert cfg.has_location and cfg.latitude == 40.5
    assert not load_config(tmp_path / "missing.toml", {}).has_location


async def test_open_meteo_parses_caches_and_falls_back(tmp_path):
    now = int(time.time())
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] > 1:
            return httpx.Response(503)
        return httpx.Response(200, json=forecast_payload(now))

    cache = tmp_path / "weather.json"
    w = OpenMeteoWeather(40, -111, cache, "Home", httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    got = await w.get()
    assert got.status == "live" and got.current.condition == "rain" and got.location_name == "Home"
    assert len(got.hourly) == 12 and got.hourly[0].time > datetime.now(timezone.utc)
    assert cache.exists()

    # A restart with the network down serves the cached copy.
    offline = OpenMeteoWeather(40, -111, cache, "Home", httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    assert (await offline.get()).current.temp_c == 12.3

    # No cache and no network: sample weather rather than an error.
    cold = OpenMeteoWeather(40, -111, tmp_path / "none.json", "", httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    assert (await cold.get()).status == "sample"
