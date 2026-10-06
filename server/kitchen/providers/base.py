"""Interfaces each integration implements.

The app only talks to these. Today most are backed by samples (see samples.py);
later threads swap in Google Calendar (iCal), Todoist, Keep and so on without
touching the routes or the web app.
"""

from __future__ import annotations

from typing import Protocol

from ..models import Brief, Calendar, Todos, Weather


class WeatherProvider(Protocol):
    async def get(self) -> Weather: ...


class CalendarProvider(Protocol):
    async def get(self) -> Calendar: ...


class TodoProvider(Protocol):
    async def get(self) -> Todos: ...

    async def set_done(self, todo_id: str, done: bool) -> Todos:
        """Raises KeyError for an unknown id."""
        ...


class BriefProvider(Protocol):
    async def get(self) -> Brief: ...
