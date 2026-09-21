import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import {
  notifyAdmissionProvisoireSms,
  notifyConcoursListeAttenteSms,
  notifyConcoursNonAdmisSms,
} from '@infrastructure/services/sms/SmsNotificationService';

export interface PublierResultatsCommande {
  schoolId: string;
  sessionId: string;
  confirmSmsCampaign?: boolean;
  campaignId?: string;
}

export interface PublierResultatsResultat {
  publishedAt: Date;
  smsSent: number;
  smsSkippedNoPhone: number;
  totalCandidats: number;
  campaignId?: string;
}

export class PublierResultatsConcoursUseCase {
  constructor(
    private readonly entranceRepository: EntranceExamRepository,
    private readonly schoolRepository?: SchoolRepository,
  ) {}

  async execute(cmd: PublierResultatsCommande): Promise<PublierResultatsResultat> {
    const session = await this.entranceRepository.trouverSession(cmd.sessionId);
    if (!session || session.schoolId !== cmd.schoolId) {
      throw new Error('Session de concours introuvable ou non autorisée');
    }

    if (session.status !== 'DELIBERATION') {
      throw new Error('La session doit être délibérée avant d être publiée');
    }

    const now = new Date();
    await this.entranceRepository.mettreAJourStatutSession(cmd.sessionId, 'PUBLISHED', {
      publishedAt: now,
    });

    let smsSent = 0;
    let smsSkippedNoPhone = 0;
    const candidats = await this.entranceRepository.listerCandidats(cmd.sessionId);

    if (cmd.confirmSmsCampaign !== false) {
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
      const smsPromises: Promise<void>[] = [];

      for (const c of candidats) {
        const candidateName = `${c.firstName} ${c.lastName}`;
        const parentPhone = c.parentPhone?.trim() || null;

        if (!parentPhone || parentPhone.length < 8) {
          smsSkippedNoPhone++;
          continue;
        }

        if (c.admissionStatus === 'ADMIS_PROVISOIRE' || c.admissionStatus === 'ADMIS') {
          smsPromises.push(
            notifyAdmissionProvisoireSms({
              schoolId: cmd.schoolId,
              candidateName,
              parentPhone,
              schoolName,
              level: levelLibelle,
              examName: examLibelle,
            })
          );
          smsSent++;
        } else if (c.admissionStatus === 'LISTE_ATTENTE') {
          smsPromises.push(
            notifyConcoursListeAttenteSms({
              schoolId: cmd.schoolId,
              candidateName,
              parentPhone,
              schoolName,
              level: levelLibelle,
              rank: c.rank ?? undefined,
            })
          );
          smsSent++;
        } else if (c.admissionStatus === 'NON_ADMIS' || c.admissionStatus === 'REFUSE') {
          smsPromises.push(
            notifyConcoursNonAdmisSms({
              schoolId: cmd.schoolId,
              candidateName,
              parentPhone,
              schoolName,
              level: levelLibelle,
            })
          );
          smsSent++;
        }
      }

      await Promise.all(smsPromises);
    }

    return {
      publishedAt: now,
      smsSent,
      smsSkippedNoPhone,
      totalCandidats: candidats.length,
      campaignId: cmd.campaignId,
    };
  }
}
