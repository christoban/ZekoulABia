#!/usr/bin/env python3
"""Extraction MINESEC Distance Learning — FR général, premier cycle, 6e.

Source publique, sans authentification. Le script ne récupère que les pages
matière et les listes de modules/leçons (titres, numéros, URLs). Il ne visite
aucune page de leçon, ne télécharge aucune vidéo et ne contourne aucune
protection d'accès.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import http.cookiejar
import json
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin, urlparse

BASE = "https://minesec-distance.schoolfaqs.net"
USER_AGENT = "ZekoulABia-ProgramExtractor/0.1 (contact: admin@zekoulabia.local)"
MIN_INTERVAL_SECONDS = 1.1
MAX_ATTEMPTS = 3
REQUEST_TIMEOUT_SECONDS = 45

SCOPE = {
    "sousSysteme": "fr",
    "section": "general",
    "cycle": "premier",
    "classe": "6e",
    "subsystemLabel": "Sous-système français",
    "sectionLabel": "Enseignement général",
    "cycleLabel": "Premier cycle",
    "levelLabel": "Sixième",
}

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "donnees-extraites"
CACHE_DIR = OUT_DIR / ".cache"
SUBJECT_CACHE_DIR = CACHE_DIR / "subjects"
DISCOVERY_CACHE = CACHE_DIR / "discovery-fr6e.json"

PARASITE_TITLES = {
    "module",
    "modules",
    "leçon",
    "lecons",
    "leçons",
    "titre des lecons",
    "titre des leçons",
    "titres des lecons",
    "titres des leçons",
}

MOJIBAKE_RE = re.compile(r"(?:Ã[\x80-\xBF]|Â[\x80-\xBF]|â€[\x80-\xBF]|ðŸ)")


class RateLimiter:
    def __init__(self, interval_seconds: float) -> None:
        self.interval_seconds = interval_seconds
        self.last_request_at: float | None = None

    def wait(self) -> None:
        if self.last_request_at is None:
            self.last_request_at = time.monotonic()
            return
        elapsed = time.monotonic() - self.last_request_at
        remaining = self.interval_seconds - elapsed
        if remaining > 0:
            time.sleep(remaining)
        self.last_request_at = time.monotonic()


def build_opener() -> urllib.request.OpenerDirector:
    cookie_jar = http.cookiejar.CookieJar()
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))


OPENER = build_opener()


def strip_tags(value: str) -> str:
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    return html.unescape(re.sub(r"<[^>]+>", "", value))


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_for_compare(value: str) -> str:
    return normalize_space(value).casefold()


def format_number(value: int | None) -> str:
    return "—" if value is None else str(value)


def has_encoding_issue(value: str) -> bool:
    return "\ufffd" in value or bool(MOJIBAKE_RE.search(value))


def is_parasite_module_title(title: str) -> bool:
    normalized = normalize_for_compare(title)
    if normalized in PARASITE_TITLES:
        return True
    return bool(re.match(r"^le[çc]on\s*\d+\b", normalized))


def is_parasite_lesson_title(title: str) -> bool:
    return normalize_for_compare(title) in PARASITE_TITLES


def extract_lesson_number(title: str) -> int | None:
    match = re.search(r"(?:Le[çc]on|Lesson|Title)\s*(?:n\s*[°o]\s*)?(\d+)", title, re.I)
    if match:
        return int(match.group(1))
    match = re.match(r"L\s*(\d+)\b", title, re.I)
    return int(match.group(1)) if match else None


def make_anomaly(
    anomaly_type: str,
    subject: dict[str, str] | None,
    detail: str,
    module: dict | None = None,
    lesson: dict | None = None,
) -> dict:
    return {
        "type": anomaly_type,
        "matiere": subject["name"] if subject else None,
        "matiereUrl": subject["url"] if subject else None,
        "moduleOrdre": module["ordre"] if module else None,
        "moduleTitre": module["titre"] if module else None,
        "leconNumero": lesson["numero"] if lesson else None,
        "leconTitre": lesson["titre"] if lesson else None,
        "detail": detail,
    }


def fetch_text(
    url: str,
    cache_path: Path | None,
    limiter: RateLimiter,
    refresh: bool = False,
) -> str:
    if cache_path is not None and cache_path.exists() and not refresh:
        return cache_path.read_text(encoding="utf-8", errors="replace")

    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        limiter.wait()
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with OPENER.open(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                raw = response.read()
            text = raw.decode("utf-8", "replace")
            if cache_path is not None:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_text(text, encoding="utf-8")
            return text
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
    expected = label.casefold()
    for call, text in buttons(page_html):
        if call.startswith(prefix) and text.casefold() == expected:
            match = re.search(r"'(.*?)'", call)
            if match:
                return match.group(1)
    raise RuntimeError(f"Filtre introuvable : {label}")


def find_level_value(page_html: str, label: str) -> str:
    expected = label.casefold()
    for model, options in selects(page_html):
        if model != "level":
            continue
        for value, text in options:
            if text.casefold() == expected:
                return value
    raise RuntimeError(f"Niveau introuvable : {label}")


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


def parse_subject_links(page_html: str) -> list[dict[str, str]]:
    subjects: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in re.finditer(r'<a\s+href="([^"]*/learn/[^"]+)"[^>]*>(.*?)</a>', page_html, re.S):
        url = urljoin(BASE, html.unescape(match.group(1)))
        if url in seen:
            continue
        label_match = re.search(r'<p class="text-xl capitalize">(.*?)</p>', match.group(2), re.S)
        if not label_match:
            continue
        label = normalize_space(strip_tags(label_match.group(1)))
        seen.add(url)
        subjects.append({"name": label, "url": url})
    return subjects


def discover_subjects(limiter: RateLimiter, refresh: bool) -> list[dict[str, str]]:
    if DISCOVERY_CACHE.exists() and not refresh:
        cached = json.loads(DISCOVERY_CACHE.read_text(encoding="utf-8"))
        if cached.get("subjects"):
            return cached["subjects"]

    limiter.wait()
    OPENER.open(
        urllib.request.Request(BASE + "/language/fr", headers={"User-Agent": USER_AGENT}),
        timeout=REQUEST_TIMEOUT_SECONDS,
    ).read()
    limiter.wait()
    homepage = OPENER.open(
        urllib.request.Request(BASE + "/", headers={"User-Agent": USER_AGENT}),
        timeout=REQUEST_TIMEOUT_SECONDS,
    ).read().decode("utf-8", "replace")

    session = LivewireSession(csrf_token(homepage), livewire_snapshot(homepage), limiter)
    _, page_html = session.call(
        "selectSubsystem", [find_call_by_label(page_html=homepage, prefix="selectSubsystem(", label=SCOPE["subsystemLabel"])]
    )
    _, page_html = session.call(
        "selectSection", [find_call_by_label(page_html, "selectSection(", SCOPE["sectionLabel"])]
    )
    _, page_html = session.call(
        "selectCycle", [find_call_by_label(page_html, "selectCycle(", SCOPE["cycleLabel"])]
    )
    level_value = find_level_value(page_html, SCOPE["levelLabel"])
    _, page_html = session.update({"level": level_value})

    subjects = parse_subject_links(page_html)
    DISCOVERY_CACHE.parent.mkdir(parents=True, exist_ok=True)
    DISCOVERY_CACHE.write_text(
        json.dumps(
            {
                "scope": SCOPE,
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


def subject_cache_path(url: str) -> Path:
    path = urlparse(url).path.strip("/")
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "__", path)
    return SUBJECT_CACHE_DIR / f"{safe}.html"


def find_matching_span_end(source: str, start: int) -> int:
    opening_end = source.find(">", start)
    if opening_end == -1:
        return -1
    depth = 1
    position = opening_end + 1
    tag_re = re.compile(r"<span\b[^>]*>|</span\s*>", re.I)
    while True:
        match = tag_re.search(source, position)
        if not match:
            return -1
        if match.group(0).startswith("</"):
            depth -= 1
            if depth == 0:
                return match.end()
        else:
            depth += 1
        position = match.end()


def parse_subject_page(
    page_html: str,
    subject: dict[str, str],
) -> tuple[list[dict], list[dict]]:
    anomalies: list[dict] = []
    headers: list[dict] = []
    for match in re.finditer(r'<span class="flex-1 text-xl">', page_html):
        start = match.start()
        end = find_matching_span_end(page_html, start)
        if end == -1:
            continue
        inner = page_html[match.end() : end - len("</span>")]
        count_match = re.search(r"\((\d+)\s*lessons?\)", inner, re.I)
        announced = int(count_match.group(1)) if count_match else None
        title_html = re.sub(r'<span class="text-sm">.*?</span>', "", inner, flags=re.S)
        title = normalize_space(strip_tags(title_html))
        title = normalize_space(re.sub(r"\(\s*\d+\s*lessons?\s*\)", "", title, flags=re.I))
        headers.append({"start": start, "end": end, "titre": title, "nbLeconsAnnonce": announced})

    modules: list[dict] = []
    for index, header in enumerate(headers):
        segment_end = headers[index + 1]["start"] if index + 1 < len(headers) else len(page_html)
        segment = page_html[header["end"] : segment_end]
        module = {
            "ordre": index + 1,
            "titre": header["titre"],
            "nbLeconsAnnonce": header["nbLeconsAnnonce"],
            "lecons": [],
        }
        if not module["titre"]:
            anomalies.append(make_anomaly("titre_vide", subject, "Titre de module vide", module))
        if is_parasite_module_title(module["titre"]):
            anomalies.append(
                make_anomaly("titre_module_parasite", subject, f"Titre de module parasite : « {module['titre']} »", module)
            )

        for anchor in re.finditer(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>', segment, re.S):
            url = urljoin(BASE, html.unescape(anchor.group(1)))
            if "/learn/" not in url:
                continue
            anchor_inner = anchor.group(2)
            title_match = re.search(
                r'<h3 class="mb-2 md:text-2xl font-semibold">\s*(.*?)\s*</h3>', anchor_inner, re.S
            )
            if not title_match:
                anomalies.append(
                    make_anomaly(
                        "ancre_ignoree",
                        subject,
                        f"Ancre sans titre de leçon : {url} — « {normalize_space(strip_tags(anchor_inner))[:120]} »",
                        module,
                    )
                )
                continue
            lesson_title = normalize_space(strip_tags(title_match.group(1)))
            number = extract_lesson_number(lesson_title)
            label_match = re.search(r'<small class="block">\s*(.*?)\s*</small>', anchor_inner, re.S)
            module_label = normalize_space(strip_tags(label_match.group(1))) if label_match else ""
            lesson = {
                "numero": number,
                "titre": lesson_title,
                "url": url,
                "_moduleLabel": module_label,
            }
            module["lecons"].append(lesson)

        original_numbers = [lesson["numero"] for lesson in module["lecons"]]
        sorted_lessons = sorted(
            module["lecons"],
            key=lambda lesson: (
                lesson["numero"] is None,
                lesson["numero"] if lesson["numero"] is not None else 0,
            ),
        )
        sorted_numbers = [lesson["numero"] for lesson in sorted_lessons]
        if original_numbers != sorted_numbers:
            anomalies.append(
                make_anomaly(
                    "lecons_desordre",
                    subject,
                    "Ordre source : "
                    + ", ".join(format_number(number) for number in original_numbers)
                    + " ; ordre trié : "
                    + ", ".join(format_number(number) for number in sorted_numbers),
                    module,
                )
            )

        number_counts = Counter(number for number in original_numbers if number is not None)
        for number, count in sorted(number_counts.items()):
            if count <= 1:
                continue
            titles = " | ".join(
                lesson["titre"] for lesson in module["lecons"] if lesson["numero"] == number
            )
            anomalies.append(
                make_anomaly(
                    "numero_lecon_duplique_module",
                    subject,
                    f"Numéro {number} présent {count} fois dans le module : {titles}",
                    module,
                )
            )

        if not module["lecons"]:
            anomalies.append(make_anomaly("module_sans_lecon", subject, "Aucune leçon extraite pour ce module", module))
        if module["nbLeconsAnnonce"] is None:
            anomalies.append(
                make_anomaly("nb_annonce_absent", subject, "Nombre de leçons annoncé introuvable", module)
            )
        elif len(module["lecons"]) != module["nbLeconsAnnonce"]:
            anomalies.append(
                make_anomaly(
                    "nb_extrait_diff",
                    subject,
                    f"{module['nbLeconsAnnonce']} annoncées, {len(module['lecons'])} extraites",
                    module,
                )
            )

        for lesson in module["lecons"]:
            if not lesson["titre"]:
                anomalies.append(make_anomaly("titre_vide", subject, "Titre de leçon vide", module, lesson))
            if is_parasite_lesson_title(lesson["titre"]):
                anomalies.append(
                    make_anomaly(
                        "titre_lecon_parasite",
                        subject,
                        f"Titre de leçon parasite : « {lesson['titre']} »",
                        module,
                        lesson,
                    )
                )
            if lesson["numero"] is None:
                anomalies.append(
                    make_anomaly(
                        "lecon_sans_numero",
                        subject,
                        f"Numéro de leçon non explicite dans « {lesson['titre']} »",
                        module,
                        lesson,
                    )
                )
            if has_encoding_issue(lesson["titre"]) or has_encoding_issue(lesson["url"]):
                anomalies.append(
                    make_anomaly(
                        "encodage_suspect",
                        subject,
                        f"Caractère mal encodé dans le titre ou l'URL : « {lesson['titre']} »",
                        module,
                        lesson,
                    )
                )
            if lesson["_moduleLabel"] and normalize_for_compare(lesson["_moduleLabel"]) != normalize_for_compare(
                module["titre"]
            ):
                anomalies.append(
                    make_anomaly(
                        "lecon_rattachee_module_different",
                        subject,
                        f"Libellé de rattachement « {lesson['_moduleLabel']} » différent du module « {module['titre']} »",
                        module,
                        lesson,
                    )
                )

        module["lecons"] = [
            {"numero": lesson["numero"], "titre": lesson["titre"], "url": lesson["url"]}
            for lesson in sorted_lessons
        ]
        modules.append(module)

    by_number: dict[int, list[tuple[dict, dict]]] = defaultdict(list)
    for module in modules:
        for lesson in module["lecons"]:
            if lesson["numero"] is not None:
                by_number[lesson["numero"]].append((module, lesson))

    for number, occurrences in sorted(by_number.items()):
        involved_modules = {module["ordre"] for module, _ in occurrences}
        if len(involved_modules) <= 1:
            continue
        details = " | ".join(
            f"M{module['ordre']} « {module['titre']} » : « {lesson['titre']} »"
            for module, lesson in occurrences
        )
        anomalies.append(
            make_anomaly(
                "numero_lecon_duplique_matiere",
                subject,
                f"Numéro {number} présent dans plusieurs modules : {details}",
            )
        )

    numbers = sorted(by_number)
    if numbers:
        minimum, maximum = numbers[0], numbers[-1]
        for number in range(minimum, maximum + 1):
            if number not in by_number:
                anomalies.append(
                    make_anomaly(
                        "numero_lecon_manquant",
                        subject,
                        f"Numéro {number} absent entre {minimum} et {maximum}",
                    )
                )
        if minimum > 1:
            anomalies.append(
                make_anomaly(
                    "numerotation_non_standard",
                    subject,
                    f"Premier numéro {minimum}, dernier numéro {maximum}",
                )
            )

    if not modules:
        anomalies.append(make_anomaly("matiere_sans_module", subject, "Aucun module extrait"))
    if not subject["name"]:
        anomalies.append(make_anomaly("matiere_libelle_absent", subject, "Libellé de matière vide"))

    return modules, anomalies


def build_programme(subject: dict[str, str], modules: list[dict]) -> dict:
    return {
        "sousSysteme": SCOPE["sousSysteme"],
        "section": SCOPE["section"],
        "cycle": SCOPE["cycle"],
        "classe": SCOPE["classe"],
        "matiere": subject["name"],
        "modules": modules,
    }


def write_json(programmes: list[dict]) -> None:
    path = OUT_DIR / "programmes.json"
    path.write_text(json.dumps(programmes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_csv(programmes: list[dict]) -> None:
    path = OUT_DIR / "programmes.csv"
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "sousSysteme",
                "section",
                "cycle",
                "classe",
                "matiere",
                "module_ordre",
                "module_titre",
                "nbLeconsAnnonce",
                "lecon_numero",
                "lecon_titre",
                "lecon_url",
            ]
        )
        for programme in programmes:
            for module in programme["modules"]:
                lessons = module["lecons"] or [None]
                for lesson in lessons:
                    writer.writerow(
                        [
                            programme["sousSysteme"],
                            programme["section"],
                            programme["cycle"],
                            programme["classe"],
                            programme["matiere"],
                            module["ordre"],
                            module["titre"],
                            "" if module["nbLeconsAnnonce"] is None else module["nbLeconsAnnonce"],
                            "" if lesson is None or lesson["numero"] is None else lesson["numero"],
                            "" if lesson is None else lesson["titre"],
                            "" if lesson is None else lesson["url"],
                        ]
                    )


def write_class_markdown(records: list[dict], generated_at: str) -> None:
    path = OUT_DIR / f"{SCOPE['classe']}.md"
    total_modules = sum(len(record["programme"]["modules"]) for record in records)
    total_lessons = sum(
        len(module["lecons"]) for record in records for module in record["programme"]["modules"]
    )
    lines = [
        f"# {SCOPE['classe']} — Programme extrait",
        "",
        f"- Source : {BASE}",
        f"- Périmètre : {SCOPE['sousSysteme']} / {SCOPE['section']} / {SCOPE['cycle']} / {SCOPE['classe']}",
        f"- Extraction : {generated_at}",
        f"- Matières : {len(records)} — modules : {total_modules} — leçons : {total_lessons}",
        "- Les leçons sont triées par numéro ; l'ordre des modules est celui de la source.",
        "- Les écarts entre nombre annoncé et nombre extrait sont dans `rapport-anomalies.md`.",
        "",
        "## Sommaire",
        "",
        "| Matière | Modules | Leçons |",
        "|---|---:|---:|",
    ]
    for record in records:
        programme = record["programme"]
        lesson_count = sum(len(module["lecons"]) for module in programme["modules"])
        lines.append(f"| {programme['matiere']} | {len(programme['modules'])} | {lesson_count} |")
    lines.append("")

    for record in records:
        programme = record["programme"]
        lines.extend([f"## {programme['matiere']}", "", f"Source : {record['subject']['url']}", ""])
        for module in programme["modules"]:
            announced = "nombre annoncé absent" if module["nbLeconsAnnonce"] is None else f"{module['nbLeconsAnnonce']} annoncées"
            lines.append(f"### {module['ordre']}. {module['titre'] or '*(titre vide)*'}")
            lines.append("")
            lines.append(f"_{announced} / {len(module['lecons'])} extraites_")
            lines.append("")
            if not module["lecons"]:
                lines.append("_Aucune leçon listée._")
                lines.append("")
                continue
            for lesson in module["lecons"]:
                title = lesson["titre"] or "*(titre vide)*"
                suffix = " — _(numéro non extrait)_" if lesson["numero"] is None else ""
                lines.append(f"- **{title}**{suffix} — {lesson['url']}")
            lines.append("")

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def write_recap(records: list[dict], generated_at: str) -> None:
    path = OUT_DIR / "recap-chiffre.md"
    total_modules = 0
    total_lessons = 0
    total_lessons_with_announced = 0
    total_announced = 0
    total_missing_announced = 0
    total_anomalies = 0
    rows = []
    for record in records:
        programme = record["programme"]
        modules = programme["modules"]
        lessons = sum(len(module["lecons"]) for module in modules)
        lessons_with_announced = sum(
            len(module["lecons"]) for module in modules if module["nbLeconsAnnonce"] is not None
        )
        announced = sum(
            module["nbLeconsAnnonce"] for module in modules if module["nbLeconsAnnonce"] is not None
        )
        missing_announced = sum(1 for module in modules if module["nbLeconsAnnonce"] is None)
        anomaly_count = len(record["anomalies"])
        total_modules += len(modules)
        total_lessons += lessons
        total_lessons_with_announced += lessons_with_announced
        total_announced += announced
        total_missing_announced += missing_announced
        total_anomalies += anomaly_count
        rows.append(
            (
                programme["matiere"],
                len(modules),
                lessons,
                announced,
                lessons - lessons_with_announced,
                lessons_with_announced - announced,
                missing_announced,
                anomaly_count,
            )
        )

    lines = [
        "# Récapitulatif chiffré",
        "",
        f"- Source : {BASE}",
        f"- Périmètre : {SCOPE['sousSysteme']} / {SCOPE['section']} / {SCOPE['cycle']} / {SCOPE['classe']}",
        f"- Extraction : {generated_at}",
        "",
        "## Par classe",
        "",
        "| Classe | Matières | Modules | Leçons extraites | Leçons annoncées | Leçons hors annonce | Écart | Anomalies |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
        f"| {SCOPE['classe']} | {len(records)} | {total_modules} | {total_lessons} | {total_announced} | {total_lessons - total_lessons_with_announced} | {total_lessons_with_announced - total_announced} | {total_anomalies} |",
        "",
        "## Par matière",
        "",
        "| Matière | Modules | Leçons extraites | Leçons annoncées | Leçons hors annonce | Écart | Modules sans annonce | Anomalies |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for (
        matiere,
        module_count,
        lesson_count,
        announced,
        lessons_without_announced,
        gap,
        missing_announced,
        anomaly_count,
    ) in rows:
        lines.append(
            f"| {matiere} | {module_count} | {lesson_count} | {announced} | {lessons_without_announced} | {gap} | {missing_announced} | {anomaly_count} |"
        )
    lines.extend(
        [
            f"| **Total** | **{total_modules}** | **{total_lessons}** | **{total_announced}** | **{total_lessons - total_lessons_with_announced}** | **{total_lessons_with_announced - total_announced}** | **{total_missing_announced}** | **{total_anomalies}** |",
            "",
            "Notes :",
            "- L'écart ne porte que sur les modules avec un nombre annoncé lisible ; les leçons hors annonce sont celles des modules sans nombre annoncé.",
            "- Les anomalies sont détaillées dans `rapport-anomalies.md` ; aucune correction n'a été appliquée.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")


def write_anomalies_report(
    records: list[dict],
    global_anomalies: list[dict],
    generated_at: str,
) -> None:
    path = OUT_DIR / "rapport-anomalies.md"
    all_anomalies = [anomaly for record in records for anomaly in record["anomalies"]] + global_anomalies
    type_counts = Counter(anomaly["type"] for anomaly in all_anomalies)

    lines = [
        "# Rapport d'anomalies",
        "",
        f"- Source : {BASE}",
        f"- Périmètre : {SCOPE['sousSysteme']} / {SCOPE['section']} / {SCOPE['cycle']} / {SCOPE['classe']}",
        f"- Extraction : {generated_at}",
        f"- Anomalies : {len(all_anomalies)}",
        "",
        "Aucune correction n'a été appliquée. Les titres, numéros et ordres sont ceux de la source ; "
        "seul le tri des leçons par numéro a été appliqué dans les fichiers, conformément à la consigne.",
        "",
        "## Synthèse par type",
        "",
        "| Type | Nombre |",
        "|---|---:|",
    ]
    for anomaly_type, count in sorted(type_counts.items()):
        lines.append(f"| `{anomaly_type}` | {count} |")
    lines.append("")

    if global_anomalies:
        lines.extend(["## Anomalies globales", ""])
        for anomaly in global_anomalies:
            lines.append(f"- **{anomaly['type']}** : {anomaly['detail']}")
        lines.append("")

    for record in records:
        subject = record["subject"]
        programme = record["programme"]
        anomalies = record["anomalies"]
        lines.extend([f"## {programme['matiere']}", "", f"Source : {subject['url']}", ""])
        if not anomalies:
            lines.extend(["_Aucune anomalie détectée._", ""])
            continue
        ordered = sorted(
            anomalies,
            key=lambda anomaly: (
                anomaly["type"],
                anomaly["moduleOrdre"] if anomaly["moduleOrdre"] is not None else 0,
                anomaly["leconNumero"] if anomaly["leconNumero"] is not None else 10**9,
                anomaly["detail"],
            ),
        )
        for anomaly in ordered:
            location = []
            if anomaly["moduleOrdre"] is not None:
                location.append(f"Module {anomaly['moduleOrdre']} « {anomaly['moduleTitre'] or '(titre vide)'} »")
            if anomaly["leconNumero"] is not None or anomaly["leconTitre"] is not None:
                location.append(
                    f"Leçon {format_number(anomaly['leconNumero'])} « {anomaly['leconTitre'] or '(titre vide)'} »"
                )
            prefix = " — ".join(location)
            if prefix:
                lines.append(f"- **{anomaly['type']}** — {prefix} : {anomaly['detail']}")
            else:
                lines.append(f"- **{anomaly['type']}** : {anomaly['detail']}")
        lines.append("")

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Ignore le cache et refait les requêtes.")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    SUBJECT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    limiter = RateLimiter(MIN_INTERVAL_SECONDS)
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")

    try:
        subjects = discover_subjects(limiter, args.refresh)
    except Exception as error:
        print(f"ERREUR découverte des matières : {error}", file=sys.stderr)
        return 1

    if len(subjects) != 18:
        print(f"AVERTISSEMENT : {len(subjects)} matières découvertes au lieu de 18.", file=sys.stderr)

    records: list[dict] = []
    global_anomalies: list[dict] = []
    if len(subjects) != 18:
        global_anomalies.append(
            {
                "type": "nombre_matieres_inattendu",
                "matiere": None,
                "matiereUrl": None,
                "moduleOrdre": None,
                "moduleTitre": None,
                "leconNumero": None,
                "leconTitre": None,
                "detail": f"{len(subjects)} matières découvertes au lieu de 18.",
            }
        )

    fetch_failed = False
    parse_failed = False
    for index, subject in enumerate(subjects, start=1):
        print(f"[{index}/{len(subjects)}] {subject['name']} — {subject['url']}")
        try:
            page_html = fetch_text(subject["url"], subject_cache_path(subject["url"]), limiter, args.refresh)
        except Exception as error:
            fetch_failed = True
            anomaly = make_anomaly("erreur_recuperation", subject, str(error))
            records.append(
                {
                    "subject": subject,
                    "programme": build_programme(subject, []),
                    "anomalies": [anomaly],
                }
            )
            continue

        modules, anomalies = parse_subject_page(page_html, subject)
        if not modules:
            parse_failed = True
        records.append(
            {
                "subject": subject,
                "programme": build_programme(subject, modules),
                "anomalies": anomalies,
            }
        )

    programmes = [record["programme"] for record in records]
    write_json(programmes)
    write_csv(programmes)
    write_class_markdown(records, generated_at)
    write_recap(records, generated_at)
    write_anomalies_report(records, global_anomalies, generated_at)

    total_modules = sum(len(programme["modules"]) for programme in programmes)
    total_lessons = sum(
        len(module["lecons"]) for programme in programmes for module in programme["modules"]
    )
    total_anomalies = sum(len(record["anomalies"]) for record in records) + len(global_anomalies)
    print(
        f"Terminé : {len(records)} matières, {total_modules} modules, {total_lessons} leçons, "
        f"{total_anomalies} anomalies."
    )
    print(f"Fichiers : {OUT_DIR / 'programmes.json'}, {OUT_DIR / 'programmes.csv'}, "
          f"{OUT_DIR / (SCOPE['classe'] + '.md')}, {OUT_DIR / 'recap-chiffre.md'}, "
          f"{OUT_DIR / 'rapport-anomalies.md'}")

    if fetch_failed or parse_failed:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
