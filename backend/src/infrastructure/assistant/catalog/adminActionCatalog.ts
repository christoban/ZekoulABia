/**
 * APPLICATION LAYER — Catalogue d'actions de l'assistant IA (copilot), rôle ADMIN.
 *
 * Ce fichier est la FAÇADE de composition uniquement.
 * Les actions sont réparties par domaine dans le dossier `admin/` :
 *
 * - admin/adminClassSubjectActions.ts   — classes, matières, professeur principal
 * - admin/adminStudentUserActions.ts    — élèves, inscriptions, transferts, matricules, candidats CEP
 * - admin/adminLv2PebsExamActions.ts    — LV2, PEBS, fenêtres choix, concours, sélections PEBS
 * - admin/adminAcademicGradeActions.ts  — notes, bulletins, conseils, EDT, périodes, statistiques
 * - admin/adminFinanceAttendanceActions.ts — finance (frais/factures/paiements), absences
 * - admin/adminHrCommRiskActions.ts     — RH (congés, diplômes), pédagogie, communications, risques élèves
 * - admin/adminHelpers.ts               — helpers de résolution internes (employee, plan frais, sessions)
 *
 * Chaque builder reçoit `deps: AdminActionDeps` en paramètre et retourne `ActionDefinition[]`.
 * Le principe de conception (noms humains → IDs résolus côté serveur) reste documenté dans
 * les fichiers individuels.
 */
import { z } from 'zod';
import type { StaffPermissionType } from '@domain/types/enums';
import {
  type ActionContext,
  type ActionExecuteResult,
  type ActionDefinition,
} from '@infrastructure/assistant/catalog/catalogShared';

import type { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import type { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import type { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import type { CreerMatiereUseCase } from '@application/subject/CreerMatiereUseCase';
import type { AssignerEnseignantMatiereUseCase } from '@application/subject/AssignerEnseignantMatiereUseCase';
import type { SupprimerMatiereUseCase } from '@application/subject/SupprimerMatiereUseCase';
import type { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import type { CreerSessionPebsUseCase } from '@application/pebsExam/CreerSessionPebsUseCase';
import type { OuvrirFenetreChoixLV2UseCase } from '@application/lv2Choice/OuvrirFenetreChoixLV2UseCase';
import type { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import type { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import type { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import type { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';
import type { ModifierMatiereUseCase } from '@application/subject/ModifierMatiereUseCase';
import type { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import type { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import type { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import type { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';
import type { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import type { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import type { VerrouillerNotesEnMasseUseCase } from '@application/grade/VerrouillerNotesEnMasseUseCase';
import type { PublierEmploiDuTempsUseCase } from '@application/timetable/PublierEmploiDuTempsUseCase';
import type { TenirConseilClasseUseCase } from '@application/classCouncil/TenirConseilClasseUseCase';
import type { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import type { VerifierPrerequisClotureUseCase } from '@application/academicYear/VerifierPrerequisClotureUseCase';
import type { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
import type { GenererFacturesEnMasseUseCase } from '@application/finance/GenererFacturesEnMasseUseCase';
import type { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';
import type { ResumeSessionConcoursUseCase } from '@application/entranceExam/ResumeSessionConcoursUseCase';
import type { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import type { ResumeSessionPebsUseCase } from '@application/pebsExam/ResumeSessionPebsUseCase';
import type { CalculerSelectionPebsUseCase } from '@application/pebsExam/CalculerSelectionPebsUseCase';
import type { VerifierMatriculeUseCase } from '@application/matricule/VerifierMatriculeUseCase';
import type { CreerSalleUseCase } from '@application/room/CreerSalleUseCase';
import type { ModifierSalleUseCase } from '@application/room/ModifierSalleUseCase';

// ── Re-exports ────────────────────────────────────────────────────────────────
export type { ActionContext, ActionExecuteResult, ActionDefinition };

// ── Dépendances du catalogue ──────────────────────────────────────────────────
export interface AdminActionDeps {
  creerClasse: CreerClasseUseCase;
  supprimerClasse: SupprimerClasseUseCase;
  assignerProfesseur: AssignerProfesseurPrincipalUseCase;
  creerMatiere: CreerMatiereUseCase;
  assignerEnseignant: AssignerEnseignantMatiereUseCase;
  supprimerMatiere: SupprimerMatiereUseCase;
  creerSessionConcours: CreerSessionConcoursUseCase;
  creerSessionPebs: CreerSessionPebsUseCase;
  ouvrirFenetreLV2: OuvrirFenetreChoixLV2UseCase;
  inscrireEleve: InscrireUtilisateurUseCase;
  modifierUtilisateur: ModifierUtilisateurUseCase;
  supprimerUtilisateur: SupprimerUtilisateurUseCase;
  transfererEleve: TransfererEleveUseCase;
  modifierMatiere: ModifierMatiereUseCase;
  affecterLV2Eleve: AffecterLV2EleveUseCase;
  affecterLV2Masse: AffecterLV2EnMasseUseCase;
  affecterPEBSEleve: AffecterPEBSEleveUseCase;
  affecterPEBSMasse: AffecterPEBSEnMasseUseCase;
  genererBulletins: GenererBulletinUseCase;
  envoyerBulletins: EnvoyerBulletinsUseCase;
  verrouillerNotesEnMasse: VerrouillerNotesEnMasseUseCase;
  publierEDT: PublierEmploiDuTempsUseCase;
  ouvrirConseilClasse: TenirConseilClasseUseCase;
  definirPeriodeCourante: DefinirPeriodeCouranteUseCase;
  verifierPrerequisCloture: VerifierPrerequisClotureUseCase;
  creerPlanFrais: CreerPlanFraisUseCase;
  genererFacturesMasse: GenererFacturesEnMasseUseCase;
  enregistrerPaiementCash: EnregistrerPaiementCashUseCase;
  resumeSessionConcours: ResumeSessionConcoursUseCase;
  calculerAdmissionConcours: CalculerAdmissionConcoursUseCase;
  resumeSessionPebs: ResumeSessionPebsUseCase;
  calculerSelectionPebs: CalculerSelectionPebsUseCase;
  verifierMatricule: VerifierMatriculeUseCase;
  creerSalle: CreerSalleUseCase;
  modifierSalle: ModifierSalleUseCase;
  /** Approuve/rejette une demande de congé (déduit le solde si approuvée). */
  traiterDemandeConge: (
    schoolId: string,
    requestId: string,
    statut: 'APPROVED' | 'REJECTED',
    validatedById: string | undefined,
  ) => Promise<{ id: string; statut: string }>;
  /** Diffuse un message SMS/email à un groupe ciblé. */
  diffuserMessage: (
    schoolId: string,
    createdById: string | undefined,
    target: { role?: string; classId?: string; level?: string; paymentStatus?: string },
    channel: 'SMS' | 'EMAIL' | 'BOTH',
    message: string,
  ) => Promise<{ total: number; sent: number; failed: number }>;
  /** Classes/matières en retard sur leur programme. */
  alertesRetardProgramme: (schoolId: string, academicYearId?: string, seuilPct?: number) => Promise<{
    subjectName: string;
    className: string;
    progressionPct: number;
    attenduPct: number;
    retardPct: number;
    niveau: 'CRITIQUE' | 'MODERE';
  }[]>;
}

// ── Builders par domaine ──────────────────────────────────────────────────────
import { buildAdminClassSubjectActions } from './admin/adminClassSubjectActions';
import { buildAdminStudentUserActions } from './admin/adminStudentUserActions';
import { buildAdminLv2PebsExamActions } from './admin/adminLv2PebsExamActions';
import { buildAdminAcademicGradeActions } from './admin/adminAcademicGradeActions';
import { buildAdminFinanceAttendanceActions } from './admin/adminFinanceAttendanceActions';
import { buildAdminHrCommRiskActions } from './admin/adminHrCommRiskActions';

// ── Point d'entrée unique ─────────────────────────────────────────────────────
export function buildAdminActionCatalog(deps: AdminActionDeps): ActionDefinition[] {
  return [
    ...buildAdminClassSubjectActions(deps),
    ...buildAdminStudentUserActions(deps),
    ...buildAdminLv2PebsExamActions(deps),
    ...buildAdminAcademicGradeActions(deps),
    ...buildAdminFinanceAttendanceActions(deps),
    ...buildAdminHrCommRiskActions(deps),
  ];
}
