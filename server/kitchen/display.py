"""Screen backlight control.

On the Surface (Ubuntu) this drives the real backlight through `brightnessctl`.
Anywhere else (a dev laptop, a browser on another machine) there's no backlight
to set, so the web app is told to dim itself with an overlay instead.
"""

from __future__ import annotations

import asyncio
import logging
import shutil

log = logging.getLogger(__name__)


class Backlight:
    def __init__(self) -> None:
        self._tool = shutil.which("brightnessctl")

    @property
    def available(self) -> bool:
        return self._tool is not None

    async def set_percent(self, percent: int) -> bool:
        """Returns True if the hardware backlight was set."""
        if not self._tool:
            return False
        percent = max(1, min(100, percent))
        proc = await asyncio.create_subprocess_exec(
            self._tool, "--quiet", "set", f"{percent}%",
            stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
        )
        _, err = await proc.communicate()
        if proc.returncode != 0:
            log.warning("brightnessctl failed: %s", err.decode().strip())
            return False
        return True
