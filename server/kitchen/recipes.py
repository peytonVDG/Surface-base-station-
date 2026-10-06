"""The cookbook: Markdown recipe notes in a folder (Peyton's Obsidian vault, synced by rclone).

The server only finds the files and their pictures; the web app parses the Markdown (so
the phone preview, which has no server, uses exactly the same code). Nothing here ever
writes into the recipes folder: "Cooked it!" dates go in the app's own data folder.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from pydantic import BaseModel

from .models import Status

PHOTO_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"}


class RecipeFile(BaseModel):
    id: str  # the note's path inside the folder, without ".md"
    markdown: str
    photo: str | None = None  # URL of the picture, if there is one
    cooked: list[date] = []


class Recipes(BaseModel):
    status: Status
    items: list[RecipeFile]


@dataclass
class _Found:
    note: Path
    photo: Path | None


class RecipeStore:
    def __init__(self, folder: Path, cooked_log: Path, sample: bool = False):
        self.folder = folder
        self.cooked_log = cooked_log
        self.sample = sample

    def _scan(self) -> dict[str, _Found]:
        found: dict[str, _Found] = {}
        if not self.folder.is_dir():
            return found
        for note in sorted(self.folder.rglob("*.md")):
            rel = note.relative_to(self.folder)
            if any(part.startswith(".") for part in rel.parts):  # .obsidian, .trash
                continue
            found[rel.with_suffix("").as_posix()] = _Found(note, self._photo_for(note))
        return found

    def _photo_for(self, note: Path) -> Path | None:
        # Next to the note, or in a photos/ folder at the top (where the phone upload will put them).
        for base in (note.parent, self.folder / "photos", note.parent / "photos"):
            for ext in sorted(PHOTO_TYPES):
                candidate = base / f"{note.stem}{ext}"
                if candidate.is_file():
                    return candidate
        return None

    def _cooked(self) -> dict[str, list[str]]:
        try:
            return json.loads(self.cooked_log.read_text())
        except (OSError, ValueError):
            return {}

    def list(self) -> Recipes:
        cooked = self._cooked()
        items = []
        for rid, f in self._scan().items():
            try:
                text = f.note.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue  # a half-synced file shows up next time
            photo = f"/api/recipes/photo?id={_quote(rid)}&ext={f.photo.suffix}" if f.photo else None
            dates = [date.fromisoformat(d) for d in cooked.get(rid, []) if _is_date(d)]
            items.append(RecipeFile(id=rid, markdown=text, photo=photo, cooked=dates))
        return Recipes(status="sample" if self.sample else "live", items=items)

    def photo(self, rid: str) -> Path:
        """Raises KeyError. Only ids found by scanning are served, so no path can escape the folder."""
        found = self._scan()[rid]
        if not found.photo:
            raise KeyError(rid)
        return found.photo

    def mark_cooked(self, rid: str, day: date) -> list[date]:
        """Raises KeyError for an unknown recipe."""
        if rid not in self._scan():
            raise KeyError(rid)
        cooked = self._cooked()
        days = cooked.setdefault(rid, [])
        if day.isoformat() not in days:
            days.append(day.isoformat())
        self.cooked_log.parent.mkdir(parents=True, exist_ok=True)
        self.cooked_log.write_text(json.dumps(cooked, indent=1))
        return [date.fromisoformat(d) for d in days if _is_date(d)]


def _is_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except (TypeError, ValueError):
        return False
    return True


def _quote(text: str) -> str:
    from urllib.parse import quote

    return quote(text, safe="")
