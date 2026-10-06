import json

import pytest
from fastapi.testclient import TestClient

from kitchen.app import Providers, create_app
from kitchen.art import ArtLibrary
from kitchen.config import REPO_ROOT, Config
from kitchen.display import Backlight
from kitchen.providers.samples import ConfiguredBrief, SampleCalendar, SampleTodos
from kitchen.providers.weather import SampleWeather
from kitchen.settings import SettingsStore


def make_library(root):
    (root / "props").mkdir(parents=True)
    for name in ("ghost.svg", "pumpkin.png", "tree.svg"):
        (root / "props" / name).write_text("x")
    rows = [
        {"path": "props/ghost.svg", "subject": "ghost", "caption": "A friendly ghost", "holidays": ["halloween"],
         "placement": "sky", "vector": True, "transparent": True, "tags": ["spooky"]},
        {"path": "props/pumpkin.png", "subject": "pumpkin", "caption": "A carved pumpkin", "holidays": ["halloween"],
         "placement": "ground", "tags": ["spooky"]},
        {"path": "props/tree.svg", "subject": "christmas tree", "caption": "A decorated tree",
         "holidays": ["christmas"], "placement": "ground", "vector": True, "transparent": True},
        {"path": "props/missing.svg", "subject": "ghost", "caption": "file not on disk"},
    ]
    (root / "manifest.json").write_text(json.dumps({"version": 1, "images": rows}))
    return ArtLibrary(root)


def test_search_by_text_holiday_and_flags(tmp_path):
    lib = make_library(tmp_path)
    assert [i.subject for i in lib.search("spooky")] == ["ghost", "pumpkin"]  # vector + transparent first
    assert [i.subject for i in lib.search(holiday="christmas")] == ["christmas tree"]
    assert [i.subject for i in lib.search("halloween", placement="ground")] == ["pumpkin"]
    assert [i.subject for i in lib.search("decorating tree")] == ["christmas tree"]  # word endings are ignored
    assert lib.search("halloween", vector=False)[0].subject == "pumpkin"
    assert lib.search("zebra") == []
    assert all(i.path != "props/missing.svg" for i in lib.search("ghost"))


def test_index_rebuilds_when_manifest_changes(tmp_path):
    lib = make_library(tmp_path)
    assert len(lib.search("ghost")) == 1
    (tmp_path / "props" / "bat.svg").write_text("x")
    data = json.loads(lib.manifest_path.read_text())
    data["images"].append({"path": "props/bat.svg", "subject": "bat", "caption": "A bat"})
    lib.manifest_path.write_text(json.dumps(data))
    import os, time
    os.utime(lib.manifest_path, (time.time() + 5, time.time() + 5))
    assert [i.subject for i in lib.search("bat")] == ["bat"]


def test_add_from_inbox(tmp_path):
    lib = make_library(tmp_path)
    (tmp_path / "_inbox").mkdir()
    (tmp_path / "_inbox" / "dancing.gif").write_text("x")
    assert lib.pending() == ["dancing.gif"]
    image = lib.add("dancing.gif", folder="characters/snoopy", subject="snoopy", caption="Snoopy dances",
                    holidays=["birthday"], placement="overlay")
    assert image.path == "characters/snoopy/dancing.gif" and image.animated and not image.vector
    assert lib.pending() == []
    assert [i.path for i in lib.search("snoopy")] == ["characters/snoopy/dancing.gif"]
    status = lib.status()
    assert status.total == 5 and "birthday" in status.holidays


def test_add_rejects_bad_input(tmp_path):
    lib = make_library(tmp_path)
    (tmp_path / "_inbox").mkdir()
    (tmp_path / "_inbox" / "a.png").write_text("x")
    with pytest.raises(FileNotFoundError):
        lib.add("nope.png", folder="props", subject="s", caption="c")
    with pytest.raises(ValueError):
        lib.add("a.png", folder="../outside", subject="s", caption="c")
    with pytest.raises(ValueError):
        lib.add("a.png", folder="props", subject="s", caption="c", placement="nowhere")


def test_api_search_and_files(tmp_path):
    lib = make_library(tmp_path / "art")
    cfg = Config(data_dir=tmp_path, web_dist=tmp_path / "nope", art_dir=lib.root)
    app = create_app(cfg, Providers(SampleWeather(), SampleCalendar(), SampleTodos(), ConfiguredBrief("")),
                     SettingsStore(tmp_path / "settings.json"), Backlight())
    with TestClient(app) as c:
        hits = c.get("/api/art/search", params={"holiday": "halloween"}).json()
        assert [h["subject"] for h in hits] == ["ghost", "pumpkin"]
        assert c.get("/art-files/props/ghost.svg").status_code == 200
        assert c.get("/api/art/status").json()["total"] == 4
        assert c.post("/api/art/reindex").json()["total"] == 4


def test_starter_library_is_consistent():
    lib = ArtLibrary(REPO_ROOT / "art")
    images = lib.load_manifest()
    assert len(images) >= 40
    for i in images:
        assert (lib.root / i.path).is_file(), i.path
        assert i.caption and i.license and i.placement
    holidays = {h for i in images for h in i.holidays}
    assert {"halloween", "christmas", "thanksgiving", "birthday", "easter", "valentines"} <= holidays
    credits = (lib.root / "CREDITS.md").read_text()
    assert "OpenMoji" in credits
