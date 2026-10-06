"""The local art library: a folder of images plus a searchable index.

The folder (the microSD card on the Surface, `art/` in the repo for the starter set) holds
the images and a `manifest.json` that describes each one. The manifest is the source of
truth, easy to read and edit by hand. `index.sqlite`, rebuilt from it, is what gets
searched, so a query like "halloween ghost" never touches an image file. New downloads go
in `_inbox/` until they are tagged (`add`), then become part of the library.

Search the library first; only go to the web when nothing fits, then `add` what you found.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path

from pydantic import BaseModel

IMAGE_SUFFIXES = {".svg", ".png", ".webp", ".gif", ".jpg", ".jpeg", ".json"}  # .json = Lottie
PLACEMENTS = ("ground", "sky", "overlay", "corner", "full-background")
SKIP_DIRS = {"_inbox", "_thumbs"}


class ArtImage(BaseModel):
    path: str  # relative to the library folder, forward slashes
    subject: str = ""
    pose: str = ""
    tags: list[str] = []
    holidays: list[str] = []
    seasons: list[str] = []
    format: str = ""
    transparent: bool = False
    vector: bool = False
    animated: bool = False
    width: int = 0
    height: int = 0
    colors: list[str] = []
    placement: str = "overlay"
    source: str = ""
    license: str = ""
    added: str = ""
    caption: str = ""
    placeholder: bool = False  # stand-in art, to be replaced by the real thing


class ArtStatus(BaseModel):
    total: int
    placeholders: int
    inbox: list[str]  # files waiting to be tagged
    holidays: list[str]


def _terms(q: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", q.lower())


@dataclass
class ArtLibrary:
    root: Path
    _conn: sqlite3.Connection | None = field(default=None, repr=False)

    @property
    def manifest_path(self) -> Path:
        return self.root / "manifest.json"

    @property
    def index_path(self) -> Path:
        return self.root / "index.sqlite"

    @property
    def exists(self) -> bool:
        return self.manifest_path.is_file()

    def load_manifest(self) -> list[ArtImage]:
        if not self.exists:
            return []
        raw = json.loads(self.manifest_path.read_text())
        return [ArtImage(**row) for row in raw.get("images", [])]

    def save_manifest(self, images: list[ArtImage]) -> None:
        images = sorted(images, key=lambda i: i.path)
        body = {"version": 1, "images": [i.model_dump(exclude_defaults=False) for i in images]}
        self.root.mkdir(parents=True, exist_ok=True)
        self.manifest_path.write_text(json.dumps(body, indent=1) + "\n")

    # --- index ---

    def _db(self) -> sqlite3.Connection:
        if self._conn is None:
            self.root.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(self.index_path, check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
        return self._conn

    def reindex(self) -> int:
        """Rebuild the search index from the manifest. Rows whose file is missing are dropped."""
        images = [i for i in self.load_manifest() if (self.root / i.path).is_file()]
        db = self._db()
        with db:
            db.execute("DROP TABLE IF EXISTS art")
            db.execute("DROP TABLE IF EXISTS art_fts")
            db.execute("CREATE TABLE art (id INTEGER PRIMARY KEY, data TEXT NOT NULL, holidays TEXT, placement TEXT,"
                       " vector INTEGER, transparent INTEGER, animated INTEGER)")
            db.execute("CREATE VIRTUAL TABLE art_fts USING fts5(text, tokenize='porter unicode61')")
            for n, i in enumerate(images):
                db.execute("INSERT INTO art VALUES (?,?,?,?,?,?,?)",
                           (n, i.model_dump_json(), " " + " ".join(i.holidays) + " ", i.placement,
                            int(i.vector), int(i.transparent), int(i.animated)))
                text = " ".join([i.subject, i.pose, i.caption, *i.tags, *i.holidays, *i.seasons, *i.colors,
                                 i.placement])
                db.execute("INSERT INTO art_fts(rowid, text) VALUES (?,?)", (n, text.replace("-", " ")))
        return len(images)

    def _ensure_index(self) -> None:
        stale = (not self.index_path.is_file()
                 or (self.exists and self.manifest_path.stat().st_mtime > self.index_path.stat().st_mtime))
        if stale:
            self.reindex()

    def search(self, q: str = "", *, holiday: str = "", placement: str = "", vector: bool | None = None,
               transparent: bool | None = None, animated: bool | None = None, limit: int = 20) -> list[ArtImage]:
        """Best matches first. Every word in `q` must match; vector + transparent art ranks ahead."""
        if not self.exists:
            return []
        self._ensure_index()
        where, args = [], []
        terms = _terms(q)
        if terms:
            where.append("art.id IN (SELECT rowid FROM art_fts WHERE art_fts MATCH ?)")
            args.append(" AND ".join(f'"{t}"*' for t in terms))
        if holiday:
            where.append("art.holidays LIKE ?")
            args.append(f"% {holiday.lower().replace(' ', '-')} %")
        if placement:
            where.append("art.placement = ?")
            args.append(placement)
        for column, value in (("vector", vector), ("transparent", transparent), ("animated", animated)):
            if value is not None:
                where.append(f"art.{column} = ?")
                args.append(int(value))
        sql = "SELECT data FROM art" + (" WHERE " + " AND ".join(where) if where else "")
        sql += " ORDER BY (art.vector + art.transparent) DESC, art.id LIMIT ?"
        rows = self._db().execute(sql, [*args, max(1, min(limit, 200))]).fetchall()
        return [ArtImage.model_validate_json(r["data"]) for r in rows]

    # --- growing the library ---

    def pending(self) -> list[str]:
        """Files in `_inbox/` waiting to be tagged."""
        inbox = self.root / "_inbox"
        if not inbox.is_dir():
            return []
        return sorted(p.name for p in inbox.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)

    def add(self, inbox_file: str, *, folder: str, subject: str, caption: str, tags: list[str] | None = None,
            holidays: list[str] | None = None, seasons: list[str] | None = None, placement: str = "overlay",
            transparent: bool = False, animated: bool = False, source: str = "", license: str = "",
            width: int = 0, height: int = 0, pose: str = "", colors: list[str] | None = None) -> ArtImage:
        """Move a file out of `_inbox/` into `folder/`, record it in the manifest, and reindex."""
        src = self.root / "_inbox" / Path(inbox_file).name
        if not src.is_file():
            raise FileNotFoundError(f"{inbox_file} isn't in _inbox/")
        if placement not in PLACEMENTS:
            raise ValueError(f"placement must be one of {', '.join(PLACEMENTS)}")
        dest_dir = (self.root / folder).resolve()
        if self.root.resolve() not in dest_dir.parents:
            raise ValueError("folder must be inside the art library")
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / src.name
        if dest.exists():
            raise FileExistsError(f"{dest.relative_to(self.root.resolve())} already exists")
        shutil.move(src, dest)
        suffix = dest.suffix.lower().lstrip(".")
        image = ArtImage(
            path=dest.relative_to(self.root.resolve()).as_posix(), subject=subject, pose=pose, tags=tags or [],
            holidays=holidays or [], seasons=seasons or [], format="lottie" if suffix == "json" else suffix,
            transparent=transparent or suffix in ("svg",), vector=suffix in ("svg", "json"),
            animated=animated or suffix in ("gif", "json"), width=width, height=height, colors=colors or [],
            placement=placement, source=source, license=license, added=date.today().isoformat(), caption=caption,
        )
        self.save_manifest([*self.load_manifest(), image])
        self.reindex()
        return image

    def status(self) -> ArtStatus:
        images = self.load_manifest()
        return ArtStatus(total=len(images), placeholders=sum(i.placeholder for i in images), inbox=self.pending(),
                         holidays=sorted({h for i in images for h in i.holidays}))


def main() -> None:
    parser = argparse.ArgumentParser(prog="kitchen-art", description="Search and grow the art library.")
    parser.add_argument("--dir", default=None, help="Library folder (default: art_dir from config.toml)")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("reindex", help="Rebuild the search index")
    sub.add_parser("pending", help="List files in _inbox/ waiting to be tagged")
    s = sub.add_parser("search", help="Find images")
    s.add_argument("query", nargs="*")
    s.add_argument("--holiday", default="")
    s.add_argument("--placement", default="")
    a = sub.add_parser("add", help="Tag an _inbox file and add it to the library")
    a.add_argument("file")
    a.add_argument("--folder", required=True, help="e.g. characters/snoopy or props")
    a.add_argument("--subject", required=True)
    a.add_argument("--caption", required=True)
    a.add_argument("--tags", default="")
    a.add_argument("--holidays", default="")
    a.add_argument("--seasons", default="")
    a.add_argument("--placement", default="overlay", choices=PLACEMENTS)
    a.add_argument("--transparent", action="store_true")
    a.add_argument("--source", default="")
    a.add_argument("--license", default="")
    args = parser.parse_args()

    from .config import load_config

    lib = ArtLibrary(Path(args.dir) if args.dir else load_config().art_dir)
    split = lambda v: [x.strip() for x in v.split(",") if x.strip()]  # noqa: E731
    if args.cmd == "reindex":
        print(f"Indexed {lib.reindex()} images")
    elif args.cmd == "pending":
        print("\n".join(lib.pending()) or "Nothing waiting in _inbox/")
    elif args.cmd == "search":
        for i in lib.search(" ".join(args.query), holiday=args.holiday, placement=args.placement):
            print(f"{i.path}\t{i.placement}\t{i.caption}")
    else:
        image = lib.add(args.file, folder=args.folder, subject=args.subject, caption=args.caption,
                        tags=split(args.tags), holidays=split(args.holidays), seasons=split(args.seasons),
                        placement=args.placement, transparent=args.transparent, source=args.source,
                        license=args.license)
        print(f"Added {image.path}")


if __name__ == "__main__":
    main()
