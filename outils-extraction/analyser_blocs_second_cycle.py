#!/usr/bin/env python3
"""Découpe en blocs les matières du Second cycle FR Général (2nde, 1re, Tle)
à chaque redémarrage de numérotation de module ou de leçon.

N'associe ni ne nomme AUCUNE série : produit uniquement des blocs factuels
(numéro de bloc, nombre de modules/leçons, 3 premiers modules, dernier module).
"""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "donnees-extraites"
CLASSES = ["2nde", "1re", "Tle"]

ROMAN_MAP = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8,
    "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15,
}

MOD_PREFIX_RE = re.compile(
    r"^(?:(?:Prise\s+en\s+main|Rappels?)[^A-Za-z0-9]*.*?)?"
    r"(?:Chap(?:itre)?|S[ée]q(?:uence)?|Module|Th[èe]me|Unit[ée]|Partie)\s*\.?\s*(?:n[°ºo]\s*)?(\d+|[IVX]+)\b",
    re.I,
)
MOD_LEADING_NUM_RE = re.compile(r"^(\d+|[IVX]+)\s*[:.\-–—)]")
SUITE_RE = re.compile(r"\(\s*suite(?:\s+et\s+fin)?\s*\)|suite\s+et\s+fin", re.I)


def parse_roman_or_int(token: str) -> int | None:
    if token.isdigit():
        return int(token)
    return ROMAN_MAP.get(token.upper())


def extract_module_number(title: str) -> int | None:
    cleaned = title.strip()
    match = MOD_PREFIX_RE.match(cleaned)
    if match:
        return parse_roman_or_int(match.group(1))
    match = MOD_LEADING_NUM_RE.match(cleaned)
    if match:
        return parse_roman_or_int(match.group(1))
    return None


def analyze_subject_blocks(programme: dict) -> dict:
    modules = programme["modules"]
    total_modules = len(modules)
    total_lessons = sum(len(m["lecons"]) for m in modules)

    # Compter les doublons de numéros de leçons entre modules (indicateur de concaténation cachée)
    lesson_num_mods: dict[int, set[int]] = {}
    for m in modules:
        for lec in m["lecons"]:
            if lec["numero"] is not None:
                lesson_num_mods.setdefault(lec["numero"], set()).add(m["positionSource"])
    duplicated_nums_across_mods = sum(1 for s in lesson_num_mods.values() if len(s) > 1)

    mod_infos = []
    for m in modules:
        mnum = extract_module_number(m["titre"])
        nums = [l["numero"] for l in m["lecons"] if l["numero"] is not None]
        mod_infos.append(
            {
                "module": m,
                "modNum": mnum,
                "isSuite": bool(SUITE_RE.search(m["titre"])),
                "hasLesson1": 1 in nums,
                "minLesson": min(nums) if nums else None,
                "maxLesson": max(nums) if nums else None,
            }
        )

    blocks_raw: list[dict] = []
    cur_mods: list[dict] = []
    cur_trigger = "début de la matière"
    max_mod_num = 0
    max_lesson_num = 0
    prev_mod_num: int | None = None
    reasons_uncertain: list[str] = []

    for idx, info in enumerate(mod_infos):
        mnum = info["modNum"]
        is_restart = False
        trigger = ""

        if idx > 0 and cur_mods:
            mod1_restart = (
                mnum == 1
                and not (info["isSuite"] and prev_mod_num == 1)
                and not (prev_mod_num == 1 and len(cur_mods) == 1)
                and (max_mod_num >= 2 or (len(cur_mods) >= 2 and max_lesson_num >= 3))
            )
            lesson1_restart = (
                info["hasLesson1"]
                and max_lesson_num >= 4
                and not (info["isSuite"] and prev_mod_num == mnum and mnum is not None)
                and (mnum is None or mnum <= 2)
            )
            if mod1_restart and lesson1_restart:
                is_restart = True
                trigger = f"redémarrage module n°1 et leçon n°1 à M{info['module']['positionSource']}"
            elif mod1_restart:
                is_restart = True
                trigger = f"redémarrage module n°1 à M{info['module']['positionSource']}"
            elif lesson1_restart:
                is_restart = True
                trigger = f"redémarrage leçon n°1 à M{info['module']['positionSource']}"

        if is_restart:
            blocks_raw.append({"trigger": cur_trigger, "items": cur_mods})
            cur_mods = [info]
            cur_trigger = trigger
            max_mod_num = mnum or 0
            max_lesson_num = info["maxLesson"] or 0
        else:
            cur_mods.append(info)
            if mnum is not None and mnum > max_mod_num:
                max_mod_num = mnum
            if info["maxLesson"] is not None and info["maxLesson"] > max_lesson_num:
                max_lesson_num = info["maxLesson"]
        prev_mod_num = mnum

    if cur_mods:
        blocks_raw.append({"trigger": cur_trigger, "items": cur_mods})

    # Évaluer les cas incertains (sans jamais deviner)
    numbered_mods = sum(1 for x in mod_infos if x["modNum"] is not None)
    tiny_blocks = sum(1 for b in blocks_raw if len(b["items"]) == 1)
    if len(blocks_raw) > 1 and tiny_blocks >= 2:
        reasons_uncertain.append(
            f"{tiny_blocks} bloc(s) d'un seul module (ex. modules indépendants recommençant chacun à Leçon 1)"
        )
    if len(blocks_raw) > 1 and numbered_mods == 0:
        reasons_uncertain.append("aucune numérotation explicite de module : découpage basé uniquement sur Leçon 1")
    if len(blocks_raw) == 1 and duplicated_nums_across_mods >= 8:
        reasons_uncertain.append(
            f"{duplicated_nums_across_mods} numéros de leçons dupliqués entre modules malgré l'absence de redémarrage net"
        )
    if len(blocks_raw) == 1 and total_modules >= 15 and numbered_mods == 0:
        reasons_uncertain.append(f"{total_modules} modules sans numérotation de module explicite")
    # Détecter une réinitialisation interne suspecte dans un bloc unique ou gros bloc (ex. chute de numérotation)
    for b_idx, blk in enumerate(blocks_raw, 1):
        b_lnums = [l["numero"] for it in blk["items"] for l in it["module"]["lecons"] if l["numero"] is not None]
        dup_in_blk = sum(1 for _, c in Counter(b_lnums).items() if c > 1)
        if len(blk["items"]) >= 8 and dup_in_blk >= 15:
            reasons_uncertain.append(
                f"Bloc {b_idx} ({len(blk['items'])} modules) contient encore {dup_in_blk} numéros de leçons dupliqués"
            )

    blocs = []
    for b_idx, blk in enumerate(blocks_raw, 1):
        mods_in_blk = [it["module"] for it in blk["items"]]
        blocs.append(
            {
                "numeroBloc": b_idx,
                "moduleDebutPositionSource": mods_in_blk[0]["positionSource"],
                "moduleFinPositionSource": mods_in_blk[-1]["positionSource"],
                "nbModules": len(mods_in_blk),
                "nbLecons": sum(len(m["lecons"]) for m in mods_in_blk),
                "premiersModules": [m["titre"] for m in mods_in_blk[:3]],
                "dernierModule": mods_in_blk[-1]["titre"],
                "declencheurCoupure": blk["trigger"],
            }
        )

    if reasons_uncertain:
        statut = "incertain"
    elif len(blocs) > 1:
        statut = "multi_blocs"
    else:
        statut = "bloc_unique"

    return {
        "classe": programme["classe"],
        "matiere": programme["matiere"],
        "urlMatiere": programme.get("urlMatiere", ""),
        "nbModulesTotal": total_modules,
        "nbLeconsTotal": total_lessons,
        "nbBlocs": len(blocs),
        "statut": statut,
        "raisonsIncertitude": reasons_uncertain,
        "blocs": blocs,
    }


def write_markdown(all_results: dict[str, list[dict]], generated_at: str) -> Path:
    lines = [
        "# Découpage en blocs — Second cycle FR Général (2nde, 1re, Tle)",
        "",
        f"- Généré le : {generated_at} (à partir des fichiers locaux uniquement, sans requête réseau)",
        "- **Aucune série n'est nommée ni supposée** : seuls les blocs factuels issus des redémarrages de numérotation (module n°1 et/ou leçon n°1) sont listés.",
        "",
        "## Synthèse par classe",
        "",
        "| Classe | Matières | Multi-blocs (net) | Un seul bloc (sans redémarrage) | Découpage incertain | Total blocs |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for cls in CLASSES:
        res = all_results[cls]
        multi = sum(1 for r in res if r["statut"] == "multi_blocs")
        uniq = sum(1 for r in res if r["statut"] == "bloc_unique")
        inc = sum(1 for r in res if r["statut"] == "incertain")
        tot_b = sum(r["nbBlocs"] for r in res)
        lines.append(f"| {cls} | {len(res)} | {multi} | {uniq} | {inc} | {tot_b} |")

    # Section des matières à découpage incertain
    lines.extend(["", "## Matières à découpage incertain (à relire en priorité)", ""])
    any_inc = False
    for cls in CLASSES:
        for r in all_results[cls]:
            if r["statut"] == "incertain":
                any_inc = True
                raisons = " ; ".join(r["raisonsIncertitude"])
                lines.append(
                    f"- **{cls} — {r['matiere']}** ({r['nbBlocs']} bloc(s), {r['nbModulesTotal']} modules, "
                    f"{r['nbLeconsTotal']} leçons) : {raisons}"
                )
    if not any_inc:
        lines.append("_Aucune matière incertaine._")

    # Section des matières sans redémarrage (un seul bloc)
    lines.extend(["", "## Matières sans redémarrage (un seul bloc net)", ""])
    for cls in CLASSES:
        uniques = [r["matiere"] for r in all_results[cls] if r["statut"] == "bloc_unique"]
        lines.append(
            f"- **{cls} ({len(uniques)})** : " + (", ".join(f"`{m}`" for m in uniques) if uniques else "_aucune_")
        )

    # Détail complet par classe et par matière
    for cls in CLASSES:
        lines.extend(["", f"## Détail — {cls}", ""])
        for r in all_results[cls]:
            tag = ""
            if r["statut"] == "incertain":
                tag = " — `[INCERTAIN]`"
            elif r["statut"] == "bloc_unique":
                tag = " — `(1 seul bloc)`"
            lines.append(
                f"### {r['matiere']} ({r['nbBlocs']} bloc(s) · {r['nbModulesTotal']} modules · {r['nbLeconsTotal']} leçons){tag}"
            )
            lines.append("")
            if r["raisonsIncertitude"]:
                lines.append(f"_Incertitude : {' ; '.join(r['raisonsIncertitude'])}_")
                lines.append("")
            for b in r["blocs"]:
                first3 = " | ".join(f"« {t} »" for t in b["premiersModules"])
                lines.append(
                    f"- **Bloc {b['numeroBloc']}** (M{b['moduleDebutPositionSource']}→M{b['moduleFinPositionSource']} · "
                    f"{b['nbModules']} modules · {b['nbLecons']} leçons · _{b['declencheurCoupure']}_)"
                )
                lines.append(f"  - 3 premiers modules : {first3}")
                lines.append(f"  - Dernier module : « {b['dernierModule']} »")
            lines.append("")

    md_path = OUT_DIR / "blocs-second-cycle-fr.md"
    md_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return md_path


def main() -> int:
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    all_results: dict[str, list[dict]] = {}
    for cls in CLASSES:
        progs = json.loads((OUT_DIR / cls / "programmes.json").read_text(encoding="utf-8"))
        all_results[cls] = [analyze_subject_blocks(p) for p in progs]

    json_path = OUT_DIR / "blocs-second-cycle-fr.json"
    json_path.write_text(
        json.dumps(
            {
                "genereLe": generated_at,
                "perimetre": "fr / general / second (2nde, 1re, Tle)",
                "note": "Aucune série n'est nommée. Découpage factuel sur redémarrage de numérotation de module ou de leçon.",
                "classes": all_results,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    md_path = write_markdown(all_results, generated_at)
    for cls in CLASSES:
        res = all_results[cls]
        multi = sum(1 for r in res if r["statut"] == "multi_blocs")
        uniq = sum(1 for r in res if r["statut"] == "bloc_unique")
        inc = sum(1 for r in res if r["statut"] == "incertain")
        print(f"{cls}: {len(res)} matières (multi_blocs={multi}, bloc_unique={uniq}, incertain={inc})")
    print(f"Écrits : {json_path} et {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

