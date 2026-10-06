"""Deployment config: where the display is, where it keeps data, and integration secrets.

Read from `config.toml` (path in KITCHEN_CONFIG, default `./config.toml`), then
overridden by KITCHEN_* environment variables. Everything is optional so the app
runs with sample data out of the box. User-facing preferences (clock style,
schedule, brightness) live in settings.json instead; see settings.py.
"""

from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Config:
    latitude: float | None = None
    longitude: float | None = None
    location_name: str = ""
    # Link to the scheduled Claude daily-brief artifact. Opened, never summarized.
    brief_url: str = ""
    data_dir: Path = field(default_factory=lambda: Path.home() / ".local/share/kitchen-display")
    web_dist: Path = REPO_ROOT / "web" / "dist"
    weather_refresh_minutes: int = 15

    @property
    def has_location(self) -> bool:
        return self.latitude is not None and self.longitude is not None


def load_config(path: str | os.PathLike[str] | None = None, env: dict[str, str] | None = None) -> Config:
    env = dict(os.environ if env is None else env)
    path = Path(path or env.get("KITCHEN_CONFIG", "config.toml"))
    raw: dict = {}
    if path.is_file():
        with path.open("rb") as f:
            raw = tomllib.load(f)

    def pick(key: str, cast=str):
        value = env.get(f"KITCHEN_{key.upper()}", raw.get(key))
        if value is None or value == "":
            return None
        return cast(value)

    kwargs = {
        "latitude": pick("latitude", float),
        "longitude": pick("longitude", float),
        "location_name": pick("location_name") or "",
        "brief_url": pick("brief_url") or "",
    }
    if (data_dir := pick("data_dir")) is not None:
        kwargs["data_dir"] = Path(data_dir).expanduser()
    if (web_dist := pick("web_dist")) is not None:
        kwargs["web_dist"] = Path(web_dist).expanduser()
    if (minutes := pick("weather_refresh_minutes", int)) is not None:
        kwargs["weather_refresh_minutes"] = minutes
    return Config(**kwargs)
