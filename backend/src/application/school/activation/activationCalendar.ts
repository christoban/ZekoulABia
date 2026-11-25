import type { SchoolActivationTx } from '@domain/ports/repositories/SchoolActivationRepository';
import { APC_UNITES } from '../curriculum/primaire-apc';
import { CALENDRIER_OFFICIEL_NATIONAL_DEFAULTS } from '@domain/constants/SystemeEducatifCameroun';

export interface CalendarCreationParams {
  tx: SchoolActivationTx;
  config: Record<string, unknown>;
  isPrimaire: boolean;
  isAnglophone: boolean;
  hasPrimaireContent: boolean;
  hasSecondaireContent: boolean;
  isComplexe: boolean;
}

export interface CalendarCreationResult {
  academicYear: { id: string };
  academicYearName: string;
  periodsCount: number;
}

export async function creerCalendrierInitial(params: CalendarCreationParams): Promise<CalendarCreationResult> {
  const { tx, config, isPrimaire, isAnglophone, hasPrimaireContent, hasSecondaireContent, isComplexe } = params;

  // 1. Créer l'année académique (adossement sur le calendrier officiel national par défaut)
  const yStart = config.academicYearStart
    ? new Date(config.academicYearStart as string)
    : new Date(CALENDRIER_OFFICIEL_NATIONAL_DEFAULTS.RENTREE);
  const yEnd = config.academicYearEnd
    ? new Date(config.academicYearEnd as string)
    : new Date(CALENDRIER_OFFICIEL_NATIONAL_DEFAULTS.CLOTURE);
  const academicYearName = (config.academicYearName as string) || CALENDRIER_OFFICIEL_NATIONAL_DEFAULTS.ANNEE;
  const academicYear = await tx.creerAnnee({ name: academicYearName, startDate: yStart, endDate: yEnd });

  // 2. Créer les périodes
  const canConfigurePeriods = !isPrimaire && !isAnglophone && !hasPrimaireContent;
  const requestedPeriods = Number(config?.periodsCount);
  const periodsCount = canConfigurePeriods && requestedPeriods === 2 ? 2 : 3;
  const isSemester = periodsCount === 2;
  const periodType = isAnglophone ? ('TERM' as const) : ('TRIMESTER' as const);
  const periodLabel = isAnglophone ? 'Term' : isSemester ? 'Semestre' : 'Trimestre';

  // Nombre de séquences par période (FR secondaire/technique uniquement) — défaut 2
  const requestedSeq = Number(config?.sequencesPerPeriod);
  const seqPerPeriod = canConfigurePeriods && requestedSeq >= 1 && requestedSeq <= 6 ? Math.floor(requestedSeq) : 2;

  // Découpage des dates : parts égales sur [yStart, yEnd]
  const msTotal = yEnd.getTime() - yStart.getTime();
  let runningSeq = 0;

  for (let i = 0; i < periodsCount; i++) {
    const pStart = i === 0 ? yStart : new Date(yStart.getTime() + Math.round((msTotal * i) / periodsCount));
    const pEnd =
      i === periodsCount - 1
        ? yEnd
        : new Date(yStart.getTime() + Math.round((msTotal * (i + 1)) / periodsCount) - 86400000);

    const period = await tx.creerPeriode({
      academicYearId: academicYear.id,
      name: `${periodLabel} ${i + 1}`,
      type: periodType,
      orderIndex: i + 1,
      startDate: pStart,
      endDate: pEnd,
      isCurrent: i === 0,
    });

    // 3. Créer les séquences/UA par période
    type SeqDef = { name: string; type: 'DS' | 'COMPOSITION' | 'CLASS_TEST' | 'TERMINAL_EXAM' | 'UA' };
    let seqDefs: SeqDef[];

    if (isComplexe) {
      seqDefs = [];
      if (hasPrimaireContent) {
        seqDefs.push(...APC_UNITES[i].unites.map((ua) => ({ name: ua, type: 'UA' as const })));
      }
      if (hasSecondaireContent) {
        if (isAnglophone) {
          seqDefs.push({ name: 'Sequence 1', type: 'CLASS_TEST' }, { name: 'Sequence 2', type: 'TERMINAL_EXAM' });
        } else {
          for (let s = 0; s < seqPerPeriod; s++) {
            runningSeq += 1;
            seqDefs.push({ name: `Séquence ${runningSeq}`, type: 'DS' });
          }
        }
      }
    } else {
      seqDefs = isPrimaire
        ? APC_UNITES[i].unites.map((ua) => ({ name: ua, type: 'UA' as const }))
        : isAnglophone
          ? [
              { name: 'Sequence 1', type: 'CLASS_TEST' },
              { name: 'Sequence 2', type: 'TERMINAL_EXAM' },
            ]
          : Array.from({ length: seqPerPeriod }, () => {
              runningSeq += 1;
              return { name: `Séquence ${runningSeq}`, type: 'DS' as const };
            });
    }

    for (let j = 0; j < seqDefs.length; j++) {
      await tx.creerSequence({
        academicPeriodId: period.id,
        name: seqDefs[j].name,
        type: seqDefs[j].type,
        orderIndex: j + 1,
        isCurrent: i === 0 && j === 0,
      });
    }
  }

  return { academicYear, academicYearName, periodsCount };
}
