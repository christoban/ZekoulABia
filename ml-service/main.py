"""
ZekoulABia — Microservice de prédiction (Infrastructure prédictive, Partie B du plan)

Ce service expose TabPFN v2 (Prior Labs License — Apache 2.0 + attribution obligatoire) en
apprentissage-en-contexte : il ne "connaît" rien a priori, il reçoit à chaque requête un
contexte d'exemples déjà étiquetés (context_features/context_labels) et prédit à partir de ce
contexte pour les nouvelles observations (query_features). Sans contexte suffisant, il répond
honnêtement "insufficient_context" plutôt que d'inventer une prédiction — conforme au principe
non négociable du plan (B.5) : ce jeu de données réel n'existe pas encore à l'échelle nécessaire
chez ZekoulABia, donc ce service reste isolé de toute décision réelle tant que ce n'est pas le cas.

Version du modèle EXPLICITEMENT figée sur V2 — jamais la version par défaut du paquet `tabpfn`
(qui installe aujourd'hui TabPFN-3, sous licence non-commerciale). Voir LICENSE_NOTICE.md.

Ce service ne touche JAMAIS de base de données — entièrement sans état, aucun accès disque
persistant, aucune écriture nulle part.
"""
import base64
import io
import os
from typing import List, Optional

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field
from tabpfn import TabPFNClassifier
from tabpfn.constants import ModelVersion

MODEL_VERSION = ModelVersion.V2
MIN_CONTEXT_SIZE = 10  # en dessous, l'apprentissage en contexte n'est pas jugé assez fiable

# OCR_LANG="fr" couvre par défaut un groupe de langues latines proches (le regroupement PP-OCR
# n'est pas un modèle par langue unique) — raisonnable pour un établissement francophone ou
# anglophone camerounais, mais pas vérifié spécifiquement sur des documents 100% anglophones.
# Configurable par variable d'environnement si un besoin réel apparaît (ex. OCR_LANG=en).
OCR_LANG = os.environ.get("OCR_LANG", "fr")

app = FastAPI(
    title="ZekoulABia ML Service",
    description="Built with PriorLabs-TabPFN — https://github.com/PriorLabs/TabPFN",
    version="0.1.0",
)


class PredictionRequest(BaseModel):
    context_features: Optional[List[List[float]]] = Field(
        default=None, description="Vecteurs de features des exemples déjà étiquetés (X_train)"
    )
    context_labels: Optional[List[str]] = Field(
        default=None, description="Labels connus correspondants (y_train) — classes en chaîne"
    )
    query_features: List[List[float]] = Field(
        description="Vecteurs de features des observations à prédire (X_test)"
    )


class PredictionResponse(BaseModel):
    insufficient_context: bool
    context_size: int
    model_version: str
    # class_probabilities[i] = { "CLASSE_A": 0.2, "CLASSE_B": 0.8, ... } pour query_features[i]
    class_probabilities: Optional[List[dict]] = None


def _predire(req: PredictionRequest) -> PredictionResponse:
    context_size = len(req.context_labels) if req.context_labels else 0

    if context_size < MIN_CONTEXT_SIZE or not req.context_features:
        return PredictionResponse(
            insufficient_context=True,
            context_size=context_size,
            model_version=str(MODEL_VERSION),
            class_probabilities=None,
        )

    model = TabPFNClassifier.create_default_for_version(MODEL_VERSION)
    x_train = np.array(req.context_features)
    y_train = np.array(req.context_labels)
    x_test = np.array(req.query_features)

    model.fit(x_train, y_train)
    probabilities = model.predict_proba(x_test)
    classes = model.classes_

    class_probabilities = [
        {str(cls): float(proba) for cls, proba in zip(classes, row)}
        for row in probabilities
    ]

    return PredictionResponse(
        insufficient_context=False,
        context_size=context_size,
        model_version=str(MODEL_VERSION),
        class_probabilities=class_probabilities,
    )


@app.get("/health")
def health():
    return {"status": "ok", "model_version": str(MODEL_VERSION), "attribution": "Built with PriorLabs-TabPFN"}


@app.post("/predict/risque-eleve", response_model=PredictionResponse)
def predict_risque_eleve(req: PredictionRequest):
    return _predire(req)


@app.post("/predict/risque-impaye", response_model=PredictionResponse)
def predict_risque_impaye(req: PredictionRequest):
    return _predire(req)


@app.post("/predict/orientation", response_model=PredictionResponse)
def predict_orientation(req: PredictionRequest):
    # Secondaire tant que la Partie A avance avec son propre moteur de règles (voir plan B.6.3) —
    # exposé ici pour la cohérence de l'interface, pas pour piloter une vraie recommandation.
    return _predire(req)


# ─── OCR local (Partie C — pipeline de scan de document) ──────────────────────────────────────
# Première étape d'un scan de document texte (bulletin, liste, diplôme, cahier) : extraire le
# texte brut localement, gratuitement, avant de décider si un modèle Groq est nécessaire pour
# structurer le résultat, et lequel. Voir DocumentAiOrchestrator.ts côté backend Node pour la
# logique de décision (confiance haute → texte seul vers un LLM ; confiance basse → modèle
# vision). Ce endpoint ne fait QUE de l'extraction, aucune interprétation — cohérent avec le
# principe déjà appliqué à TabPFN plus haut : chaque brique fait une seule chose honnêtement.

_ocr_engine = None  # chargé paresseusement — le chargement des poids du modèle est coûteux,
                    # on ne veut pas payer ce coût au démarrage si l'OCR n'est jamais appelé.


def _obtenir_moteur_ocr():
    global _ocr_engine
    if _ocr_engine is None:
        from paddleocr import PaddleOCR
        # enable_mkldnn=False : contournement d'un bug connu et toujours ouvert de PaddlePaddle
        # 3.3.x sur l'exécuteur oneDNN/PIR ("ConvertPirAttribute2RuntimeAttribute not support"),
        # qui fait planter TOUTE inférence CPU sans ce paramètre — vérifié en conditions réelles
        # sur cette machine (paddlepaddle 3.3.1, paddleocr 3.7.0). Voir PaddlePaddle/Paddle#77340.
        # use_angle_cls (API 2.x) est devenu use_textline_orientation en 3.x ; show_log a disparu.
        _ocr_engine = PaddleOCR(use_textline_orientation=True, lang=OCR_LANG, enable_mkldnn=False)
    return _ocr_engine


class OcrRequest(BaseModel):
    image_base64: str = Field(description="Image encodée en base64, sans préfixe data:...")


class OcrLine(BaseModel):
    text: str
    confidence: float


class OcrResponse(BaseModel):
    text: str  # texte complet, une ligne détectée par ligne de sortie
    confidence: float  # moyenne des confiances par ligne — 0.0 si aucun texte détecté
    lines: List[OcrLine]


@app.post("/ocr/extract", response_model=OcrResponse)
def ocr_extract(req: OcrRequest):
    from PIL import Image

    try:
        image_bytes = base64.b64decode(req.image_base64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_array = np.array(image)
    except Exception:
        # Image illisible (base64 corrompu, format non supporté) — pas une erreur serveur,
        # l'appelant décidera de basculer directement sur le modèle vision.
        return OcrResponse(text="", confidence=0.0, lines=[])

    moteur = _obtenir_moteur_ocr()
    # .predict() (pas .ocr(), dépréciée en 3.x) renvoie une liste d'OCRResult (un par page/image
    # — toujours une seule entrée ici, une image à la fois). rec_texts/rec_scores sont deux listes
    # parallèles, pas des tuples imbriqués comme en 2.x — format vérifié en conditions réelles.
    resultats = list(moteur.predict(image_array))

    lignes: List[OcrLine] = []
    for page in resultats:
        textes = page.get("rec_texts", [])
        scores = page.get("rec_scores", [])
        for texte, confiance in zip(textes, scores):
            lignes.append(OcrLine(text=texte, confidence=float(confiance)))

    texte_complet = "\n".join(l.text for l in lignes)
    confiance_moyenne = (sum(l.confidence for l in lignes) / len(lignes)) if lignes else 0.0

    return OcrResponse(text=texte_complet, confidence=confiance_moyenne, lines=lignes)
