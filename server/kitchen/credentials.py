"""Sign-in secrets for Todoist and Google, kept on the device only.

Everything lives in one JSON file in the data directory (default
~/.local/share/kitchen-display/credentials.json), outside the repository, with
owner-only permissions. Nothing here is ever committed, served to the web app, or
logged: the API only reports *whether* each service is connected.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

log = logging.getLogger(__name__)


class CredentialStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._data = self._load()

    def _load(self) -> dict:
        try:
            raw = json.loads(self.path.read_text())
        except FileNotFoundError:
            return {}
        except (OSError, ValueError) as e:
            log.warning("Couldn't read %s, starting empty: %s", self.path, e)
            return {}
        return raw if isinstance(raw, dict) else {}

    def get(self, service: str) -> dict:
        return dict(self._data.get(service, {}))

    def update(self, service: str, **fields: str | None) -> None:
        """Merge fields into a service's entry; a None value removes that field."""
        entry = self.get(service)
        for k, v in fields.items():
            if v is None:
                entry.pop(k, None)
            else:
                entry[k] = v
        if entry:
            self._data[service] = entry
        else:
            self._data.pop(service, None)
        self._save()

    def clear(self, service: str) -> None:
        self._data.pop(service, None)
        self._save()

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "w") as f:
            json.dump(self._data, f, indent=2)
        tmp.replace(self.path)
