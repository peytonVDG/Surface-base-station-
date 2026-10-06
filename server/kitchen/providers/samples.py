"""Placeholder data so the display looks real before integrations exist.

Times are generated relative to "now" so the sample calendar always has
something upcoming, whatever time you open it.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta

from ..models import (
    Brief,
    Calendar,
    CalendarEvent,
    CurrentWeather,
    DailyWeather,
    HourlyWeather,
    Todo,
    Todos,
    Weather,
)


def _now() -> datetime:
    return datetime.now().astimezone()


def _today_at(hour: int, minute: int = 0, days: int = 0) -> datetime:
    now = _now()
    return datetime.combine(now.date() + timedelta(days=days), time(hour, minute), tzinfo=now.tzinfo)


def sample_weather() -> Weather:
    now = _now()
    base = now.replace(minute=0, second=0, microsecond=0)
    temps = [14.5, 15.0, 15.5, 15.0, 14.0, 13.0, 12.0, 11.5, 11.0, 10.5, 10.0, 9.5]
    conds = ["partly", "partly", "cloudy", "cloudy", "rain", "rain", "cloudy", "partly", "clear", "clear", "clear", "clear"]
    return Weather(
        status="sample",
        updated_at=now,
        current=CurrentWeather(
            temp_c=14.0, condition="partly", code=2, cloud_cover=45, precip_mm=0.0, wind_kph=9.0, is_day=6 <= now.hour < 19
        ),
        today=DailyWeather(high_c=17.0, low_c=8.0, sunrise=_today_at(7, 10), sunset=_today_at(18, 40)),
        hourly=[
            HourlyWeather(time=base + timedelta(hours=i + 1), temp_c=t, condition=c, precip_prob=60 if c == "rain" else 10)
            for i, (t, c) in enumerate(zip(temps, conds))
        ],
    )


class SampleCalendar:
    async def get(self) -> Calendar:
        rows = [
            ("standup", "Team standup", 8, 30, 15, "#2f6db5", ""),
            ("lunch", "Lunch with Sam", 12, 0, 60, "#3f8f4f", "Cafe Rio"),
            ("dentist", "Dentist", 15, 30, 45, "#c8102e", "Bright Smiles Dental"),
            ("soccer", "Soccer pickup", 18, 30, 30, "#e3a400", "Riverside Park"),
            ("car", "Car service", 9, 0, 60, "#7e57c2", "Main St Auto"),
            ("book", "Book club", 19, 0, 90, "#2f6db5", ""),
        ]
        events = []
        for i, (eid, title, h, m, dur, color, loc) in enumerate(rows):
            start = _today_at(h, m, days=1 if i >= 4 else 0)
            events.append(
                CalendarEvent(id=eid, title=title, start=start, end=start + timedelta(minutes=dur), color=color, location=loc)
            )
        return Calendar(status="sample", events=events)


class SampleTodos:
    def __init__(self) -> None:
        self._items = [
            Todo(id="1", title="Take the trash out", due=_today_at(20)),
            Todo(id="2", title="Pick up limes"),
            Todo(id="3", title="Call the vet", due=_today_at(9, days=-1), overdue=True),
            Todo(id="4", title="Flu shots", done=True),
            Todo(id="5", title="Water the plants"),
        ]

    async def get(self) -> Todos:
        return Todos(status="sample", items=[t.model_copy() for t in self._items])

    async def set_done(self, todo_id: str, done: bool) -> Todos:
        for item in self._items:
            if item.id == todo_id:
                item.done = done
                return await self.get()
        raise KeyError(todo_id)


class ConfiguredBrief:
    """The brief is a link to a scheduled artifact. Until its update time can be
    read from claude.ai, the card just says "Today's brief"."""

    def __init__(self, url: str) -> None:
        self._url = url

    async def get(self) -> Brief:
        return Brief(status="live" if self._url else "sample", url=self._url, updated_at=None)
