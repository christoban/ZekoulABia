import type React from 'react'
import type { ReferentielModule } from '../../_types'
import type {
  OfficialAcademicCalendarDto,
  BacCoefficientDto,
  TemplateSubjectDto,
  OfficialProgressionDto,
  TarifMinesecDto,
} from '../../_api'
import {
  saveOfficialCalendar,
  saveBacCoefficient,
  saveTemplateSubject,
  saveOfficialProgression,
  saveTarifMinesec,
} from '../../_api'

export const MODAL_LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 4,
}

export const MODAL_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #d1d5db',
  fontSize: 13,
}

export const MODAL_SELECT_STYLE: React.CSSProperties = {
  ...MODAL_INPUT_STYLE,
  background: 'white',
}

export function getReferentielModalTitle(module: ReferentielModule, isEdit: boolean): string {
  const titleMap: Record<ReferentielModule, string> = {
    calendar: isEdit ? "Modifier l'Arrêté Calendrier Scolaire" : 'Nouvel Arrêté Calendrier Scolaire',
    bac: isEdit ? 'Modifier un Coefficient BAC' : 'Nouveau Coefficient BAC (Arrêté 92/22)',
    templates: isEdit ? 'Modifier Matière & Volume Horaire' : 'Nouvelle Matière par Template',
    progressions: isEdit ? 'Modifier Programme / Progression Type' : 'Nouveau Programme / Progression Type',
    tarifs: isEdit ? 'Modifier Tarif Réglementaire MINESEC' : 'Nouveau Tarif MINESEC Réglementaire',
  }
  return titleMap[module]
}

export function getDefaultReferentielFormData(module: ReferentielModule): Record<string, unknown> {
  if (module === 'calendar') {
    const nextYear = '2027-2028'
    return {
      academicYear: nextYear,
      establishmentType: 'MINESEC',
      arreteReference: `Arrêté conjoint MINESEC/MINEDUB pour l'année ${nextYear}`,
      dateRentreeOfficielle: '2027-09-06',
      dateClotureOfficielle: '2028-07-28',
      trimestres: [
        { name: 'Trimestre 1', startDate: '2027-09-06', endDate: '2027-12-03' },
        { name: 'Trimestre 2', startDate: '2027-12-06', endDate: '2028-03-24' },
        { name: 'Trimestre 3', startDate: '2028-04-10', endDate: '2028-07-28' },
      ],
      periodesVacances: [
        { name: 'Noël', startDate: '2027-12-17', endDate: '2028-01-03' },
        { name: 'Pâques', startDate: '2028-03-24', endDate: '2028-04-10' },
      ],
      active: true,
    }
  }
  if (module === 'bac') {
    return {
      subjectName: '',
      serie: 'A4',
      niveau: 'TERMINALE',
      coefficient: 2,
      groupe: 1,
      templateCode: '__ALL__',
      source: 'Arrêté N° 92/22 MINESEC du 17 Mars 2022',
      isOfficialMinesec: true,
    }
  }
  if (module === 'templates') {
    return {
      subsystem: 'FRANCOPHONE',
      templateCode: 'LYCEE_FR',
      classLevel: '6e',
      filiere: 'FR_GENERAL',
      subjectName: '',
      coefficient: 2,
      weeklyPeriods: 3,
    }
  }
  if (module === 'progressions') {
    return {
      templateCode: 'LYCEE_FR',
      level: '6e',
      filiere: 'FR_GENERAL',
      subjectName: '',
      titre: '',
      chapitresText: 'Chapitre 1: Généralités (4h)\nChapitre 2: Applications pratiques (6h)',
      active: true,
    }
  }
  return {
    typeFrais: 'SCOLARITE_SECOND_CYCLE',
    anneeScolaire: '2026-2027',
    niveau: '2nd_cycle',
    montantFCFA: 10000,
    description: 'Frais de scolarité réglementaires MINESEC',
    actif: true,
  }
}

export async function saveReferentielFormData(
  module: ReferentielModule,
  formData: Record<string, unknown>,
): Promise<string> {
  if (module === 'calendar') {
    const calData: Partial<OfficialAcademicCalendarDto> = {
      id: formData.id as string | undefined,
      academicYear: String(formData.academicYear || ''),
      establishmentType: String(formData.establishmentType || 'MINESEC'),
      arreteReference: formData.arreteReference ? String(formData.arreteReference) : null,
      dateRentreeOfficielle: String(formData.dateRentreeOfficielle || ''),
      dateClotureOfficielle: String(formData.dateClotureOfficielle || ''),
      trimestres: (formData.trimestres as OfficialAcademicCalendarDto['trimestres']) || [],
      periodesVacances: (formData.periodesVacances as OfficialAcademicCalendarDto['periodesVacances']) || [],
      active: formData.active !== false,
    }
    await saveOfficialCalendar(calData)
    return `Calendrier scolaire ${calData.academicYear} enregistré avec succès.`
  }

  if (module === 'bac') {
    const bacData: Partial<BacCoefficientDto> = {
      id: formData.id as string | undefined,
      subjectName: String(formData.subjectName || ''),
      serie: String(formData.serie || ''),
      niveau: (formData.niveau || 'TERMINALE') as 'SECONDE' | 'PREMIERE' | 'TERMINALE',
      coefficient: Number(formData.coefficient || 1),
      groupe: Number(formData.groupe || 1),
      templateCode: String(formData.templateCode || '__ALL__'),
      source: String(formData.source || 'Arrêté N° 92/22 MINESEC'),
      isOfficialMinesec: true,
    }
    await saveBacCoefficient(bacData)
    return `Coefficient BAC pour ${bacData.subjectName} (${bacData.serie}) enregistré.`
  }

  if (module === 'templates') {
    const subData: Partial<TemplateSubjectDto> & { subsystem?: 'FRANCOPHONE' | 'ANGLOPHONE' } = {
      id: formData.id as string | undefined,
      subsystem: (formData.subsystem || 'FRANCOPHONE') as 'FRANCOPHONE' | 'ANGLOPHONE',
      templateCode: String(formData.templateCode || ''),
      classLevel: String(formData.classLevel || ''),
      subjectName: String(formData.subjectName || ''),
      coefficient: Number(formData.coefficient || 1),
      weeklyPeriods: formData.weeklyPeriods ? Number(formData.weeklyPeriods) : null,
      filiere: String(formData.filiere || 'FR_GENERAL'),
    }
    await saveTemplateSubject(subData)
    return `Matière de référence ${subData.subjectName} (${subData.templateCode}) enregistrée.`
  }

  if (module === 'progressions') {
    let chapitres = formData.chapitres as OfficialProgressionDto['chapitres'] | undefined
    if (!chapitres && typeof formData.chapitresText === 'string') {
      chapitres = formData.chapitresText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map((line, idx) => ({
          ordre: idx + 1,
          titre: line.replace(/^\d+[\.\-)]\s*/, ''),
          volumeHeuresPrevu: 4,
          sequenceCibleFin: Math.min(6, Math.floor(idx / 2) + 1),
        }))
    }
    const progData: Partial<OfficialProgressionDto> = {
      id: formData.id as string | undefined,
      templateCode: String(formData.templateCode || '__ALL__'),
      level: String(formData.level || ''),
      filiere: formData.filiere ? String(formData.filiere) : '',
      subjectName: String(formData.subjectName || ''),
      titre: String(formData.titre || `Programme ${formData.subjectName} ${formData.level}`),
      chapitres: chapitres || [],
      active: formData.active !== false,
    }
    await saveOfficialProgression(progData)
    return `Progression type «${progData.titre}» enregistrée.`
  }

  const tarifData: Partial<TarifMinesecDto> = {
    id: formData.id as string | undefined,
    typeFrais: String(formData.typeFrais || ''),
    anneeScolaire: String(formData.anneeScolaire || ''),
    niveau: formData.niveau ? String(formData.niveau) : null,
    montantFCFA: Number(formData.montantFCFA || 0),
    description: formData.description ? String(formData.description) : null,
    actif: formData.actif !== false,
  }
  await saveTarifMinesec(tarifData)
  return `Tarif réglementaire MINESEC ${tarifData.typeFrais} (${tarifData.anneeScolaire}) enregistré.`
}
