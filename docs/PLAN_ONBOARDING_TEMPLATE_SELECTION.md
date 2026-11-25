# Plan ultra détaillé — sélection libre des templates dans l’onboarding

## 1. Objectif

Permettre à l’utilisateur de sélectionner explicitement n’importe quel template supporté par le système, sans être prisonnier de la détection automatique actuelle, tout en gardant un parcours guidé par catégories et un filtrage métier cohérent.

Le but final est :
- aucun template “imposé” par la simple heuristique du nom ou du sous-système,
- un parcours qui guide, filtre, et laisse l’utilisateur choisir librement,
- un comportement conforme à l’architecture hexagonale du backend déjà en place.

---

## 2. Règle de périmètre : ce qui est demandé, et ce qui ne l’est pas

### Ce qui est demandé

- refonte du parcours onboarding pour qu’il propose les templates disponibles selon les catégories réelles du système,
- sélection explicite du template final,
- préselection guidée par détection uniquement comme suggestion, jamais comme contrainte,
- validation backend du template choisi,
- compatibilité avec les templates déjà reconnus par le backend : primaire, secondaire, technique, professionnel, bilingue, anglophone, complexe, etc.

### Ce qu’il ne faut pas faire

- ne pas créer une liste brute de tous les templates sans filtre dans une seule étape,
- ne pas supprimer ni réécrire la logique de détection métier déjà utile,
- ne pas injecter de `any` / `as any` pour contourner les types,
- ne pas mélanger logique métier dans le composant UI,
- ne pas toucher au moteur d’activation backend pour reconstituer une logique qui ne fait pas partie du périmètre, sauf pour validation terminale.

---

## 3. Analyse préalable obligatoire (fichiers réels à lire avant d’agir)

### 3.1 Backend — vrai référentiel de templates

À lire en priorité :
- [backend/src/application/school/schoolTemplateConfig.ts](../backend/src/application/school/schoolTemplateConfig.ts) — référentiel métier principal du backend
- [backend/src/application/school/ActiverEtablissementUseCase.ts](../backend/src/application/school/ActiverEtablissementUseCase.ts) — le template est utilisé pour activer l’établissement
- [backend/src/application/school/activation/activationClasses.ts](../backend/src/application/school/activation/activationClasses.ts) — génération de classes selon le template
- [backend/src/application/school/activation/activationSecondary.ts](../backend/src/application/school/activation/activationSecondary.ts) — logique de matières / coefficients pour les templates secondaires
- [backend/src/application/school/curriculum/francophone/premier-cycle.ts](../backend/src/application/school/curriculum/francophone/premier-cycle.ts)
- [backend/src/application/school/curriculum/francophone/technique.ts](../backend/src/application/school/curriculum/francophone/technique.ts)
- [backend/src/application/school/curriculum/francophone/primaire.ts](../backend/src/application/school/curriculum/francophone/primaire.ts)
- [backend/src/application/school/curriculum/anglophone/secondary.ts](../backend/src/application/school/curriculum/anglophone/secondary.ts)
- [backend/src/application/school/curriculum/anglophone/technical.ts](../backend/src/application/school/curriculum/anglophone/technical.ts)

### 3.2 Frontend — point de rupture actuel

À lire en priorité :
- [frontend/src/app/onboarding/[token]/page.tsx](../frontend/src/app/onboarding/[token]/page.tsx) — composant principal de l’onboarding
- [frontend/AGENTS.md](../frontend/AGENTS.md) — règle de structure frontend
- [AGENTS.md](../AGENTS.md) — règles générales du repo
- [CONVENTIONS.md](../CONVENTIONS.md) — conventions coding + i18n + architecture
- [ARCHITECTURE.md](../ARCHITECTURE.md) — architecture globale

### 3.3 Ce que l’analyse montre

Le backend contient déjà la vérité métier :
- `templateCode`
- `isPrimaire`
- `isTechnique`
- `isAnglophone`
- `langMode`
- cas `COMPLEXE_SCOLAIRE`
- cas `LYCEE_BILINGUE`, `PRIMARY_BILINGUAL`, `SAR_SM`, `CFM`, `GTC_GTHS_EN`, etc.

Le frontend ne reflète pas cette richesse parce qu’il porte sa propre copie locale avec un `TEMPLATE_META` hardcodé dans `onboarding/[token]/page.tsx`. Ce catalogue local est incomplet et opère sous forme de détection automatique, pas de sélection métier explicite.

---

## 4. Les règles d’architecture à respecter absolument

### 4.1 Règles AGENTS.md

A respecter sans discussion :
- ne pas dépasser le périmètre demandé,
- ne pas refactorer sans nécessité,
- ne pas utiliser `as any`,
- ne pas inventer un nouveau modèle au mauvais endroit,
- garder la logique métier backend dans le backend,
- faire preuve de vérification avant d’affirmer les tests passés,
- respecter le format de plan et la vérification `tsc` / smoke test.

### 4.2 Règles hexagonales

- le backend reste source de vérité métier,
- le frontend ne doit pas réimplémenter une logique métier propre en dur,
- le controller HTTP ne doit pas contenir la logique métier,
- le use case doit rester l’endroit d’orchestration des règles métiers,
- le repository et les services restent derrière des ports/interfaces,
- la sélection de template doit être validée côté backend, pas seulement côté frontend.

### 4.3 Règles de typage

Le code ne doit pas masquer des erreurs avec de gros types `any`.

Exemples interdits :

```ts
const data: any = await response.json();
const config = payload as any;
```

À la place, utiliser :
- types explicites,
- interfaces dédiées,
- unions discrètes,
- validation Zod si besoin,
- `unknown` puis garde-fou typé.

Exemple sûr :

```ts
type TemplateCatalogResponse = {
  success: boolean;
  data: {
    templates: TemplateOption[];
  };
};

interface TemplateOption {
  code: string;
  name: string;
  subsystem: 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL';
  educationType: 'GENERAL' | 'TECHNICAL' | 'PROFESSIONAL' | 'MIXED';
  level: 'PRIMARY' | 'SECONDARY' | 'COMPLEX';
  isPrimaire: boolean;
  isTechnique: boolean;
  isComplexe: boolean;
}
```

### 4.4 Règle de tests

Avant de déclarer la tâche terminée, il faut :
- `cd backend && ./node_modules/.bin/tsc --noEmit`
- éventuellement `cd frontend && ./node_modules/.bin/tsc --noEmit` si on touche le frontend
- et un smoke test ciblé si besoin
- plus un test fonctionnel d’intégration ou un test unitaire sur le parcours de template sélectionné

---

## 5. Cause racine exacte du bug

### 5.1 La page onboarding n’est pas alimentée par le catalogue métier réel

Dans [frontend/src/app/onboarding/[token]/page.tsx](../frontend/src/app/onboarding/[token]/page.tsx), on trouve :

```ts
const TEMPLATE_META: Record<string, DetectedTemplate> = { ... }

function detectTemplate(form: FormData): DetectedTemplate | null { ... }

const template = forcedTemplateCode
  ? (TEMPLATE_META[forcedTemplateCode] ?? detectTemplate(form))
  : detectTemplate(form)
```

Cette logique crée une redondance inutile :
- le frontend re-définit les templates,
- la logique de détection décide au lieu de l’utilisateur,
- les autres templates du backend sont alors invisibles à l’UI.

### 5.2 Ce qui bloque en pratique

On a des conditions comme :
- `subsystem === 'FRANCOPHONE' && educationType === 'GENERAL' && ownership === 'PUBLIC'`
- puis on la branche vers “CES ou Lycée”
- ou bien vers “GHS ou GSS”

Cela n’est pas un choix libre de template ; c’est une déduction poussée.

Le vrai besoin métier est :
- le système doit proposer les templates valides selon les catégories,
- mais l’utilisateur doit pouvoir choisir un autre template valide si besoin.

---

## 6. Architecture cible proposée

### 6.1 Source unique de vérité côté backend

Le backend doit exposer un catalogue de templates sous un format stable.

Le plus simple est un endpoint dédié :

```ts
GET /api/v2/onboarding/template-catalog
```

Réponse attendue :

```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "code": "LYCEE_FR",
        "name": "Lycée Général Francophone",
        "subsystem": "FRANCOPHONE",
        "educationType": "GENERAL",
        "level": "SECONDARY",
        "ownership": ["PUBLIC", "PRIVATE_SECULAR", "PRIVATE_FAITH"],
        "isPrimaire": false,
        "isTechnique": false,
        "isProfessionnel": false,
        "isComplexe": false,
        "isGroupSchool": false
      }
    ]
  }
}
```

### 6.2 Frontend — parcours guidé + override manuel

Le frontend ne doit plus faire :
- “je pars de detectTemplate() et j’impose ça”

Il doit faire :
- “je charge le catalogue backend”
- “je filtre selon les réponses de l’utilisateur”
- “j’affiche les templates cohérents”
- “je garde la détection comme suggestion par défaut”
- “l’utilisateur peut cliquer sur n’importe quel template proposé”

### 6.3 State du composant

L’état exact recommandé :

```ts
interface OnboardingTemplateSelectionState {
  detectedTemplateCode: string | null;
  selectedTemplateCode: string | null;
  templateCatalog: TemplateOption[];
  filters: {
    isGroupSchool: boolean | null;
    subsystem: 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL' | null;
    educationType: 'GENERAL' | 'TECHNICAL' | 'PROFESSIONAL' | 'MIXED' | null;
    level: 'PRIMARY' | 'SECONDARY' | 'COMPLEX' | null;
    ownership: 'PUBLIC' | 'PRIVATE_SECULAR' | 'PRIVATE_FAITH' | null;
  };
}
```

Important :
- `detectedTemplateCode` n’est qu’une suggestion,
- `selectedTemplateCode` est le vrai choix utilisateur,
- si l’utilisateur modifie son choix, on remplace la suggestion sans verrou.

---

## 7. UX métier cible détaillée

### Étape 1 — Groupe scolaire ?

Question :
- Est-ce un groupe scolaire ?

Choix :
- Oui
- Non

Effet :
- si “Oui”, le parcours affiche des options de type `COMPLEXE_SCOLAIRE`, éventuellement mixte, multi-cycle
- si “Non”, on reste dans les templates standard

### Étape 2 — Sous-système

Choix :
- Francophone
- Anglophone
- Bilingue

Important :
- les templates d’un sous-système ne doivent pas être visibles pour un autre sous-système, sauf cas de `LYCEE_BILINGUE`, `PRIMARY_BILINGUAL` ou `COMPLEXE_SCOLAIRE` explicitement maîtrisés.

### Étape 3 — Type d’enseignement

Choix :
- Général
- Technique
- Professionnel
- Mixte

Effet :
- Général → `LYCEE_FR`, `CES_FR`, `GHS_EN`, `GSS_EN`, etc.
- Technique → `LYCEE_TECHNIQUE_FR`, `CETIC`, `GTC_GTHS_EN`, `GTC_EN`
- Professionnel → `SAR_SM`, `CFM`
- Mixte/complexe → `COMPLEXE_SCOLAIRE`

### Étape 4 — Niveau / cycle

Choix :
- Primaire
- Secondaire
- Complexe

Effet :
- Primaire → `PRIMAIRE_FR`, `MATERNELLE_FR`, `PRIMARY_EN`, `NURSERY_EN`, `PRIMARY_BILINGUAL` etc.
- Secondaire → `LYCEE_FR`, `CES_FR`, `GHS_EN`, `GSS_EN`, `PRIVE_EN`, `LYCEE_BILINGUE` etc.
- Complexe → `COMPLEXE_SCOLAIRE`

### Étape 5 — Statut / propriété

Choix :
- Public
- Privé
- Confessionnel / autre (si supporté)

Effet :
- certains templates ne sont disponibles que dans certains statuts
- ce filtre doit être calculé à partir du catalogue backend

### Étape 6 — Sélection finale du template

Affichage d’une liste claire :
- nom
- code
- description courte
- sous-système / niveau / type

Exemple visuel attendu :

```tsx
{filteredTemplates.map((template) => (
  <button
    key={template.code}
    type="button"
    onClick={() => setSelectedTemplateCode(template.code)}
    aria-pressed={selectedTemplateCode === template.code}
  >
    <strong>{template.name}</strong>
    <span>{template.code}</span>
    <small>{template.educationType} · {template.level}</small>
  </button>
))}
```

Important :
- bouton de “choisir”,
- synthèse visuelle du template actif,
- possibilité de re-choisir depuis la liste.

---

## 8. Implémentation backend recommandée

### 8.1 Nouveau point d’entrée

Créer une route ou un controller du type :
- `SchoolOnboardingController.getTemplateCatalog()`
- ou `GET /api/v2/onboarding/template-catalog`

### 8.2 Fichiers probables à modifier

- [backend/src/infrastructure/http/controllers/SchoolOnboardingController.ts](../backend/src/infrastructure/http/controllers/SchoolOnboardingController.ts)
- [backend/src/infrastructure/http/routes/](../backend/src/infrastructure/http/routes) — route liée à onboarding
- éventuellement un `use case` dédié si le besoin est plus propre, par exemple :
  - `ListerTemplatesDisponiblesUseCase.ts`
  - ou un service `TemplateCatalogService`

### 8.3 Règle de conception backend

Respecter les couches :
- `domain` = types / interfaces / règles
- `application` = use case de lecture du catalog
- `infrastructure` = route + controller + repo adapter

Pas de logique métier à la main dans le controller.

### 8.4 Exemple de contrat TypeScript

```ts
export type TemplateLevel = 'PRIMARY' | 'SECONDARY' | 'COMPLEX';
export type TemplateSubsystem = 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL';
export type TemplateEducationType = 'GENERAL' | 'TECHNICAL' | 'PROFESSIONAL' | 'MIXED';
export type TemplateOwnership = 'PUBLIC' | 'PRIVATE_SECULAR' | 'PRIVATE_FAITH';

export interface TemplateCatalogEntry {
  code: string;
  name: string;
  subsystem: TemplateSubsystem;
  educationType: TemplateEducationType;
  level: TemplateLevel;
  ownership: TemplateOwnership[];
  isPrimaire: boolean;
  isTechnique: boolean;
  isProfessionnel: boolean;
  isComplexe: boolean;
  isGroupSchool: boolean;
}
```

Le backend peut construire ce tableau depuis :
- [backend/src/application/school/schoolTemplateConfig.ts](../backend/src/application/school/schoolTemplateConfig.ts)
- en complétant avec les règles spécifiques de secondaire, technique, primaire, etc.

### 8.5 Validation backend finale

Quand l’utilisateur soumet :

```json
{
  "onboardingConfig": {
    "templateCode": "LYCEE_FR"
  }
}
```

Le backend doit vérifier que :
- `LYCEE_FR` est bien un template supporté,
- il est compatible avec le profil de l’établissement,
- le payload n’a pas été trompé par un code externe,
- en cas d’incompatibilité, on renvoie une erreur claire sans mutation.

---

## 9. Implémentation frontend recommandée

### 9.1 Supprimer les points de friction actuels

Dans [frontend/src/app/onboarding/[token]/page.tsx](../frontend/src/app/onboarding/[token]/page.tsx), il faut retirer le mécanisme de forcing implicite basé sur :
- `forcedTemplateCode`,
- `detectTemplate(form)`,
- remplacement systématique du template sélectionné par `detectTemplate`.

### 9.2 Nouveau modèle d’état

Créer une logique de type :

```ts
const [templateCatalog, setTemplateCatalog] = useState<TemplateOption[]>([]);
const [detectedTemplateCode, setDetectedTemplateCode] = useState<string | null>(null);
const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | null>(null);
```

### 9.3 Chargement du catalogue

Exemple de flux :

```ts
useEffect(() => {
  async function loadCatalog() {
    const response = await fetch('/api/v2/onboarding/template-catalog', {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Impossible de charger le catalogue des templates');
    }

    const payload = (await response.json()) as TemplateCatalogResponse;
    setTemplateCatalog(payload.data.templates);
  }

  void loadCatalog();
}, []);
```

### 9.4 Filtrage

Filtrer les templates en fonction du parcours :

```ts
const filteredTemplates = useMemo(() => {
  return templateCatalog.filter((template) => {
    if (filters.isGroupSchool !== null && template.isGroupSchool !== filters.isGroupSchool) {
      return false;
    }
    if (filters.subsystem && template.subsystem !== filters.subsystem) {
      return false;
    }
    if (filters.educationType && template.educationType !== filters.educationType) {
      return false;
    }
    if (filters.level && template.level !== filters.level) {
      return false;
    }
    return true;
  });
}, [templateCatalog, filters]);
```

### 9.5 Sélection finale

Le template final utilisé pour la soumission doit être :

```ts
const effectiveTemplateCode = selectedTemplateCode ?? detectedTemplateCode;
```

Et la soumission doit utiliser `effectiveTemplateCode` dans `onboardingConfig.templateCode`.

### 9.6 Ce qu’il faut absolument éviter côté frontend

- pas de `forcedTemplateCode` qui écrase le choix final,
- pas de `TEMPLATE_META` local qui évolue sans cohérence avec backend,
- pas de logique “if name contains X then template Y” comme source de vérité,
- pas de `any` pour contourner le typage,
- pas d’override silencieux de la sélection manuelle par la détection automatique.

---

## 10. Problèmes à traiter dans chaque branche métier

### 10.1 Primaire / maternelle

Templates concernés :
- `PRIMAIRE_FR`
- `MATERNELLE_FR`
- `PRIMARY_EN`
- `NURSERY_EN`
- `PRIMARY_BILINGUAL`
- `COMPLEXE_SCOLAIRE` (si le complexe contient du primaire)

### 10.2 Secondaire général francophone

Templates concernés :
- `LYCEE_FR`
- `CES_FR`
- `PRIVE_FR`
- `LYCEE_BILINGUE`

### 10.3 Secondaire général anglophone

Templates concernés :
- `GHS_EN`
- `GSS_EN`
- `PRIVE_EN`
- `LYCEE_BILINGUE` (si section anglophone)

### 10.4 Technique francophone

Templates concernés :
- `LYCEE_TECHNIQUE_FR`
- `CETIC`

### 10.5 Technique anglophone

Templates concernés :
- `GTC_GTHS_EN`
- `GTC_EN`

### 10.6 Professionnel francophone

Templates concernés :
- `SAR_SM`
- `CFM`

### 10.7 Complexe scolaire

Template concerné :
- `COMPLEXE_SCOLAIRE`

Cas très important :
- le complexe mélange plusieurs dimensions,
- la logique doit expliciter des sous-sections primaire / secondaire / mixte,
- il ne faut pas le traiter comme un deuxième niveau “proche” d’un template standard.

---

## 11. Sécurité et robustesse

### 11.1 Validation côté backend

Toujours valider :
- le template appartient bien au catalogue backend,
- le template est compatible avec le flux,
- le user ne peut pas injecter un code inconnu,
- le code est bien stocké dans `onboardingConfig.templateCode`.

### 11.2 Protection anti fail-safe

Ne pas mettre de logique “si indéfini, prendre un template par défaut sans explication”.

Le bon comportement est :
- si le catalogue est vide : erreur claire,
- si la sélection est vide : erreur de validation,
- si le template n’est pas supporté : rejet explicite.

### 11.3 Règle de compatibilité

Le template choisi doit être compatible avec la génération des classes métiers dans :
- [backend/src/application/school/activation/activationClasses.ts](../backend/src/application/school/activation/activationClasses.ts)
- [backend/src/application/school/activation/activationSecondary.ts](../backend/src/application/school/activation/activationSecondary.ts)
- [backend/src/application/school/ActiverEtablissementUseCase.ts](../backend/src/application/school/ActiverEtablissementUseCase.ts)

---

## 12. Vérification avant fin de chantier

### 12.1 Vérification TypeScript

Commande :

```bash
cd backend && ./node_modules/.bin/tsc --noEmit
```

et éventuellement :

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
```

### 12.2 Vérification UI / comportement

À tester manuellement :
- primaire visible et sélectionnable,
- secondaire visible et sélectionnable,
- technique visible et sélectionnable,
- professionnel visible et sélectionnable,
- complexe visible et sélectionnable,
- “détection suggérée” ne bloque pas la sélection manuelle,
- l’utilisateur peut rechoisir un autre template après sélection.

### 12.3 Vérification backend

Tester qu’à la soumission :
- `templateCode` est bien un code du catalogue,
- l’activation backend n’échoue pas sur le template sélectionné,
- la génération de classes est cohérente pour le type choisi.

### 12.4 Smoke test ciblé

Avant le merge, ajouter un test smoke très ciblé sur le chemin de sélection de template si le projet en a déjà un style similaire. Sinon, au minimum, valider via `tsc` + parcours manuel.

---

## 13. Plan d’implémentation en étapes détaillées

### Étape 1 — créer le catalogue métier backend

Difficulté : Moyenne
IA recommandée : exécutante

Travail exact :
- créer les types TypeScript dans le backend pour représenter les templates,
- créer un `TemplateCatalogEntry` stable,
- exposer un endpoint `GET /api/v2/onboarding/template-catalog`,
- utiliser la source de vérité du backend (`schoolTemplateConfig` + les règles de détermination existantes),
- ne pas dupliquer la logique côté frontend.

### Étape 2 — ajouter le service de lecture du catalogue

Difficulté : Moyenne
IA recommandée : exécutante

Travail exact :
- créer le service ou use case `ListerTemplatesDisponiblesUseCase` si nécessaire,
- faire un filtrage côté backend très simple : par `subsystem` et `educationType`,
- renvoyer le catalogue structuré au frontend.

### Étape 3 — refactorer le frontend onboarding

Difficulté : Élevée
IA recommandée : Claude Code

Travail exact :
- remplacer l’objet local `TEMPLATE_META` de [frontend/src/app/onboarding/[token]/page.tsx](../frontend/src/app/onboarding/[token]/page.tsx),
- supprimer / limiter `detectTemplate()` comme suggestion,
- introduire `selectedTemplateCode` et `detectedTemplateCode`,
- filtrer les options visibles depuis le backend,
- rendre le choix explicite.

### Étape 4 — sécuriser la soumission

Difficulté : Élevée
IA recommandée : Claude Code

Travail exact :
- valider `templateCode` dans le backend avant activation,
- vérifier qu’il existe dans le catalogue backend,
- rejeter les codes non supportés,
- garder les logs d’audit si nécessaire.

### Étape 5 — tests et vérification

Difficulté : Moyenne
IA recommandée : exécutante

Travail exact :
- test le parcours sur quelques templates représentatifs,
- vérifier le filtrage par sous-système,
- vérifier le remplacement manuel,
- vérifier la compatibilité de `templateCode` avec l’activation backend.

---

## 14. Fichiers clés à modifier

### backend
- [backend/src/application/school/schoolTemplateConfig.ts](../backend/src/application/school/schoolTemplateConfig.ts)
- [backend/src/application/school/ActiverEtablissementUseCase.ts](../backend/src/application/school/ActiverEtablissementUseCase.ts)
- [backend/src/application/school/activation/activationClasses.ts](../backend/src/application/school/activation/activationClasses.ts)
- [backend/src/application/school/activation/activationSecondary.ts](../backend/src/application/school/activation/activationSecondary.ts)
- [backend/src/infrastructure/http/controllers/SchoolOnboardingController.ts](../backend/src/infrastructure/http/controllers/SchoolOnboardingController.ts)
- éventuelles routes onboarding backend

### frontend
- [frontend/src/app/onboarding/[token]/page.tsx](../frontend/src/app/onboarding/[token]/page.tsx)
- éventuellement [frontend/src/lib/i18n](../frontend/src/lib/i18n) si on ajoute des libellés de template précis
- si on introduit un composant dédié de sélection de template, on peut le placer selon la règle feature/route de [frontend/AGENTS.md](../frontend/AGENTS.md)

---

## 15. Règles “petit modèle exécutant” — savoir-faire de sécurité

Le code produit par un petit modèle exécutant doit respecter ces points stricts :

1. Lire le fichier cible avant d’éditer.
2. Ne pas supposé qu’un template existe sans vérifier dans le backend.
3. Ne pas créer de code avec `any`.
4. Ne pas contourner la validation TypeScript par des cast dangereux.
5. Ne pas forcer la séquence de sélection par heuristique.
6. Ne pas réécrire la logique métier backend dans le frontend.
7. Ne pas introduire de duplication de catalogue.
8. Garder le flux “suggestion <> choix manuel” séparé.
9. Toujours respecter le principe “filtrer, pas verrouiller”.
10. Vérifier les commandes `tsc` avant de conclure.

---

## 16. Recommandation finale et synthèse

La bonne solution n’est ni :
- afficher tous les templates d’un coup sans filtre,
- ni :
- imposer la suggestion détectée comme unique choix.

La bonne solution est :
- parcours guidé par catégories,
- filtres techniques basés sur le catalogue backend réel,
- affichage des templates valides,
- choix explicite de l’utilisateur,
- détection automatique seulement comme suggestion initiale,
- validation backend de la sélection finale.

C’est exactement ce qu’il faut pour que l’utilisateur puisse choisir n’importe quel template supporté par le système, sans se faire imposer celui que le système a “découvert”.

---

## 17. Conclusion immédiate

Le refactoring à mener est donc très clair :

1. exposer un catalogue backend fiable,
2. rendre le frontend filtré mais libre,
3. séparer détection/suggestion et sélection utilisateur,
4. valider la sélection finale côté backend,
5. vérifier stricte conformité avec les règles AGENTS + hexagonale + typage strict.

Cela respecte le besoin métier sans casser l’architecture existante. 
