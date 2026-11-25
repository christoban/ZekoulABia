#!/usr/bin/env python3
"""Convertisseur MINESEC Général Anglophone -> JSON d'import officiel ZekoulABia (Form1 -> UpperSixth).

Règles :
- Catalogue réel : AnglophoneSubjectLoad (backend/src/application/school/curriculum/anglophone/secondary.ts),
  filières EN_GENERAL (Form1..UpperSixth) et EN_PEBS (Form1..Form5).
- Fichiers bruts jamais modifiés ; corrections.json appliqué en mémoire avec --apply-corrections.
- Fichiers prêts à l'import dans donnees-extraites/import/ ; fichiers a-part-* et essai-*
  exclusivement dans donnees-extraites/import/ne-pas-importer/.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from convertir_en_rapports import (
    write_en_global_recap,
    write_en_history_fusion_annex,
    write_francais_intensif_split_annex,
)
from convertir_vers_zekoulabia import (
    DEFAULT_SOURCE,
    OUT_DIR,
    apply_validated_corrections,
    build_item,
)

EN_CLASSES = ["Form1", "Form2", "Form3", "Form4", "Form5", "LowerSixth", "UpperSixth"]
ACCEPTED_CONFIDENCES = {"certain", "probable"}

# Catalogue exact AnglophoneSubjectLoad extrait en lecture seule de secondary.ts
EN_GENERAL_CATALOG: dict[str, set[str]] = {
    "Form1": {"English Language", "Literature in English", "French", "Geography", "History", "Citizenship Education", "Biology", "Chemistry", "Mathematics", "Physics", "Computer Science", "Food and Nutrition"},
    "Form2": {"English Language", "Literature in English", "French", "Geography", "History", "Citizenship Education", "Biology", "Chemistry", "Mathematics", "Physics", "Computer Science", "Food and Nutrition"},
    "Form3": {"English Language", "Literature in English", "French", "Geography", "Economics", "History", "Citizenship Education", "Biology", "Chemistry", "Mathematics", "Physics", "Computer Science", "Food and Nutrition", "Logic"},
    "Form4": {"English Language", "Literature in English", "French", "Geography", "Economics", "History", "Citizenship Education", "Commerce", "Biology", "Chemistry", "Mathematics", "Physics", "Computer Science", "Geology", "Food and Nutrition", "Human Biology", "Additional Mathematics", "Logic"},
    "Form5": {"English Language", "Literature in English", "French", "Geography", "Economics", "History", "Citizenship Education", "Commerce", "Biology", "Chemistry", "Mathematics", "Physics", "Computer Science", "Geology", "Food and Nutrition", "Human Biology", "Additional Mathematics", "Logic"},
    "LowerSixth": {"English Language", "Literature in English", "French", "Geography", "Economics", "History", "Biology", "Chemistry", "Mathematics", "Physics", "Computer Science", "Geology", "Food and Nutrition", "Additional Mathematics", "Philosophy"},
    "UpperSixth": {"English Language", "Literature in English", "French", "Geography", "Economics", "History", "Biology", "Chemistry", "Mathematics", "Physics", "Computer Science", "Geology", "Food and Nutrition", "Philosophy"},
}

EN_PEBS_CATALOG: dict[str, set[str]] = {
    "Form1": {"Français intensif (Langue)", "Français intensif (Littérature)", "English Language", "Éducation à la Citoyenneté et à la Morale", "Geography", "History", "Computer Sciences", "Biology", "Chemistry", "Home Economics", "Mathematics", "Physics", "Sport and Physical Education", "Manual Labour"},
    "Form2": {"Français intensif (Langue)", "Français intensif (Littérature)", "English Language", "Éducation à la Citoyenneté et à la Morale", "Geography", "History", "Computer Sciences", "Biology", "Chemistry", "Home Economics", "Mathematics", "Physics", "Sport and Physical Education", "Manual Labour"},
    "Form3": {"Français intensif (Langue)", "Français intensif (Littérature)", "English Language", "Economics", "Éducation à la Citoyenneté et à la Morale", "Geography", "History", "Computer Sciences", "Biology", "Chemistry", "Food and Nutrition", "Mathematics", "Physics", "Logic", "Sport and Physical Education", "Manual Labour"},
    "Form4": {"Français intensif (Langue)", "Français intensif (Littérature)", "English Language", "Economics", "Éducation à la Citoyenneté et à la Morale", "Geography", "History", "Computer Sciences", "Biology", "Chemistry", "Food and Nutrition", "Mathematics", "Physics", "Geology", "Logic", "Sport and Physical Education", "Manual Labour"},
    "Form5": {"Français intensif (Langue)", "Français intensif (Littérature)", "English Language", "Economics", "Éducation à la Citoyenneté et à la Morale", "Geography", "History", "Computer Sciences", "Biology", "Chemistry", "Food and Nutrition", "Mathematics", "Physics", "Geology", "Logic", "Sport and Physical Education", "Manual Labour"},
}


def load_en_correspondence(path: Path) -> tuple[dict[str, dict], dict[str, dict]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    c1 = {e["libelleSource"]: e for e in raw.get("firstCycle", [])}
    c2 = {e["libelleSource"]: e for e in raw.get("secondCycle", [])}
    return c1, c2


def is_literature_lesson(titre: str) -> bool:
    tl = titre.lower()
    return ("initiation à la littérature" in tl) or ("initiation a la litterature" in tl) or ("lecture suivie" in tl)


def split_francais_intensif(prog: dict) -> tuple[dict, dict]:
    """Découpe Francais Intensif en 2 programmes (Langue vs Littérature) sans aucune perte."""
    lang_mods, lit_mods = [], []
    for mod in prog["modules"]:
        l_lang = [dict(l) for l in mod["lecons"] if not is_literature_lesson(l["titre"])]
        l_lit = [dict(l) for l in mod["lecons"] if is_literature_lesson(l["titre"])]
        if l_lang:
            m_copy = dict(mod)
            m_copy["lecons"] = l_lang
            lang_mods.append(m_copy)
        if l_lit:
            m_copy = dict(mod)
            m_copy["lecons"] = l_lit
            lit_mods.append(m_copy)
    p_lang = dict(prog, modules=lang_mods)
    p_lit = dict(prog, modules=lit_mods)
    return p_lang, p_lit


def resolve_entry(entry: dict, classe: str) -> tuple[str, list[str], str, dict[str, str]]:
    per_cls = entry.get("parClasse", {}).get(classe)
    if per_cls:
        return (
            per_cls.get("matiereZekoulABia", "aucune"),
            per_cls.get("filiereProposee", []),
            per_cls.get("confiance", "a-part"),
            per_cls.get("matiereParFiliere", entry.get("matiereParFiliere", {})),
        )
    return (
        entry.get("matiereZekoulABia", "aucune"),
        entry.get("filiereProposee", []),
        entry.get("confiance", "a-part"),
        entry.get("matiereParFiliere", {}),
    )


def process_en_class(
    classe: str,
    corr_map: dict[str, dict],
    corrections: list[dict],
    generer_essais: bool,
    import_dir: Path,
    ne_pas_importer_dir: Path,
) -> tuple[dict, dict | None, dict | None]:
    filieres = ["EN_GENERAL", "EN_PEBS"] if classe in EN_PEBS_CATALOG else ["EN_GENERAL"]
    catalogs = {"EN_GENERAL": EN_GENERAL_CATALOG[classe]}
    if "EN_PEBS" in filieres:
        catalogs["EN_PEBS"] = EN_PEBS_CATALOG[classe]

    raw_progs = json.loads((OUT_DIR / classe / "programmes.json").read_text(encoding="utf-8"))
    per_fil_items: dict[str, list[dict]] = {f: [] for f in filieres}
    per_fil_stats: dict[str, list[dict]] = {f: [] for f in filieres}
    per_fil_apart: dict[str, list[dict]] = {f: [] for f in filieres}

    total_extracted = 0
    unique_imported_src: dict[str, dict] = {}
    unique_apart_lecs = 0
    history_parts: list[tuple[str, dict, int]] = []
    fi_split_summary: dict | None = None

    for raw_prog in raw_progs:
        label = raw_prog["matiere"]
        raw_lecs = sum(len(m["lecons"]) for m in raw_prog["modules"])
        total_extracted += raw_lecs
        prog, merged_cnt = apply_validated_corrections(raw_prog, corrections) if corrections else (raw_prog, 0)
        entry = corr_map.get(label)

        if entry is None:
            unique_apart_lecs += raw_lecs
            for f in filieres:
                per_fil_apart[f].append(raw_prog)
            continue

        target_name, proposed_fils, conf, by_fil_name = resolve_entry(entry, classe)

        if conf == "split-pebs" and "EN_PEBS" in filieres:
            p_lang, p_lit = split_francais_intensif(prog)
            it_lang, st_lang, _ = build_item(
                [p_lang], 0, "Français intensif (Langue)", f"{label} (Langue)", classe, "EN_PEBS",
                titre=f"Programme officiel MINESEC — {classe} (EN_PEBS) — Français intensif (Langue)",
            )
            it_lit, st_lit, _ = build_item(
                [p_lit], 0, "Français intensif (Littérature)", f"{label} (Littérature)", classe, "EN_PEBS",
                titre=f"Programme officiel MINESEC — {classe} (EN_PEBS) — Français intensif (Littérature)",
            )
            assert st_lang["leconsImport"] + st_lit["leconsImport"] == raw_lecs
            per_fil_items["EN_PEBS"].extend([it_lang, it_lit])
            per_fil_stats["EN_PEBS"].extend([st_lang, st_lit])
            unique_imported_src[label] = {
                "leconsImport": raw_lecs, "exclusions": 0, "fusions": 0,
            }
            fi_split_summary = {"classe": classe, "raw": raw_lecs, "lang": st_lang["leconsImport"], "lit": st_lit["leconsImport"]}
            continue

        if conf == "fusion-history":
            history_parts.append((label, prog, merged_cnt))
            continue

        if conf not in ACCEPTED_CONFIDENCES or target_name == "aucune" or not proposed_fils:
            unique_apart_lecs += raw_lecs
            for f in filieres:
                per_fil_apart[f].append(raw_prog)
            continue

        matched_any = False
        for f in filieres:
            t_name = by_fil_name.get(f, target_name)
            if f in proposed_fils and t_name in catalogs[f]:
                matched_any = True
                item, stats, _ = build_item(
                    [prog], merged_cnt, t_name, label, classe, f,
                    titre=f"Programme officiel MINESEC — {classe} ({f}) — {t_name}",
                )
                per_fil_items[f].append(item)
                per_fil_stats[f].append(stats)
                if label not in unique_imported_src:
                    unique_imported_src[label] = stats
        if not matched_any:
            unique_apart_lecs += raw_lecs
            for f in filieres:
                per_fil_apart[f].append(raw_prog)

    history_fusion_summary: dict | None = None
    if history_parts:
        # Ordre canonique GCE A-Level : Cameroon -> African -> World
        order_rank = {"Cameroon history": 0, "African history": 1, "World history": 2}
        history_parts.sort(key=lambda x: order_rank.get(x[0], 99))
        h_progs = [p for _, p, _ in history_parts]
        h_merged = sum(m for _, _, m in history_parts)
        h_src_label = " + ".join(lbl for lbl, _, _ in history_parts)
        h_item, h_stats, h_prov = build_item(
            h_progs, h_merged, "History", h_src_label, classe, "EN_GENERAL",
            titre=f"Programme officiel MINESEC — {classe} (EN_GENERAL) — History",
        )
        per_fil_items["EN_GENERAL"].append(h_item)
        per_fil_stats["EN_GENERAL"].append(h_stats)
        unique_imported_src[h_src_label] = h_stats
        history_fusion_summary = {
            "classe": classe,
            "parts": [(lbl, sum(len(m["lecons"]) for m in p["modules"])) for lbl, p, _ in history_parts],
            "imp": h_stats["leconsImport"],
            "provenance": h_prov,
        }

    filiere_totals: dict[str, dict] = {}
    apart_totals: dict[str, dict] = {}
    for f in filieres:
        out_file = import_dir / f"{classe} {f}.json"
        out_file.write_text(json.dumps({"source": DEFAULT_SOURCE, "level": classe, "items": per_fil_items[f]}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        st_list = per_fil_stats[f]
        ext = sum(s["leconsExtraites"] for s in st_list)
        excl = sum(s["exclusions"] for s in st_list)
        fus = sum(s["fusions"] for s in st_list)
        imp = sum(s["leconsImport"] for s in st_list)
        assert imp == ext - excl - fus
        filiere_totals[f] = {"items": len(st_list), "ext": ext, "excl": excl, "fus": fus, "imp": imp}
        print(f"Écrit {out_file.name:30s} : {len(st_list):2d} items, {imp:4d} importées (ext={ext}, excl={excl}, fus={fus}, OK)")

        apart_items = [
            build_item([rp], 0, rp["matiere"], rp["matiere"], classe, f, titre=f"À PART — {classe} ({f}) — {rp['matiere']}", active=False)[0]
            for rp in per_fil_apart[f]
        ]
        apart_file = ne_pas_importer_dir / f"a-part-{classe} {f}.json"
        apart_file.write_text(json.dumps({"source": DEFAULT_SOURCE, "level": classe, "items": apart_items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        apart_totals[f] = {"items": len(apart_items), "lecs": sum(len(it["chapitres"]) for it in apart_items)}

        if generer_essais:
            trial_items = [
                build_item([rp], 0, rp["matiere"], rp["matiere"], classe, f, titre=f"ESSAI NE PAS IMPORTER — {classe} ({f}) — {rp['matiere']}", active=False, chap_prefix="ESSAI NE PAS IMPORTER")[0]
                for rp in per_fil_apart[f]
            ]
            trial_file = ne_pas_importer_dir / f"{classe} essai {f}.json"
            trial_file.write_text(json.dumps({"source": DEFAULT_SOURCE, "level": classe, "items": trial_items}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    u_imp = sum(s["leconsImport"] for s in unique_imported_src.values())
    u_excl = sum(s["exclusions"] for s in unique_imported_src.values())
    u_fus = sum(s["fusions"] for s in unique_imported_src.values())
    assert total_extracted == u_imp + u_excl + u_fus + unique_apart_lecs, (
        f"Mismatch {classe}: {total_extracted} != {u_imp}+{u_excl}+{u_fus}+{unique_apart_lecs}"
    )

    rec = {
        "classe": classe,
        "nbSubjects": len(raw_progs),
        "totalExtracted": total_extracted,
        "uniqueImported": u_imp,
        "uniqueExcluded": u_excl,
        "uniqueMerged": u_fus,
        "putAside": unique_apart_lecs,
        "filiereTotals": filiere_totals,
        "apartTotals": apart_totals,
    }
    return rec, fi_split_summary, history_fusion_summary


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--classes", nargs="+", default=EN_CLASSES)
    parser.add_argument("--correspondance", default=str(OUT_DIR / "correspondance-matieres-en-general.json"))
    parser.add_argument("--apply-corrections", action="store_true")
    parser.add_argument("--generer-essais", action="store_true")
    args = parser.parse_args()

    c1_map, c2_map = load_en_correspondence(Path(args.correspondance))
    corrections: list[dict] = []
    if args.apply_corrections:
        corr_file = OUT_DIR / "corrections.json"
        if corr_file.exists():
            corrections = json.loads(corr_file.read_text(encoding="utf-8")).get("corrections", [])

    import_dir = OUT_DIR / "import"
    ne_pas_importer_dir = import_dir / "ne-pas-importer"
    ne_pas_importer_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now().astimezone().isoformat(timespec="seconds")

    all_recs, fi_splits, hist_fusions = [], [], []
    for cls in args.classes:
        cmap = c2_map if cls in ("LowerSixth", "UpperSixth") else c1_map
        rec, fi_s, h_f = process_en_class(cls, cmap, corrections, args.generer_essais, import_dir, ne_pas_importer_dir)
        all_recs.append(rec)
        if fi_s:
            fi_splits.append(fi_s)
        if h_f:
            hist_fusions.append(h_f)

    write_francais_intensif_split_annex(fi_splits, generated_at, OUT_DIR / "decoupage-francais-intensif.md")
    write_en_history_fusion_annex(hist_fusions, generated_at, OUT_DIR / "fusion-en-history.md")
    write_en_global_recap(all_recs, generated_at, OUT_DIR / "recap-import-en-general.md")
    print(f"Écrit decoupage-francais-intensif.md, fusion-en-history.md et recap-import-en-general.md ({len(all_recs)} classes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

