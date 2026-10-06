"""Google Calendar (read-only) through a one-time browser sign-in.

The sign-in is the standard "installed app" flow with PKCE: the Surface opens
Google's own sign-in page, Google sends the browser back to this backend on
127.0.0.1 with a one-time code, and the backend swaps it for a refresh token that
is saved in credentials.json on the device. The only scope requested is
calendar.readonly, so the display can never change the calendar.

The OAuth client ID and secret come from config.toml / KITCHEN_GOOGLE_* or from
Settings. For a "Desktop app" client Google doesn't treat the secret as
confidential, but it still stays out of the repository.
"""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
import time
from datetime import datetime, time as dtime, timedelta
from urllib.parse import urlencode

import httpx

from ..credentials import CredentialStore
from ..models import Calendar, CalendarEvent
from .samples import SampleCalendar

log = logging.getLogger(__name__)

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
PENDING_TTL = 600  # seconds a sign-in may take before the one-time state expires


# Google Calendar's event colours (colorId on an event); events without one use the calendar's blue.
EVENT_COLORS = {
    "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73", "5": "#f6bf26", "6": "#f4511e",
    "7": "#039be5", "8": "#616161", "9": "#3f51b5", "10": "#0b8043", "11": "#d50000",
}
DEFAULT_EVENT_COLOR = "#039be5"


def parse_event(raw: dict) -> CalendarEvent | None:
    start, end = raw.get("start", {}), raw.get("end", {})
    if raw.get("status") == "cancelled":
        return None
    all_day = "date" in start
    try:
        if all_day:
            s = datetime.combine(datetime.fromisoformat(start["date"]).date(), dtime.min).astimezone()
            e = datetime.combine(datetime.fromisoformat(end["date"]).date(), dtime.min).astimezone()
        else:
            s = datetime.fromisoformat(start["dateTime"])
            e = datetime.fromisoformat(end["dateTime"])
    except (KeyError, ValueError):
        return None
    return CalendarEvent(
        id=str(raw.get("id", "")),
        title=raw.get("summary") or "(No title)",
        start=s,
        end=e,
        all_day=all_day,
        location=raw.get("location", ""),
        color=EVENT_COLORS.get(str(raw.get("colorId")), DEFAULT_EVENT_COLOR),
    )


class GoogleCalendar:
    def __init__(self, creds: CredentialStore, default_client: tuple[str, str] | None = None, client: httpx.AsyncClient | None = None) -> None:
        self._creds = creds
        self._default_client = default_client  # (id, secret) from config.toml
        self._client = client or httpx.AsyncClient(timeout=15)
        self._sample = SampleCalendar()
        self._access: tuple[str, float] | None = None
        self._last: Calendar | None = None
        self._pending: dict[str, tuple[str, float]] = {}  # state -> (code_verifier, expires_at)

    # --- sign-in -----------------------------------------------------------

    def client_credentials(self) -> tuple[str, str] | None:
        saved = self._creds.get("google")
        if saved.get("client_id") and saved.get("client_secret"):
            return saved["client_id"], saved["client_secret"]
        return self._default_client if self._default_client and all(self._default_client) else None

    @property
    def connected(self) -> bool:
        return bool(self._creds.get("google").get("refresh_token"))

    def authorize_url(self, redirect_uri: str) -> str:
        creds = self.client_credentials()
        if creds is None:
            raise LookupError("no Google client configured")
        verifier = secrets.token_urlsafe(64)
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
        state = secrets.token_urlsafe(24)
        now = time.time()
        self._pending = {s: v for s, v in self._pending.items() if v[1] > now}
        self._pending[state] = (verifier, now + PENDING_TTL)
        query = urlencode(
            {
                "client_id": creds[0],
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": SCOPE,
                "access_type": "offline",
                "prompt": "consent",  # always hand back a refresh token
                "code_challenge": challenge,
                "code_challenge_method": "S256",
                "state": state,
            }
        )
        return f"{AUTH_URL}?{query}"

    async def finish_sign_in(self, code: str, state: str, redirect_uri: str) -> None:
        """Raises PermissionError for an unknown/expired state, ValueError if Google refuses."""
        verifier, expires = self._pending.pop(state, ("", 0.0))
        if not verifier or expires < time.time():
            raise PermissionError("unknown sign-in")
        creds = self.client_credentials()
        if creds is None:
            raise ValueError("no Google client configured")
        resp = await self._client.post(
            TOKEN_URL,
            data={
                "client_id": creds[0],
                "client_secret": creds[1],
                "code": code,
                "code_verifier": verifier,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )
        body = resp.json() if resp.content else {}
        if resp.status_code != 200 or not body.get("refresh_token"):
            raise ValueError(body.get("error_description") or body.get("error") or "Google didn't return a refresh token")
        self._creds.update("google", refresh_token=body["refresh_token"])
        self._access = (body["access_token"], time.time() + body.get("expires_in", 3600) - 60)

    def disconnect(self) -> None:
        self._creds.update("google", refresh_token=None)
        self._access = None
        self._last = None

    # --- events ------------------------------------------------------------

    async def _token(self) -> str:
        if self._access and self._access[1] > time.time():
            return self._access[0]
        creds = self.client_credentials()
        if creds is None:
            raise PermissionError("no Google client configured")
        resp = await self._client.post(
            TOKEN_URL,
            data={
                "client_id": creds[0],
                "client_secret": creds[1],
                "refresh_token": self._creds.get("google")["refresh_token"],
                "grant_type": "refresh_token",
            },
        )
        if resp.status_code == 400 and resp.json().get("error") == "invalid_grant":
            self.disconnect()  # access was revoked in the Google account: back to signed out
            raise PermissionError("Google access was revoked")
        resp.raise_for_status()
        body = resp.json()
        self._access = (body["access_token"], time.time() + body.get("expires_in", 3600) - 60)
        return self._access[0]

    async def get(self) -> Calendar:
        if not self.connected:
            return await self._sample.get()
        try:
            token = await self._token()
            midnight = datetime.combine(datetime.now().astimezone().date(), dtime.min).astimezone()
            resp = await self._client.get(
                EVENTS_URL,
                params={
                    "timeMin": midnight.isoformat(),
                    "timeMax": (midnight + timedelta(days=2)).isoformat(),
                    "singleEvents": "true",
                    "orderBy": "startTime",
                    "maxResults": 50,
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
        except (httpx.HTTPError, PermissionError) as e:
            log.warning("Google Calendar fetch failed: %s", e)
            if self._last:
                return self._last.model_copy(update={"status": "stale"})
            return await self._sample.get() if not self.connected else Calendar(status="stale", events=[])
        events = [e for raw in resp.json().get("items", []) if (e := parse_event(raw))]
        self._last = Calendar(status="live", events=events)
        return self._last
