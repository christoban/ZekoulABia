#!/usr/bin/env python3
"""Convertisseur MINESEC -> format JSON d'import officiel ZekoulABia (Second cycle FR : 2nde, 1ere, Tle).

Règles strictes :
- Les fichiers bruts donnees-extraites/{2nde,1re,Tle}/programmes.json ne sont JAMAIS modifiés.
- Applique donnees-extraites/corrections.json en mémoire (--apply-corrections).
- Utilise donnees-extraites/correspondance-matieres-fr-second-cycle.json comme source unique de vérité :
  * Option A : filiere='' pour les matières communes (résolues par fallback), filiere='<SERIE>' pour les matières propres/différenciées.
  * Découpage déterministe de Français -> Langue Française + Littérature (préfixe 'Langue française') + Français complet (E, TI, AC).
  * Fusion Intensive English (ABI) = Anglais (dédoublonné) + Literature awareness (comme D1).
  * Isolation de tous les blocs/matières écartés dans donnees-extraites/import/ne-pas-importer/.
- Produit :
  * donnees-extraites/import/{2nde,1ere,Tle} FR_SECOND_CYCLE.json
  * donnees-extraites/import/ne-pas-importer/a-part-{2nde,1ere,Tle} FR_SECOND_CYCLE.json
  * donnees-extraites/correspondance-matieres-fr-second-cycle.md
  * donnees-extraites/recap-import-fr-second-cycle.md
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path

from convertir_vers_zekoulabia import apply_validated_corrections

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "donnees-extraites"
IMPORT_DIR = OUT_DIR / "import"
NE_PAS_IMPORTER_DIR = IMPORT_DIR / "ne-pas-importer"
CORR_TABLE_PATH = OUT_DIR / "correspondance-matieres-fr-second-cycle.json"
CORRECTIONS_PATH = OUT_DIR / "corrections.json"
DEFAULT_SOURCE = "minesec-distance-learning"
CLASSES_SOURCE = ["2nde", "1re", "Tle"]

PREFIX_NUM_RE = re.compile(
    r"^(?:(?:le[çc]on|lesson|s[ée]ance|chap(?:itre)?|cours|module|u\.?a\.?|tp|td|activit[ée]|s[ée]q(?:uence)?)\s*n?[°ºo]?\s*\d+\s*[:.\-–—]?\s*)+",
    re.I,
)
LANGUE_FR_RE = re.compile(r"langue\s+fran[çc]aise", re.I)


def norm_title_key(titre: str) -> str:
    s = unicodedata.normalize("NFD", titre or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = PREFIX_NUM_RE.sub("", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def select_modules_in_order(prog: dict, ranges: list[list[int]]) -> tuple[list[dict], set[int]]:
    by_pos = {m["positionSource"]: m for m in prog["modules"]}
    selected: list[dict] = []
    used: set[int] = set()
    for start, end in ranges:
        for pos in range(start, end + 1):
            if pos in by_pos:
                selected.append(by_pos[pos])
                used.add(pos)
    return selected, used


def build_chapitres_from_modules(
    module_entries: list[tuple[str, dict]],
    dedup_mode: str = "none",
    lesson_filter=None,
) -> tuple[list[dict], int, int]:
    """Construit la liste Zod-compatible de chapitres à partir de (matiereSource, module).
    Retourne (chapitres, nb_exclus_corrections, nb_dedoublonnes).
    """
    chapitres: list[dict] = []
    seen_keys: set[str] = set()
    ordre = 0
    global_pos = 0
    mod_ordre_seq = 0
    excluded_corr = 0
    deduped = 0

    for _mat_src, mod in module_entries:
        kept: list[tuple[int, dict]] = []
        for lec in mod["lecons"]:
            global_pos += 1
            if bool(lec.get("exclure", False)):
                excluded_corr += 1
                continue
            raw_title = (lec.get("titre") or "").strip()
            if not raw_title or raw_title in (":", "-", "—"):
                excluded_corr += 1
                continue
            if lesson_filter is not None and not lesson_filter(lec):
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
                    "titre": lec["titre"],
                    "moduleOrdre": mod_ordre_seq,
                    "moduleTitre": mod["titre"],
                    "positionDansModule": lec["positionSource"],
                    "positionSource": gpos,
                    "leconNumero": lec["numero"],
                    "numeroAffiche": lec["numeroAffiche"],
                    "sourceUrl": lec["url"],
                    "exclure": False,
                    "titreModuleParasite": bool(mod.get("titreModuleParasite", False)),
                }
            )
    return chapitres, excluded_corr, deduped


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
    parser = argparse.ArgumentParser(description="Convertit 2nde/1re/Tle FR Général vers JSON d'import ZekoulABia.")
    parser.add_argument("--apply-corrections", action="store_true", default=True)
    args = parser.parse_args()

    table = json.loads(CORR_TABLE_PATH.read_text(encoding="utf-8"))
    template_code = table["perimetre"]["templateCode"]
    level_map = table["perimetre"]["niveauxCanoniques"]
    regles = table["regles"]
    regles_by_src = {r["libelleSource"]: r for r in regles}

    corrections: list[dict] = []
    if args.apply_corrections and CORRECTIONS_PATH.exists():
        corrections = json.loads(CORRECTIONS_PATH.read_text(encoding="utf-8")).get("corrections", [])

    IMPORT_DIR.mkdir(parents=True, exist_ok=True)
    NE_PAS_IMPORTER_DIR.mkdir(parents=True, exist_ok=True)

    recap_rows: list[dict] = []
    class_summaries: list[dict] = []
    a_part_summary: list[dict] = []
    global_keys: set[tuple[str, str, str, str]] = set()

    for cls in CLASSES_SOURCE:
        canon_level = level_map[cls]
        raw_progs = json.loads((OUT_DIR / cls / "programmes.json").read_text(encoding="utf-8"))
        progs_by_mat: dict[str, dict] = {}
        for p in raw_progs:
            p_clean, _ = apply_validated_corrections(p, corrections)
            progs_by_mat[p["matiere"]] = p_clean

        # Vérifier qu'aucune matière source n'est oubliée dans la table de correspondance
        missing = sorted(set(progs_by_mat.keys()) - set(regles_by_src.keys()))
        if missing:
            raise SystemExit(f"ERREUR : matières absentes de correspondance-matieres-fr-second-cycle.json pour {cls} : {missing}")

        import_items: list[dict] = []
        a_part_items: list[dict] = []
        anglais_clean_modules: list[tuple[str, dict]] = []

        # Pré-préparer la piste Anglais propre pour la fusion Intensive English (ABI)
        if "Anglais" in progs_by_mat:
            ang_spec = regles_by_src["Anglais"]["parClasse"][cls][0]
            ang_mods, _ = select_modules_in_order(progs_by_mat["Anglais"], ang_spec["modules"])
            anglais_clean_modules = [("Anglais", m) for m in ang_mods]

        raw_lessons_cls = sum(len(m["lecons"]) for p in progs_by_mat.values() for m in p["modules"])
        unique_kept_lessons_cls = 0
        dedup_cls = 0
        excluded_corr_cls = 0
        a_part_lessons_cls = 0

        for mat, prog in progs_by_mat.items():
            regle = regles_by_src[mat]
            decision = regle["decision"]
            specs = regle["parClasse"].get(cls, [])
            if not specs:
                raise SystemExit(f"ERREUR : aucune règle pour ({cls}, {mat})")

            used_mod_positions: set[int] = set()

            for spec in specs:
                conf = spec.get("confiance", "a-part")
                mods, used = select_modules_in_order(prog, spec["modules"])
                if conf == "a-part":
                    chaps, ex_c, _ = build_chapitres_from_modules([(mat, m) for m in mods], dedup_mode="none")
                    a_part_lessons_cls += len(chaps)
                    a_part_items.append(
                        {
                            "classeSource": cls,
                            "level": canon_level,
                            "subjectNameSource": mat,
                            "decision": decision,
                            "raison": spec.get("remarque", "Mis à part"),
                            "nbLecons": len(chaps),
                            "chapitres": chaps,
                        }
                    )
                    a_part_summary.append(
                        {"classe": canon_level, "matiere": mat, "type": "matiere_entiere", "nbLecons": len(chaps), "raison": spec.get("remarque", "")}
                    )
                    used_mod_positions |= used
                    continue

                used_mod_positions |= used
                dedup_mode = spec.get("dedup", "none")
                mode = spec.get("mode", "direct")

                if mode == "fusion_avec_anglais":
                    # Intensive English (ABI) = Anglais dédoublonné + Literature awareness
                    chaps_ang, ex1, dd1 = build_chapitres_from_modules(anglais_clean_modules, dedup_mode="exact_title")
                    chaps_lit, ex2, dd2 = build_chapitres_from_modules([(mat, m) for m in mods], dedup_mode="none")
                    # Recomposer moduleOrdre continu et ordre 1..N
                    combined: list[dict] = []
                    max_mod_ang = max((c["moduleOrdre"] for c in chaps_ang), default=0)
                    for idx_c, c in enumerate(chaps_ang, 1):
                        combined.append({**c, "ordre": idx_c})
                    for c in chaps_lit:
                        combined.append({**c, "ordre": len(combined) + 1, "moduleOrdre": c["moduleOrdre"] + max_mod_ang})
                    unique_kept_lessons_cls += len(chaps_lit)
                    for fil in spec["filieres"]:
                        key = (template_code, canon_level, fil, spec["matiereZekoulABia"])
                        assert key not in global_keys, f"Clé dupliquée : {key}"
                        global_keys.add(key)
                        import_items.append(
                            make_import_item(template_code, canon_level, fil, spec["matiereZekoulABia"], f"Anglais + {mat}", combined)
                        )
                    recap_rows.append(
                        {
                            "level": canon_level,
                            "source": f"Anglais + {mat}",
                            "cible": spec["matiereZekoulABia"],
                            "filieres": ", ".join(spec["filieres"]),
                            "lecons": len(combined),
                            "modules": len({c["moduleOrdre"] for c in combined}),
                            "dedup": dd1 + dd2,
                            "decision": decision,
                            "confiance": spec.get("niveauConfianceDecision", "elevee"),
                        }
                    )

                elif mode == "split_francais":
                    # 1. Piste complète dédoublonnée (pour E, TI, AC -> Français)
                    chaps_all, ex_c, dd_c = build_chapitres_from_modules([(mat, m) for m in mods], dedup_mode=dedup_mode)
                    # 2. Découpage déterministe : Langue française vs Littérature
                    chaps_lang, _, _ = build_chapitres_from_modules(
                        [(mat, m) for m in mods],
                        dedup_mode=dedup_mode,
                        lesson_filter=lambda lec: bool(LANGUE_FR_RE.search(lec.get("titre", ""))),
                    )
                    chaps_litt, _, _ = build_chapitres_from_modules(
                        [(mat, m) for m in mods],
                        dedup_mode=dedup_mode,
                        lesson_filter=lambda lec: not bool(LANGUE_FR_RE.search(lec.get("titre", ""))),
                    )
                    unique_kept_lessons_cls += len(chaps_all)
                    dedup_cls += dd_c
                    excluded_corr_cls += ex_c

                    for fil in spec.get("filieresSplit", []):
                        for subj_name, ch_list in [("Langue Française", chaps_lang), ("Littérature", chaps_litt)]:
                            key = (template_code, canon_level, fil, subj_name)
                            assert key not in global_keys, f"Clé dupliquée : {key}"
                            global_keys.add(key)
                            import_items.append(make_import_item(template_code, canon_level, fil, subj_name, mat, ch_list))
                    for fil in spec.get("filieresComplet", []):
                        key = (template_code, canon_level, fil, "Français")
                        assert key not in global_keys, f"Clé dupliquée : {key}"
                        global_keys.add(key)
                        import_items.append(make_import_item(template_code, canon_level, fil, "Français", mat, chaps_all))

                    fil_split_lbl = ", ".join(f if f else '""(commun)' for f in spec.get("filieresSplit", []))
                    fil_comp_lbl = ", ".join(spec.get("filieresComplet", []))
                    recap_rows.append(
                        {
                            "level": canon_level,
                            "source": f"{mat} ({spec['modules']})",
                            "cible": f"Langue Française ({len(chaps_lang)}) + Littérature ({len(chaps_litt)})" + (f" / Français ({len(chaps_all)})" if fil_comp_lbl else ""),
                            "filieres": fil_split_lbl + (f" | complet: {fil_comp_lbl}" if fil_comp_lbl else ""),
                            "lecons": len(chaps_all),
                            "modules": len({c["moduleOrdre"] for c in chaps_all}),
                            "dedup": dd_c,
                            "decision": decision,
                            "confiance": spec.get("niveauConfianceDecision", "moyenne"),
                        }
                    )

                else:
                    chaps, ex_c, dd_c = build_chapitres_from_modules([(mat, m) for m in mods], dedup_mode=dedup_mode)
                    unique_kept_lessons_cls += len(chaps)
                    dedup_cls += dd_c
                    excluded_corr_cls += ex_c
                    for fil in spec["filieres"]:
                        key = (template_code, canon_level, fil, spec["matiereZekoulABia"])
                        assert key not in global_keys, f"Clé dupliquée : {key}"
                        global_keys.add(key)
                        import_items.append(
                            make_import_item(template_code, canon_level, fil, spec["matiereZekoulABia"], mat, chaps)
                        )
                    recap_rows.append(
                        {
                            "level": canon_level,
                            "source": mat,
                            "cible": spec["matiereZekoulABia"],
                            "filieres": ", ".join(f if f else '""(commun)' for f in spec["filieres"]),
                            "lecons": len(chaps),
                            "modules": len({c["moduleOrdre"] for c in chaps}),
                            "dedup": dd_c,
                            "decision": decision,
                            "confiance": spec.get("niveauConfianceDecision", "elevee"),
                        }
                    )

            # Archiver tout module non consommé de cette matière dans ne-pas-importer/
            unused_mods = [m for m in prog["modules"] if m["positionSource"] not in used_mod_positions]
            if unused_mods:
                ch_un, _, _ = build_chapitres_from_modules([(mat, m) for m in unused_mods], dedup_mode="none")
                a_part_lessons_cls += len(ch_un)
                mod_range_str = f"M{unused_mods[0]['positionSource']}..M{unused_mods[-1]['positionSource']} ({len(unused_mods)} mod)"
                a_part_items.append(
                    {
                        "classeSource": cls,
                        "level": canon_level,
                        "subjectNameSource": mat,
                        "decision": decision,
                        "raison": f"Blocs/modules écartés (doublons de piste ou fragments ambigus) : {mod_range_str}",
                        "nbLecons": len(ch_un),
                        "chapitres": ch_un,
                    }
                )
                a_part_summary.append(
                    {"classe": canon_level, "matiere": mat, "type": "blocs_ecartes", "nbLecons": len(ch_un), "raison": mod_range_str}
                )

        # Écriture des fichiers JSON d'import et ne-pas-importer
        out_import = IMPORT_DIR / f"{canon_level} FR_SECOND_CYCLE.json"
        payload = {"source": DEFAULT_SOURCE, "items": import_items}
        out_import.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        out_apart = NE_PAS_IMPORTER_DIR / f"a-part-{canon_level} FR_SECOND_CYCLE.json"
        out_apart.write_text(
            json.dumps({"classeSource": cls, "level": canon_level, "items": a_part_items}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        class_summaries.append(
            {
                "level": canon_level,
                "rawLessons": raw_lessons_cls,
                "uniqueKept": unique_kept_lessons_cls,
                "dedup": dedup_cls,
                "excludedCorr": excluded_corr_cls,
                "aPart": a_part_lessons_cls,
                "importItems": len(import_items),
                "importLessonsTotal": sum(len(it["chapitres"]) for it in import_items),
                "fileSizeKo": round(out_import.stat().st_size / 1024, 1),
            }
        )

    # Générer correspondance-matieres-fr-second-cycle.md et recap-import-fr-second-cycle.md
    now_str = datetime.now().isoformat(timespec="seconds")
    md_corr = [
        "# Table de correspondance — Second cycle Francophone Général (`2nde`, `1ere`, `Tle`)",
        "",
        f"- Généré le : {now_str} depuis `correspondance-matieres-fr-second-cycle.json` (source unique de vérité).",
        "- Stratégie : **Option A** — `filiere: \"\"` pour les matières communes (résolues par fallback dans `officialProgressionResolution.ts`), `filiere: \"<SERIE>\"` pour les matières propres ou différenciées par série.",
        "- Séries couvertes : **les 12 séries** de `BacCoefficient` (`A1`, `A2`, `A3`, `A4`, `A5`, `ABI`, `AC`, `C`, `D`, `E`, `SH`, `TI`).",
        "",
        "## Synthèse par classe",
        "",
        "| Niveau | Leçons brutes | Leçons retenues (uniques) | Dédoublonnées intra-bloc | Exclues (corrections) | Mis à part (blocs/hors cat.) | Items d'import | Leçons import (toutes séries) | Taille JSON |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for s in class_summaries:
        md_corr.append(
            f"| {s['level']} | {s['rawLessons']} | {s['uniqueKept']} | {s['dedup']} | {s['excludedCorr']} | {s['aPart']} | **{s['importItems']}** | {s['importLessonsTotal']} | {s['fileSizeKo']} Ko |"
        )
    tot_items = sum(s["importItems"] for s in class_summaries)
    tot_raw = sum(s["rawLessons"] for s in class_summaries)
    tot_kept = sum(s["uniqueKept"] for s in class_summaries)
    tot_dd = sum(s["dedup"] for s in class_summaries)
    tot_ex = sum(s["excludedCorr"] for s in class_summaries)
    tot_ap = sum(s["aPart"] for s in class_summaries)
    tot_imp_lec = sum(s["importLessonsTotal"] for s in class_summaries)
    md_corr.append(
        f"| **Total** | **{tot_raw}** | **{tot_kept}** | **{tot_dd}** | **{tot_ex}** | **{tot_ap}** | **{tot_items}** | **{tot_imp_lec}** | — |"
    )

    md_corr.extend([
        "",
        "## Détail des correspondances importées",
        "",
        "| Niveau | Source MINESEC | Matière ZekoulABia | Filières (`filiere`) | Mod | Leçons | Dédoub. | Décision | Confiance |",
        "|---|---|---|---|---:|---:|---:|---|---|",
    ])
    for r in recap_rows:
        md_corr.append(
            f"| {r['level']} | {r['source']} | {r['cible']} | `{r['filieres']}` | {r['modules']} | {r['lecons']} | {r['dedup']} | {r['decision']} | {r['confiance']} |"
        )

    md_corr.extend([
        "",
        "## Éléments mis à part (`import/ne-pas-importer/a-part-*-FR_SECOND_CYCLE.json`)",
        "",
        "| Niveau | Matière source | Type | Leçons | Raison |",
        "|---|---|---|---:|---|",
    ])
    for a in a_part_summary:
        md_corr.append(f"| {a['classe']} | {a['matiere']} | {a['type']} | {a['nbLecons']} | {a['raison']} |")

    md_text = "\n".join(md_corr) + "\n"
    (OUT_DIR / "correspondance-matieres-fr-second-cycle.md").write_text(md_text, encoding="utf-8")
    (OUT_DIR / "recap-import-fr-second-cycle.md").write_text(md_text, encoding="utf-8")

    print(f"CONVERSION_OK: {tot_items} items d'import générés sur 2nde/1ere/Tle")
    for s in class_summaries:
        print(f"  {s['level']:4s}: {s['importItems']:3d} items, {s['importLessonsTotal']:4d} leçons, {s['fileSizeKo']} Ko (raw={s['rawLessons']}, kept={s['uniqueKept']}, dedup={s['dedup']}, ex={s['excludedCorr']}, aPart={s['aPart']})")


if __name__ == "__main__":
    main()

