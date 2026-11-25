-- Allow contenuRealise to be null (for subjects without structured programme)
ALTER TABLE "CahierDeTexte" ALTER COLUMN "contenuRealise" DROP NOT NULL;

-- Add contenuLibre for free-form content (EPS, Arts, etc.)
ALTER TABLE "CahierDeTexte" ADD COLUMN "contenuLibre" TEXT;
