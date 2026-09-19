/**
 * APPLICATION — Use case : Inscrire un élève (Action directe 1-step)
 *
 * Seule action de finalisation du dossier d'inscription. Exécutée par un SECRETAIRE
 * ou un ADMIN (si l'option adminGereInscriptions est activée).
 * Crée le(s) compte(s) élève (+ parent si nécessaire) et l'enregistrement d'inscription (Enrollment).
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { canGererInscriptions } from '@domain/rules/EnrollmentRules';
import { parseDateFR } from '../../shared/date/parseDateFR';
import type { OnboardingStatus } from '@domain/types/enums';
import type { ValiderOnboardingCompteResultat } from './types';

export interface InscrireEleveCommande {
  schoolId: string;
  onboardingId: string;
  validatedById: string;
  validatorRole: string;
  staffPermissions?: readonly string[];
  classId?: string;
}

export interface InscrireEleveResultat {
  onboardingId: string;
  studentProfileId: string;
  recipientType: string;
  comptesCrees: ValiderOnboardingCompteResultat[];
}

export class InscrireEleveUseCase {
  constructor(
    private readonly eleveOnboardingRepository: EleveOnboardingRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(cmd: InscrireEleveCommande): Promise<InscrireEleveResultat> {
    const school = await this.schoolRepository.findById(cmd.schoolId);
    const adminGere = school?.adminGereInscriptions ?? false;

    if (!canGererInscriptions({ role: cmd.validatorRole, staffPermissions: cmd.staffPermissions, adminGereInscriptions: adminGere })) {
      throw new Error('Vous n’avez pas les droits nécessaires pour inscrire des élèves.');
    }

    const onboarding = await this.eleveOnboardingRepository.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');

    const statusValides: OnboardingStatus[] = ['SUBMITTED', 'DRAFT', 'LINK_SENT'];
    if (!statusValides.includes(onboarding.status)) {
      throw new Error(`Ce dossier ne peut pas être inscrit depuis son statut actuel (${onboarding.status})`);
    }

    const classId = cmd.classId ?? onboarding.classId;
    if (!classId) throw new Error('Aucune classe définie pour ce dossier — précisez-en une avant d’inscrire');

    const submitted = (onboarding.submittedData ?? {}) as Record<string, any>;
    const nom = String(submitted.nom || onboarding.nomProvisoire);
    const prenom = String(submitted.prenom || '');
    const dateOfBirth = typeof submitted.dateNaissance === 'string' ? parseDateFR(submitted.dateNaissance) : null;
    const gender = typeof submitted.gender === 'string' ? submitted.gender : null;

    const recipientType = onboarding.recipientType as 'ELEVE' | 'PARENT' | 'LES_DEUX';
    const hasDistinctParentContact = !!(onboarding.parentContactEmail || onboarding.parentContactTelephone);
    const eleveRecoitContact = recipientType === 'ELEVE' || (recipientType === 'LES_DEUX' && hasDistinctParentContact);
    const parentRecoitContact = recipientType === 'PARENT' || recipientType === 'LES_DEUX';

    const eleveContactEmail = eleveRecoitContact ? onboarding.contactEmail : null;
    const eleveContactTelephone = eleveRecoitContact ? onboarding.contactTelephone : null;
    const parentContactEmailUtilise = hasDistinctParentContact ? onboarding.parentContactEmail : onboarding.contactEmail;
    const parentContactTelephoneUtilise = hasDistinctParentContact ? onboarding.parentContactTelephone : onboarding.contactTelephone;

    const eleveAccessMode: 'FULL_ACCESS' | 'SMS_ONLY' =
      onboarding.eleveADispositif === false && !!eleveContactTelephone ? 'SMS_ONLY' : 'FULL_ACCESS';
    const parentAccessMode: 'FULL_ACCESS' | 'SMS_ONLY' =
      onboarding.parentADispositif === false && !!parentContactTelephoneUtilise ? 'SMS_ONLY' : 'FULL_ACCESS';

    const { studentProfileId, comptesCrees } = await this.eleveOnboardingRepository.validerOnboarding({
      schoolId: cmd.schoolId,
      onboardingId: onboarding.id,
      validatedById: cmd.validatedById,
      classId,
      nom,
      prenom,
      dateOfBirth,
      gender,
      eleveContactEmail,
      eleveContactTelephone,
      parentContactEmail: parentContactEmailUtilise,
      parentContactTelephone: parentContactTelephoneUtilise,
      parentRecoitContact,
      eleveAccessMode,
      parentAccessMode,
      eleveDispositifOS: onboarding.eleveDispositifOS,
      parentDispositifOS: onboarding.parentDispositifOS,
      examCandidateId: onboarding.examCandidateId,
    });

    await this.activityLog.log({
      userId: cmd.validatedById,
      schoolId: cmd.schoolId,
      action: 'ONBOARDING_VALIDATED',
      details: `Élève ${nom} ${prenom} inscrit avec succès (dossier ${onboarding.id}, ${comptesCrees.length} compte(s) créé(s))`,
    });

    return {
      onboardingId: onboarding.id,
      studentProfileId,
      recipientType,
      comptesCrees,
    };
  }
}
