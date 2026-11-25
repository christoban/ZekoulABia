#!/usr/bin/env python3
"""Convertisseur MINESEC -> format JSON d'import officiel ZekoulABia (6e -> 3e, filière explicite).

Règles :
- Les fichiers bruts donnees-extraites/<classe>/programmes.json ne sont JAMAIS modifiés.
- Avec --apply-corrections, applique donnees-extraites/corrections.json (exclure,
  fusionner_avec_precedente, modifier_champ) en mémoire avant conversion.
- Produit par (niveau, filière) :
  * import/<classe> FR_GENERAL.json et import/<classe> FR_PEBS.json (confiance élevée/moyenne)
  * import/a-part-<classe> FR_GENERAL.json et import/a-part-<classe> FR_PEBS.json
  * (si --generer-essais) import/<classe> essai <filiere>.json (dry-run sur les seuls mis à part)
- En FR_PEBS : fusionne Anglais (piste propre) + Literature awareness -> Intensive English,
  et source Sport and Physical Education + Manual Labour depuis Form1..Form4 (Décision D3).
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from convertir_rapports import (
    CYCLE1_FILIERES,
    write_class_non_converted_report,
    write_global_recap,
    write_intensive_english_annex,
)

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "donnees-extraites"
DEFAULT_SOURCE = "minesec-distance-learning"
ACCEPTED_CONFIDENCES = {"certain", "probable"}
FR_TO_EN_PEBS_CLASS = {"6e": "Form1", "5e": "Form2", "4e": "Form3", "3e": "Form4"}

# Catalogue exact CycleCoefficient (lecture seule de premier-cycle.ts)
GEN_65_CATALOG = {
    "Anglais", "Français", "Lettres classiques (Latin/Grec)",
    "Éducation à la Citoyenneté et à la Morale", "Histoire", "Géographie",
    "Informatique", "Mathématiques", "Sciences",
    "Éducation Artistique et Culturelle", "Cultures Nationales",
    "Langues Nationales", "EPS", "Travail Manuel",
}
GEN_43_CATALOG = (GEN_65_CATALOG - {"Sciences"}) | {"LV2", "Physique-Chimie-Technologie", "SVTEEHB"}
PEBS_65_CATALOG = {
    "Intensive English", "Français", "Lettres classiques (Latin/Grec)",
    "Citizenship Education", "Géographie", "Histoire",
    "Informatique", "Mathématiques", "Sciences",
    "Éducation Artistique et Culturelle", "Cultures Nationales",
    "Langues Nationales", "Sport and Physical Education", "Manual Labour",
}
PEBS_43_CATALOG = (PEBS_65_CATALOG - {"Sciences"}) | {"LV2", "Physique-Chimie-Technologie", "SVTEEHB"}

CYCLE1_FR_CATALOG: dict[tuple[str, str], set[str]] = {
    ("6e", "FR_GENERAL"): GEN_65_CATALOG, ("5e", "FR_GENERAL"): GEN_65_CATALOG,
    ("4e", "FR_GENERAL"): GEN_43_CATALOG, ("3e", "FR_GENERAL"): GEN_43_CATALOG,
    ("6e", "FR_PEBS"): PEBS_65_CATALOG, ("5e", "FR_PEBS"): PEBS_65_CATALOG,
    ("4e", "FR_PEBS"): PEBS_43_CATALOG, ("3e", "FR_PEBS"): PEBS_43_CATALOG,
}


def load_correspondence_map(correspondence_path: Path) -> dict[str, dict]:
    raw = json.loads(correspondence_path.read_text(encoding="utf-8"))
    mapping: dict[str, dict] = {}
    for section_key in ("matieresTroncEtAutres", "pct", "languesOptionnelles"):
        for entry in raw.get(section_key, []):
            mapping[entry["libelleSource"]] = entry
    return mapping


def resolve_entry_for_class(entry: dict, classe: str) -> tuple[str, list[str], str]:
    per_class = entry.get("parClasse", {}).get(classe)
    if per_class:
        return (
            per_class.get("matiereZekoulABia", "aucune"),
            per_class.get("filiereProposee", []),
            per_class.get("confiance", "a-part"),
        )
    return (
        entry.get("matiereZekoulABia", "aucune"),
        entry.get("filiereProposee", []),
        entry.get("confiance", "a-part"),
    )


def apply_validated_corrections(programme: dict, corrections: list[dict]) -> tuple[dict, int]:
    """Applique les corrections (modifier_champ, exclure, fusionner_avec_precedente) en mémoire."""
    classe, matiere = programme["classe"], programme["matiere"]
    relevant = [c for c in corrections if c.get("classe") == classe and c.get("matiere") == matiere]
    if not relevant:
        return programme, 0

    modules_out = []
    merged_total = 0
    for mod in programme["modules"]:
        mod_copy = dict(mod)
        mod_pos = mod["positionSource"]
        for corr in relevant:
            if corr.get("cible") == "module" and corr.get("modulePositionSource") == mod_pos:
                if corr.get("action") == "modifier_champ" and corr.get("champ"):
                    mod_copy[corr["champ"]] = corr["valeurCorrigee"]

        lecons_work = [dict(l) for l in mod["lecons"]]
        for corr in relevant:
            if corr.get("cible") != "lecon" or corr.get("modulePositionSource") != mod_pos:
                continue
            target_pos = corr.get("leconPositionSource")
            for lec in lecons_work:
                if lec["positionSource"] != target_pos:
                    continue
                if corr.get("action") == "exclure":
                    lec["exclure"] = True
                elif corr.get("action") == "modifier_champ" and corr.get("champ"):
                    lec[corr["champ"]] = corr["valeurCorrigee"]

        merge_positions = {
            corr["leconPositionSource"]
            for corr in relevant
            if corr.get("cible") == "lecon"
            and corr.get("modulePositionSource") == mod_pos
            and corr.get("action") == "fusionner_avec_precedente"
        }
        merged_lecons: list[dict] = []
        for lec in lecons_work:
            if lec["positionSource"] in merge_positions and merged_lecons:
                merged_lecons[-1]["titre"] = f"{merged_lecons[-1]['titre'].rstrip()} {lec['titre'].lstrip()}"
                merged_total += 1
            else:
                merged_lecons.append(lec)

        mod_copy["lecons"] = merged_lecons
        modules_out.append(mod_copy)

    prog_copy = dict(programme)
    prog_copy["modules"] = modules_out
    return prog_copy, merged_total


def build_chapitres(
    programmes: list[dict],
    prefix: str | None = None,
) -> tuple[list[dict], list[dict], int, int]:
    """Construit les chapitres Zod-compatibles (moduleOrdre continu 1..N, modules vides omis, 0 renumérotation)."""
    chapitres: list[dict] = []
    provenance: list[dict] = []
    global_pos = 0
    ordre = 0
    excluded_count = 0
    extracted_after_merge = 0
    mod_ordre_seq = 0

    for prog in programmes:
        for module in prog["modules"]:
            mod_titre = module["titre"]
            is_mod_parasite = bool(module.get("titreModuleParasite", False))
            kept_lessons: list[tuple[int, dict]] = []
            mod_extracted = 0
            mod_excluded = 0
            for lesson in module["lecons"]:
                extracted_after_merge += 1
                mod_extracted += 1
                global_pos += 1
                if bool(lesson.get("exclure", False)):
                    excluded_count += 1
                    mod_excluded += 1
                    continue
                kept_lessons.append((global_pos, lesson))

            if not kept_lessons:
                continue

            mod_ordre_seq += 1
            for gpos, lesson in kept_lessons:
                ordre += 1
                chap_titre = f"{prefix} — {lesson['titre']}" if prefix else lesson["titre"]
                chapitres.append(
                    {
                        "ordre": ordre,
                        "titre": chap_titre,
                        "moduleOrdre": mod_ordre_seq,
                        "moduleTitre": mod_titre,
                        "positionDansModule": lesson["positionSource"],
                        "positionSource": gpos,
                        "leconNumero": lesson["numero"],
                        "numeroAffiche": lesson["numeroAffiche"],
                        "sourceUrl": lesson["url"],
                        "exclure": False,
                        "titreModuleParasite": is_mod_parasite,
                    }
                )
            provenance.append(
                {
                    "moduleOrdreFusion": mod_ordre_seq,
                    "matiereSource": prog["matiere"],
                    "moduleOrdreSource": module["ordre"],
                    "moduleTitre": mod_titre,
                    "leconsExtraites": mod_extracted,
                    "exclusions": mod_excluded,
                    "leconsImport": len(kept_lessons),
                }
            )
    return chapitres, provenance, extracted_after_merge, excluded_count


def build_item(
    programmes: list[dict],
    merged_count: int,
    zekoulabia_name: str,
    source_label: str,
    level: str,
    filiere: str,
    titre: str,
    active: bool = True,
    chap_prefix: str | None = None,
) -> tuple[dict, dict, list[dict]]:
    chapitres, prov, after_merge, excluded = build_chapitres(programmes, prefix=chap_prefix)
    raw_extracted = after_merge + merged_count
    assert len(chapitres) == raw_extracted - excluded - merged_count
    item = {
        "templateCode": "__ALL__",
        "level": level,
        "filiere": filiere,
        "subjectName": zekoulabia_name,
        "subjectNameSource": source_label,
        "titre": titre,
        "source": DEFAULT_SOURCE,
        "active": active,
        "chapitres": chapitres,
    }
    stats = {
        "matiereSource": source_label,
        "subjectName": zekoulabia_name,
        "filiere": filiere,
        "leconsExtraites": raw_extracted,
        "exclusions": excluded,
        "fusions": merged_count,
        "leconsImport": len(chapitres),
    }
    return item, stats, prov


def process_class(
    classe: str,
    corr_map: dict[str, dict],
    corrections: list[dict],
    generer_essais: bool,
    import_dir: Path,
    generated_at: str,
) -> tuple[dict, dict]:
    raw_progs = json.loads((OUT_DIR / classe / "programmes.json").read_text(encoding="utf-8"))
    per_filiere_items: dict[str, list[dict]] = {fil: [] for fil in CYCLE1_FILIERES}
    per_filiere_stats: dict[str, list[dict]] = {fil: [] for fil in CYCLE1_FILIERES}
    put_aside_entries: list[tuple[dict, dict]] = []
    progs_corr_by_name: dict[str, tuple[dict, int]] = {}

    total_extracted_fr = 0
    unique_fr_stats: dict[str, dict] = {}

    for raw_prog in raw_progs:
        label = raw_prog["matiere"]
        raw_lecs = sum(len(m["lecons"]) for m in raw_prog["modules"])
        total_extracted_fr += raw_lecs
        prog, merged_cnt = apply_validated_corrections(raw_prog, corrections) if corrections else (raw_prog, 0)
        progs_corr_by_name[label] = (prog, merged_cnt)
        entry = corr_map.get(label)

        if entry is None:
            put_aside_entries.append((raw_prog, {"matiere": label, "matiereZekoulABia": "aucune", "modules": len(raw_prog["modules"]), "lecons": raw_lecs, "raison": "Absente de la table de correspondance."}))
            continue

        target_name, proposed_filieres, confiance = resolve_entry_for_class(entry, classe)
        if confiance == "fusion-pebs":
            # Literature awareness : traitée ci-dessous dans la fusion Intensive English (FR_PEBS)
            continue

        if confiance not in ACCEPTED_CONFIDENCES or target_name == "aucune" or not proposed_filieres:
            put_aside_entries.append((raw_prog, {
                "matiere": label,
                "matiereZekoulABia": target_name,
                "modules": len(raw_prog["modules"]),
                "lecons": raw_lecs,
                "raison": entry.get("remarque", "Mise à part."),
            }))
            continue

        for fil in proposed_filieres:
            if target_name not in CYCLE1_FR_CATALOG[(classe, fil)]:
                continue
            item, stats, _ = build_item(
                [prog], merged_cnt, target_name, label, classe, fil,
                titre=f"Programme officiel MINESEC — {classe} ({fil}) — {target_name}",
            )
            per_filiere_items[fil].append(item)
            per_filiere_stats[fil].append(stats)
            if label not in unique_fr_stats:
                unique_fr_stats[label] = stats

    # FR_PEBS : 1) Fusion Intensive English = Anglais (dédoublonné) + Literature awareness
    ang_prog, ang_merged = progs_corr_by_name["Anglais"]
    lit_prog, lit_merged = progs_corr_by_name["Literature awareness"]
    ie_item, ie_stats, ie_prov = build_item(
        [ang_prog, lit_prog], ang_merged + lit_merged, "Intensive English",
        "Anglais + Literature awareness", classe, "FR_PEBS",
        titre=f"Programme officiel MINESEC — {classe} (FR_PEBS) — Intensive English",
    )
    per_filiere_items["FR_PEBS"].append(ie_item)
    per_filiere_stats["FR_PEBS"].append(ie_stats)
    # Comptabiliser Literature awareness une seule fois dans unique_fr_stats
    _, lit_only_stats, _ = build_item([lit_prog], lit_merged, "Intensive English", "Literature awareness", classe, "FR_PEBS", "tmp")
    unique_fr_stats["Literature awareness"] = lit_only_stats

    ang_raw_cnt = sum(len(m["lecons"]) for m in [p for p in raw_progs if p["matiere"] == "Anglais"][0]["modules"])
    lit_raw_cnt = sum(len(m["lecons"]) for m in [p for p in raw_progs if p["matiere"] == "Literature awareness"][0]["modules"])
    fusion_summary = {
        "classe": classe,
        "angExt": ang_raw_cnt,
        "angExcl": ie_stats["exclusions"],
        "litExt": lit_raw_cnt,
        "imp": ie_stats["leconsImport"],
        "provenance": ie_prov,
    }

    # FR_PEBS : 2) Apports croisés Form1..Form4 (Décision D3 : confiance élevée)
    en_cls = FR_TO_EN_PEBS_CLASS[classe]
    en_raw = {p["matiere"]: p for p in json.loads((OUT_DIR / en_cls / "programmes.json").read_text(encoding="utf-8"))}
    pe_en_prog, pe_en_merged = apply_validated_corrections(en_raw["Physical Education and Sports"], corrections) if corrections else (en_raw["Physical Education and Sports"], 0)
    ml_en_prog, ml_en_merged = apply_validated_corrections(en_raw["Manual Labour"], corrections) if corrections else (en_raw["Manual Labour"], 0)

    pe_item, pe_stats, _ = build_item(
        [pe_en_prog], pe_en_merged, "Sport and Physical Education",
        f"{en_cls} — Physical Education and Sports", classe, "FR_PEBS",
        titre=f"Programme officiel MINESEC — {classe} (FR_PEBS) — Sport and Physical Education",
    )
    ml_item, ml_stats, _ = build_item(
        [ml_en_prog], ml_en_merged, "Manual Labour",
        f"{en_cls} — Manual Labour", classe, "FR_PEBS",
        titre=f"Programme officiel MINESEC — {classe} (FR_PEBS) — Manual Labour",
    )
    per_filiere_items["FR_PEBS"].extend([pe_item, ml_item])
    per_filiere_stats["FR_PEBS"].extend([pe_stats, ml_stats])

    # Écriture des fichiers d'import propres (import/) + a-part/essai (import/ne-pas-importer/)
    ne_pas_importer_dir = import_dir / "ne-pas-importer"
    ne_pas_importer_dir.mkdir(parents=True, exist_ok=True)
    filiere_totals: dict[str, dict] = {}
    for fil in CYCLE1_FILIERES:
        out_file = import_dir / f"{classe} {fil}.json"
        out_file.write_text(json.dumps({"source": DEFAULT_SOURCE, "level": classe, "items": per_filiere_items[fil]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        st_list = per_filiere_stats[fil]
        ext = sum(s["leconsExtraites"] for s in st_list)
        excl = sum(s["exclusions"] for s in st_list)
        fus = sum(s["fusions"] for s in st_list)
        imp = sum(s["leconsImport"] for s in st_list)
        assert imp == ext - excl - fus
        filiere_totals[fil] = {"items": len(st_list), "ext": ext, "excl": excl, "fus": fus, "imp": imp}
        print(f"Écrit {out_file.name:28s} : {len(st_list):2d} items, {imp:4d} importées (ext={ext}, excl={excl}, fus={fus}, OK)")

        apart_items = [
            build_item([rp], 0, rp["matiere"], rp["matiere"], classe, fil, titre=f"À PART — {classe} ({fil}) — {rp['matiere']}", active=False)[0]
            for rp, _ in put_aside_entries
        ]
        apart_file = ne_pas_importer_dir / f"a-part-{classe} {fil}.json"
        apart_file.write_text(json.dumps({"source": DEFAULT_SOURCE, "level": classe, "items": apart_items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        if generer_essais:
            trial_items = [
                build_item([rp], 0, rp["matiere"], rp["matiere"], classe, fil, titre=f"ESSAI NE PAS IMPORTER — {classe} ({fil}) — {rp['matiere']}", active=False, chap_prefix="ESSAI NE PAS IMPORTER")[0]
                for rp, _ in put_aside_entries
            ]
            trial_file = ne_pas_importer_dir / f"{classe} essai {fil}.json"
            trial_file.write_text(json.dumps({"source": DEFAULT_SOURCE, "level": classe, "items": trial_items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        # Supprimer d'éventuels anciens fichiers a-part/essai à la racine d'import/
        for stale in (import_dir / f"a-part-{classe} {fil}.json", import_dir / f"{classe} essai {fil}.json"):
            if stale.exists():
                stale.unlink()

    # Réconciliation globale FR
    u_imp = sum(s["leconsImport"] for s in unique_fr_stats.values())
    u_excl = sum(s["exclusions"] for s in unique_fr_stats.values())
    u_fus = sum(s["fusions"] for s in unique_fr_stats.values())
    put_aside_lecs = sum(m["lecons"] for _, m in put_aside_entries)
    assert total_extracted_fr == u_imp + u_excl + u_fus + put_aside_lecs, (
        f"Mismatch {classe}: {total_extracted_fr} != {u_imp}+{u_excl}+{u_fus}+{put_aside_lecs}"
    )

    reconciliation = {
        "classe": classe,
        "correctionsApplied": bool(corrections),
        "nbSubjectsFr": len(raw_progs),
        "totalExtractedFr": total_extracted_fr,
        "uniqueImportedFr": u_imp,
        "uniqueExcludedFr": u_excl,
        "uniqueMergedFr": u_fus,
        "putAsideFr": put_aside_lecs,
        "nbPutAside": len(put_aside_entries),
        "pebsEnClass": en_cls,
        "pebsPeLecons": pe_stats["leconsImport"],
        "pebsMlLecons": ml_stats["leconsImport"],
        "filiereTotals": filiere_totals,
    }
    write_class_non_converted_report(
        classe, [m for _, m in put_aside_entries], per_filiere_stats, reconciliation, generated_at, OUT_DIR / f"non-convertis-{classe}.md"
    )
    return reconciliation, fusion_summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--classes", nargs="+", default=["6e", "5e", "4e", "3e"], help="Classes à convertir (défaut: 6e 5e 4e 3e)")
    parser.add_argument("--correspondance", default=str(OUT_DIR / "correspondance-matieres-fr-premier-cycle.json"))
    parser.add_argument("--apply-corrections", action="store_true", help="Applique donnees-extraites/corrections.json en mémoire.")
    parser.add_argument("--generer-essais", action="store_true", help="Génère aussi les fichiers d'essai dry-run sur les seuls mis à part.")
    args = parser.parse_args()

    corr_map = load_correspondence_map(Path(args.correspondance))
    corrections: list[dict] = []
    if args.apply_corrections:
        corr_file = OUT_DIR / "corrections.json"
        if corr_file.exists():
            corrections = json.loads(corr_file.read_text(encoding="utf-8")).get("corrections", [])

    import_dir = OUT_DIR / "import"
    import_dir.mkdir(parents=True, exist_ok=True)
    # Nettoyer l'ancien fichier provisoire désormais intégré à 6e FR_PEBS.json
    obsolete = import_dir / "a-valider-6e-FR_PEBS-intensive-english.json"
    if obsolete.exists():
        obsolete.unlink()

    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")
    all_recs: list[dict] = []
    all_fusions: list[dict] = []
    for cls in args.classes:
        rec, fus = process_class(cls, corr_map, corrections, args.generer_essais, import_dir, generated_at)
        all_recs.append(rec)
        all_fusions.append(fus)

    write_intensive_english_annex(all_fusions, generated_at, OUT_DIR / "fusion-intensive-english.md")
    write_global_recap(all_recs, generated_at, OUT_DIR / "recap-import-fr-premier-cycle.md")
    print(f"Écrit fusion-intensive-english.md ({len(all_fusions)} classes) et recap-import-fr-premier-cycle.md")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
