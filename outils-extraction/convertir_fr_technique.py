#!/usr/bin/env python3
"""Convertisseur MINESEC -> format JSON d'import officiel ZekoulABia (Enseignement Technique FR).

Règles strictes :
- Les fichiers bruts donnees-extraites/technique-fr/*/programmes.json ne sont JAMAIS modifiés.
- Utilise donnees-extraites/correspondance-matieres-fr-technique.json comme source unique de vérité :
  * Convertit uniquement les matières générales et transversales correspondant au catalogue
    CycleCoefficient (`technique.ts` : CAP1-CAP4, BT1-BT3, filières F1 et G2, templateCode='__ALL__').
  * Isole toutes les spécialités fines non modélisées et tous les blocs doublons dans
    donnees-extraites/import/ne-pas-importer/a-part-{CAP1..BT3} FR_TECHNIQUE.json.
- Produit :
  * donnees-extraites/import/{CAP1,CAP2,CAP3,CAP4,BT1,BT2,BT3} FR_TECHNIQUE.json
  * donnees-extraites/import/ne-pas-importer/a-part-{CAP1..BT3} FR_TECHNIQUE.json
  * donnees-extraites/correspondance-matieres-fr-technique.md
  * donnees-extraites/recap-import-fr-technique.md
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "donnees-extraites"
SRC_DIR = OUT_DIR / "technique-fr"
IMPORT_DIR = OUT_DIR / "import"
NE_PAS_IMPORTER_DIR = IMPORT_DIR / "ne-pas-importer"
CORR_TABLE_PATH = OUT_DIR / "correspondance-matieres-fr-technique.json"
DEFAULT_SOURCE = "minesec-distance-learning"
CLASSES_SOURCE = ["1re-annee", "2e-annee", "3e-annee", "4e-annee", "2nde", "1re", "Tle"]

PREFIX_NUM_RE = re.compile(
    r"^(?:(?:le[çc]on|lesson|s[ée]ance|chap(?:itre)?|cours|module|u\.?a\.?|tp|td|activit[ée]|s[ée]q(?:uence)?)\s*n?[°ºo]?\s*\d+\s*[:.\-–—]?\s*)+",
    re.I,
)


def norm_title_key(titre: str) -> str:
    s = unicodedata.normalize("NFD", titre or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = PREFIX_NUM_RE.sub("", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def select_modules_in_order(prog: dict, ranges: list[list[int]]) -> tuple[list[dict], set[int]]:
    by_pos = {m["positionSource"]: m for m in prog["modules"]}
    max_pos = max(by_pos.keys(), default=0)
    selected: list[dict] = []
    used: set[int] = set()
    for start, end in ranges:
        capped_end = min(end, max_pos)
        for pos in range(start, capped_end + 1):
            if pos in by_pos and pos not in used:
                selected.append(by_pos[pos])
                used.add(pos)
    return selected, used


def build_chapitres_from_modules(
    module_entries: list[dict],
    dedup_mode: str = "exact_title",
) -> tuple[list[dict], int, int]:
    """Construit la liste Zod-compatible de chapitres.
    Retourne (chapitres, nb_vides_exclus, nb_dedoublonnes).
    """
    chapitres: list[dict] = []
    seen_keys: set[str] = set()
    ordre = 0
    global_pos = 0
    mod_ordre_seq = 0
    excluded_empty = 0
    deduped = 0

    for mod in module_entries:
        kept: list[tuple[int, dict]] = []
        for lec in mod["lecons"]:
            global_pos += 1
            if bool(lec.get("exclure", False)):
                excluded_empty += 1
                continue
            raw_title = (lec.get("titre") or "").strip()
            if not raw_title or raw_title in (":", "-", "—", "."):
                excluded_empty += 1
                continue
            if dedup_mode == "exact_title":
                k = norm_title_key(raw_title)
                if k and k in seen_keys:
                    deduped += 1
                    continue
                if k:
                    seen_keys.add(k)
            kept.append((global_pos, lec))

        if not kept:
            continue
        mod_ordre_seq += 1
        for gpos, lec in kept:
            ordre += 1
            chapitres.append(
                {
                    "ordre": ordre,
                    "titre": lec["titre"].strip(),
                    "moduleOrdre": mod_ordre_seq,
                    "moduleTitre": mod["titre"],
                    "positionDansModule": lec["positionSource"],
                    "positionSource": gpos,
                    "leconNumero": lec.get("numero"),
                    "numeroAffiche": lec.get("numeroAffiche"),
                    "sourceUrl": lec.get("url"),
                    "exclure": False,
                    "titreModuleParasite": bool(mod.get("titreModuleParasite", False)),
                }
            )
    return chapitres, excluded_empty, deduped


def make_import_item(
    template_code: str,
    level: str,
    filiere: str,
    subject_name: str,
    subject_source: str,
    chapitres: list[dict],
) -> dict:
    fil_label = f" ({filiere})" if filiere else ""
    return {
        "templateCode": template_code,
        "level": level,
        "filiere": filiere,
        "subjectName": subject_name,
        "subjectNameSource": subject_source,
        "titre": f"Programme officiel — {subject_name} ({level}{fil_label})",
        "source": DEFAULT_SOURCE,
        "active": True,
        "chapitres": chapitres,
    }


def main() -> None:
    table = json.loads(CORR_TABLE_PATH.read_text(encoding="utf-8"))
    template_code = table["perimetre"]["templateCode"]
    level_map = table["perimetre"]["niveauxCanoniques"]
    regles_by_src = {r["libelleSource"]: r for r in table["regles"]}

    IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    NE_PAS_IMPORTER_DIR.mkdir(parents=True, exist_ok=True)

    recap_rows: list[dict] = []
    class_summaries: list[dict] = []
    global_keys: set[tuple[str, str, str, str]] = set()

    for cls in CLASSES_SOURCE:
        canon_level = level_map[cls]
        raw_progs = json.loads((SRC_DIR / cls / "programmes.json").read_text(encoding="utf-8"))

        import_items: list[dict] = []
        a_part_items: list[dict] = []
        raw_lessons_cls = sum(len(m["lecons"]) for p in raw_progs for m in p["modules"])
        mapped_subjects_cls = 0
        archived_subjects_cls = 0
        archived_blocks_cls = 0
        archived_lessons_cls = 0
        dedup_cls = 0
        empty_cls = 0

        for prog in raw_progs:
            mat = prog["matiere"]
            regle = regles_by_src.get(mat)
            specs = regle["parClasse"].get(cls, []) if regle else []

            if not specs:
                chaps, ex_e, _ = build_chapitres_from_modules(prog["modules"], dedup_mode="none")
                archived_subjects_cls += 1
                archived_lessons_cls += len(chaps)
                empty_cls += ex_e
                a_part_items.append(
                    {
                        "classeSource": cls,
                        "level": canon_level,
                        "subjectNameSource": mat,
                        "type": "specialite_ou_hors_catalogue",
                        "raison": "Spécialité fine ou matière absente du catalogue générique F1/G2 (technique.ts)",
                        "nbLecons": len(chaps),
                        "chapitres": chaps,
                    }
                )
                continue

            mapped_subjects_cls += 1
            used_mod_positions: set[int] = set()

            for spec in specs:
                mods, used = select_modules_in_order(prog, spec["modules"])
                used_mod_positions |= used
                dedup_mode = spec.get("dedup", "exact_title")
                chaps, ex_e, dd = build_chapitres_from_modules(mods, dedup_mode=dedup_mode)
                assert len(chaps) > 0, f"0 chapitre produit pour ({cls}, {mat}, {spec['matiereZekoulABia']})"
                empty_cls += ex_e
                dedup_cls += dd

                for fil in spec["filieres"]:
                    key = (template_code, canon_level, fil, spec["matiereZekoulABia"])
                    assert key not in global_keys, f"Clé dupliquée : {key}"
                    global_keys.add(key)
                    import_items.append(
                        make_import_item(
                            template_code,
                            canon_level,
                            fil,
                            spec["matiereZekoulABia"],
                            mat,
                            chaps,
                        )
                    )
                    recap_rows.append(
                        {
                            "classe": canon_level,
                            "classeSource": cls,
                            "filiere": fil or "(commun F1/G2)",
                            "matiereZekoulABia": spec["matiereZekoulABia"],
                            "matiereSource": mat,
                            "nbModules": len({c["moduleOrdre"] for c in chaps}),
                            "nbLecons": len(chaps),
                            "dedup": dd,
                            "confiance": spec["confiance"],
                            "decision": regle["decision"],
                            "remarque": spec.get("remarque", ""),
                        }
                    )

            unused_mods = [m for m in prog["modules"] if m["positionSource"] not in used_mod_positions]
            if unused_mods:
                chaps_u, ex_u, _ = build_chapitres_from_modules(unused_mods, dedup_mode="none")
                archived_blocks_cls += 1
                archived_lessons_cls += len(chaps_u)
                empty_cls += ex_u
                a_part_items.append(
                    {
                        "classeSource": cls,
                        "level": canon_level,
                        "subjectNameSource": mat,
                        "type": "blocs_doublons_ou_ecartes",
                        "raison": f"Modules non retenus (pistes doublons/variantes) : {[m['positionSource'] for m in unused_mods]}",
                        "nbLecons": len(chaps_u),
                        "chapitres": chaps_u,
                    }
                )

        # Écrire JSON d'import officiel (1 niveau canonique par fichier, format exact proposeProgressionsImportSchema)
        import_path = IMPORT_DIR / f"{canon_level} FR_TECHNIQUE.json"
        import_payload = {
            "source": DEFAULT_SOURCE,
            "level": canon_level,
            "items": import_items,
        }
        import_path.write_text(
            json.dumps(import_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        # Écrire archive ne-pas-importer
        a_part_path = NE_PAS_IMPORTER_DIR / f"a-part-{canon_level} FR_TECHNIQUE.json"
        a_part_path.write_text(
            json.dumps(a_part_items, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        class_summaries.append(
            {
                "classeSource": cls,
                "level": canon_level,
                "nbMatieresBrutes": len(raw_progs),
                "nbMatieresConverties": mapped_subjects_cls,
                "nbMatieresArchivees": archived_subjects_cls,
                "nbBlocsArchives": archived_blocks_cls,
                "nbItemsImport": len(import_items),
                "nbLeconsImport": sum(len(i["chapitres"]) for i in import_items),
                "nbLeconsBrutes": raw_lessons_cls,
                "nbLeconsArchivees": archived_lessons_cls,
                "nbDedup": dedup_cls,
                "nbVides": empty_cls,
                "fichierImport": import_path.name,
            }
        )

    # Générer correspondance-matieres-fr-technique.md
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    md_corr = [
        "# Correspondance matières — Enseignement technique Francophone (CAP1–CAP4, BT1–BT3)",
        "",
        f"> Généré automatiquement le {now_str} depuis `correspondance-matieres-fr-technique.json`.",
        "> Périmètre : `templateCode = \"__ALL__\"` (`LYCEE_TECHNIQUE_FR`, `CETIC`), filières génériques `F1` (Industriel) et `G2` (Tertiaire).",
        "> Les spécialités fines non modélisées et les blocs doublons sont archivés dans `import/ne-pas-importer/a-part-*-FR_TECHNIQUE.json`.",
        "",
        "| Niveau | Filière | Matière ZekoulABia | Matière source MINESEC | Modules | Leçons | Dédoublonnées | Confiance | Décision | Remarque |",
        "|---|---|---|---|---:|---:|---:|---|---|---|",
    ]
    for r in recap_rows:
        md_corr.append(
            f"| {r['classe']} ({r['classeSource']}) | {r['filiere']} | {r['matiereZekoulABia']} | {r['matiereSource']} | {r['nbModules']} | {r['nbLecons']} | {r['dedup']} | {r['confiance']} | {r['decision']} | {r['remarque']} |"
        )
    (OUT_DIR / "correspondance-matieres-fr-technique.md").write_text("\n".join(md_corr) + "\n", encoding="utf-8")

    # Générer recap-import-fr-technique.md
    tot_items = sum(s["nbItemsImport"] for s in class_summaries)
    tot_lecons_imp = sum(s["nbLeconsImport"] for s in class_summaries)
    tot_brutes = sum(s["nbMatieresBrutes"] for s in class_summaries)
    tot_conv = sum(s["nbMatieresConverties"] for s in class_summaries)
    tot_arch = sum(s["nbMatieresArchivees"] for s in class_summaries)

    md_recap = [
        "# Récapitulatif d'import — Enseignement technique Francophone (CAP1–CAP4, BT1–BT3)",
        "",
        f"> Généré le {now_str} par `outils-extraction/convertir_fr_technique.py`.",
        f"> Total : **{tot_items} progressions officielles** (**{tot_lecons_imp} leçons**), réparties sur **7 fichiers JSON** (1 niveau canonique par fichier), **{tot_conv}/{tot_brutes}** couples classe/matière convertis et **{tot_arch}** spécialités fines archivées dans `ne-pas-importer/`.",
        "",
        "| Niveau | Source | Matières brutes | Converties | Archivées (spécialités) | Items import | Leçons import | Leçons archivées | Fichier JSON |",
        "|---|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for s in class_summaries:
        md_recap.append(
            f"| {s['level']} | `{s['classeSource']}` | {s['nbMatieresBrutes']} | {s['nbMatieresConverties']} | {s['nbMatieresArchivees']} | {s['nbItemsImport']} | {s['nbLeconsImport']} | {s['nbLeconsArchivees']} | `{s['fichierImport']}` |"
        )
    (OUT_DIR / "recap-import-fr-technique.md").write_text("\n".join(md_recap) + "\n", encoding="utf-8")

    print(f"OK Technique FR : {tot_items} items ({tot_lecons_imp} leçons) sur 7 fichiers, {tot_arch} spécialités archivées.")
    for s in class_summaries:
        print(
            f"  - {s['level']:4s} ({s['classeSource']:9s}): {s['nbItemsImport']:2d} items, {s['nbLeconsImport']:4d} leçons "
            f"(brut={s['nbMatieresBrutes']}, conv={s['nbMatieresConverties']}, arch={s['nbMatieresArchivees']}, dedup={s['nbDedup']}, vides={s['nbVides']})"
        )


if __name__ == "__main__":
    main()

