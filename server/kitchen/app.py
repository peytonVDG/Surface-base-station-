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

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError

from .config import Config
from .display import Backlight
from .models import Brief, Calendar, Todos, Weather
from .providers.base import BriefProvider, CalendarProvider, TodoProvider, WeatherProvider
from .providers.samples import ConfiguredBrief, SampleCalendar, SampleTodos
from .providers.weather import OpenMeteoWeather, SampleWeather
from .settings import Settings, SettingsStore

log = logging.getLogger(__name__)


@dataclass
class Providers:
    weather: WeatherProvider
    calendar: CalendarProvider
    todos: TodoProvider
    brief: BriefProvider


def build_providers(config: Config) -> Providers:
    if config.has_location:
        weather: WeatherProvider = OpenMeteoWeather(
            config.latitude, config.longitude, config.data_dir / "weather.json", config.location_name
        )
    else:
        weather = SampleWeather()
    return Providers(weather=weather, calendar=SampleCalendar(), todos=SampleTodos(), brief=ConfiguredBrief(config.brief_url))


class ClientConfig(BaseModel):
    latitude: float | None
    longitude: float | None
    location_name: str
    hardware_backlight: bool


class TodoUpdate(BaseModel):
    done: bool


class BacklightRequest(BaseModel):
    percent: int = Field(ge=1, le=100)


class BacklightResult(BaseModel):
    hardware: bool


def create_app(
    config: Config,
    providers: Providers | None = None,
    settings: SettingsStore | None = None,
    backlight: Backlight | None = None,
) -> FastAPI:
    providers = providers or build_providers(config)
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

    @app.put("/api/backlight")
    async def set_backlight(body: BacklightRequest) -> BacklightResult:
        return BacklightResult(hardware=await backlight.set_percent(body.percent))

    if config.web_dist.is_dir():
        app.mount("/", StaticFiles(directory=config.web_dist, html=True), name="web")
    else:
        log.warning("No built web app at %s. Run `npm run build` in web/, or use the Vite dev server.", config.web_dist)

    return app
