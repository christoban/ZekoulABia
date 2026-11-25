"""Rédaction des rapports, annexes de fusion et récapitulatifs du convertisseur ZekoulABia."""

from __future__ import annotations

from pathlib import Path

CYCLE1_FILIERES = ["FR_GENERAL", "FR_PEBS"]


def write_intensive_english_annex(
    all_fusions: list[dict],
    generated_at: str,
    out_path: Path,
) -> Path:
    """Rédige donnees-extraites/fusion-intensive-english.md pour 6e, 5e, 4e et 3e."""
    lines = [
        "# Annexe de fusion — `Intensive English` (`FR_PEBS`, `6e` → `3e`)",
        "",
        f"- Généré le : {generated_at}",
        "- Décision : **D1** (confiance **élevée**) — dans le PEBS camerounais, `Intensive English` (5h/sem) réunit `Anglais` Langue (3h/sem, piste propre dédoublonnée via `corrections.json`) + `Literature awareness` (2h/sem) en UN seul item `FR_PEBS`.",
        "- **Schéma d'import** : `chapitreImportSchema` (`officialProgressionImport.schema.ts`) n'accepte pas de champ `matiereSource` par chapitre ; la provenance module par module est conservée ici.",
        "- **Numérotation** : `moduleOrdre` continu `1..N` (modules entièrement exclus omis), **aucune renumérotation des leçons** (`leconNumero` et `numeroAffiche` inchangés).",
        "",
        "## Synthèse chiffrée (avant / après)",
        "",
        "| Classe | `Anglais` brut | Exclusions `Anglais` | `Anglais` net | `Literature awareness` | Modules fusion | Total importé | Contrôle |",
        "|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    for f in all_fusions:
        ang_net = f["angExt"] - f["angExcl"]
        ok = "OK" if f["imp"] == ang_net + f["litExt"] else "ERREUR"
        lines.append(
            f"| **{f['classe']}** | {f['angExt']} | {f['angExcl']} | {ang_net} | {f['litExt']} | {len(f['provenance'])} | **{f['imp']}** | `{f['imp']} == {ang_net} + {f['litExt']}` ({ok}) |"
        )

    for f in all_fusions:
        lines.extend(
            [
                "",
                f"## Provenance module par module — `{f['classe']}` (`import/{f['classe']} FR_PEBS.json`)",
                "",
                "| `moduleOrdre` fusion | Matière source | `moduleOrdre` source | Titre du module | Extraites | Exclusions | Importées |",
                "|---:|---|---:|---|---:|---:|---:|",
            ]
        )
        for p in f["provenance"]:
            lines.append(
                f"| {p['moduleOrdreFusion']} | `{p['matiereSource']}` | {p['moduleOrdreSource']} | "
                f"{p['moduleTitre']} | {p['leconsExtraites']} | {p['exclusions']} | {p['leconsImport']} |"
            )
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def write_class_non_converted_report(
    classe: str,
    put_aside: list[dict],
    per_filiere_stats: dict[str, list[dict]],
    class_reconciliation: dict,
    generated_at: str,
    out_path: Path,
) -> Path:
    """Rédige donnees-extraites/non-convertis-<classe>.md avec contrôle de somme global."""
    tot_aside = sum(nc["lecons"] for nc in put_aside)
    lines = [
        f"# Matières mises à part et contrôle chiffré — FR 1er cycle `{classe}`",
        "",
        f"- Généré le : {generated_at}",
        f"- `corrections.json` appliqué : **{'OUI' if class_reconciliation['correctionsApplied'] else 'NON'}** (fichiers bruts intacts).",
        "",
        f"## Matières mises à part (`a-part-{classe} *.json` : {len(put_aside)} matières, {tot_aside} leçons)",
        "",
        "| Libellé source (MINESEC) | Cible catalogue | Modules | Leçons | Raison de mise à part |",
        "|---|---|---:|---:|---|",
    ]
    for nc in put_aside:
        lines.append(
            f"| `{nc['matiere']}` | `{nc['matiereZekoulABia']}` | {nc['modules']} | {nc['lecons']} | {nc['raison']} |"
        )

    lines.extend(["", "## Contrôle chiffré par fichier d'import", ""])
    lines.append("| Fichier | Filière | Items | Extraites | Exclusions | Fusions | Importées | Contrôle |")
    lines.append("|---|---|---:|---:|---:|---:|---:|---|")
    for fil in CYCLE1_FILIERES:
        st_list = per_filiere_stats[fil]
        ext = sum(s["leconsExtraites"] for s in st_list)
        excl = sum(s["exclusions"] for s in st_list)
        fus = sum(s["fusions"] for s in st_list)
        imp = sum(s["leconsImport"] for s in st_list)
        ok = "OK" if imp == ext - excl - fus else "ERREUR"
        lines.append(
            f"| `import/{classe} {fil}.json` | `{fil}` | {len(st_list)} | {ext} | {excl} | {imp if False else fus} | {imp} | `{imp} == {ext} - {excl} - {fus}` ({ok}) |"
        )

    rec = class_reconciliation
    ok_glob = "OK" if rec["totalExtractedFr"] == rec["uniqueImportedFr"] + rec["uniqueExcludedFr"] + rec["uniqueMergedFr"] + rec["putAsideFr"] else "ERREUR"
    lines.extend(
        [
            "",
            "## Somme globale sur la classe (source FR + apports croisés PEBS)",
            "",
            f"- **Source FR `{classe}/programmes.json`** : **{rec['totalExtractedFr']}** leçons extraites sur **{rec['nbSubjectsFr']}** matières.",
            f"  - Importées uniques FR (`FR_GENERAL` ∪ `FR_PEBS`) : **{rec['uniqueImportedFr']}**",
            f"  - Exclues (`corrections.json`) : **{rec['uniqueExcludedFr']}**",
            f"  - Fusionnées (`fusionner_avec_precedente`) : **{rec['uniqueMergedFr']}**",
            f"  - Mises à part (`a-part-{classe} *.json`) : **{rec['putAsideFr']}**",
            f"  - **Égalité globale FR** : `{rec['uniqueImportedFr']} + {rec['uniqueExcludedFr']} + {rec['uniqueMergedFr']} + {rec['putAsideFr']} = {rec['totalExtractedFr']}` (**{ok_glob}**)",
            f"- **Apports croisés PEBS (`{rec['pebsEnClass']}/programmes.json`)** : `Physical Education and Sports` ({rec['pebsPeLecons']} leçons) + `Manual Labour` ({rec['pebsMlLecons']} leçons) = **{rec['pebsPeLecons'] + rec['pebsMlLecons']}** leçons (0 exclusion, 0 fusion) importées dans `import/{classe} FR_PEBS.json`.",
            "",
            "## Fichiers à part et dry-run (ne pas importer en production)",
            "",
            f"- `import/ne-pas-importer/a-part-{classe} FR_GENERAL.json` et `import/ne-pas-importer/a-part-{classe} FR_PEBS.json` : {len(put_aside)} items ({tot_aside} leçons).",
            f"- `import/ne-pas-importer/{classe} essai FR_GENERAL.json` et `import/ne-pas-importer/{classe} essai FR_PEBS.json` : mêmes {len(put_aside)} items préfixés `ESSAI NE PAS IMPORTER` (dry-run uniquement).",
            "",
        ]
    )
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def write_global_recap(
    all_recs: list[dict],
    generated_at: str,
    out_path: Path,
) -> Path:
    """Rédige donnees-extraites/recap-import-fr-premier-cycle.md pour 6e–3e."""
    lines = [
        "# Récapitulatif chiffré d'import — Premier cycle FR (`6e` → `3e`)",
        "",
        f"- Généré le : {generated_at}",
        "",
        "## 1. Somme globale par classe (source FR : `extraites = importées + exclues + fusionnées + mises à part`)",
        "",
        "| Classe | Matières FR | Extraites FR | Importées uniques FR | Exclues | Fusionnées | Mises à part | Vérification | Apport PEBS (Form1–4) |",
        "|---|---:|---:|---:|---:|---:|---:|---|---:|",
    ]
    tot = {"sub": 0, "ext": 0, "imp": 0, "excl": 0, "fus": 0, "aside": 0, "pebs_en": 0}
    for r in all_recs:
        s = r["uniqueImportedFr"] + r["uniqueExcludedFr"] + r["uniqueMergedFr"] + r["putAsideFr"]
        ok = "OK" if s == r["totalExtractedFr"] else "ERREUR"
        pebs_en = r["pebsPeLecons"] + r["pebsMlLecons"]
        lines.append(
            f"| **{r['classe']}** | {r['nbSubjectsFr']} | {r['totalExtractedFr']} | {r['uniqueImportedFr']} | "
            f"{r['uniqueExcludedFr']} | {r['uniqueMergedFr']} | {r['putAsideFr']} | `{s} == {r['totalExtractedFr']}` ({ok}) | +{pebs_en} |"
        )
        tot["sub"] += r["nbSubjectsFr"]
        tot["ext"] += r["totalExtractedFr"]
        tot["imp"] += r["uniqueImportedFr"]
        tot["excl"] += r["uniqueExcludedFr"]
        tot["fus"] += r["uniqueMergedFr"]
        tot["aside"] += r["putAsideFr"]
        tot["pebs_en"] += pebs_en

    ok_t = "OK" if tot["imp"] + tot["excl"] + tot["fus"] + tot["aside"] == tot["ext"] else "ERREUR"
    lines.append(
        f"| **TOTAL** | **{tot['sub']}** | **{tot['ext']}** | **{tot['imp']}** | **{tot['excl']}** | **{tot['fus']}** | **{tot['aside']}** | **`{tot['ext']}` ({ok_t})** | **+{tot['pebs_en']}** |"
    )

    lines.extend(
        [
            "",
            "## 2. Détail par fichier d'import `(niveau, filière)`",
            "",
            "| Fichier d'import | Items | Extraites | Exclues | Fusionnées | Importées | `a-part` (items / leçons) |",
            "|---|---:|---:|---:|---:|---:|---|",
        ]
    )
    for r in all_recs:
        for fil in CYCLE1_FILIERES:
            fs = r["filiereTotals"][fil]
            lines.append(
                f"| `import/{r['classe']} {fil}.json` | {fs['items']} | {fs['ext']} | {fs['excl']} | {fs['fus']} | **{fs['imp']}** | {r['nbPutAside']} / {r['putAsideFr']} |"
            )
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path
