#!/usr/bin/env python3
"""Extraction MINESEC Distance Learning — script généralisé (général & technique, FR & EN).

Source publique, sans authentification. Le script ne récupère que les pages
matière et les listes de modules/leçons (titres, numéros, URLs). Il ne visite
aucune page de leçon, ne télécharge aucune vidéo et ne contourne aucune
protection d'accès.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from minesec_http import (
    BASE,
    MIN_INTERVAL_SECONDS,
    RateLimiter,
    discover_subjects_live,
    fetch_text,
    subject_cache_path,
)
from minesec_parser import (
    detect_explicit_series,
    make_anomaly,
    normalize_subject_key,
    parse_subject_page,
)
from minesec_writers import (
    compute_class_stats,
    write_anomalies_report,
    write_class_markdown,
    write_csv,
    write_global_cycle_recap,
    write_json,
    write_recap,
)

SUBSYSTEM_LABELS = {"fr": "Sous-système français", "en": "English Subsystem"}
SECTION_LABELS = {
    ("fr", "general"): "Enseignement général",
    ("fr", "technique"): "Enseignement technique et formation professionnelle",
    ("en", "general"): "General Education",
    ("en", "technique"): "Technical Education and Vocational Training",
}
CYCLE_LABELS = {
    ("fr", "premier"): "Premier cycle", ("fr", "second"): "Deuxième cycle", ("fr", "deuxieme"): "Deuxième cycle",
    ("en", "premier"): "First Cycle", ("en", "second"): "Second Cycle", ("en", "deuxieme"): "Second Cycle",
}
LEVEL_LABELS = {
    "6e": "Sixième", "5e": "Cinquième", "4e": "Quatrième", "3e": "Troisième",
    "2nde": "Seconde", "1re": "Première", "1ere": "Première", "tle": "Terminale",
    "1re-annee": "Première année", "2e-annee": "Deuxième année",
    "3e-annee": "Troisième année", "4e-annee": "Quatrième année",
    "form1": "Form One", "form2": "Form Two", "form3": "Form Three",
    "form4": "Form Four", "form5": "Form Five",
    "lowersixth": "LowerSixth", "uppersixth": "UpperSixth",
}
CYCLE_CLASSES = {
    ("fr", "general", "premier"): ["6e", "5e", "4e", "3e"],
    ("fr", "general", "second"): ["2nde", "1re", "Tle"],
    ("fr", "general", "deuxieme"): ["2nde", "1re", "Tle"],
    ("en", "general", "premier"): ["Form1", "Form2", "Form3", "Form4", "Form5"],
    ("en", "general", "second"): ["LowerSixth", "UpperSixth"],
    ("en", "general", "deuxieme"): ["LowerSixth", "UpperSixth"],
    ("fr", "technique", "premier"): ["1re-annee", "2e-annee", "3e-annee", "4e-annee"],
    ("fr", "technique", "second"): ["2nde", "1re", "Tle"],
    ("fr", "technique", "deuxieme"): ["2nde", "1re", "Tle"],
    ("en", "technique", "premier"): ["Form1", "Form2", "Form3", "Form4", "Form5"],
    ("en", "technique", "second"): ["LowerSixth", "UpperSixth"],
    ("en", "technique", "deuxieme"): ["LowerSixth", "UpperSixth"],
}

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "donnees-extraites"
CACHE_DIR = OUT_DIR / ".cache"
SUBJECT_CACHE_DIR = CACHE_DIR / "subjects"


def build_scope(sous_systeme: str, section: str, cycle: str, classe: str) -> dict[str, str]:
    ss, sec, cyc, cls_key = sous_systeme.lower(), section.lower(), cycle.lower(), classe.lower()
    if ss not in SUBSYSTEM_LABELS:
        raise ValueError(f"Sous-système non supporté : {sous_systeme}")
    if (ss, sec) not in SECTION_LABELS:
        raise ValueError(f"Section non supportée : {ss}/{section}")
    if (ss, cyc) not in CYCLE_LABELS:
        raise ValueError(f"Cycle non supporté : {ss}/{cycle}")
    return {
        "sousSysteme": ss,
        "section": sec,
        "cycle": cyc,
        "classe": classe,
        "subsystemLabel": SUBSYSTEM_LABELS[ss],
        "sectionLabel": SECTION_LABELS[(ss, sec)],
        "cycleLabel": CYCLE_LABELS[(ss, cyc)],
        "levelLabel": LEVEL_LABELS.get(cls_key, classe),
    }


def discovery_cache_path(scope: dict[str, str]) -> Path:
    return CACHE_DIR / f"discovery-{scope['sousSysteme']}-{scope['section']}-{scope['cycle']}-{scope['classe']}.json"


def legacy_discovery_cache_path(scope: dict[str, str]) -> Path | None:
    if (scope["sousSysteme"], scope["section"], scope["cycle"], scope["classe"]) == ("fr", "general", "premier", "6e"):
        return CACHE_DIR / "discovery-fr6e.json"
    return None


def class_output_dir(scope: dict[str, str]) -> Path:
    if scope["section"] == "technique":
        return OUT_DIR / f"technique-{scope['sousSysteme']}" / scope["classe"]
    return OUT_DIR / scope["classe"]


def global_recap_filename(sous_systeme: str, section: str, cycle: str) -> str:
    cycle_slug = "second-cycle" if cycle.lower() in ("second", "deuxieme") else "premier-cycle"
    ss = sous_systeme.lower()
    if section.lower() == "technique":
        return f"recap-global-{ss}-technique-{cycle_slug}.md"
    ss_prefix = "" if ss == "fr" else f"{ss}-"
    return f"recap-global-{ss_prefix}{cycle_slug}.md"


def build_programme(scope: dict[str, str], subject: dict[str, str], modules: list[dict]) -> dict:
    prog: dict = {
        "sousSysteme": scope["sousSysteme"],
        "section": scope["section"],
        "cycle": scope["cycle"],
        "classe": scope["classe"],
        "matiere": subject["name"],
        "urlMatiere": subject["url"],
    }
    if scope["cycle"] in ("second", "deuxieme") or scope["section"] == "technique":
        prog["serie"] = detect_explicit_series(subject["name"], subject["url"])
    prog["modules"] = modules
    return prog


def extract_class(
    scope: dict[str, str],
    limiter: RateLimiter,
    refresh: bool,
    only_subject: str | None,
    generated_at: str,
) -> tuple[dict, bool]:
    refresh_discovery = refresh and (only_subject is None)
    subjects = discover_subjects_live(
        scope,
        discovery_cache_path(scope),
        legacy_discovery_cache_path(scope),
        limiter,
        refresh_discovery,
    )
    target_key = normalize_subject_key(only_subject) if only_subject else None

    records: list[dict] = []
    global_anomalies: list[dict] = []
    has_error = False
    matched_subject = False

    for index, subject in enumerate(subjects, start=1):
        is_target = target_key is None or normalize_subject_key(subject["name"]) == target_key
        if is_target:
            matched_subject = True
        should_refresh = refresh and is_target
        tag = "LIVE --refresh" if should_refresh else "cache/auto"
        print(f"[{scope['classe']} {index}/{len(subjects)}] {subject['name']} ({tag}) — {subject['url']}")
        try:
            page_html, meta = fetch_text(
                subject["url"], subject_cache_path(SUBJECT_CACHE_DIR, subject["url"]), limiter, should_refresh
            )
            if not meta["fromCache"]:
                print(
                    f"   -> HTTP {meta['status']} | {meta['bytes']} octets | {meta['elapsedMs']} ms | "
                    f"attente rate-limit={meta['sleptSeconds']}s | tentative={meta['attempt']}"
                )
        except Exception as error:
            has_error = True
            print(f"   -> ERREUR : {error}", file=sys.stderr)
            anomaly = make_anomaly("erreur_recuperation", subject, str(error))
            records.append(
                {
                    "subject": subject,
                    "programme": build_programme(scope, subject, []),
                    "anomalies": [anomaly],
                }
            )
            continue

        modules, anomalies = parse_subject_page(page_html, subject, BASE)
        if not modules:
            has_error = True
        records.append(
            {
                "subject": subject,
                "programme": build_programme(scope, subject, modules),
                "anomalies": anomalies,
            }
        )

    if only_subject and not matched_subject:
        raise RuntimeError(f"Matière « {only_subject} » introuvable en {scope['classe']}.")

    out_dir = class_output_dir(scope)
    out_dir.mkdir(parents=True, exist_ok=True)
    programmes = [record["programme"] for record in records]
    write_json(programmes, out_dir)
    write_csv(programmes, out_dir)
    write_class_markdown(records, scope, BASE, generated_at, out_dir)
    write_recap(records, global_anomalies, scope, BASE, generated_at, out_dir)
    write_anomalies_report(records, global_anomalies, scope, BASE, generated_at, out_dir)

    stats = compute_class_stats(records, global_anomalies)
    print(
        f"Classe {scope['classe']} terminée : {stats['subjects']} matières, {stats['modules']} modules, "
        f"{stats['lessons']} leçons, {stats['anomalies']} anomalies "
        f"(désordre lexico={stats['disorder_lex']}, autre={stats['disorder_other']})."
    )
    return {"scope": scope, "records": records, "global_anomalies": global_anomalies, "stats": stats}, has_error


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sous-systeme", default="fr", help="Sous-système (ex: fr, en). Défaut: fr")
    parser.add_argument("--section", default="general", help="Section (ex: general, technique). Défaut: general")
    parser.add_argument("--cycle", default="premier", help="Cycle (ex: premier, second). Défaut: premier")
    parser.add_argument("--classe", nargs="+", help="Classes à extraire (ex: --classe 6e ou --classe 2nde 1re Tle).")
    parser.add_argument("--refresh", action="store_true", help="Ignore le cache et refait les requêtes.")
    parser.add_argument("--matiere", help="Cible une seule matière pour --refresh (autres lues depuis le cache).")
    parser.add_argument("--global-recap", action="store_true", help="Écrit le récapitulatif global du cycle.")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    SUBJECT_CACHE_DIR.mkdir(parents=True, exist_ok=True)

    classes = args.classe
    if not classes:
        key = (args.sous_systeme.lower(), args.section.lower(), args.cycle.lower())
        if key not in CYCLE_CLASSES:
            print(f"ERREUR : précisez --classe pour {key}", file=sys.stderr)
            return 2
        classes = CYCLE_CLASSES[key]

    limiter = RateLimiter(MIN_INTERVAL_SECONDS)
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")

    class_runs = []
    any_error = False
    for classe in classes:
        try:
            scope = build_scope(args.sous_systeme, args.section, args.cycle, classe)
            run_data, has_error = extract_class(scope, limiter, args.refresh, args.matiere, generated_at)
            class_runs.append(run_data)
            any_error = any_error or has_error
        except Exception as error:
            print(f"ERREUR classe {classe} : {error}", file=sys.stderr)
            return 1

    if args.global_recap or len(class_runs) > 1:
        filename = global_recap_filename(args.sous_systeme, args.section, args.cycle)
        recap_path = write_global_cycle_recap(class_runs, BASE, generated_at, OUT_DIR, filename=filename)
        print(f"Récapitulatif global écrit : {recap_path}")

    print(
        f"Requêtes réseau effectuées : {limiter.request_count} "
        f"(temps d'attente rate-limit cumulé : {limiter.total_sleep_seconds:.2f}s)."
    )
    return 1 if any_error else 0


if __name__ == "__main__":
    raise SystemExit(main())
