import json
import logging
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server.app import create_app, load_wordbank
from server.config import ROOT, Settings
from server.logs import JsonFormatter


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    static = tmp_path / "dist"
    static.mkdir()
    (static / "index.html").write_text("<!doctype html><title>test page</title>")
    return Settings(
        host="127.0.0.1",
        port=0,
        commit="abc1234",
        version="1.2.3",
        wordbank_path=ROOT / "data" / "wordbank.json",
        static_dir=static,
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings))


def test_health_probe(client):
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_wordbank_is_served_as_json(client):
    res = client.get("/api/wordbank")
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/json")
    categories = res.json()["categories"]
    assert len(categories) > 0
    assert "words" in categories[0]


def test_wordbank_matches_the_file_exactly(client, settings):
    on_disk = json.loads(settings.wordbank_path.read_text(encoding="utf-8"))
    assert client.get("/api/wordbank").json() == on_disk


def test_version_and_commit(client):
    assert client.get("/api/version").json() == {"version": "1.2.3", "commit": "abc1234"}


def test_unknown_api_route_is_a_json_404(client):
    res = client.get("/api/nope")
    assert res.status_code == 404
    assert res.json() == {"error": "Not found"}


def test_front_end_is_served(client):
    res = client.get("/")
    assert res.status_code == 200
    assert "test page" in res.text


def test_api_still_works_without_a_built_front_end(settings, tmp_path):
    client = TestClient(create_app(replace(settings, static_dir=tmp_path / "missing")))
    assert client.get("/healthz").status_code == 200
    assert client.get("/").status_code == 404


def test_requests_are_logged_but_health_probes_are_not(client, caplog):
    with caplog.at_level(logging.INFO, logger="darija"):
        client.get("/healthz")
        client.get("/api/version")
    requests = [r for r in caplog.records if r.getMessage() == "request"]
    assert len(requests) == 1
    record = requests[0]
    assert (record.method, record.path, record.status) == ("GET", "/api/version", 200)


def test_log_lines_are_json(client, caplog):
    with caplog.at_level(logging.INFO, logger="darija"):
        client.get("/api/version")
    entry = json.loads(JsonFormatter().format(caplog.records[-1]))
    assert entry["msg"] == "request"
    assert entry["level"] == "info"
    assert entry["status"] == 200
    assert "time" in entry


def test_startup_fails_on_a_bad_wordbank(settings, tmp_path):
    bad = tmp_path / "bad.json"
    bad.write_text('{"categories": []}')
    with pytest.raises(ValueError, match="categories"):
        create_app(replace(settings, wordbank_path=bad))


def test_startup_fails_on_a_missing_wordbank(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_wordbank(tmp_path / "nope.json")


def test_settings_come_from_the_environment(monkeypatch):
    monkeypatch.setenv("PORT", "9999")
    monkeypatch.setenv("HOST", "0.0.0.0")
    monkeypatch.setenv("COMMIT_SHA", "0123456789abcdef")
    s = Settings.from_env()
    assert (s.host, s.port, s.commit) == ("0.0.0.0", 9999, "0123456")


def test_settings_defaults(monkeypatch):
    for name in ("PORT", "HOST", "COMMIT_SHA", "WORDBANK_PATH", "STATIC_DIR"):
        monkeypatch.delenv(name, raising=False)
    s = Settings.from_env()
    assert (s.host, s.port, s.commit) == ("127.0.0.1", 8000, "dev")
    assert s.wordbank_path == ROOT / "data" / "wordbank.json"
