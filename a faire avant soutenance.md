Voici le fonctionnement complet, consolidé après tout ce qu'on a discuté.

## Statuts d'un établissement

`ACTIF` → `SUSPENDU` → `ARCHIVÉ` (jamais de suppression physique s'il y a de vraies données) ou `SUSPENDU` → `ACTIF` (réactivation)

Séparément : un établissement **brouillon** (jamais utilisé en vrai) peut être supprimé directement.

## Cas 1 — Établissement avec de vraies données (≥1 élève avec bulletin publié OU ≥1 paiement enregistré)

1. **Suspension** (`SuspendreEtablissementUseCase`) : super admin déclenche, motif obligatoire (impayé, litige, fermeture, doublon...), statut → `SUSPENDU`, accès coupé pour tout le monde dans l'établissement, **données intactes**. Notification immédiate (push+SMS) à l'admin/proviseur de l'établissement. Log dans la vue sécurité-plateforme.

2. **Suspension sans limite de durée par défaut** — rien ne se passe automatiquement tant que le super admin n'engage pas explicitement le compte à rebours d'archivage (une suspension "punitive" ou "en attente de paiement" peut rester indéfiniment sans jamais aller vers l'archivage).

3. **Si le super admin engage le compte à rebours d'archivage** (action distincte, volontaire) :
   - Notification hebdomadaire à l'admin/proviseur pendant 90 jours ("votre établissement sera archivé le [date] si aucune action")
   - Le proviseur peut à tout moment stopper le compte à rebours en réglant ce qui posait problème (le super admin réactive ou annule l'archivage programmé)

4. **Après 90 jours sans réaction** → `ArchiverEtablissementUseCase` : statut → `ARCHIVÉ`, aucune donnée supprimée, sort des listes actives/stats/facturation du super admin, éventuellement déplacé vers un stockage froid plus tard (jamais effacé). Log sécurité-plateforme.

5. **Réactivation** possible à tout moment depuis `SUSPENDU` ou `ARCHIVÉ` (`ReactiverEtablissementUseCase`), même rigueur : motif, notification, log.

## Cas 2 — Établissement brouillon (0 élève réel, 0 bulletin, 0 paiement)

`SupprimerEtablissementBrouillonUseCase` : hard delete réel, mais bloqué automatiquement (409) dès que `hasProductionData` détecte la moindre vraie donnée. Re-authentification MFA + mot de passe obligatoire, même pour un brouillon.

## Garde-fous transverses (déjà présents ailleurs dans ZekoulABia, réutilisés ici)

- Toute action de ce use case réservée au rôle Super Admin plateforme le plus élevé (toi), jamais un Admin d'établissement même sur son propre établissement
- Log dans la vue sécurité-plateforme (jamais la vue établissement, qui pourrait ne plus exister)
- Pattern propose/apply cohérent avec le reste (clôture d'année, emploi du temps) — pas d'action irréversible silencieuse

Je mets à jour ta mémoire projet avec cette décision pour qu'elle soit là la prochaine fois qu'on en reparle.C'est enregistré. Dis-moi quand tu veux qu'on code `SuspendreEtablissementUseCase` (le plus utilisé au quotidien), ou si tu préfères commencer par `SupprimerEtablissementBrouillonUseCase` (plus simple, sert à nettoyer tes tests actuels).



le fichier bootstrap est devenu trop long il faut le scinder en plusieurs fichiuers et de meme pour tous les autre s fichiers qui dépasse 500 OU 600 OU 700 OU 800 lignes de code



ok il va falloir faire et implémenter les audit de tout ce qui se passe au niveau de l'établissement pour l'admin et les staff en fonction de leur niveau pour l'eleve des audit en ce qui lui concernedans ses fonctions, meme chose pour chaque role et maintenant l'admin a l'audit complet pour tout son etablissement et pour le super admin c'ets l'audit de toute la plateforme


il faudra implémenter le fait de se connecter juste en mettant ses identifiants , pas beosin de choisir son role et l'etablissement, quand tu mets ton mot de passe et ton email, si tu as deux comptes dans plusieurs etablissements cà viendra après , on te demandera de choisir ou tu veux te connecter

⚠️ AVANT MISE EN PRODUCTION — Nettoyage du mode dev import utilisateurs

Fichier concerné : backend/src/application/user/ImporterUtilisateursUseCase.ts (ou ses handlers extraits après refactoring)

Ce qu'il faut faire :

Supprimer la constante DEV_PASS et toute référence à un mot de passe fixe en dur.
Supprimer la branche conditionnelle if (isDevMode) { ... } else { ... } pour la génération du hash — ne garder QUE la génération aléatoire (randomBytes).
Supprimer la méthode envoyerEmailDevMode() entièrement.
Supprimer toute lecture de process.env.EMAIL_DISABLED dans ce fichier — le flux ne doit avoir qu'un seul chemin : génération aléatoire + envoi du vrai lien d'invitation, sans branche alternative possible.

Ce qu'il ne faut PAS faire :

Ne pas se contenter de mettre EMAIL_DISABLED=false dans le .env de production en laissant le code de la branche dev intact — le code lui-même doit disparaître, pas juste être désactivé par variable d'environnement. Une variable mal configurée un jour (erreur humaine, mauvais déploiement, .env copié par erreur) suffit à réactiver le mot de passe fixe pour de vrais comptes d'élèves/parents.
Ne pas laisser DEV_PASS dans le code même commenté ou "juste au cas où" — un mot de passe en dur qui traîne dans l'historique Git est un risque même s'il n'est plus utilisé activement.
Ne pas oublier de vérifier s'il existe des références similaires ailleurs dans le code (recherche globale EMAIL_DISABLED et DEV_PASS dans tout le repo, pas seulement ce fichier) — d'autres endroits du projet (ex: création de compte manuelle par un admin) pourraient avoir le même pattern.

Comment vérifier que c'est fait : grep -r "EMAIL_DISABLED\|DEV_PASS" backend/src/ doit retourner zéro résultat avant le déploiement final.




il faudra chercher à comprendre comment fonctionne le processus d'anonymisation des feuilles de composition, qui sont ceux qui interviennent à chaque partie pour faire quoi 