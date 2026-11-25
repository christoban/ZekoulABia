/**
 * DOMAIN LAYER — Point d'entrée des entités
 */
export { User } from './User';
export type { UserProps, CreerUserProps } from './User';

export { School } from './School';
export type { SchoolProps, CreerSchoolProps } from './School';

export { Classe } from './Classe';
export type { ClasseProps, CreerClasseProps } from './Classe';

export { Note } from './Note';
export type { NoteProps, CreerNoteProps } from './Note';

export { Presence } from './Presence';
export type { PresenceProps, EnregistrerPresenceProps } from './Presence';

export { Bulletin } from './Bulletin';
export type { BulletinProps, CreerBulletinProps, LigneMatiereProps, NoteNonValidee } from './Bulletin';

export { PlanFrais } from './PlanFrais';
export type { PlanFraisProps, CreerPlanFraisProps } from './PlanFrais';

export { Facture } from './Facture';
export type { FactureProps, CreerFactureProps } from './Facture';

export { Paiement } from './Paiement';
export type { PaiementProps, CreerPaiementProps } from './Paiement';

export { Depense } from './Depense';
export type { DepenseProps, CreerDepenseProps } from './Depense';

export { EmploiDuTemps } from './EmploiDuTemps';
export type { EmploiDuTempsProps, CreerEmploiDuTempsProps } from './EmploiDuTemps';

export { CreneauHoraire } from './CreneauHoraire';
export type { CreneauHoraireProps, CreerCreneauProps } from './CreneauHoraire';
