import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { CreerSqueletteOnboardingUseCase } from '../eleveOnboarding/CreerSqueletteOnboardingUseCase';
import { notifyConcoursPromotionSms } from '@infrastructure/services/sms/SmsNotificationService';

export interface DecisionCandidatCep {
  candidateId: string;
  cepResult: 'REUSSI' | 'ECHOUE';
}

export interface AppliquerSaisieLotCepCommande {
  schoolId: string;
  sessionId: string;
  adminUserId: string;
  decisions: DecisionCandidatCep[];
  promotionsIds?: string[];
}

export interface AppliquerSaisieLotCepResult {
  confirmes: number;
  annules: number;
  promus: number;
  dossiersCrees: number;
  sessionCloturee: boolean;
}

export class AppliquerSaisieLotCepUseCase {
  constructor(
    private readonly entranceRepository: EntranceExamRepository,
    private readonly creerSqueletteOnboarding: CreerSqueletteOnboardingUseCase,
    private readonly schoolRepository?: SchoolRepository,
  ) {}

  async execute(cmd: AppliquerSaisieLotCepCommande): Promise<AppliquerSaisieLotCepResult> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    let confirmes = 0;
    let annules = 0;
    let dossiersCrees = 0;
    let promus = 0;

    let schoolName = 'Établissement';
    let isAnglophone = false;
    if (this.schoolRepository) {
      const school = await this.schoolRepository.findById(cmd.schoolId);
      if (school) {
        schoolName = school.name;
        isAnglophone = school.subsystem === 'ANGLOPHONE';
      }
    }
    const examLibelle = isAnglophone ? 'FSLC' : 'CEP';
    const levelLibelle = isAnglophone ? 'Form 1' : '6e';

    // 1. Appliquer les décisions CEP (REUSSI / ECHOUE)
    for (const dec of cmd.decisions) {
      const candidate = await this.entranceRepository.trouverCandidatAvecSession(dec.candidateId);
      if (!candidate || candidate.sessionId !== cmd.sessionId) continue;
      if (candidate.admissionStatus !== 'ADMIS_PROVISOIRE') continue;

      const candidateName = `${candidate.firstName} ${candidate.lastName}`;
      const parentPhone = candidate.parentPhone ?? null;

      if (dec.cepResult === 'REUSSI') {
        await this.entranceRepository.mettreAJourResultatCEP(candidate.id, {
          cepResult: 'REUSSI',
          admissionStatus: 'CONFIRME',
        });
        confirmes++;

        // Création du squelette d'onboarding en brouillon (SANS SMS DE LIEN AUTOMATIQUE)
        let classId: string | undefined = candidate.session?.targetClassId ?? undefined;
        if (!classId) {
          const classeCible = await this.entranceRepository.trouverClasseNiveau(cmd.schoolId, '6');
          classId = classeCible?.id;
        }

        try {
          const onboarding = await this.creerSqueletteOnboarding.execute({
            schoolId: cmd.schoolId,
            createdById: cmd.adminUserId,
            nomProvisoire: candidateName,
            classId,
            contactTelephone: parentPhone,
            recipientType: 'PARENT',
            sourceType: 'CONCOURS',
            examCandidateId: candidate.id,
            aucunContactDisponible: !parentPhone,
          });
          if (onboarding) dossiersCrees++;
        } catch (err) {
          console.error('[AppliquerSaisieLotCepUseCase] Erreur squelette onboarding:', err);
        }
      } else {
        // Échec au CEP : ANNULE — AUCUN SMS (place libérée)
        await this.entranceRepository.mettreAJourResultatCEP(candidate.id, {
          cepResult: 'ECHOUE',
          admissionStatus: 'ANNULE',
        });
        annules++;
      }
    }

    // 2. Traiter les promotions de la liste d'attente
    if (cmd.promotionsIds && cmd.promotionsIds.length > 0) {
      for (const promoId of cmd.promotionsIds) {
        const promoCand = await this.entranceRepository.trouverCandidatAvecSession(promoId);
        if (!promoCand || promoCand.sessionId !== cmd.sessionId) continue;
        if (promoCand.admissionStatus !== 'LISTE_ATTENTE') continue;

        await this.entranceRepository.mettreAJourStatutAdmission(promoCand.id, 'ADMIS_PROVISOIRE');
        promus++;

        // Envoi du SMS au candidat promu (information nouvelle)
        if (promoCand.parentPhone && promoCand.parentPhone.trim().length >= 8) {
          await notifyConcoursPromotionSms({
            schoolId: cmd.schoolId,
            candidateName: `${promoCand.firstName} ${promoCand.lastName}`,
            parentPhone: promoCand.parentPhone.trim(),
            schoolName,
            level: levelLibelle,
            examName: examLibelle,
          });
        }
      }
    }

    // 3. Clôture automatique de la session si tous les candidats ont été traités
    const enAttente = await this.entranceRepository.compterCandidatsEnAttente(cmd.sessionId);
    let sessionCloturee = false;
    if (enAttente === 0) {
      await this.entranceRepository.mettreAJourStatutSession(cmd.sessionId, 'CLOSED');
      sessionCloturee = true;
    }

    return {
      confirmes,
      annules,
      promus,
      dossiersCrees,
      sessionCloturee,
    };
  }
}
