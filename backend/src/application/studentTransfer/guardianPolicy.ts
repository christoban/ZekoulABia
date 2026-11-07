import { STUDENT_TRANSFER_CONFIG } from './config';

export const AGE_MAJORITE_CIVILE = STUDENT_TRANSFER_CONFIG.ageMajoriteCivile;

export interface TuteurPrincipalCandidat {
  parentProfileId: string;
  phone: string | null;
  phoneVerified: boolean;
}

export function estEleveMajeur(dateNaissance: Date, dateReference: Date): boolean {
  const age = dateReference.getUTCFullYear() - dateNaissance.getUTCFullYear();
  const anniversaireNonPasse =
    dateReference.getUTCMonth() < dateNaissance.getUTCMonth()
    || (
      dateReference.getUTCMonth() === dateNaissance.getUTCMonth()
      && dateReference.getUTCDate() < dateNaissance.getUTCDate()
    );

  return age - (anniversaireNonPasse ? 1 : 0) >= AGE_MAJORITE_CIVILE;
}

export function validerTuteurPrincipal(
  candidats: TuteurPrincipalCandidat[],
): TuteurPrincipalCandidat {
  if (candidats.length !== 1) {
    throw new Error('Un élève doit avoir exactement un tuteur principal.');
  }

  const tuteur = candidats[0];
  if (!tuteur.phone || !tuteur.phoneVerified) {
    throw new Error('Le tuteur principal doit disposer d’un téléphone vérifié.');
  }

  return tuteur;
}