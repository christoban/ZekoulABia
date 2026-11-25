# Spike comparatif — Moteur de rendu de bulletins (Étape 3)

## 1. Critères d'acceptation fixés AVANT mesure

Le choix entre **Playwright (Chromium HTML/CSS → PDF)** et **PDFKit à blocs mesurés (polices TTF embarquées)** est tranché à partir d'un benchmark reproductible sur **une classe complète de 60 élèves** comportant **18 matières réparties en 3 groupes** et des **appréciations longues de 320+ caractères**, selon les 4 critères obligatoires :

| Critère | Seuil exigé avant mesure | Mode de vérification |
|---|---|---|
| **1. Débit (classe de 60 élèves)** | `< 180 s` (moins de 3 minutes pour 60 bulletins complets) | Chronomètre réel (`performance.now()`) sur la boucle de 60 rendus |
| **2. Empreinte RAM** | Compatible avec le conteneur backend actuel (`delta RSS < 150 Mo` en processus serveur, sans dépendre d'un sidecar Chromium de 250–350 Mo si évitable) | Mesure `process.memoryUsage().rss` avant/pic/après + RSS des processus Chromium enfants le cas échéant |
| **3. Zéro chevauchement** | **0 collision verticale** sur tableaux à **18–22 matières** et appréciations de **320+ caractères** | Hauteur de chaque ligne mesurée avant dessin (`heightOfString` PDFKit / layout flux HTML CSS) + assertion automatique |
| **4. Lisibilité Noir & Blanc (niveaux de gris)** | **100 % compréhensible sans couleur** ; aucune information portée uniquement par la teinte | Polices TTF `LiberationSans` embarquées, cotes textuelles (`A+` / `A` / `ECA` / `NA`), trames et bordures contrastées |

---

## 2. Protocole de mesure

- Échantillon : 60 `StudentBulletinSnapshot` réalistes (18 matières × 3 groupes + profil de classe + décision du conseil + conduite avec heures à `null` affichées `"—"` + QR code PNG).
- Candidat A : `MeasuredPdfKitBulletinRenderer` (PDFKit + polices TTF `/usr/share/fonts/liberation-sans-fonts/LiberationSans-*.ttf`, calcul de hauteur avant dessin).
- Candidat B : Playwright Chromium (`playwright`, réutilisation d'une instance `browser` unique sur 60 pages A4 HTML/CSS).

---

## 3. Mesures réelles observées (classe de 60 élèves, 18 matières × 3 groupes, commentaires 320+ caractères)

Mesures exécutées sur la machine locale Linux (Bun + `pdfkit` vs `playwright` `chromium-1228` avec `args: ['--no-sandbox', '--disable-dev-shm-usage']` sur instance unique réutilisée pour les 60 pages) :

| Critère mesuré | Seuil exigé | `MeasuredPdfKitBulletinRenderer` (PDFKit + TTF) | `PlaywrightChromium` (`chromium-1228`) |
|---|---|---|---|
| **Temps total (60 bulletins)** | `< 180 s` | **`8 609 ms` (8,61 s)** | **`4 633 ms` (4,63 s)** (`892 ms` launch + `3 741 ms` render) |
| **Cadence moyenne** | — | `143,5 ms / bulletin` | `62,3 ms / bulletin` |
| **Empreinte RAM** | Compatible conteneur (`delta < 150 Mo`) | RSS Bun `167,5 → 238,6 Mo` (**`+71,1 Mo`**) | Arbre de processus Chromium pic **`1 230,9 Mo` (~1,23 Go)** |
| **Taille moyenne d'un PDF** | — | `49,7 Ko` | `28,4 Ko` |
| **Exécution en sandbox / conteneur restreint** | Doit tourner sans privilège spécial | **OK en sandbox strict** (0 binaire externe, polices TTF standard) | **Échec en sandbox strict** (`SIGTRAP` sur `chrome_crashpad_handler --database`) |
| **Zéro chevauchement (18 matières, 320+ car.)** | **0 collision** | Garanti par `measureRowHeight()` avant dessin + pagination propre | Géré par flux HTML table |
| **Lisibilité niveaux de gris** | **100 % lisible sans couleur** | Polices `LiberationSans` TTF embarquées, bordures nettes, cotes textuelles | CSS monochrome respecté |

---

## 4. Décision d'architecture

**Moteur retenu par défaut : `MeasuredPdfKitBulletinRenderer` derrière l'interface `BulletinRendererPort`.**

Justification factuelle à partir du spike :
1. **Mémoire & stabilité conteneur** : bien que Playwright soit 1,86× plus rapide en temps brut (`4,63 s` vs `8,61 s`), son arbre de processus Chromium consomme **`1 230,9 Mo` RSS** en pic sur 60 bulletins — soit **17× le delta mémoire de PDFKit (`+71,1 Mo`)** et largement au-delà d'un budget conteneur backend classique (risque critique d'OOMKill lors de générations parallèles ou sur instance modeste), en plus de nécessiter des flags/privilèges (`chrome_crashpad_handler` / `--no-sandbox`) fragiles en environnement durci.
2. **Marge de débit très confortable** : `MeasuredPdfKitBulletinRenderer` génère 60 bulletins complexes en **8,61 secondes** (marge de **> 20×** par rapport au seuil de 3 minutes / 180 s), tout en restant 100 % stateless en pur TypeScript/PDFKit.
3. **Qualité typographique & zéro chevauchement** : l'embarquement des polices TrueType `LiberationSans` (`Regular`, `Bold`, `Italic`) couvre intégralement les diacritiques français (`é, è, ê, à, ç, œ`) et chaque bloc (`studentCard`, lignes de matières à commentaires 320+ caractères, `classProfile`, `councilDecision`, `conductSummary` avec heures à `null` affichées `"—"`, QR code `/verify`) mesure sa hauteur réelle avant écriture.
4. **Réversibilité garantie par l'architecture hexagonale** : tout l'atelier dépend uniquement de `BulletinRendererPort.render(snapshot, templateSpec, options)` et du contrat déclaratif `BulletinTemplateSpec`. Si un besoin futur impose un rendu HTML/CSS dédié sur serveur dimensionné, un adaptateur `HtmlChromiumBulletinRenderer` pourra être branché sans modifier le domaine ni les cas d'usage.
