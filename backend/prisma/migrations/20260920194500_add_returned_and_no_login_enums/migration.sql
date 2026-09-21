-- AlterEnum: Ajout de RETURNED à OnboardingStatus et NO_LOGIN à UserAccessMode
ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "UserAccessMode" ADD VALUE IF NOT EXISTS 'NO_LOGIN';
