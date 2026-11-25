/**
 * APPLICATION — Use Case : Obtenir le profil académique d'un élève (V1.1)
 *
 * Agrège les bulletins existants (source unique — aucune re-calcul).
 * Classification par matière basée sur le passMark de l'école.
 */
import type { AcademicProfileQueryPort, BulletinProfil } from '@domain/ports/repositories/AcademicProfileQueryPort';
import type { SchoolSettingsRepository } from '@domain/ports/repositories/SchoolSettingsRepository';
import { classifierMatiere, type ClassificationMatiere } from '@domain/rules/profilAcademique';

export interface ObtenirProfilAcademiqueCommande {
  studentId: string;
  schoolId: string;
  academicYearId: string;
}

export interface MatiereProfil {
  subjectId: string;
  subjectName: string;
  coefficient: number;
  moyennesParPeriode: (number | null)[];
  moyenneAnnuelle: number;
  classification: ClassificationMatiere;
  tendance: 'HAUSSE' | 'STABLE' | 'BAISSE';
}

export interface ProfilAcademique {
  studentFirstName: string;
  studentLastName: string;
  periodes: { periodId: string; nom: string; moyenneGenerale: number | null }[];
  matieres: MatiereProfil[];
  forces: string[];
  faiblesses: string[];
  moyenneGeneraleAnnuelle: number | null;
}

export class ObtenirProfilAcademiqueUseCase {
  constructor(
    private readonly academicProfilePort: AcademicProfileQueryPort,
    private readonly settingsRepo: SchoolSettingsRepository,
  ) {}

  async execute(cmd: ObtenirProfilAcademiqueCommande): Promise<ProfilAcademique> {
    const settings = await this.settingsRepo.getParametresEffectifs(cmd.schoolId);
    const passMark = settings.passMark;

    const data = await this.academicProfilePort.obtenirProfilAcademique(
      cmd.studentId,
      cmd.schoolId,
      cmd.academicYearId,
    );

    if (!data || data.bulletins.length === 0) {
      return {
        studentFirstName: '',
        studentLastName: '',
        periodes: [],
        matieres: [],
        forces: [],
        faiblesses: [],
        moyenneGeneraleAnnuelle: null,
      };
    }

    const periodes = data.bulletins.map((b) => ({
      periodId: b.academicPeriodId,
      nom: b.academicPeriodName,
      moyenneGenerale: b.generalAverage,
    }));

    // Agréger les lignes matière par subjectId sur toutes les périodes
    const matieresMap = new Map<string, {
      subjectName: string;
      coefficient: number;
      moyennes: (number | null)[];
    }>();

    for (const bulletin of data.bulletins) {
      for (const ligne of bulletin.lignes) {
        const existing = matieresMap.get(ligne.subjectId);
        if (existing) {
          existing.moyennes.push(ligne.subjectAverage);
        } else {
          matieresMap.set(ligne.subjectId, {
            subjectName: ligne.subjectName,
            coefficient: ligne.coefficient,
            moyennes: [ligne.subjectAverage],
          });
        }
      }
    }

    const matieres: MatiereProfil[] = [];
    const forces: string[] = [];
    const faiblesses: string[] = [];
    let sommeGenerales = 0;
    let nbGenerales = 0;

    for (const [subjectId, info] of matieresMap) {
      const valeurs = info.moyennes.filter((m): m is number => m !== null && m > 0);
      const result = classifierMatiere(valeurs, passMark);

      matieres.push({
        subjectId,
        subjectName: info.subjectName,
        coefficient: info.coefficient,
        moyennesParPeriode: info.moyennes,
        moyenneAnnuelle: result.moyenneAnnuelle,
        classification: result.classification,
        tendance: result.tendance,
      });

      if (result.classification === 'FORCE') {
        forces.push(info.subjectName);
      } else if (result.classification === 'FAIBLE' || result.classification === 'CRITIQUE') {
        faiblesses.push(info.subjectName);
      }
    }

    for (const p of periodes) {
      if (p.moyenneGenerale !== null) {
        sommeGenerales += p.moyenneGenerale;
        nbGenerales++;
      }
    }

    return {
      studentFirstName: data.studentFirstName,
      studentLastName: data.studentLastName,
      periodes,
      matieres,
      forces,
      faiblesses,
      moyenneGeneraleAnnuelle: nbGenerales > 0 ? sommeGenerales / nbGenerales : null,
    };
  }
}
