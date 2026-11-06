# Déploiement Phase 1B

Le schéma et le code doivent être déployés dans la même fenêtre afin d'éviter qu'un ancien serveur ne lise un schéma partiellement migré.

1. **Sauvegarde** : prendre une sauvegarde PostgreSQL vérifiée et noter son identifiant avant toute opération.
2. **Fenêtre de maintenance** : arrêter les workers et empêcher les nouvelles écritures applicatives.
3. **Migration** : depuis `backend/`, exécuter `npx prisma migrate deploy`, puis vérifier que la migration Phase 1B est `applied`.
4. **Code** : déployer immédiatement la version applicative correspondante et redémarrer API et workers.
5. **Vérification** : contrôler les inscriptions, les profils élèves, les `StudentIdentity`, les journaux d'audit et les erreurs serveur ; vérifier particulièrement les inscriptions non rattachables.
6. **Retour arrière** : si une vérification échoue, arrêter la version déployée, restaurer la sauvegarde dans une base de restauration, redéployer la version précédente et ne jamais supprimer manuellement les colonnes ou identités créées par la migration.

Le backfill est contrôlé : les codes dossier `D6-ELEVE001` à `D6-ELEVE004` sont ignorés, restent inchangés et apparaissent dans le rapport `skippedProfiles`.
