#!/usr/bin/env python3
"""Client HTTP, rate-limiter, session Livewire et découverte paginée MINESEC."""

from __future__ import annotations

import html
import http.cookiejar
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from minesec_parser import normalize_space, normalize_subject_key, parse_subject_links, strip_tags

BASE = "https://minesec-distance.schoolfaqs.net"
USER_AGENT = "ZekoulABia-ProgramExtractor/0.3 (contact: admin@zekoulabia.local)"
MIN_INTERVAL_SECONDS = 1.1
MAX_ATTEMPTS = 3
REQUEST_TIMEOUT_SECONDS = 45


class RateLimiter:
    def __init__(self, interval_seconds: float) -> None:
        self.interval_seconds = interval_seconds
        self.last_request_at: float | None = None
        self.request_count = 0
        self.total_sleep_seconds = 0.0

    def wait(self) -> float:
        slept = 0.0
        if self.last_request_at is not None:
            elapsed = time.monotonic() - self.last_request_at
            remaining = self.interval_seconds - elapsed
            if remaining > 0:
                time.sleep(remaining)
                slept = remaining
                self.total_sleep_seconds += remaining
        self.last_request_at = time.monotonic()
        self.request_count += 1
        return slept


def build_opener() -> urllib.request.OpenerDirector:
    cookie_jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))


OPENER = build_opener()


def subject_cache_path(subject_cache_dir: Path, url: str) -> Path:
    path = urlparse(url).path.strip("/")
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "__", path)
    return subject_cache_dir / f"{safe}.html"


def fetch_text(
    url: str,
    cache_path: Path | None,
    limiter: RateLimiter,
    refresh: bool = False,
) -> tuple[str, dict]:
    if cache_path is not None and cache_path.exists() and not refresh:
        text = cache_path.read_text(encoding="utf-8", errors="replace")
        return text, {"fromCache": True, "bytes": len(text.encode("utf-8")), "status": None, "elapsedMs": 0}

    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        slept = limiter.wait()
        started = time.monotonic()
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with OPENER.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                status = getattr(response, "status", None)
                raw = response.read()
            elapsed_ms = int((time.monotonic() - started) * 1000)
            text = raw.decode("utf-8", "replace")
            if cache_path is not None:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(text, encoding="utf-8")
            return text, {
                "fromCache": False,
                "status": status,
                "bytes": len(raw),
                "elapsedMs": elapsed_ms,
                "sleptSeconds": round(slept, 3),
                "attempt": attempt,
            }
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = error
            if attempt < MAX_ATTEMPTS:
                time.sleep(2**attempt)
    raise RuntimeError(f"Échec de récupération après {MAX_ATTEMPTS} tentatives : {url} ({last_error})")


def livewire_snapshot(page_html: str) -> str:
    for match in re.finditer(r'wire:snapshot="([^"]+)"', page_html):
        raw = html.unescape(match.group(1))
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if payload.get("memo", {}).get("name") == "subject-lessons-component":
            return raw
    raise RuntimeError("Snapshot Livewire « subject-lessons-component » introuvable")


def csrf_token(page_html: str) -> str:
    match = re.search(r'<meta name="csrf-token" content="([^"]+)"', page_html)
    if not match:
        raise RuntimeError("Jeton CSRF introuvable")
    return match.group(1)


def buttons(page_html: str) -> list[tuple[str, str]]:
    return [
        (match.group(1), normalize_space(strip_tags(match.group(2))))
        for match in re.finditer(r'<button[^>]*wire:click="([^"]+)"[^>]*>(.*?)</button>', page_html, re.S)
    ]


def selects(page_html: str) -> list[tuple[str, list[tuple[str, str]]]]:
    result = []
    for match in re.finditer(r"<select(.*?)</select>", page_html, re.S):
        block = match.group(0)
        model = re.search(r'wire:model[^=]*="([^"]+)"', block)
        options = [
            (value, normalize_space(strip_tags(label)))
            for value, label in re.findall(r'<option value="([^"]*)"[^>]*>(.*?)</option>', block, re.S)
        ]
        result.append((model.group(1) if model else "?", options))
    return result


def find_call_by_label(page_html: str, prefix: str, label: str) -> str:
    expected = normalize_subject_key(label)
    available = []
    for call, text in buttons(page_html):
        if call.startswith(prefix):
            available.append(text)
            if normalize_subject_key(text) == expected:
                match = re.search(r"'(.*?)'", call)
                if match:
                    return match.group(1)
    raise RuntimeError(f"Filtre introuvable : {label} (disponibles : {available})")


def find_level_value(page_html: str, label: str) -> str:
    expected = normalize_subject_key(label)
    available = []
    for model, options in selects(page_html):
        if model != "level":
            continue
        for value, text in options:
            available.append(text)
            if normalize_subject_key(text) == expected:
                return value
    raise RuntimeError(f"Niveau introuvable : {label} (disponibles : {available})")


class LivewireSession:
    def __init__(self, token: str, snapshot: str, limiter: RateLimiter) -> None:
        self.token = token
        self.snapshot = snapshot
        self.limiter = limiter

    def _post(self, updates: dict | None = None, calls: list | None = None) -> tuple[str, str]:
        payload = {
            "_token": self.token,
            "components": [
                {
                    "snapshot": self.snapshot,
                    "updates": updates or {},
                    "calls": calls or [],
                }
            ],
        }
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        last_error: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            self.limiter.wait()
            request = urllib.request.Request(
                BASE + "/livewire/update",
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Livewire": "1",
                    "X-CSRF-TOKEN": self.token,
                    "User-Agent": USER_AGENT,
                },
            )
            try:
                with OPENER.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                    data = json.loads(response.read().decode("utf-8", "replace"))
                for component in data["components"]:
                    snapshot_payload = json.loads(component["snapshot"])
                    if snapshot_payload.get("memo", {}).get("name") != "subject-lessons-component":
                        continue
                    self.snapshot = component["snapshot"]
                    return component["snapshot"], component["effects"].get("html", "")
                raise RuntimeError("Réponse Livewire sans composant subject-lessons")
            except (urllib.error.URLError, TimeoutError, OSError, KeyError, json.JSONDecodeError) as error:
                last_error = error
                if attempt < MAX_ATTEMPTS:
                    time.sleep(2**attempt)
        raise RuntimeError(f"Échec Livewire après {MAX_ATTEMPTS} tentatives ({last_error})")

    def call(self, method: str, params: list) -> tuple[str, str]:
        return self._post(calls=[{"path": "", "method": method, "params": params}])

    def update(self, updates: dict) -> tuple[str, str]:
        return self._post(updates=updates)


def discover_subjects_live(
    scope: dict[str, str],
    cache_path: Path,
    legacy_path: Path | None,
    limiter: RateLimiter,
    refresh: bool,
) -> list[dict[str, str]]:
    if not refresh:
        for candidate in (cache_path, legacy_path):
            if candidate is not None and candidate.exists():
                cached = json.loads(candidate.read_text(encoding="utf-8"))
                if cached.get("subjects"):
                    if candidate != cache_path:
                        cache_path.parent.mkdir(parents=True, exist_ok=True)
                        cache_path.write_text(candidate.read_text(encoding="utf-8"), encoding="utf-8")
                    return cached["subjects"]

    fetch_text(BASE + "/language/fr", None, limiter, refresh=True)
    homepage, _ = fetch_text(BASE + "/", None, limiter, refresh=True)

    session = LivewireSession(csrf_token(homepage), livewire_snapshot(homepage), limiter)
    _, page_html = session.call(
        "selectSubsystem", [find_call_by_label(homepage, "selectSubsystem(", scope["subsystemLabel"])]
    )
    _, page_html = session.call(
        "selectSection", [find_call_by_label(page_html, "selectSection(", scope["sectionLabel"])]
    )
    _, page_html = session.call(
        "selectCycle", [find_call_by_label(page_html, "selectCycle(", scope["cycleLabel"])]
    )
    level_value = find_level_value(page_html, scope["levelLabel"])
    _, page_html = session.update({"level": level_value})

    subjects: list[dict[str, str]] = []
    seen_urls: set[str] = set()
    for subject in parse_subject_links(page_html, BASE):
        if subject["url"] not in seen_urls:
            seen_urls.add(subject["url"])
            subjects.append(subject)

    # Support natif de la pagination Livewire (ex. Technique FR > 50 matières par classe)
    page_nums = sorted({int(num) for num in re.findall(r"gotoPage\((\d+),\s*'page'\)", page_html)})
    visited = {1}
    page = 2
    while page in page_nums and page <= 20:
        if page in visited:
            page += 1
            continue
        _, page_html = session.call("gotoPage", [page, "page"])
        visited.add(page)
        added = 0
        for subject in parse_subject_links(page_html, BASE):
            if subject["url"] not in seen_urls:
                seen_urls.add(subject["url"])
                subjects.append(subject)
                added += 1
        more_nums = {int(num) for num in re.findall(r"gotoPage\((\d+),\s*'page'\)", page_html)}
        page_nums = sorted(set(page_nums) | more_nums)
        if added == 0:
            break
        page += 1

    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(
        json.dumps(
            {
                "scope": scope,
                "discoveredAt": datetime.now().astimezone().isoformat(timespec="seconds"),
                "subjects": subjects,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return subjects

