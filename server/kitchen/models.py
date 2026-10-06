"""Shapes the backend serves to the web app. Mirrored in web/src/lib/types.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

# "live": fresh from the source. "stale": the last good copy, source unreachable.
# "sample": placeholder data because the integration isn't set up yet.
Status = Literal["live", "stale", "sample"]

Condition = Literal["clear", "partly", "cloudy", "fog", "rain", "storm", "snow"]


class CurrentWeather(BaseModel):
    temp_c: float
    condition: Condition
    code: int
    cloud_cover: int  # percent
    precip_mm: float  # per hour
    wind_kph: float
    is_day: bool


class DailyWeather(BaseModel):
    high_c: float
    low_c: float
    sunrise: datetime | None
    sunset: datetime | None


class HourlyWeather(BaseModel):
    time: datetime
    temp_c: float
    condition: Condition
    precip_prob: int | None = None


class Weather(BaseModel):
    status: Status
    updated_at: datetime
    location_name: str = ""
    current: CurrentWeather
    today: DailyWeather
    hourly: list[HourlyWeather]


class CalendarEvent(BaseModel):
    id: str
    title: str
    start: datetime
    end: datetime
    all_day: bool = False
    color: str = "#2f6db5"
    location: str = ""


class Calendar(BaseModel):
    status: Status
    events: list[CalendarEvent]  # today and tomorrow, sorted by start


class Todo(BaseModel):
    id: str
    title: str
    due: datetime | None = None
    overdue: bool = False
    done: bool = False


class Todos(BaseModel):
    status: Status
    items: list[Todo]


class Brief(BaseModel):
    status: Status
    url: str
    updated_at: datetime | None = None
