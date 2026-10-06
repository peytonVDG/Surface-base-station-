"""HTTP API for the web app, plus the built web app itself.

The backend holds keys and does all fetching; the page only draws. Routes only
know the provider interfaces in providers/base.py, so swapping a sample for a
real integration is a change in build_providers() alone.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError

from .config import Config
from .credentials import CredentialStore
from .display import Backlight
from .models import Brief, Calendar, Photos, Todos, Weather
from .providers.base import BriefProvider, CalendarProvider, TodoProvider, WeatherProvider
from .providers.google_calendar import GoogleCalendar
from .providers.samples import ConfiguredBrief
from .providers.todoist import TodoistTodos
from .photos import scan_photos
from .providers.weather import OpenMeteoWeather, SampleWeather
from .settings import Settings, SettingsStore

log = logging.getLogger(__name__)


@dataclass
class Providers:
    weather: WeatherProvider
    calendar: CalendarProvider
    todos: TodoProvider
    brief: BriefProvider


def build_providers(config: Config, creds: CredentialStore | None = None) -> Providers:
    creds = creds or CredentialStore(config.data_dir / "credentials.json")
    if config.has_location:
        weather: WeatherProvider = OpenMeteoWeather(
            config.latitude, config.longitude, config.data_dir / "weather.json", config.location_name
        )
    else:
        weather = SampleWeather()
    calendar = GoogleCalendar(creds, (config.google_client_id, config.google_client_secret))
    return Providers(weather=weather, calendar=calendar, todos=TodoistTodos(creds), brief=ConfiguredBrief(config.brief_url))


class ClientConfig(BaseModel):
    latitude: float | None
    longitude: float | None
    location_name: str
    hardware_backlight: bool


class TodoUpdate(BaseModel):
    done: bool


class ConnectionStatus(BaseModel):
    connected: bool
    ready: bool = True  # Google only: a client ID and secret are set, so sign-in can start


class Connections(BaseModel):
    todoist: ConnectionStatus
    google: ConnectionStatus


class TodoistToken(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class GoogleClient(BaseModel):
    client_id: str = Field(min_length=10, max_length=300)
    client_secret: str = Field(min_length=5, max_length=300)


class BacklightRequest(BaseModel):
    percent: int = Field(ge=1, le=100)


class BacklightResult(BaseModel):
    hardware: bool


def _done_page(ok: bool, message: str) -> str:
    import html

    title = "Google Calendar connected" if ok else "Google sign-in didn't finish"
    body = "Going back to the display..." if ok else html.escape(message) + " <a href='/'>Back to the display</a>"
    redirect = "<meta http-equiv=refresh content='2;url=/'>" if ok else ""
    return f"<!doctype html>{redirect}<meta name=viewport content='width=device-width'><title>{title}</title><body style='font:20px system-ui;padding:2em'><h1>{title}</h1><p>{body}</p>"


def create_app(
    config: Config,
    providers: Providers | None = None,
    settings: SettingsStore | None = None,
    backlight: Backlight | None = None,
    creds: CredentialStore | None = None,
) -> FastAPI:
    creds = creds or CredentialStore(config.data_dir / "credentials.json")
    providers = providers or build_providers(config, creds)
    settings = settings or SettingsStore(config.data_dir / "settings.json")
    backlight = backlight or Backlight()

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI):
        task = None
        if isinstance(providers.weather, OpenMeteoWeather):
            task = asyncio.create_task(providers.weather.poll_forever(config.weather_refresh_minutes))
        yield
        if task:
            task.cancel()

    app = FastAPI(title="Kitchen display", lifespan=lifespan)

    @app.get("/api/health")
    async def health() -> dict:
        return {"ok": True}

    @app.get("/api/config")
    async def client_config() -> ClientConfig:
        return ClientConfig(
            latitude=config.latitude,
            longitude=config.longitude,
            location_name=config.location_name,
            hardware_backlight=backlight.available,
        )

    @app.get("/api/weather")
    async def weather() -> Weather:
        return await providers.weather.get()

    @app.get("/api/calendar")
    async def calendar() -> Calendar:
        return await providers.calendar.get()

    @app.get("/api/todos")
    async def todos() -> Todos:
        return await providers.todos.get()

    @app.patch("/api/todos/{todo_id}")
    async def update_todo(todo_id: str, body: TodoUpdate) -> Todos:
        try:
            return await providers.todos.set_done(todo_id, body.done)
        except KeyError:
            raise HTTPException(404, "No such to-do") from None

    @app.get("/api/brief")
    async def brief() -> Brief:
        return await providers.brief.get()

    @app.get("/api/photos")
    async def photos() -> Photos:
        return Photos(photos=scan_photos(config.data_dir / "photos"))

    @app.get("/api/settings")
    async def get_settings() -> Settings:
        return settings.get()

    @app.patch("/api/settings")
    async def patch_settings(patch: dict) -> Settings:
        try:
            return settings.update(patch)
        except ValidationError as e:
            raise HTTPException(422, e.errors(include_url=False, include_context=False)) from None

    @app.delete("/api/settings")
    async def reset_settings() -> Settings:
        return settings.reset()

    # --- Sign-ins. Secrets go in, only connected/not-connected comes out. ---

    def google() -> GoogleCalendar:
        if not isinstance(providers.calendar, GoogleCalendar):
            raise HTTPException(404, "Google Calendar isn't available")
        return providers.calendar

    def todoist() -> TodoistTodos:
        if not isinstance(providers.todos, TodoistTodos):
            raise HTTPException(404, "Todoist isn't available")
        return providers.todos

    def callback_url(request: Request) -> str:
        # Google only allows a loopback redirect for desktop clients, so this is always 127.0.0.1.
        return f"http://127.0.0.1:{request.url.port or 80}/api/connections/google/callback"

    @app.get("/api/connections")
    async def connections() -> Connections:
        g, t = google(), todoist()
        return Connections(
            todoist=ConnectionStatus(connected=t.connected),
            google=ConnectionStatus(connected=g.connected, ready=g.client_credentials() is not None),
        )

    @app.put("/api/connections/todoist")
    async def connect_todoist(body: TodoistToken) -> Connections:
        token = body.token.strip()
        if not await todoist().check_token(token):
            raise HTTPException(422, "Todoist didn't accept that token")
        creds.update("todoist", token=token)
        return await connections()

    @app.delete("/api/connections/todoist")
    async def disconnect_todoist() -> Connections:
        creds.clear("todoist")
        return await connections()

    @app.put("/api/connections/google/client")
    async def google_client(body: GoogleClient) -> Connections:
        creds.update("google", client_id=body.client_id.strip(), client_secret=body.client_secret.strip())
        return await connections()

    @app.get("/api/connections/google/start")
    async def google_start(request: Request):
        try:
            return RedirectResponse(google().authorize_url(callback_url(request)))
        except LookupError:
            raise HTTPException(409, "Enter the Google client ID and secret first") from None

    @app.get("/api/connections/google/callback")
    async def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
        if error or not code:
            return HTMLResponse(_done_page(False, error or "Sign-in was cancelled"), status_code=400)
        try:
            await google().finish_sign_in(code, state, callback_url(request))
        except (PermissionError, ValueError) as e:
            return HTMLResponse(_done_page(False, str(e)), status_code=400)
        return HTMLResponse(_done_page(True, ""))

    @app.delete("/api/connections/google")
    async def disconnect_google() -> Connections:
        google().disconnect()
        return await connections()

    @app.put("/api/backlight")
    async def set_backlight(body: BacklightRequest) -> BacklightResult:
        return BacklightResult(hardware=await backlight.set_percent(body.percent))

    photo_dir = config.data_dir / "photos"
    photo_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/user-photos", StaticFiles(directory=photo_dir), name="user-photos")

    if config.web_dist.is_dir():
        app.mount("/", StaticFiles(directory=config.web_dist, html=True), name="web")
    else:
        log.warning("No built web app at %s. Run `npm run build` in web/, or use the Vite dev server.", config.web_dist)

    return app
