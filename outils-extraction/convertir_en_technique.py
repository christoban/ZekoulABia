#!/usr/bin/env python3
"""Convertisseur MINESEC -> format JSON d'import officiel ZekoulABia (Enseignement Technique EN).

Règles strictes :
- Les fichiers bruts donnees-extraites/technique-en/*/programmes.json ne sont JAMAIS modifiés.
- Utilise donnees-extraites/correspondance-matieres-en-technique.json comme source unique de vérité :
  * Convertit uniquement les matières générales et transversales correspondant au catalogue
    AnglophoneSubjectLoad (`technical.ts` : Form1-Form4, LowerSixth, UpperSixth, filières IND et STT,
    templateCode='__ALL__', JAMAIS filiere='' pour zéro collision avec le Général Anglophone).
  * Archive intégralement Form5 (absent d'AnglophoneSubjectLoad) ainsi que toutes les spécialités
    fines non modélisées et les blocs doublons dans donnees-extraites/import/ne-pas-importer/.
- Produit :
  * donnees-extraites/import/{Form1,Form2,Form3,Form4,LowerSixth,UpperSixth} EN_TECHNIQUE.json
  * donnees-extraites/import/ne-pas-importer/a-part-{Form1..Form5,LowerSixth,UpperSixth} EN_TECHNIQUE.json
  * donnees-extraites/correspondance-matieres-en-technique.md
  * donnees-extraites/recap-import-en-technique.md
"""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "donnees-extraites"
SRC_DIR = OUT_DIR / "technique-en"
IMPORT_DIR = OUT_DIR / "import"
NE_PAS_IMPORTER_DIR = IMPORT_DIR / "ne-pas-importer"
CORR_TABLE_PATH = OUT_DIR / "correspondance-matieres-en-technique.json"
DEFAULT_SOURCE = "minesec-distance-learning"
CLASSES_IMPORT = ["Form1", "Form2", "Form3", "Form4", "LowerSixth", "UpperSixth"]
CLASSES_ARCHIVE = ["Form5"]

PREFIX_NUM_RE = re.compile(
    r"^(?:(?:le[çc]on|lesson|les[so]n|s[ée]ance|chap(?:itre|ter)?|cours|module|u\.?a\.?|tp|td|activit[ée]|s[ée]q(?:uence)?)\s*n?[°ºo]?\s*\d+\s*[:.\-–—]?\s*)+",
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
    assert filiere != "", f"INTERDIT : filiere='' en Technique EN ({level}, {subject_name}) — risque de collision avec Général EN"
    return {
        "templateCode": template_code,
        "level": level,
        "filiere": filiere,
        "subjectName": subject_name,
        "subjectNameSource": subject_source,
        "titre": f"Official syllabus — {subject_name} ({level} {filiere})",
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

    for cls in CLASSES_IMPORT:
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
                        "raison": "Spécialité fine ou matière absente du catalogue IND/STT (technical.ts)",
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
                            "filiere": fil,
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
                        "raison": f"Modules non retenus (pistes doublons/révision) : {[m['positionSource'] for m in unused_mods]}",
                        "nbLecons": len(chaps_u),
                        "chapitres": chaps_u,
                    }
                )

        import_path = IMPORT_DIR / f"{canon_level} EN_TECHNIQUE.json"
        import_payload = {
            "source": DEFAULT_SOURCE,
            "level": canon_level,
            "items": import_items,
        }
        import_path.write_text(
            json.dumps(import_payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        a_part_path = NE_PAS_IMPORTER_DIR / f"a-part-{canon_level} EN_TECHNIQUE.json"
        a_part_path.write_text(
            json.dumps(a_part_items, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        class_summaries.append(
            {
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

    # Archiver intégralement Form5 (absent d'AnglophoneSubjectLoad pour GTC_GTHS_EN / GTC_EN)
    archived_levels_summary: list[dict] = []
    for cls in CLASSES_ARCHIVE:
        raw_progs = json.loads((SRC_DIR / cls / "programmes.json").read_text(encoding="utf-8"))
        a_part_items = []
        tot_l = 0
        for prog in raw_progs:
            chaps, _, _ = build_chapitres_from_modules(prog["modules"], dedup_mode="none")
            tot_l += len(chaps)
            a_part_items.append(
                {
                    "classeSource": cls,
                    "level": cls,
                    "subjectNameSource": prog["matiere"],
                    "type": "niveau_hors_catalogue",
                    "raison": "Niveau Form5 absent du catalogue technique anglophone ZekoulABia (technical.ts couvre Form1-Form4 + LowerSixth/UpperSixth)",
                    "nbLecons": len(chaps),
                    "chapitres": chaps,
                }
            )
        a_part_path = NE_PAS_IMPORTER_DIR / f"a-part-{cls} EN_TECHNIQUE.json"
        a_part_path.write_text(
            json.dumps(a_part_items, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        archived_levels_summary.append({"level": cls, "nbMatieres": len(raw_progs), "nbLecons": tot_l, "fichier": a_part_path.name})

    # Générer correspondance-matieres-en-technique.md
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    md_corr = [
        "# Correspondance matières — Enseignement technique Anglophone (Form1–Form4, LowerSixth, UpperSixth)",
        "",
        f"> Généré automatiquement le {now_str} depuis `correspondance-matieres-en-technique.json`.",
        "> Périmètre : `templateCode = \"__ALL__\"` (`GTC_GTHS_EN`, `GTC_EN`), filières `IND` (Industrial) et `STT` (Tertiary). Aucun item n'utilise `filiere = \"\"` afin d'éviter toute collision avec le Général Anglophone sur les mêmes niveaux.",
        "> `Form5` (absent de `technical.ts`), les spécialités fines non modélisées et les blocs doublons sont archivés dans `import/ne-pas-importer/a-part-*-EN_TECHNIQUE.json`.",
        "",
        "| Niveau | Filière | Matière ZekoulABia | Matière source MINESEC | Modules | Leçons | Dédoublonnées | Confiance | Décision | Remarque |",
        "|---|---|---|---|---:|---:|---:|---|---|---|",
    ]
    for r in recap_rows:
        md_corr.append(
            f"| {r['classe']} | {r['filiere']} | {r['matiereZekoulABia']} | {r['matiereSource']} | {r['nbModules']} | {r['nbLecons']} | {r['dedup']} | {r['confiance']} | {r['decision']} | {r['remarque']} |"
        )
    (OUT_DIR / "correspondance-matieres-en-technique.md").write_text("\n".join(md_corr) + "\n", encoding="utf-8")

    # Générer recap-import-en-technique.md
    tot_items = sum(s["nbItemsImport"] for s in class_summaries)
    tot_lecons_imp = sum(s["nbLeconsImport"] for s in class_summaries)
    tot_brutes = sum(s["nbMatieresBrutes"] for s in class_summaries) + sum(a["nbMatieres"] for a in archived_levels_summary)
    tot_conv = sum(s["nbMatieresConverties"] for s in class_summaries)
    tot_arch = sum(s["nbMatieresArchivees"] for s in class_summaries) + sum(a["nbMatieres"] for a in archived_levels_summary)

    md_recap = [
        "# Récapitulatif d'import — Enseignement technique Anglophone (Form1–Form4, LowerSixth, UpperSixth)",
        "",
        f"> Généré le {now_str} par `outils-extraction/convertir_en_technique.py`.",
        f"> Total : **{tot_items} progressions officielles** (**{tot_lecons_imp} leçons**), réparties sur **6 fichiers JSON** (1 niveau canonique par fichier), **{tot_conv}/{tot_brutes}** couples classe/matière convertis et **{tot_arch}** couples archivés (spécialités fines + `Form5` complet).",
        "> Rappel : les libellés de `backend/src/application/school/curriculum/anglophone/technical.ts` sont marqués provisoires dans le code source ; les progressions ci-dessous s'alignent strictement sur ces libellés sans modifier le code backend.",
        "",
        "| Niveau | Matières brutes | Converties | Archivées | Items import | Leçons import | Leçons archivées | Fichier JSON |",
        "|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for s in class_summaries:
        md_recap.append(
            f"| {s['level']} | {s['nbMatieresBrutes']} | {s['nbMatieresConverties']} | {s['nbMatieresArchivees']} | {s['nbItemsImport']} | {s['nbLeconsImport']} | {s['nbLeconsArchivees']} | `{s['fichierImport']}` |"
        )
    for a in archived_levels_summary:
        md_recap.append(
            f"| {a['level']} *(archivé)* | {a['nbMatieres']} | 0 | {a['nbMatieres']} | 0 | 0 | {a['nbLecons']} | `ne-pas-importer/{a['fichier']}` |"
        )
    (OUT_DIR / "recap-import-en-technique.md").write_text("\n".join(md_recap) + "\n", encoding="utf-8")

    print(f"OK Technique EN : {tot_items} items ({tot_lecons_imp} leçons) sur 6 fichiers, {tot_arch} couples archivés (dont Form5).")
    for s in class_summaries:
        print(
            f"  - {s['level']:10s}: {s['nbItemsImport']:2d} items, {s['nbLeconsImport']:4d} leçons "
            f"(brut={s['nbMatieresBrutes']}, conv={s['nbMatieresConverties']}, arch={s['nbMatieresArchivees']}, dedup={s['nbDedup']}, vides={s['nbVides']})"
        )
    for a in archived_levels_summary:
        print(f"  - {a['level']:10s}: ARCHIVÉ intégralement ({a['nbMatieres']} matières, {a['nbLecons']} leçons)")


if __name__ == "__main__":
    main()

