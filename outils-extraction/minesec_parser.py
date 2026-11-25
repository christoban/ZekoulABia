#!/usr/bin/env python3
"""Parsing HTML, extraction de numéros et détection d'anomalies MINESEC."""

from __future__ import annotations

import html
import re
import unicodedata
from collections import Counter, defaultdict
from urllib.parse import urljoin

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

DISPLAYED_NUMBER_RE = re.compile(
    r"^("
    r"(?:TU\s*\d+\s*(?:[:.;]\s*|\s+))?"
    r"(?:"
    r"(?:L[eé][çc]ons?|L\s+e[çc]on|Leon|Lessons?|Leson|Lersson|Title|Titre|S[ée]ance|Dossier|"
    r"GW|Practical\s*Work|Directed\s*\(\s*Guided\s*\)\s*Work|Further\s*Stud(?:y|ies)|Lesson\s*FS|FS|Unit|Activit[ée]|Chapitre)"
    r"\s*(?::\s*|(?:n\s*[°ºo]\s*)?)\d+"
    r"|(?:TD|TP|Guided\s*Work)\s*(?:n\s*[°ºo]\s*)?\d*"
    r"|Projet(?:\s*\d+)?"
    r"|N\.B\."
    r"|(?:L|D)\s*\d+"
    r")"
    r")(?=\s*[:：;.)\-–—]|$|\s)",
    re.I,
)


def strip_tags(value: str) -> str:
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    return html.unescape(re.sub(r"<[^>]+>", "", value))


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_for_compare(value: str) -> str:
    return normalize_space(value).casefold()


def normalize_subject_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", normalize_space(value))
    without_accents = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", without_accents.casefold()).strip()


def format_number(value: int | None) -> str:
    return "—" if value is None else str(value)


def has_encoding_issue(value: str) -> bool:
    return "\ufffd" in value or bool(MOJIBAKE_RE.search(value))


def detect_explicit_series(subject_name: str, subject_url: str) -> str | None:
    """Détecte uniquement une mention explicite de série dans le libellé ou l'URL (n'invente jamais)."""
    for source in (subject_name, subject_url):
        match = re.search(r"\bs[ée]rie[\s_-]+(A\d*|ABI|C|D|E|TI|SH|AC)\b", source, re.I)
        if match:
            return match.group(1).upper()
    return None


def is_parasite_module_title(title: str) -> bool:
    normalized = normalize_for_compare(title)
    if normalized in PARASITE_TITLES:
        return True
    return bool(re.match(r"^le[çc]on\s*\d+\b", normalized))


def is_parasite_lesson_title(title: str) -> bool:
    return normalize_for_compare(title) in PARASITE_TITLES


def extract_lesson_number(title: str) -> int | None:
    """Extrait uniquement un numéro explicite de leçon (jamais depuis la position)."""
    match = re.search(r"(?:Le[çc]on|Lesson|Title|Titre)\s*(?::\s*|(?:n\s*[°ºo]\s*)?)(\d+)", title, re.I)
    if match:
        return int(match.group(1))
    match = re.search(r"\bS[ée]ance\s*(?:n\s*[°ºo]\s*)?(\d+)\b", title, re.I)
    if match:
        return int(match.group(1))
    match = re.match(r"L\s*(\d+)\b", title, re.I)
    return int(match.group(1)) if match else None


def extract_displayed_number(title: str) -> str:
    """Extrait le libellé de numéro/repère tel qu'affiché en tête de titre (peut être vide)."""
    cleaned = normalize_space(title)
    match = DISPLAYED_NUMBER_RE.match(cleaned)
    return normalize_space(match.group(1)) if match else ""


def sort_lessons_for_reading(lessons: list[dict]) -> list[dict]:
    """Trie par numéro croissant (leçons sans numéro en fin de module, ordre source conservé)."""
    return sorted(
        lessons,
        key=lambda lesson: (
            lesson["numero"] is None,
            lesson["numero"] if lesson["numero"] is not None else 0,
            lesson.get("positionSource", 0),
        ),
    )


def classify_disorder(original_numbers: list[int | None]) -> str:
    """Classe un désordre en 'lexicographique' (ex: 1, 10, 11, ..., 2) ou 'autre'."""
    nums = [n for n in original_numbers if n is not None]
    if len(nums) < 2:
        return "autre"
    # Vérifie que les éléments None ne sont pas intercalés avant un nombre
    seen_none = False
    for value in original_numbers:
        if value is None:
            seen_none = True
        elif seen_none:
            return "autre"
    if nums != sorted(nums) and nums == sorted(nums, key=str):
        return "lexicographique"
    return "autre"


def make_anomaly(
    anomaly_type: str,
    subject: dict[str, str] | None,
    detail: str,
    module: dict | None = None,
    lesson: dict | None = None,
    sous_type: str | None = None,
) -> dict:
    return {
        "type": anomaly_type,
        "sousType": sous_type,
        "matiere": subject["name"] if subject else None,
        "matiereUrl": subject["url"] if subject else None,
        "moduleOrdre": module["ordre"] if module else None,
        "moduleTitre": module["titre"] if module else None,
        "leconNumero": lesson["numero"] if lesson else None,
        "leconTitre": lesson["titre"] if lesson else None,
        "detail": detail,
    }


def parse_subject_links(page_html: str, base_url: str) -> list[dict[str, str]]:
    subjects: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in re.finditer(r'<a\s+href="([^"]*/learn/[^"]+)"[^>]*>(.*?)</a>', page_html, re.S):
        url = urljoin(base_url, html.unescape(match.group(1)))
        if url in seen:
            continue
        label_match = re.search(r'<p class="text-xl capitalize">(.*?)</p>', match.group(2), re.S)
        if not label_match:
            continue
        label = normalize_space(strip_tags(label_match.group(1)))
        seen.add(url)
        subjects.append({"name": label, "url": url})
    return subjects


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
    base_url: str,
) -> tuple[list[dict], list[dict]]:
    anomalies: list[dict] = []
    headers: list[dict] = []
    for match in re.finditer(r'<span class="flex-1 text-xl">', page_html):
        start = match.start()
        end = find_matching_span_end(page_html, start)
        if end == -1:
            continue
        inner = page_html[match.end() : end - len("</span>")]
        count_match = re.search(r"\((\d+)\s*(?:lessons?|cours|le[çc]ons?)\)", inner, re.I)
        announced = int(count_match.group(1)) if count_match else None
        title_html = re.sub(r'<span class="text-sm">.*?</span>', "", inner, flags=re.S)
        title = normalize_space(strip_tags(title_html))
        title = normalize_space(re.sub(r"\(\s*\d+\s*(?:lessons?|cours|le[çc]ons?)\s*\)", "", title, flags=re.I))
        headers.append({"start": start, "end": end, "titre": title, "nbLeconsAnnonce": announced})

    modules: list[dict] = []
    for index, header in enumerate(headers):
        segment_end = headers[index + 1]["start"] if index + 1 < len(headers) else len(page_html)
        segment = page_html[header["end"] : segment_end]
        module_pos = index + 1
        module: dict = {
            "ordre": module_pos,
            "positionSource": module_pos,
            "titre": header["titre"],
            "nbLeconsAnnonce": header["nbLeconsAnnonce"],
        }
        if is_parasite_module_title(module["titre"]):
            module["titreModuleParasite"] = True
            anomalies.append(
                make_anomaly("titre_module_parasite", subject, f"Titre de module parasite : « {module['titre']} »", module)
            )
        module["lecons"] = []

        if not module["titre"]:
            anomalies.append(make_anomaly("titre_vide", subject, "Titre de module vide", module))
        if has_encoding_issue(module["titre"]):
            anomalies.append(
                make_anomaly(
                    "encodage_suspect",
                    subject,
                    f"Caractère mal encodé dans le titre de module : « {module['titre']} »",
                    module,
                )
            )

        raw_lessons: list[dict] = []
        lesson_pos = 0
        for anchor in re.finditer(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>', segment, re.S):
            url = urljoin(base_url, html.unescape(anchor.group(1)))
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
            lesson_pos += 1
            lesson_title = normalize_space(strip_tags(title_match.group(1)))
            number = extract_lesson_number(lesson_title)
            displayed_number = extract_displayed_number(lesson_title)
            label_match = re.search(r'<small class="block">\s*(.*?)\s*</small>', anchor_inner, re.S)
            module_label = normalize_space(strip_tags(label_match.group(1))) if label_match else ""
            raw_lessons.append(
                {
                    "positionSource": lesson_pos,
                    "numeroAffiche": displayed_number,
                    "numero": number,
                    "titre": lesson_title,
                    "url": url,
                    "_moduleLabel": module_label,
                }
            )

        original_numbers = [lesson["numero"] for lesson in raw_lessons]
        sorted_lessons = sort_lessons_for_reading(raw_lessons)
        sorted_numbers = [lesson["numero"] for lesson in sorted_lessons]
        if original_numbers != sorted_numbers:
            disorder_kind = classify_disorder(original_numbers)
            anomalies.append(
                make_anomaly(
                    "lecons_desordre",
                    subject,
                    f"Type : {disorder_kind} — Ordre source : "
                    + ", ".join(format_number(number) for number in original_numbers)
                    + " ; ordre trié : "
                    + ", ".join(format_number(number) for number in sorted_numbers),
                    module,
                    sous_type=disorder_kind,
                )
            )

        number_counts = Counter(number for number in original_numbers if number is not None)
        for number, count in sorted(number_counts.items()):
            if count <= 1:
                continue
            titles = " | ".join(
                lesson["titre"] for lesson in raw_lessons if lesson["numero"] == number
            )
            anomalies.append(
                make_anomaly(
                    "numero_lecon_duplique_module",
                    subject,
                    f"Numéro {number} présent {count} fois dans le module : {titles}",
                    module,
                )
            )

        if not raw_lessons:
            anomalies.append(make_anomaly("module_sans_lecon", subject, "Aucune leçon extraite pour ce module", module))
        if module["nbLeconsAnnonce"] is None:
            anomalies.append(
                make_anomaly("nb_annonce_absent", subject, "Nombre de leçons annoncé introuvable", module)
            )
        elif len(raw_lessons) != module["nbLeconsAnnonce"]:
            anomalies.append(
                make_anomaly(
                    "nb_extrait_diff",
                    subject,
                    f"{module['nbLeconsAnnonce']} annoncées, {len(raw_lessons)} extraites",
                    module,
                )
            )

        # Conserver strictement l'ordre de la source dans module["lecons"]
        for lesson in raw_lessons:
            if not lesson["titre"]:
                anomalies.append(make_anomaly("titre_vide", subject, "Titre de leçon vide", module, lesson))
            parasite_lesson = is_parasite_lesson_title(lesson["titre"])
            if parasite_lesson:
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

            cleaned_lesson: dict = {
                "positionSource": lesson["positionSource"],
                "numeroAffiche": lesson["numeroAffiche"],
                "numero": lesson["numero"],
                "titre": lesson["titre"],
                "url": lesson["url"],
            }
            if parasite_lesson:
                cleaned_lesson["exclure"] = True
            module["lecons"].append(cleaned_lesson)

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
    elif has_encoding_issue(subject["name"]):
        anomalies.append(
            make_anomaly("encodage_suspect", subject, f"Caractère mal encodé dans le libellé de matière : « {subject['name']} »")
        )

    return modules, anomalies
