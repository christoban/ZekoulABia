#!/usr/bin/env python3
"""Audit lecture seule exhaustif des 96 couples (classe, matiere) du second cycle
francophone général (2nde, 1re, Tle) à partir des fichiers locaux uniquement.

Produit : donnees-extraites/audit-second-cycle-fr.md
Ne modifie AUCUN fichier brut et n'effectue AUCUNE requête réseau.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "donnees-extraites"
BLOCS_PATH = DATA_DIR / "blocs-second-cycle-fr.json"
OUT_MD = DATA_DIR / "audit-second-cycle-fr.md"
CLASSES = ["2nde", "1re", "Tle"]

PREFIX_NUM_RE = re.compile(
    r"^(?:(?:le[çc]on|lesson|s[ée]ance|chap(?:itre)?|cours|module|u\.?a\.?|tp|td|activit[ée]|s[ée]q(?:uence)?)\s*n?[°ºo]?\s*\d+\s*[:.\-–—]?\s*)+",
    re.I,
)
PARASITE_RE = re.compile(
    r"^(?:semaine|titres?\s+des\s+le[çc]ons?|prise\s+en\s+main|chapitre\s+trimestre|du\s+\d+|^\d{2}\s+(?:sept|oct|nov|d[ée]c|jan|f[ée]v|mar|avr|mai|juin))",
    re.I,
)
URL_SERIES_HINT_RE = re.compile(
    r"(?:2nd|2nde|1er|1ere|1re|tle|term)[a-z0-9_-]*(?:a[1-5]|abi|ac|sh|ti|[cde])\b|(?:serie|ser)[-_]?(?:a[1-5]|abi|ac|sh|ti|[acde])",
    re.I,
)


def norm_text(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = PREFIX_NUM_RE.sub("", s)
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return s


def block_lessons(prog: dict, start_pos: int, end_pos: int) -> list[dict]:
    out: list[dict] = []
    for m in prog["modules"]:
        if start_pos <= m["positionSource"] <= end_pos:
            for lec in m["lecons"]:
                out.append({"modPos": m["positionSource"], "modTitre": m["titre"], **lec})
    return out


def pair_similarity(lecs_a: list[dict], lecs_b: list[dict]) -> dict:
    """Calcule la couverture mutuelle entre deux listes de leçons par similarité de titres."""
    if not lecs_a or not lecs_b:
        return {"exact": 0, "high": 0, "covA": 0.0, "covB": 0.0}
    na = [norm_text(x.get("titre", "")) for x in lecs_a if norm_text(x.get("titre", ""))]
    nb = [norm_text(x.get("titre", "")) for x in lecs_b if norm_text(x.get("titre", ""))]
    set_b = set(nb)

    def match_count(src: list[str], dst: list[str], dst_set: set[str]) -> tuple[int, int]:
        exact = 0
        high = 0
        for t in src:
            if t in dst_set:
                exact += 1
                high += 1
                continue
            best = 0.0
            for u in dst:
                if abs(len(t) - len(u)) > max(len(t), len(u)) * 0.45:
                    continue
                r = SequenceMatcher(None, t, u).ratio()
                if r > best:
                    best = r
                    if best >= 0.85:
                        break
            if best >= 0.80:
                high += 1
        return exact, high

    ex_a, hi_a = match_count(na, nb, set_b)
    ex_b, hi_b = match_count(nb, na, set(na))
    return {
        "exact": min(ex_a, ex_b),
        "highA": hi_a,
        "highB": hi_b,
        "covA": round(100.0 * hi_a / len(na), 1) if na else 0.0,
        "covB": round(100.0 * hi_b / len(nb), 1) if nb else 0.0,
    }


def internal_duplicates_stats(lecs: list[dict]) -> dict:
    """Distingue doublons de titres réels vs simples réutilisations de numéros entre modules."""
    norm_titles = [norm_text(x.get("titre", "")) for x in lecs]
    non_empty = [t for t in norm_titles if t]
    empty_count = len(norm_titles) - len(non_empty)
    c_titles = Counter(non_empty)
    dup_titles = [(t, c) for t, c in c_titles.items() if c > 1]
    dup_lesson_instances = sum(c - 1 for _, c in dup_titles)

    # Doublons exacts inter-modules (même titre normalisé dans >= 2 modules distincts)
    title_mods: dict[str, set[int]] = {}
    for x in lecs:
        t = norm_text(x.get("titre", ""))
        if t:
            title_mods.setdefault(t, set()).add(x["modPos"])
    cross_mod_exact = sum(1 for mods in title_mods.values() if len(mods) > 1)

    # Doublons flous (>= 0.85) entre modules distincts si taille raisonnable
    by_mod: dict[int, list[str]] = {}
    for x in lecs:
        t = norm_text(x.get("titre", ""))
        if t:
            by_mod.setdefault(x["modPos"], []).append(t)

    # Taux de leçons qui ont un quasi-doublon dans un autre module
    fuzzy_cross = 0
    if len(non_empty) <= 300:
        for idx, x in enumerate(lecs):
            t = norm_titles[idx]
            if not t:
                continue
            if len(title_mods.get(t, set())) > 1:
                fuzzy_cross += 1
                continue
            found = False
            for mpos, mlist in by_mod.items():
                if mpos == x["modPos"]:
                    continue
                for u in mlist:
                    if abs(len(t) - len(u)) > max(len(t), len(u)) * 0.35:
                        continue
                    if SequenceMatcher(None, t, u).ratio() >= 0.85:
                        found = True
                        break
                if found:
                    break
            if found:
                fuzzy_cross += 1

    return {
        "total": len(lecs),
        "emptyTitles": empty_count,
        "exactDupTitleGroups": len(dup_titles),
        "exactDupExtraRows": dup_lesson_instances,
        "crossModExact": cross_mod_exact,
        "crossModFuzzyRows": fuzzy_cross,
    }


def extract_url_hints(lecs: list[dict]) -> list[str]:
    hints: list[str] = []
    seen: set[str] = set()
    for x in lecs:
        url = x.get("url") or ""
        slug = url.rstrip("/").split("/")[-1] if url else ""
        for m in URL_SERIES_HINT_RE.findall(slug):
            low = m.lower()
            if low not in seen:
                seen.add(low)
                hints.append(m)
    return hints[:8]


def main() -> None:
    blocs_all = json.loads(BLOCS_PATH.read_text(encoding="utf-8"))["classes"]
    raw_by_class: dict[str, dict[str, dict]] = {}
    for cls in CLASSES:
        progs = json.loads((DATA_DIR / cls / "programmes.json").read_text(encoding="utf-8"))
        raw_by_class[cls] = {p["matiere"]: p for p in progs}

    lines: list[str] = [
        "# Audit factuel complet — Second cycle Francophone Général (`2nde`, `1re`, `Tle`)",
        "",
        "- Source : fichiers locaux `donnees-extraites/{2nde,1re,Tle}/programmes.json` + `blocs-second-cycle-fr.json` (**0 requête réseau**, fichiers bruts intacts).",
        "- Objectif : distinguer objectivement pour chacune des 96 matières :",
        "  1. **Doublons de pistes** (fort recouvrement textuel entre blocs ou intra-bloc) vs **programmes distincts** (multi-séries ou ateliers indépendants) ;",
        "  2. **Fausses incertitudes** (numérotation qui redémarre par module mais 0 doublon de titre réel) ;",
        "  3. **Indices de séries** (titres de modules/chapitres + slugs URL) ;",
        "  4. **Modules/titres parasites** (dates, `Semaine`, titres vides, etc.).",
        "",
    ]

    # ── 1. Synthèse des anomalies de doublons internes & parasites sur les 96 matières
    lines.extend([
        "## 1. Vue d'ensemble des 96 matières (doublons réels vs fausses alertes)",
        "",
        "| Classe | Matière | Statut blocs | Blocs | Mod | Leç | Titres vides | Doublons exacts (lignes +) | Quasi-doublons inter-mod | Modules suspects |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|---|",
    ])

    details_sections: list[str] = []

    for cls in CLASSES:
        blocs_cls = blocs_all[cls]
        details_sections.extend(["", f"## Détail approfondi — {cls}", ""])
        for entry in blocs_cls:
            mat = entry["matiere"]
            prog = raw_by_class[cls][mat]
            all_lecs = block_lessons(prog, 1, 10**9)
            istats = internal_duplicates_stats(all_lecs)

            suspect_mods = [
                f"M{m['positionSource']}:`{m['titre'][:45]}`"
                for m in prog["modules"]
                if PARASITE_RE.search(m["titre"].strip()) or len(m["lecons"]) == 0
            ]
            suspect_str = ", ".join(suspect_mods[:3]) + (f" (+{len(suspect_mods)-3})" if len(suspect_mods) > 3 else "")

            lines.append(
                f"| {cls} | {mat} | {entry['statut']} | {entry['nbBlocs']} | {entry['nbModulesTotal']} | "
                f"{entry['nbLeconsTotal']} | {istats['emptyTitles']} | {istats['exactDupExtraRows']} | "
                f"{istats['crossModFuzzyRows']} | {suspect_str or '—'} |"
            )

            # Détail pour TOUTES les matières multi-blocs, incertaines, ou avec doublons/parasites
            needs_detail = (
                entry["nbBlocs"] > 1
                or entry["statut"] != "bloc_unique"
                or istats["exactDupExtraRows"] > 0
                or istats["emptyTitles"] > 0
                or bool(suspect_mods)
                or mat in ("Informatique", "Informatique Fondamentale", "Chimie", "Genres Cinématographiques")
            )
            if not needs_detail:
                continue

            details_sections.append(
                f"### {cls} — {mat} (`{entry['statut']}`, {entry['nbBlocs']} bloc(s), {entry['nbModulesTotal']} mod, {entry['nbLeconsTotal']} leçons)"
            )
            details_sections.append("")

            blk_data: list[tuple[dict, list[dict]]] = []
            for b in entry["blocs"]:
                lecs = block_lessons(prog, b["moduleDebutPositionSource"], b["moduleFinPositionSource"])
                blk_data.append((b, lecs))
                b_stats = internal_duplicates_stats(lecs)
                hints = extract_url_hints(lecs)
                mods_in_b = [
                    m for m in prog["modules"]
                    if b["moduleDebutPositionSource"] <= m["positionSource"] <= b["moduleFinPositionSource"]
                ]
                sample_urls = [l.get("url", "").rstrip("/").split("/")[-1] for l in lecs[:2] if l.get("url")]

                details_sections.append(
                    f"- **Bloc {b['numeroBloc']}** (`M{b['moduleDebutPositionSource']}→M{b['moduleFinPositionSource']}`, "
                    f"{b['nbModules']} mod, {b['nbLecons']} leç, doublons internes exacts={b_stats['exactDupExtraRows']}, "
                    f"inter-mod flous={b_stats['crossModFuzzyRows']}, titres vides={b_stats['emptyTitles']})"
                )
                if hints:
                    details_sections.append(f"  - Indices URL : `{'`, `'.join(hints)}`")
                if sample_urls:
                    details_sections.append(f"  - Exemples slugs : `{'`, `'.join(sample_urls)}`")
                # Lister tous les titres de modules (jusqu'à 25, sinon premiers 12 + derniers 5)
                if len(mods_in_b) <= 20:
                    mod_list = " ; ".join(f"M{m['positionSource']}({len(m['lecons'])}): {m['titre']}" for m in mods_in_b)
                else:
                    head = " ; ".join(f"M{m['positionSource']}({len(m['lecons'])}): {m['titre']}" for m in mods_in_b[:10])
                    tail = " ; ".join(f"M{m['positionSource']}({len(m['lecons'])}): {m['titre']}" for m in mods_in_b[-5:])
                    mod_list = f"{head} ; ... ; {tail}"
                details_sections.append(f"  - Modules : {mod_list}")

            # Matrice de similarité entre blocs si >= 2 blocs
            if len(blk_data) >= 2:
                details_sections.append("  - **Similarité inter-blocs (titres normalisés >= 0.80)** :")
                for i in range(len(blk_data)):
                    for j in range(i + 1, len(blk_data)):
                        bi, li = blk_data[i]
                        bj, lj = blk_data[j]
                        sim = pair_similarity(li, lj)
                        verdict = (
                            "DOUBLON PROBABLE" if min(sim["covA"], sim["covB"]) >= 70
                            else "INCLUSION PARTIELLE / PISTE COMMUNE" if max(sim["covA"], sim["covB"]) >= 50
                            else "PROGRAMMES DISTINCTS"
                        )
                        details_sections.append(
                            f"    - B{bi['numeroBloc']} ({len(li)} leç) ↔ B{bj['numeroBloc']} ({len(lj)} leç) : "
                            f"exact={sim['exact']}, cov B{bi['numeroBloc']}={sim['covA']}%, cov B{bj['numeroBloc']}={sim['covB']}% → **{verdict}**"
                        )
            details_sections.append("")

    OUT_MD.write_text("\n".join(lines + details_sections) + "\n", encoding="utf-8")
    print(f"AUDIT_WRITTEN: {OUT_MD} ({len(lines) + len(details_sections)} lignes)")


if __name__ == "__main__":
    main()
