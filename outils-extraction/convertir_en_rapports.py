"""Rédaction des annexes et récapitulatifs pour le général anglophone (Form1 -> UpperSixth)."""

from __future__ import annotations

from pathlib import Path


def write_francais_intensif_split_annex(
    splits: list[dict],
    generated_at: str,
    out_path: Path,
) -> Path:
    lines = [
        "# Annexe de découpage — `Francais Intensif` (`EN_PEBS`, `Form1` → `Form5`)",
        "",
        f"- Généré le : {generated_at}",
        "- Décision : **D9** (confiance **moyenne**) — `AnglophoneSubjectLoad` (`secondary.ts` L44–45) sépare `Français intensif (Langue)` et `Français intensif (Littérature)`, tandis que MINESEC regroupe les deux volets dans `Francais Intensif`.",
        "- **Critère déterministe (zéro perte)** : toute leçon dont le titre contient explicitement `initiation à la littérature` ou `lecture suivie` va dans `Français intensif (Littérature)` ; toutes les autres leçons (grammaire, vocabulaire, conjugaison, orthographe, expression orale/écrite, lecture, traduction, révision) vont dans `Français intensif (Langue)`.",
        "- **Numérotation** : les 5 modules thématiques (`moduleOrdre` 1..5) et les numéros de leçons d'origine sont conservés tels quels (aucune renumérotation).",
        "",
        "## Contrôle de somme par classe (`Langue + Littérature == Total`)",
        "",
        "| Classe | Extraites (`Francais Intensif`) | `Français intensif (Langue)` | `Français intensif (Littérature)` | Somme | Contrôle |",
        "|---|---:|---:|---:|---:|---|",
    ]
    for s in splits:
        tot = s["lang"] + s["lit"]
        ok = "OK" if tot == s["raw"] else "ERREUR"
        lines.append(f"| **{s['classe']}** | {s['raw']} | {s['lang']} | {s['lit']} | {tot} | `{tot} == {s['raw']}` ({ok}) |")
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def write_en_history_fusion_annex(
    fusions: list[dict],
    generated_at: str,
    out_path: Path,
) -> Path:
    lines = [
        "# Annexe de fusion — `History` (`EN_GENERAL`, `LowerSixth` & `UpperSixth`)",
        "",
        f"- Généré le : {generated_at}",
        "- Décision : **D12** (confiance **moyenne**) — `AnglophoneSubjectLoad` (`secondary.ts` L25) et `A_LEVEL_CODES` (`9091`) déclarent une matière unique `History`, alors que MINESEC sépare les volets du GCE A-Level (`Cameroon history`, `African history`, `World history`).",
        "- **Numérotation** : `moduleOrdre` continu `1..N`, aucune renumérotation des leçons.",
        "",
        "## Synthèse chiffrée",
        "",
        "| Classe | Sources fusionnées | Modules | Leçons importées | Contrôle |",
        "|---|---|---:|---:|---|",
    ]
    for f in fusions:
        srcs = " + ".join(f"`{k}` ({v})" for k, v in f["parts"])
        tot = sum(v for _, v in f["parts"])
        ok = "OK" if tot == f["imp"] else "ERREUR"
        lines.append(f"| **{f['classe']}** | {srcs} | {len(f['provenance'])} | **{f['imp']}** | `{f['imp']} == {tot}` ({ok}) |")

    for f in fusions:
        lines.extend([
            "",
            f"## Provenance module par module — `{f['classe']}` (`import/{f['classe']} EN_GENERAL.json`)",
            "",
            "| `moduleOrdre` fusion | Matière source | `moduleOrdre` source | Titre du module | Leçons |",
            "|---:|---|---:|---|---:|",
        ])
        for p in f["provenance"]:
            lines.append(f"| {p['moduleOrdreFusion']} | `{p['matiereSource']}` | {p['moduleOrdreSource']} | {p['moduleTitre']} | {p['leconsImport']} |")
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path


def write_en_global_recap(
    all_recs: list[dict],
    generated_at: str,
    out_path: Path,
) -> Path:
    lines = [
        "# Récapitulatif chiffré d'import — Général anglophone (`Form1` → `UpperSixth`)",
        "",
        f"- Généré le : {generated_at}",
        "- Catalogue vérifié : `AnglophoneSubjectLoad` (`secondary.ts` : `EN_GENERAL` Form1–UpperSixth, `EN_PEBS` Form1–Form5).",
        "- Fichiers prêts à l'import : `donnees-extraites/import/` (12 fichiers EN) ; fichiers mis à part & dry-run : `donnees-extraites/import/ne-pas-importer/`.",
        "",
        "## 1. Somme globale par classe (`extraites = importées uniques + exclues + fusionnées + mises à part`)",
        "",
        "| Classe | Matières | Extraites | Importées uniques | Exclues | Fusionnées | Mises à part | Vérification |",
        "|---|---:|---:|---:|---:|---:|---:|---|",
    ]
    tot = {"sub": 0, "ext": 0, "imp": 0, "excl": 0, "fus": 0, "aside": 0}
    for r in all_recs:
        s = r["uniqueImported"] + r["uniqueExcluded"] + r["uniqueMerged"] + r["putAside"]
        ok = "OK" if s == r["totalExtracted"] else "ERREUR"
        lines.append(
            f"| **{r['classe']}** | {r['nbSubjects']} | {r['totalExtracted']} | {r['uniqueImported']} | "
            f"{r['uniqueExcluded']} | {r['uniqueMerged']} | {r['putAside']} | `{s} == {r['totalExtracted']}` ({ok}) |"
        )
        tot["sub"] += r["nbSubjects"]
        tot["ext"] += r["totalExtracted"]
        tot["imp"] += r["uniqueImported"]
        tot["excl"] += r["uniqueExcluded"]
        tot["fus"] += r["uniqueMerged"]
        tot["aside"] += r["putAside"]

    ok_t = "OK" if tot["imp"] + tot["excl"] + tot["fus"] + tot["aside"] == tot["ext"] else "ERREUR"
    lines.append(
        f"| **TOTAL** | **{tot['sub']}** | **{tot['ext']}** | **{tot['imp']}** | **{tot['excl']}** | **{tot['fus']}** | **{tot['aside']}** | **`{tot['ext']}` ({ok_t})** |"
    )

    lines.extend([
        "",
        "## 2. Détail par fichier `(niveau, filière)`",
        "",
        "| Fichier d'import (`import/`) | Filière | Items | Extraites | Exclues | Fusionnées | Importées | `ne-pas-importer/a-part-*` (items / leçons) |",
        "|---|---|---:|---:|---:|---:|---:|---|",
    ])
    for r in all_recs:
        for fil, fs in r["filiereTotals"].items():
            ap = r["apartTotals"][fil]
            lines.append(
                f"| `{r['classe']} {fil}.json` | `{fil}` | {fs['items']} | {fs['ext']} | {fs['excl']} | {fs['fus']} | **{fs['imp']}** | {ap['items']} / {ap['lecs']} |"
            )

    lines.extend([
        "",
        "## 3. Erreurs source explicitement isolées dans `ne-pas-importer/`",
        "",
        "- `LowerSixth` · `English` (200 leçons) : contenu intégralement en français (copie exacte de `Francais Intensif` / `French`).",
        "- `UpperSixth` · `English` (144 leçons) : contenu intégralement en français (copie exacte de `Francais Intensif`).",
        "- `Form4` · `Informatique` (21 leçons) : programme francophone (`UA1`–`UA10`) publié par erreur à côté de `Computer Science`.",
        "",
    ])
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path

