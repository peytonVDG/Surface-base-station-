"""Weather from Open-Meteo (free, no key), polled in the background and cached.

The web app never waits on the network: it gets the last good forecast from
memory (or from disk after a restart), marked "stale" if refreshing failed.
With no location configured, or before the first fetch ever succeeds, it gets
sample weather instead.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from ..models import Condition, CurrentWeather, DailyWeather, HourlyWeather, Weather
from .samples import sample_weather

log = logging.getLogger(__name__)

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HOURS_AHEAD = 12
# Treat the cached copy as stale if we haven't managed a refresh in this long.
STALE_AFTER = timedelta(minutes=45)


def condition_for(code: int) -> Condition:
    """Collapse WMO weather codes into the display's handful of sky states."""
    if code in (0, 1):
        return "clear"
    if code == 2:
        return "partly"
    if code == 3:
        return "cloudy"
    if code in (45, 48):
        return "fog"
    if code in (71, 73, 75, 77, 85, 86):
        return "snow"
    if code in (95, 96, 99):
        return "storm"
    if 51 <= code <= 67 or 80 <= code <= 82:
        return "rain"
    return "cloudy"


def _ts(seconds: int | None) -> datetime | None:
    return None if seconds is None else datetime.fromtimestamp(seconds, tz=timezone.utc)


def parse_forecast(data: dict, now: datetime, location_name: str = "") -> Weather:
    cur = data["current"]
    daily = data["daily"]
    hourly = data["hourly"]

    upcoming = []
    for t, temp, code, prob in zip(
        hourly["time"], hourly["temperature_2m"], hourly["weather_code"], hourly["precipitation_probability"]
    ):
        when = _ts(t)
        if when > now:
            upcoming.append(HourlyWeather(time=when, temp_c=temp, condition=condition_for(code), precip_prob=prob))
        if len(upcoming) == HOURS_AHEAD:
            break

    return Weather(
        status="live",
        updated_at=now,
        location_name=location_name,
        current=CurrentWeather(
            temp_c=cur["temperature_2m"],
            condition=condition_for(cur["weather_code"]),
            code=cur["weather_code"],
            cloud_cover=cur["cloud_cover"],
            precip_mm=cur["precipitation"],
            wind_kph=cur["wind_speed_10m"],
            is_day=bool(cur["is_day"]),
        ),
        today=DailyWeather(
            high_c=daily["temperature_2m_max"][0],
            low_c=daily["temperature_2m_min"][0],
            sunrise=_ts(daily["sunrise"][0]),
            sunset=_ts(daily["sunset"][0]),
        ),
        hourly=upcoming,
    )


class OpenMeteoWeather:
    def __init__(
        self,
        latitude: float,
        longitude: float,
        cache_file: Path,
        location_name: str = "",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.latitude = latitude
        self.longitude = longitude
        self.location_name = location_name
        self.cache_file = cache_file
        self._client = client or httpx.AsyncClient(timeout=15)
        self._latest: Weather | None = self._load_cache()

    def _load_cache(self) -> Weather | None:
        try:
            return Weather.model_validate_json(self.cache_file.read_text())
        except (OSError, ValueError):
            return None

    def _save_cache(self, weather: Weather) -> None:
        try:
            self.cache_file.parent.mkdir(parents=True, exist_ok=True)
            self.cache_file.write_text(weather.model_dump_json())
        except OSError as e:
            log.warning("Couldn't write weather cache: %s", e)

    async def refresh(self) -> Weather:
        params = {
            "latitude": self.latitude,
            "longitude": self.longitude,
            "current": "temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,is_day",
            "hourly": "temperature_2m,weather_code,precipitation_probability",
            "daily": "temperature_2m_max,temperature_2m_min,sunrise,sunset",
            "timezone": "auto",
            "timeformat": "unixtime",
            "forecast_days": 2,
        }
        resp = await self._client.get(FORECAST_URL, params=params)
        resp.raise_for_status()
        weather = parse_forecast(resp.json(), datetime.now(timezone.utc), self.location_name)
        self._latest = weather
        self._save_cache(weather)
        return weather

    async def get(self) -> Weather:
        if self._latest is None:
            try:
                return await self.refresh()
            except (httpx.HTTPError, KeyError, ValueError) as e:
                log.warning("Weather fetch failed, showing sample: %s", e)
                return sample_weather()
        latest = self._latest
        if datetime.now(timezone.utc) - latest.updated_at > STALE_AFTER:
            return latest.model_copy(update={"status": "stale"})
        return latest

    async def poll_forever(self, every_minutes: int) -> None:
        while True:
            try:
                await self.refresh()
            except (httpx.HTTPError, KeyError, ValueError) as e:
                log.warning("Weather refresh failed: %s", e)
            await asyncio.sleep(every_minutes * 60)


class SampleWeather:
    async def get(self) -> Weather:
        return sample_weather()
