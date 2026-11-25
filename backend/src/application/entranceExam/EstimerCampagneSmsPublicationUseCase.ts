import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';

export interface EstimerCampagneSmsCommande {
  schoolId: string;
  sessionId: string;
}

export interface CandidateSansTelephone {
  id: string;
  firstName: string;
  lastName: string;
  candidateNumber?: string | null;
  admissionStatus: string;
}

export interface EstimationCampagneSmsResult {
  totalCandidats: number;
  totalSmsAEnvoyer: number;
  totalSansTelephone: number;
  candidatsSansTelephone: CandidateSansTelephone[];
  groupes: {
    admis: { count: number; withPhone: number; withoutPhone: number; previewMessage: string };
    listeAttente: { count: number; withPhone: number; withoutPhone: number; previewMessage: string };
    nonAdmis: { count: number; withPhone: number; withoutPhone: number; previewMessage: string };
  };
  campaignIdSuggere: string;
  subsystem: string;
  examLibelle: string;
  levelLibelle: string;
  schoolName: string;
}

export class EstimerCampagneSmsPublicationUseCase {
  constructor(
    private readonly entranceRepository: EntranceExamRepository,
    private readonly schoolRepository: SchoolRepository,
  ) {}

  async execute(cmd: EstimerCampagneSmsCommande): Promise<EstimationCampagneSmsResult> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    const school = await this.schoolRepository.findById(cmd.schoolId);
    const schoolName = school?.name || 'Établissement';
    const subsystem = school?.subsystem || 'FRANCOPHONE';
    const isAnglophone = subsystem === 'ANGLOPHONE';
    const examLibelle = isAnglophone ? 'FSLC' : 'CEP';
    const levelLibelle = isAnglophone ? 'Form 1' : '6e';

    const candidats = await this.entranceRepository.listerCandidats(cmd.sessionId);

    const admisCands = candidats.filter(
      (c) => c.admissionStatus === 'ADMIS_PROVISOIRE' || c.admissionStatus === 'ADMIS'
    );
    const attenteCands = candidats.filter((c) => c.admissionStatus === 'LISTE_ATTENTE');
    const nonAdmisCands = candidats.filter(
      (c) => c.admissionStatus === 'NON_ADMIS' || c.admissionStatus === 'REFUSE'
    );

    const filterWithPhone = (list: typeof candidats) =>
      list.filter((c) => Boolean(c.parentPhone && c.parentPhone.trim().length >= 8));
    const filterWithoutPhone = (list: typeof candidats) =>
      list.filter((c) => !c.parentPhone || c.parentPhone.trim().length < 8);

    const admisWithPhone = filterWithPhone(admisCands);
    const admisWithoutPhone = filterWithoutPhone(admisCands);

    const attenteWithPhone = filterWithPhone(attenteCands);
    const attenteWithoutPhone = filterWithoutPhone(attenteCands);

    const nonAdmisWithPhone = filterWithPhone(nonAdmisCands);
    const nonAdmisWithoutPhone = filterWithoutPhone(nonAdmisCands);

    const allWithoutPhone: CandidateSansTelephone[] = [
      ...admisWithoutPhone,
      ...attenteWithoutPhone,
      ...nonAdmisWithoutPhone,
    ].map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      candidateNumber: c.candidateNumber ?? null,
      admissionStatus: c.admissionStatus,
    }));

    const totalSms = admisWithPhone.length + attenteWithPhone.length + nonAdmisWithPhone.length;

    const previewAdmis = isAnglophone
      ? `${schoolName}: [Candidate Name] has been provisionally admitted into ${levelLibelle} on the entrance exam, subject to passing ${examLibelle}. Please contact the school administration for the next steps.`
      : `${schoolName}: [Nom du candidat] est admis(e) provisoirement en ${levelLibelle} au concours d'entrée, sous réserve de la réussite au ${examLibelle}. Merci de vous présenter au secrétariat pour la suite des démarches.`;

    const previewAttente = isAnglophone
      ? `${schoolName}: [Candidate Name] is on the waiting list for entrance exam into ${levelLibelle}. You will be contacted should a place become available.`
      : `${schoolName}: [Nom du candidat] est placé(e) sur la liste complémentaire du concours d'entrée en ${levelLibelle}. Vous serez contacté(e) en cas de libération d'une place.`;

    const previewNonAdmis = isAnglophone
      ? `${schoolName}: We regret to inform you that [Candidate Name] was not admitted into ${levelLibelle} through the entrance exam. We thank you for your application and wish them great success.`
      : `${schoolName}: Nous vous informons que [Nom du candidat] n'a pas été retenu(e) au concours d'entrée en ${levelLibelle}. Nous vous remercions pour votre confiance et lui souhaitons plein succès.`;

    return {
      totalCandidats: candidats.length,
      totalSmsAEnvoyer: totalSms,
      totalSansTelephone: allWithoutPhone.length,
      candidatsSansTelephone: allWithoutPhone,
      groupes: {
        admis: {
          count: admisCands.length,
          withPhone: admisWithPhone.length,
          withoutPhone: admisWithoutPhone.length,
          previewMessage: previewAdmis,
        },
        listeAttente: {
          count: attenteCands.length,
          withPhone: attenteWithPhone.length,
          withoutPhone: attenteWithoutPhone.length,
          previewMessage: previewAttente,
        },
        nonAdmis: {
          count: nonAdmisCands.length,
          withPhone: nonAdmisWithPhone.length,
          withoutPhone: nonAdmisWithoutPhone.length,
          previewMessage: previewNonAdmis,
        },
      },
      campaignIdSuggere: `concours-${cmd.sessionId}-pub-${Date.now()}`,
      subsystem,
      examLibelle,
      levelLibelle,
      schoolName,
    };
  }
}
