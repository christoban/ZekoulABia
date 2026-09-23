-- Bug préexistant corrigé au passage (distinct du mapping Phase 2) :
-- EleveOnboardingController et l'interface OnboardingSettings (TS) référencent
-- directAdmissionWithoutExam et capacityBufferPercent, mais ces colonnes n'ont
-- jamais été créées dans la table SchoolOnboardingSettings.
-- La migration 20260920194600 avait ajouté requireEntranceExam/admissionPolicy,
-- pas ces deux champs. Cette migration crée les colonnes manquantes.

-- Booléen : admission directe sur dossier sans concours obligatoire
ALTER TABLE "SchoolOnboardingSettings" ADD COLUMN IF NOT EXISTS "directAdmissionWithoutExam" BOOLEAN NOT NULL DEFAULT false;

-- Pourcentage de surcapacité tolérée avant dérogation obligatoire
ALTER TABLE "SchoolOnboardingSettings" ADD COLUMN IF NOT EXISTS "capacityBufferPercent" INTEGER NOT NULL DEFAULT 0;
