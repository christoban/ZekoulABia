-- Lot 3 bis : marquage non destructif des leçons retirées du référentiel national.
-- Purement additif : colonne nullable, aucune donnée existante modifiée ni supprimée.
ALTER TABLE "Chapitre" ADD COLUMN "retireDuReferentielLe" TIMESTAMP(3);

-- ROLLBACK (à appliquer manuellement uniquement si nécessaire, NON exécuté par Prisma) :
-- ALTER TABLE "Chapitre" DROP COLUMN "retireDuReferentielLe";

