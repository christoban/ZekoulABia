#!/usr/bin/env python3
"""Générateurs de sorties (JSON, CSV, Markdown classe, récaps, rapport d'anomalies)."""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path

from minesec_parser import format_number, normalize_subject_key, sort_lessons_for_reading


def write_json(programmes: list[dict], out_dir: Path) -> Path:
    path = out_dir / "programmes.json"
    path.write_text(json.dumps(programmes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def write_csv(programmes: list[dict], out_dir: Path) -> Path:
    path = out_dir / "programmes.csv"
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
                "module_positionSource",
                "module_titre",
                "titreModuleParasite",
                "nbLeconsAnnonce",
                "lecon_positionSource",
                "lecon_numeroAffiche",
                "lecon_numero",
                "lecon_titre",
                "exclure",
                "lecon_url",
            ]
        )
        for programme in programmes:
            for module in programme["modules"]:
                lessons = module["lecons"] or [None]
                is_mod_parasite = "true" if module.get("titreModuleParasite") else ""
                for lesson in lessons:
                    writer.writerow(
                        [
                            programme["sousSysteme"],
                            programme["section"],
                            programme["cycle"],
                            programme["classe"],
                            programme["matiere"],
                            module["ordre"],
                            module["positionSource"],
                            module["titre"],
                            is_mod_parasite,
                            "" if module["nbLeconsAnnonce"] is None else module["nbLeconsAnnonce"],
                            "" if lesson is None else lesson["positionSource"],
                            "" if lesson is None else lesson["numeroAffiche"],
                            "" if lesson is None or lesson["numero"] is None else lesson["numero"],
                            "" if lesson is None else lesson["titre"],
                            "" if lesson is None or not lesson.get("exclure") else "true",
                            "" if lesson is None else lesson["url"],
                        ]
                    )
    return path


def write_class_markdown(
    records: list[dict],
    scope: dict[str, str],
    base_url: str,
    generated_at: str,
    out_dir: Path,
) -> Path:
    path = out_dir / f"{scope['classe']}.md"
    total_modules = sum(len(record["programme"]["modules"]) for record in records)
    total_lessons = sum(
        len(module["lecons"]) for record in records for module in record["programme"]["modules"]
    )
    lines = [
        f"# {scope['classe']} — Programme extrait",
        "",
        f"- Source : {base_url}",
        f"- Périmètre : {scope['sousSysteme']} / {scope['section']} / {scope['cycle']} / {scope['classe']}",
        f"- Extraction : {generated_at}",
        f"- Matières : {len(records)} — modules : {total_modules} — leçons : {total_lessons}",
        "- **Ordre des leçons** : pour le confort de lecture, les leçons sont triées par numéro croissant dans ce Markdown "
        "(les leçons sans numéro apparaissent en fin de module dans leur ordre source). "
        "Dans `programmes.json` et `programmes.csv`, l'ordre exact de la source (`positionSource`) est conservé sans aucun tri.",
        "- L'ordre des modules est celui de la source (`positionSource`).",
        "- Les anomalies et écarts sont détaillés dans `rapport-anomalies.md`.",
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
            announced = (
                "nombre annoncé absent"
                if module["nbLeconsAnnonce"] is None
                else f"{module['nbLeconsAnnonce']} annoncées"
            )
            parasite_tag = " `[titreModuleParasite]`" if module.get("titreModuleParasite") else ""
            lines.append(f"### {module['positionSource']}. {module['titre'] or '*(titre vide)*'}{parasite_tag}")
            lines.append("")
            lines.append(f"_{announced} / {len(module['lecons'])} extraites_")
            lines.append("")
            if not module["lecons"]:
                lines.append("_Aucune leçon listée._")
                lines.append("")
                continue
            for lesson in sort_lessons_for_reading(module["lecons"]):
                title = lesson["titre"] or "*(titre vide)*"
                tags = []
                if lesson["numero"] is None:
                    tags.append("_(numéro non extrait)_")
                if lesson.get("exclure"):
                    tags.append("`[exclure]`")
                suffix = (" — " + " ".join(tags)) if tags else ""
                lines.append(f"- **{title}** (pos. {lesson['positionSource']}){suffix} — {lesson['url']}")
            lines.append("")

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return path


def compute_class_stats(records: list[dict], global_anomalies: list[dict]) -> dict:
    total_modules = 0
    total_lessons = 0
    total_lessons_with_announced = 0
    total_announced = 0
    total_missing_announced = 0
    total_anomalies = len(global_anomalies)
    disorder_lex = 0
    disorder_other = 0
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
        anomalies = record["anomalies"]
        anomaly_count = len(anomalies)
        for anomaly in anomalies:
            if anomaly["type"] == "lecons_desordre":
                if anomaly.get("sousType") == "lexicographique":
                    disorder_lex += 1
                else:
                    disorder_other += 1

        total_modules += len(modules)
        total_lessons += lessons
        total_lessons_with_announced += lessons_with_announced
        total_announced += announced
        total_missing_announced += missing_announced
        total_anomalies += anomaly_count
        rows.append(
            {
                "matiere": programme["matiere"],
                "modules": len(modules),
                "lessons": lessons,
                "announced": announced,
                "lessons_without_announced": lessons - lessons_with_announced,
                "gap": lessons_with_announced - announced,
                "missing_announced": missing_announced,
                "anomalies": anomaly_count,
            }
        )

    return {
        "subjects": len(records),
        "modules": total_modules,
        "lessons": total_lessons,
        "announced": total_announced,
        "lessons_without_announced": total_lessons - total_lessons_with_announced,
        "gap": total_lessons_with_announced - total_announced,
        "missing_announced": total_missing_announced,
        "anomalies": total_anomalies,
        "disorder_lex": disorder_lex,
        "disorder_other": disorder_other,
        "rows": rows,
    }


def write_recap(
    records: list[dict],
    global_anomalies: list[dict],
    scope: dict[str, str],
    base_url: str,
    generated_at: str,
    out_dir: Path,
) -> Path:
    path = out_dir / "recap-chiffre.md"
    stats = compute_class_stats(records, global_anomalies)
    lines = [
        f"# Récapitulatif chiffré — {scope['classe']}",
        "",
        f"- Source : {base_url}",
        f"- Périmètre : {scope['sousSysteme']} / {scope['section']} / {scope['cycle']} / {scope['classe']}",
        f"- Extraction : {generated_at}",
        "",
        "## Par classe",
        "",
        "| Classe | Matières | Modules | Leçons extraites | Leçons annoncées | Leçons hors annonce | Écart | Anomalies |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
        f"| {scope['classe']} | {stats['subjects']} | {stats['modules']} | {stats['lessons']} | {stats['announced']} | {stats['lessons_without_announced']} | {stats['gap']} | {stats['anomalies']} |",
        "",
        "## Par matière",
        "",
        "| Matière | Modules | Leçons extraites | Leçons annoncées | Leçons hors annonce | Écart | Modules sans annonce | Anomalies |",
        "|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for row in stats["rows"]:
        lines.append(
            f"| {row['matiere']} | {row['modules']} | {row['lessons']} | {row['announced']} | "
            f"{row['lessons_without_announced']} | {row['gap']} | {row['missing_announced']} | {row['anomalies']} |"
        )
    lines.extend(
        [
            f"| **Total** | **{stats['modules']}** | **{stats['lessons']}** | **{stats['announced']}** | "
            f"**{stats['lessons_without_announced']}** | **{stats['gap']}** | **{stats['missing_announced']}** | **{stats['anomalies']}** |",
            "",
            "Notes :",
            "- L'écart ne porte que sur les modules avec un nombre annoncé lisible ; les leçons hors annonce sont celles des modules sans nombre annoncé.",
            "- Dans `programmes.json` et `programmes.csv`, les leçons sont conservées dans l'ordre exact de la source (`positionSource`).",
            "- Les anomalies sont détaillées dans `rapport-anomalies.md` ; aucune correction ni renumérotation n'a été appliquée.",
            "",
        ]
    )
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def _anomaly_display_label(anomaly: dict) -> str:
    if anomaly["type"] == "lecons_desordre" and anomaly.get("sousType"):
        return f"lecons_desordre ({anomaly['sousType']})"
    return anomaly["type"]


def write_anomalies_report(
    records: list[dict],
    global_anomalies: list[dict],
    scope: dict[str, str],
    base_url: str,
    generated_at: str,
    out_dir: Path,
) -> Path:
    path = out_dir / "rapport-anomalies.md"
    all_anomalies = [anomaly for record in records for anomaly in record["anomalies"]] + global_anomalies
    type_counts = Counter(anomaly["type"] for anomaly in all_anomalies)
    detailed_counts = Counter(_anomaly_display_label(anomaly) for anomaly in all_anomalies)

    lines = [
        f"# Rapport d'anomalies — {scope['classe']}",
        "",
        f"- Source : {base_url}",
        f"- Périmètre : {scope['sousSysteme']} / {scope['section']} / {scope['cycle']} / {scope['classe']}",
        f"- Extraction : {generated_at}",
        f"- Anomalies : {len(all_anomalies)}",
        "",
        "Aucune correction ni renumérotation n'a été appliquée. Les titres, numéros et ordres de `programmes.json` "
        "sont strictement ceux de la source (`positionSource`). "
        "Les cas de `lecons_desordre` sont classés en `lexicographique` (ex. `1, 10, 11, …, 2`) ou `autre`.",
        "",
        "## Synthèse par type",
        "",
        "| Type | Nombre |",
        "|---|---:|",
    ]
    for label, count in sorted(detailed_counts.items()):
        lines.append(f"| `{label}` | {count} |")
    lines.append("")

    checked_zero = [
        label
        for label in (
            "nb_extrait_diff",
            "nb_annonce_absent",
            "titre_vide",
            "titre_lecon_parasite",
            "titre_module_parasite",
            "numero_lecon_duplique_module",
            "numero_lecon_duplique_matiere",
            "numero_lecon_manquant",
            "lecons_desordre",
            "encodage_suspect",
        )
        if type_counts.get(label, 0) == 0
    ]
    if checked_zero:
        lines.append("Contrôles effectués sans anomalie (0) : " + ", ".join(f"`{label}`" for label in checked_zero) + ".")
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
                _anomaly_display_label(anomaly),
                anomaly["moduleOrdre"] if anomaly["moduleOrdre"] is not None else 0,
                anomaly["leconNumero"] if anomaly["leconNumero"] is not None else 10**9,
                anomaly["detail"],
            ),
        )
        for anomaly in ordered:
            label = _anomaly_display_label(anomaly)
            location = []
            if anomaly["moduleOrdre"] is not None:
                location.append(f"Module {anomaly['moduleOrdre']} « {anomaly['moduleTitre'] or '(titre vide)'} »")
            if anomaly["leconNumero"] is not None or anomaly["leconTitre"] is not None:
                location.append(
                    f"Leçon {format_number(anomaly['leconNumero'])} « {anomaly['leconTitre'] or '(titre vide)'} »"
                )
            prefix = " — ".join(location)
            if prefix:
                lines.append(f"- **{label}** — {prefix} : {anomaly['detail']}")
            else:
                lines.append(f"- **{label}** : {anomaly['detail']}")
        lines.append("")

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return path


def write_global_cycle_recap(
    class_runs: list[dict],
    base_url: str,
    generated_at: str,
    root_out_dir: Path,
    filename: str = "recap-global-premier-cycle.md",
) -> Path:
    path = root_out_dir / filename
    ss_title = class_runs[0]["scope"]["sousSysteme"].upper() if class_runs else "FR"
    sec_title = class_runs[0]["scope"]["sectionLabel"] if class_runs else "Général"
    cycle_title = class_runs[0]["scope"]["cycleLabel"] if class_runs else "Cycle"
    lines = [
        f"# Récapitulatif global — {ss_title} {sec_title}, {cycle_title}",
        "",
        f"- Source : {base_url}",
        f"- Extraction : {generated_at}",
        "",
        "## Synthèse par classe",
        "",
        "| Classe | Matières | Modules | Leçons extraites | Leçons annoncées | Hors annonce | Écart | Anomalies | Désordre lexico | Désordre autre |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    tot = Counter()
    for run in class_runs:
        classe = run["scope"]["classe"]
        st = run["stats"]
        for key in (
            "subjects",
            "modules",
            "lessons",
            "announced",
            "lessons_without_announced",
            "gap",
            "anomalies",
            "disorder_lex",
            "disorder_other",
        ):
            tot[key] += st[key]
        lines.append(
            f"| {classe} | {st['subjects']} | {st['modules']} | {st['lessons']} | {st['announced']} | "
            f"{st['lessons_without_announced']} | {st['gap']} | {st['anomalies']} | "
            f"{st['disorder_lex']} | {st['disorder_other']} |"
        )
    lines.append(
        f"| **Total** | **{tot['subjects']}** | **{tot['modules']}** | **{tot['lessons']}** | **{tot['announced']}** | "
        f"**{tot['lessons_without_announced']}** | **{tot['gap']}** | **{tot['anomalies']}** | "
        f"**{tot['disorder_lex']}** | **{tot['disorder_other']}** |"
    )
    lines.extend(["", "## Fichiers par classe", ""])
    for run in class_runs:
        classe = run["scope"]["classe"]
        lines.append(
            f"- **{classe}** : `{classe}/programmes.json`, `{classe}/programmes.csv`, "
            f"`{classe}/{classe}.md`, `{classe}/recap-chiffre.md`, `{classe}/rapport-anomalies.md`"
        )

    # Comparaison des matières par rapport à la première classe du cycle (6e ou 2nde)
    ref_run = class_runs[0] if len(class_runs) > 1 else None
    if ref_run is not None:
        ref_classe = ref_run["scope"]["classe"]
        ref_map = {
            normalize_subject_key(record["programme"]["matiere"]): record["programme"]["matiere"]
            for record in ref_run["records"]
        }
        lines.extend(
            [
                "",
                f"## Comparaison des matières par classe par rapport à la {ref_classe}",
                "",
                "La correspondance est établie sur le libellé normalisé (insensible à la casse et aux accents), "
                "en affichant les libellés bruts de la source.",
                "",
            ]
        )
        for run in class_runs:
            classe = run["scope"]["classe"]
            if classe == ref_classe:
                continue
            cur_map = {
                normalize_subject_key(record["programme"]["matiere"]): record["programme"]["matiere"]
                for record in run["records"]
            }
            only_in_class = [cur_map[key] for key in cur_map if key not in ref_map]
            missing_from_class = [ref_map[key] for key in ref_map if key not in cur_map]
            label_variants = [
                (ref_map[key], cur_map[key])
                for key in cur_map
                if key in ref_map and cur_map[key] != ref_map[key]
            ]
            lines.append(f"### {classe} vs {ref_classe}")
            lines.append("")
            lines.append(
                f"- **Présentes en {classe}, absentes en {ref_classe} ({len(only_in_class)})** : "
                + (", ".join(f"`{name}`" for name in only_in_class) if only_in_class else "_aucune_")
            )
            lines.append(
                f"- **Présentes en {ref_classe}, absentes en {classe} ({len(missing_from_class)})** : "
                + (", ".join(f"`{name}`" for name in missing_from_class) if missing_from_class else "_aucune_")
            )
            if label_variants:
                variants_str = ", ".join(f"`{a}` → `{b}`" for a, b in label_variants)
                lines.append(f"- **Variantes de libellé (même matière)** : {variants_str}")
            lines.append("")

    path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return path

