"""Todoist to-dos, using a personal API token pasted into Settings.

Shows what's due today plus anything overdue. Checking an item off closes it in
Todoist; tapping it again reopens it. Without a token this serves the sample list,
so the screen never goes empty.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time

import httpx

from ..credentials import CredentialStore
from ..models import Todo, Todos
from .samples import SampleTodos

log = logging.getLogger(__name__)

API = "https://api.todoist.com/api/v1"


def parse_task(raw: dict, today: date) -> Todo:
    due = raw.get("due") or {}
    when: datetime | None = None
    overdue = False
    if due.get("date"):
        text = due["date"]
        try:
            if "T" in text:
                when = datetime.fromisoformat(text.replace("Z", "+00:00"))
                if when.tzinfo is None:
                    when = when.astimezone()
                overdue = when.date() < today
            else:
                day = date.fromisoformat(text)
                overdue = day < today
                # Date-only tasks show no clock time; keep the day for sorting.
                when = datetime.combine(day, time(23, 59)).astimezone() if day != today else None
        except ValueError:
            when = None
    return Todo(
        id=str(raw["id"]), title=raw.get("content", ""), due=when, overdue=overdue, done=bool(raw.get("checked")),
        # The API counts up (4 = urgent); the app shows P1 as the most urgent.
        priority=5 - min(max(int(raw.get("priority") or 1), 1), 4),
    )


class TodoistTodos:
    def __init__(self, creds: CredentialStore, client: httpx.AsyncClient | None = None) -> None:
        self._creds = creds
        self._client = client or httpx.AsyncClient(timeout=15)
        self._sample = SampleTodos()
        self._last: Todos | None = None
        self._finished: dict[str, Todo] = {}  # today's checked-off items, kept so they show struck through

    @property
    def connected(self) -> bool:
        return bool(self._creds.get("todoist").get("token"))

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._creds.get('todoist')['token']}"}

    async def get(self) -> Todos:
        if not self.connected:
            return await self._sample.get()
        try:
            resp = await self._client.get(
                f"{API}/tasks/filter", params={"query": "today | overdue"}, headers=self._headers()
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            log.warning("Todoist fetch failed: %s", e)
            if self._last:
                return self._last.model_copy(update={"status": "stale"})
            return await self._sample.get()
        today = datetime.now().astimezone().date()
        items = [parse_task(t, today) for t in resp.json().get("results", [])]
        # Todoist can lag a moment behind a close: keep what was just checked off showing as done.
        items = [t.model_copy(update={"done": True}) if t.id in self._finished else t for t in items]
        shown = {t.id for t in items}
        items += [t for i, t in self._finished.items() if i not in shown]
        self._last = Todos(status="live", items=items)
        return self._last

    async def set_done(self, todo_id: str, done: bool) -> Todos:
        if not self.connected:
            return await self._sample.set_done(todo_id, done)
        known = self._last.items if self._last else []
        match = next((t for t in known if t.id == todo_id), None)
        if match is None:
            raise KeyError(todo_id)
        resp = await self._client.post(
            f"{API}/tasks/{todo_id}/{'close' if done else 'reopen'}", headers=self._headers()
        )
        if resp.status_code == 404:
            raise KeyError(todo_id)
        resp.raise_for_status()
        if done:
            self._finished[todo_id] = match.model_copy(update={"done": True})
        else:
            self._finished.pop(todo_id, None)
        return await self.get()

    async def check_token(self, token: str) -> bool:
        try:
            resp = await self._client.get(f"{API}/projects", params={"limit": 1}, headers={"Authorization": f"Bearer {token}"})
        except httpx.HTTPError:
            return False
        return resp.status_code == 200
