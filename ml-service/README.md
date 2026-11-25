# ZekoulABia ML Service

Microservice Python (FastAPI) exposant TabPFN v2 en apprentissage-en-contexte, pour la partie
"infrastructure prédictive" du plan (`PLAN_IMPLEMENTATION_CLAUDE_CODE.md`, Partie B).

## Attribution obligatoire

Ce service utilise **TabPFN v2**, sous licence Prior Labs License (Apache 2.0 + attribution
obligatoire). Conformément à cette licence :

> Built with PriorLabs-TabPFN — https://github.com/PriorLabs/TabPFN

Cette mention doit rester visible partout où ce service ou ses résultats sont présentés
(interface admin, documentation, écrans de comparaison). Voir `main.py` (description FastAPI
et `/health`) où elle est déjà exposée.

**Version figée** : ce service utilise explicitement `ModelVersion.V2` (voir
`tabpfn.constants.ModelVersion` dans `main.py`), jamais la version par défaut du paquet
`tabpfn` (TabPFN-3 aujourd'hui, sous licence non-commerciale). Ne jamais retirer ce pin.

## Principe non négociable (plan B.5)

ZekoulABia n'a pas encore de données de résultats réels étiquetés à l'échelle nécessaire pour
valider la fiabilité de TabPFN sur nos cas d'usage. Ce service :

- ne pilote AUCUNE notification, alerte ou décision réelle envoyée à un utilisateur ;
- répond honnêtement `insufficient_context: true` quand moins de `MIN_CONTEXT_SIZE` (10)
  exemples étiquetés sont fournis en contexte, plutôt que d'inventer une prédiction ;
- existe uniquement comme référence comparable à l'adapter à règles
  (`RulesBasedPredictionService`), pour permettre une vraie comparaison future une fois des
  données réelles disponibles.

## Installation

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

## Lancement

```bash
uvicorn main:app --reload --port 8001
```

Vérifier : `GET http://localhost:8001/health`

## Endpoints

- `GET /health`
- `POST /predict/risque-eleve`
- `POST /predict/risque-impaye`
- `POST /predict/orientation`
- `POST /ocr/extract`

Chaque endpoint `/predict/*` attend `query_features` (obligatoire) et, optionnellement,
`context_features`/`context_labels` (exemples déjà étiquetés). Sans contexte suffisant, la
réponse indique `insufficient_context: true` et aucune probabilité n'est calculée.

## OCR local (`/ocr/extract`)

Première étape du pipeline de scan de document (diplôme RH, liste de candidats, cahier de
textes) : extrait le texte brut d'une image via **PaddleOCR** (CPU, aucune dépendance GPU),
localement et gratuitement, avant que le backend Node ne décide s'il envoie ce texte à un LLM
(`openai/gpt-oss-120b`, confiance haute) ou bascule sur un modèle vision Groq (confiance basse).
Voir `backend/src/infrastructure/services/DocumentAiOrchestrator.ts` pour la logique de décision.

Attend `{"image_base64": "..."}` (sans préfixe `data:...`), renvoie `{"text", "confidence",
"lines"}` — `confidence` est la moyenne des confiances par ligne détectée, `0.0` si rien n'a été
détecté (image vide, floue, ou pas de texte). Cet endpoint ne fait AUCUNE interprétation — il
extrait, il ne comprend pas.

**Langue** : `OCR_LANG` (défaut `fr`) — PaddleOCR regroupe plusieurs langues latines proches sous
un même modèle, raisonnable pour le francophone/anglophone camerounais mais pas vérifié
spécifiquement sur des documents 100% anglophones. Ajustable si un besoin réel apparaît.

**Poids du modèle** : téléchargés automatiquement au premier appel de `/ocr/extract` (pas au
démarrage du service) — le tout premier scan sera plus lent le temps du téléchargement, les
appels suivants réutilisent le moteur déjà chargé en mémoire.
