"""User preferences, stored in one settings.json the backend owns.

Every change applies live (the web app PATCHes a field and re-renders). Unknown
keys in the file are dropped and bad values fall back to defaults, so a
hand-edited file can't brick the display. More groups (cookbook, music, voice)
get added here as those screens are built.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

log = logging.getLogger(__name__)

HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class Schedule(BaseModel):
    model_config = ConfigDict(extra="ignore")

    weekday_wake: str = "04:30"
    leave_for_work: str = "06:10"
    back_from_work: str = "15:00"
    sleep_at: str = "00:00"
    weekend_wake: str = "07:00"
    workdays: list[Annotated[int, Field(ge=0, le=6)]] = [1, 2, 3, 4, 5]  # 0 = Sunday
    sleep_during_work: bool = True
    nap_minutes: Annotated[int, Field(ge=1, le=30)] = 2  # awake this long after a tap in sleep mode

    @field_validator("weekday_wake", "leave_for_work", "back_from_work", "sleep_at", "weekend_wake")
    @classmethod
    def _hhmm(cls, v: str) -> str:
        if not HHMM.match(v):
            raise ValueError("time must be HH:MM (24-hour)")
        return v


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Display
    brightness: Annotated[int, Field(ge=5, le=100)] = 100
    animations: Literal["full", "calm", "off"] = "full"
    look: Literal["auto", "day", "night"] = "auto"
    # Clock & date
    clock_24h: bool = False
    show_seconds: bool = False
    temp_unit: Literal["F", "C"] = "F"
    # Home screen
    leave_warn_minutes: Annotated[int, Field(ge=5, le=60)] = 20
    countdown_ring: bool = True
    hold_clock_for_settings: bool = True
    # Sound & voice
    volume: Annotated[int, Field(ge=0, le=100)] = 60
    mic_muted: bool = False

    schedule: Schedule = Schedule()


def _merge(base: dict, patch: dict) -> dict:
    out = dict(base)
    for k, v in patch.items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def _salvage(raw: dict) -> Settings:
    """Keep every valid field from a partly bad file, default the rest."""
    good: dict = {}
    for key, value in raw.items():
        try:
            Settings.model_validate(_merge(good, {key: value}))
            good[key] = value
        except ValidationError:
            log.warning("Ignoring bad setting %r", key)
    return Settings.model_validate(good)


class SettingsStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._settings = self._load()

    def _load(self) -> Settings:
        try:
            raw = json.loads(self.path.read_text())
        except FileNotFoundError:
            return Settings()
        except (OSError, ValueError) as e:
            log.warning("Couldn't read %s, using defaults: %s", self.path, e)
            return Settings()
        if not isinstance(raw, dict):
            return Settings()
        try:
            return Settings.model_validate(raw)
        except ValidationError:
            return _salvage(raw)

    def get(self) -> Settings:
        return self._settings

    def update(self, patch: dict) -> Settings:
        """Apply a partial update. Raises ValidationError and changes nothing if it's invalid."""
        updated = Settings.model_validate(_merge(self._settings.model_dump(), patch))
        self._settings = updated
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(updated.model_dump_json(indent=2))
        tmp.replace(self.path)
        return updated

    def reset(self) -> Settings:
        self._settings = Settings()
        self.path.unlink(missing_ok=True)
        return self._settings
