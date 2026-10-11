"""The cookbook: Markdown recipe notes in a folder (Peyton's Obsidian vault, synced by rclone).

The server finds the files and their pictures and saves edits back to the same Markdown
notes (so Obsidian and the Drive sync see them); the web app parses the Markdown (so the
phone preview, which has no server, uses exactly the same code). "Cooked it!" dates go in
the app's own data folder, not the notes.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from pydantic import BaseModel

from .models import Status

PHOTO_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"}


class RecipeFile(BaseModel):
    id: str  # the note's path inside its folder, without ".md" (other folders get "<folder>::" in front)
    markdown: str
    photo: str | None = None  # URL of the picture, if there is one
    cooked: list[date] = []
    folder: str = ""  # which recipe folder it lives in
    editable: bool = True


class Recipes(BaseModel):
    status: Status
    items: list[RecipeFile]


class FolderInfo(BaseModel):
    label: str
    path: str
    primary: bool  # the folder from config.toml; it can't be removed from the app
    removable: bool
    exists: bool
    count: int


class Folders(BaseModel):
    sample: bool
    folders: list[FolderInfo]


@dataclass
class _Found:
    note: Path
    photo: Path | None
    folder: str
    editable: bool


@dataclass
class _Folder:
    label: str
    path: Path
    primary: bool
    removable: bool


class RecipeError(Exception):
    """Something the person can fix; the message is shown on screen."""


TEMPLATE = """---
title: {title}
servings: 4
time: 30 min
tags: []
---
## Ingredients
- 

## Steps
1. 

## Notes
"""


def safe_filename(title: str) -> str:
    name = re.sub(r'[\\/:*?"<>|#^\[\]\x00-\x1f]+', " ", title)
    name = re.sub(r"\s+", " ", name).strip(" .")
    return name[:80]


class RecipeStore:
    """The recipe folders: the one from config.toml, plus any added in the app (kept in extra_file)."""

    def __init__(self, primary: Path | None, sample_dir: Path, cooked_log: Path, extra_file: Path | None = None):
        self.primary = primary
        self.sample_dir = sample_dir
        self.cooked_log = cooked_log
        self.extra_file = extra_file

    # --- folders ---

    def _extra(self) -> list[Path]:
        if not self.extra_file:
            return []
        try:
            raw = json.loads(self.extra_file.read_text())
        except (OSError, ValueError):
            return []
        return [Path(p) for p in raw if isinstance(p, str)] if isinstance(raw, list) else []

    def _save_extra(self, paths: list[Path]) -> None:
        if not self.extra_file:
            raise RecipeError("This display can't remember folders.")
        self.extra_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.extra_file.with_suffix(".tmp")
        tmp.write_text(json.dumps([str(p) for p in paths], indent=1))
        tmp.replace(self.extra_file)

    @property
    def sample(self) -> bool:
        return self.primary is None and not self._extra()

    def _folders(self) -> list[_Folder]:
        paths = ([(self.primary, True)] if self.primary else []) + [(p, False) for p in self._extra()]
        if not paths:
            return [_Folder("Sample recipes", self.sample_dir, True, False)]
        out: list[_Folder] = []
        used: set[str] = set()
        for path, primary in paths:
            base = path.name or "Recipes"
            label, n = base, 2
            while label in used:
                label, n = f"{base} {n}", n + 1
            used.add(label)
            out.append(_Folder(label, path, primary, not primary))
        return out

    def folders(self) -> Folders:
        infos = []
        for f in self._folders():
            count = sum(1 for x in self._scan().values() if x.folder == f.label)
            infos.append(FolderInfo(label=f.label, path=str(f.path), primary=f.primary and not self.sample,
                                    removable=f.removable, exists=f.path.is_dir(), count=count))
        return Folders(sample=self.sample, folders=infos)

    def add_folder(self, raw: str, create: bool = False) -> Folders:
        text = raw.strip()
        if not text:
            raise RecipeError("Type or pick a folder first.")
        path = Path(text).expanduser()
        if not path.is_absolute():
            raise RecipeError("Use the full path, like /home/you/Recipes.")
        if not path.is_dir():
            if not create:
                raise RecipeError("That folder doesn't exist.")
            try:
                path.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                raise RecipeError(f"Couldn't create that folder: {e.strerror or e}") from None
        path = path.resolve()
        have = [p.resolve() for p in ([self.primary] if self.primary else []) + self._extra()]
        if path in have:
            raise RecipeError("That folder is already in the cookbook.")
        self._save_extra(self._extra() + [path])
        return self.folders()

    def remove_folder(self, raw: str) -> Folders:
        extra = self._extra()
        keep = [p for p in extra if str(p) != raw]
        if len(keep) == len(extra):
            raise KeyError(raw)
        self._save_extra(keep)
        return self.folders()

    # --- recipes ---

    def _scan(self) -> dict[str, _Found]:
        found: dict[str, _Found] = {}
        for i, folder in enumerate(self._folders()):
            if not folder.path.is_dir():
                continue
            prefix = "" if i == 0 else f"{folder.label}::"
            for note in sorted(folder.path.rglob("*.md")):
                rel = note.relative_to(folder.path)
                if any(part.startswith(".") for part in rel.parts):  # .obsidian, .trash
                    continue
                found[prefix + rel.with_suffix("").as_posix()] = _Found(
                    note, self._photo_for(folder.path, note), folder.label, not self.sample
                )
        return found

    def _photo_for(self, root: Path, note: Path) -> Path | None:
        # Next to the note, or in a photos/ folder at the top (where the phone upload will put them).
        for base in (note.parent, root / "photos", note.parent / "photos"):
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

    def _item(self, rid: str, f: _Found, cooked: dict[str, list[str]], text: str) -> RecipeFile:
        photo = f"/api/recipes/photo?id={_quote(rid)}&ext={f.photo.suffix}" if f.photo else None
        dates = [date.fromisoformat(d) for d in cooked.get(rid, []) if _is_date(d)]
        return RecipeFile(id=rid, markdown=text, photo=photo, cooked=dates, folder=f.folder, editable=f.editable)

    def list(self) -> Recipes:
        cooked = self._cooked()
        items = []
        for rid, f in self._scan().items():
            try:
                text = f.note.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue  # a half-synced file shows up next time
            items.append(self._item(rid, f, cooked, text))
        return Recipes(status="sample" if self.sample else "live", items=items)

    def photo(self, rid: str) -> Path:
        """Raises KeyError. Only ids found by scanning are served, so no path can escape the folder."""
        found = self._scan()[rid]
        if not found.photo:
            raise KeyError(rid)
        return found.photo

    def _editable(self, rid: str) -> _Found:
        """Raises KeyError for an unknown recipe, RecipeError for the read-only sample."""
        found = self._scan()[rid]
        if not found.editable:
            raise RecipeError("The sample recipes can't be changed. Add your own folder in Settings first.")
        return found

    def save(self, rid: str, markdown: str) -> RecipeFile:
        found = self._editable(rid)
        _write(found.note, markdown)
        return self._item(rid, found, self._cooked(), markdown)

    def create(self, title: str, folder: str | None = None) -> RecipeFile:
        folders = [f for f in self._folders() if not self.sample]
        if not folders:
            raise RecipeError("Add a recipe folder in Settings first.")
        target = next((f for f in folders if f.label == folder), folders[0])
        name = safe_filename(title)
        if not name:
            raise RecipeError("Give the recipe a name.")
        path = target.path / f"{name}.md"
        n = 2
        while path.exists():
            path = target.path / f"{name} {n}.md"
            n += 1
        text = TEMPLATE.format(title=title.strip())
        _write(path, text)
        rid = next((k for k, v in self._scan().items() if v.note == path), path.stem)
        return self._item(rid, self._scan()[rid], {}, text)

    def delete(self, rid: str) -> None:
        """Moves the note to .trash in its folder (Obsidian's own bin), so nothing is lost for good."""
        found = self._editable(rid)
        folder = next(f for f in self._folders() if f.label == found.folder)
        trash = folder.path / ".trash"
        trash.mkdir(exist_ok=True)
        dest = trash / found.note.name
        n = 2
        while dest.exists():
            dest = trash / f"{found.note.stem} {n}.md"
            n += 1
        found.note.replace(dest)

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


def _write(path: Path, text: str) -> None:
    """Whole-file replace, so a sync running at the same moment never sees half a note."""
    tmp = path.with_name(f".{path.name}.tmp")
    try:
        tmp.write_text(text, encoding="utf-8", newline="")
        tmp.replace(path)
    except OSError as e:
        tmp.unlink(missing_ok=True)
        raise RecipeError(f"Couldn't save: {e.strerror or e}") from None


def _is_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except (TypeError, ValueError):
        return False
    return True


def _quote(text: str) -> str:
    from urllib.parse import quote

    return quote(text, safe="")
