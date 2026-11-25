# i18n — Guide pour les étapes 4b/4c/4d

## Ajouter une clé de traduction

1. Ouvrir le fichier JSON du domaine concerné dans `src/locales/fr/` (ex. `admin.json`)
2. Ajouter la clé imbriquée :
   ```json
   { "monComposant": { "titre": "Mon Titre", "description": "Ma desc" } }
   ```
3. Faire le **miroir exact** dans `src/locales/en/` (mêmes clés, valeurs traduites)

## Utiliser une clé dans un composant

```tsx
import { useT } from '@/lib/i18n'

function MonComposant() {
  const t = useT('admin')           // ← le namespace = nom du fichier JSON (sans .json)
  return <h1>{t('monComposant.titre')}</h1>
}
```

Le hook `useT(namespace)` retourne une fonction qui prend un chemin dot-separated (`'a.b.c'` → `dict.a.b.c`).

## Règles

| Namespace | Contenu |
|-----------|---------|
| `common` | Boutons universels, statuts, champs, auth, validation |
| `navigation` | Sidebar, topbar, breadcrumbs |
| `admin` | Pages admin uniquement (settings, config, etc.) |
| `teacher` | Espace enseignant |
| `staff` | Espace staff (vie scolaire, orientation) |
| `parent` | Espace parent |
| `student` | Espace élève |
| `grades` | Notes, bulletins, relevés |
| `finance` | Mobile Money, frais, transactions |
| `discipline` | Sanctions, retenues, conseil de discipline |
| `errors` | Messages d'erreur, 404, fallbacks |

## Pages publiques

Le choix FR/EN est stocké dans `zekoulabia_lang_override`. Sans choix explicite, le navigateur est utilisé.

## Dashboard connecté

Chaque compte possède sa propre préférence dans `zekoulabia_dashboard_lang_<userId>`. Un choix global ne peut donc pas être appliqué à un autre utilisateur du même navigateur. Cette préférence ne modifie pas la langue des bulletins, documents, SMS ou emails, qui reste résolue côté backend selon l'établissement et la section.
