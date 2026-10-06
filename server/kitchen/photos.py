"""The device's own photo bank.

Drop pictures into ~/.local/share/kitchen-display/photos/<Category>/ (one folder per
category: Family, Recipes, Pets...). They show up in the Photos screen next to the
built-in placeholder pictures, with the file name as the title. Nothing is uploaded
anywhere, and the folder is outside the repository.
"""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import quote

from .models import Photo

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"}


def scan_photos(root: Path) -> list[Photo]:
    """One level of category folders; files sitting directly in `root` go under "Photos"."""
    if not root.is_dir():
        return []
    found: list[Photo] = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink() or not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        rel = path.relative_to(root)
        if any(part.startswith(".") for part in rel.parts):
            continue
        category = rel.parts[0] if len(rel.parts) > 1 else "Photos"
        title = re.sub(r"[-_]+", " ", path.stem).strip().capitalize()
        found.append(
            Photo(id="user-" + rel.as_posix().lower(), title=title, category=category, url="/user-photos/" + quote(rel.as_posix()))
        )
    return found
