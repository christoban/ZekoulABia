/**
 * DOMAIN LAYER — Export centralisé des ports repositories
 */
export type { UserRepository } from './UserRepository';
export type { SchoolRepository } from './SchoolRepository';
export type { ClasseRepository } from './ClasseRepository';
export type { NoteRepository, NoteNonValideeInfo } from './NoteRepository';
export type { PresenceRepository, StatistiquesPresence } from './PresenceRepository';
export type { BulletinRepository } from './BulletinRepository';
export type {
  MatiereRepository,
  MatiereProps,
  CoefficientMatiere
} from './MatiereRepository';
export type {
  AnneeAcademiqueRepository,
  AnneeAcademiqueProps,
  PeriodeAcademiqueProps,
  SequenceAcademiqueProps,
  CalendrierPeriode,
} from './AnneeAcademiqueRepository';
export type {
  PromotionRepository,
  ClassPromotionMapping,
  DecisionConseil,
  PromotionEleveParams,
} from './PromotionRepository';
export type { InvitationRepository, InvitationProps } from './InvitationRepository';
export type { PlanFraisRepository } from './PlanFraisRepository';
export type { FactureRepository, FactureEnRetard } from './FactureRepository';
export type { PaiementRepository, RevenusParPeriode } from './PaiementRepository';
export type { DepenseRepository } from './DepenseRepository';
export type { SousGroupeRepository, SousGroupeProps } from './SousGroupeRepository';
export type { TimetableRepository, CreneauConflitInfo } from './TimetableRepository';
export type { SanteEleveRepository, DonneesSanteEleve } from './SanteEleveRepository';
export type {
  SchoolSettingsRepository,
  SchoolSettingsComplets,
} from './SchoolSettingsRepository';
export type { ParentRepository, EnfantAvecStats } from './ParentRepository';
export type {
  ClassCouncilPreviewQueryPort,
  DonneesVueConseil,
  DonneesVueConseilParEleve,
} from './ClassCouncilPreviewQueryPort';
export type {
  ProgrammeRepository,
  ProgrammeProps,
  ProgrammeCreateData,
  ProgrammeUpdateData,
  ProgrammeFilters,
} from './ProgrammeRepository';
export type {
  ChapitreRepository,
  ChapitreProps,
  ChapitreCreateData,
  ChapitreUpdateData,
} from './ChapitreRepository';
export type {
  CahierDeTexteRepository,
  CahierDeTexteProps,
  CahierDeTexteCreateData,
  CahierDeTexteUpdateData,
  CahierDeTexteFilters,
} from './CahierDeTexteRepository';
export type {
  DepartmentRepository,
  DepartmentProps,
} from './DepartmentRepository';

export type { StudentRecommendationRepository, StudentRecommendationData } from './StudentRecommendationRepository';
export type { SchoolConfigRepository } from './SchoolConfigRepository';
export type { TeachingAssignmentRepository, TeachingAssignmentData } from './TeachingAssignmentRepository';
export type {
  AcademicProfileQueryPort,
  AcademicProfileData,
  BulletinProfil,
  LigneMatiereProfil,
} from './AcademicProfileQueryPort';
export type {
  RapportsScolariteRepository,
  EffectifClasseRow,
  DossierIncompletRow,
  StatConcoursRow,
} from './RapportsScolariteRepository';
