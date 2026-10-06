import json
import stat
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from kitchen.app import Providers, create_app
from kitchen.config import Config
from kitchen.credentials import CredentialStore
from kitchen.display import Backlight
from kitchen.providers.google_calendar import GoogleCalendar
from kitchen.providers.samples import ConfiguredBrief
from kitchen.providers.todoist import TodoistTodos
from kitchen.providers.weather import SampleWeather
from kitchen.settings import SettingsStore

TOKEN = "t" * 40


def make(tmp_path, handler):
    http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    creds = CredentialStore(tmp_path / "credentials.json")
    providers = Providers(SampleWeather(), GoogleCalendar(creds, ("cid-1234567", "secret-1"), http), TodoistTodos(creds, http), ConfiguredBrief(""))
    app = create_app(Config(data_dir=tmp_path, web_dist=tmp_path / "nope"), providers, SettingsStore(tmp_path / "s.json"), Backlight(), creds)
    return TestClient(app), creds


def test_credentials_are_private_and_never_returned(tmp_path):
    def handler(req):
        return httpx.Response(200, json={"results": []})

    c, creds = make(tmp_path, handler)
    with c:
        out = c.put("/api/connections/todoist", json={"token": TOKEN})
        assert out.json()["todoist"]["connected"] is True
        assert TOKEN not in out.text
        mode = stat.S_IMODE((tmp_path / "credentials.json").stat().st_mode)
        assert mode == 0o600
        assert c.delete("/api/connections/todoist").json()["todoist"]["connected"] is False
        assert not creds.get("todoist")


def test_bad_todoist_token_rejected(tmp_path):
    c, creds = make(tmp_path, lambda r: httpx.Response(401))
    with c:
        assert c.put("/api/connections/todoist", json={"token": TOKEN}).status_code == 422
        assert not creds.get("todoist")


def test_todoist_list_and_check_off(tmp_path):
    calls = []

    def handler(req: httpx.Request):
        calls.append((req.method, req.url.path))
        assert req.headers["authorization"] == f"Bearer {TOKEN}"
        if req.url.path.endswith("/tasks/filter"):
            return httpx.Response(200, json={"results": [
                {"id": "a1", "content": "Call the vet", "due": {"date": "2020-01-01"}, "checked": False, "priority": 4},
                {"id": "b2", "content": "Limes", "due": None, "checked": False},
            ]})
        return httpx.Response(204) if "/tasks/" in req.url.path else httpx.Response(200, json={"results": []})

    c, creds = make(tmp_path, handler)
    creds.update("todoist", token=TOKEN)
    with c:
        todos = c.get("/api/todos").json()
        assert todos["status"] == "live"
        assert {t["title"]: t["overdue"] for t in todos["items"]} == {"Call the vet": True, "Limes": False}
        # Checked-off item stays on screen (done) even though the next fetch no longer returns it.
        handler_items = c.patch("/api/todos/b2", json={"done": True}).json()["items"]
        assert next(t for t in handler_items if t["id"] == "b2")["done"] is True
        assert ("POST", "/api/v1/tasks/b2/close") in calls
        assert {t["id"]: t["priority"] for t in todos["items"]} == {"a1": 1, "b2": 4}
        assert c.patch("/api/todos/zzz", json={"done": True}).status_code == 404


def test_todoist_without_token_serves_sample(tmp_path):
    c, _ = make(tmp_path, lambda r: httpx.Response(500))
    with c:
        assert c.get("/api/todos").json()["status"] == "sample"
        assert c.get("/api/calendar").json()["status"] == "sample"


def test_google_sign_in_flow(tmp_path):
    seen = {}

    def handler(req: httpx.Request):
        if req.url.host == "oauth2.googleapis.com":
            form = parse_qs(req.content.decode())
            seen.setdefault("token_forms", []).append(form)
            if form["grant_type"] == ["authorization_code"]:
                return httpx.Response(200, json={"access_token": "at", "refresh_token": "rt", "expires_in": 3600})
            return httpx.Response(200, json={"access_token": "at2", "expires_in": 3600})
        assert req.headers["authorization"].startswith("Bearer at")
        return httpx.Response(200, json={"items": [
            {"id": "e1", "summary": "Dentist", "colorId": "11", "start": {"dateTime": "2026-10-06T15:30:00-04:00"}, "end": {"dateTime": "2026-10-06T16:15:00-04:00"}},
            {"id": "e2", "summary": "Off", "start": {"date": "2026-10-07"}, "end": {"date": "2026-10-08"}},
            {"id": "e3", "status": "cancelled", "start": {"date": "2026-10-07"}, "end": {"date": "2026-10-08"}},
        ]})

    c, creds = make(tmp_path, handler)
    with c:
        assert c.get("/api/connections").json()["google"] == {"connected": False, "ready": True}
        r = c.get("/api/connections/google/start", follow_redirects=False)
        assert r.status_code in (302, 307)
        q = parse_qs(urlparse(r.headers["location"]).query)
        assert q["scope"] == ["https://www.googleapis.com/auth/calendar.readonly"]
        assert q["code_challenge_method"] == ["S256"] and q["access_type"] == ["offline"]
        assert q["redirect_uri"][0].endswith("/api/connections/google/callback")

        # A callback with an unknown state is refused and stores nothing.
        assert c.get("/api/connections/google/callback", params={"code": "x", "state": "forged"}).status_code == 400
        assert not creds.get("google").get("refresh_token")

        ok = c.get("/api/connections/google/callback", params={"code": "abc", "state": q["state"][0]})
        assert ok.status_code == 200 and "connected" in ok.text
        assert "code_verifier" in seen["token_forms"][0]
        assert creds.get("google")["refresh_token"] == "rt"

        cal = c.get("/api/calendar").json()
        assert cal["status"] == "live"
        assert [e["title"] for e in cal["events"]] == ["Dentist", "Off"]
        assert cal["events"][1]["all_day"] is True
        assert [e["color"] for e in cal["events"]] == ["#d50000", "#039be5"]

        assert c.delete("/api/connections/google").json()["google"]["connected"] is False
        assert c.get("/api/calendar").json()["status"] == "sample"


def test_google_revoked_access_signs_out(tmp_path):
    c, creds = make(tmp_path, lambda r: httpx.Response(400, json={"error": "invalid_grant"}))
    creds.update("google", refresh_token="rt")
    with c:
        assert c.get("/api/calendar").json()["status"] == "sample"
        assert not creds.get("google").get("refresh_token")


def test_google_start_needs_client(tmp_path):
    http = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    creds = CredentialStore(tmp_path / "credentials.json")
    providers = Providers(SampleWeather(), GoogleCalendar(creds, None, http), TodoistTodos(creds, http), ConfiguredBrief(""))
    app = create_app(Config(data_dir=tmp_path, web_dist=tmp_path / "nope"), providers, SettingsStore(tmp_path / "s.json"), Backlight(), creds)
    with TestClient(app) as c:
        assert c.get("/api/connections").json()["google"]["ready"] is False
        assert c.get("/api/connections/google/start", follow_redirects=False).status_code == 409
        c.put("/api/connections/google/client", json={"client_id": "x" * 20, "client_secret": "y" * 10})
        assert c.get("/api/connections").json()["google"]["ready"] is True
