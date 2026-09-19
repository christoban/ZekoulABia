'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import type { ReferentielModule } from '../_types'
import type {
  OfficialAcademicCalendarDto,
  BacCoefficientDto,
  TemplateSubjectDto,
  OfficialProgressionDto,
  TarifMinesecDto,
} from '../_api'
import {
  saveOfficialCalendar,
  saveBacCoefficient,
  saveTemplateSubject,
  saveOfficialProgression,
  saveTarifMinesec,
} from '../_api'

interface Props {
  open: boolean
  module: ReferentielModule
  item: Record<string, unknown> | null
  onClose: () => void
  onSaved: (msg: string) => void
}

export default function ReferentielEditModal({ open, module, item, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!open) return
    setError(null)
    if (item) {
      setFormData({ ...item })
    } else {
      // Valeurs par défaut selon le module
      if (module === 'calendar') {
        const nextYear = '2027-2028'
        setFormData({
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
        })
      } else if (module === 'bac') {
        setFormData({
          subjectName: '',
          serie: 'A4',
          niveau: 'TERMINALE',
          coefficient: 2,
          groupe: 1,
          templateCode: '__ALL__',
          source: 'Arrêté N° 92/22 MINESEC du 17 Mars 2022',
          isOfficialMinesec: true,
        })
      } else if (module === 'templates') {
        setFormData({
          subsystem: 'FRANCOPHONE',
          templateCode: 'LYCEE_FR',
          classLevel: '6e',
          filiere: 'FR_GENERAL',
          subjectName: '',
          coefficient: 2,
          weeklyPeriods: 3,
        })
      } else if (module === 'progressions') {
        setFormData({
          templateCode: 'LYCEE_FR',
          level: '6e',
          filiere: 'FR_GENERAL',
          subjectName: '',
          titre: '',
          chapitresText: 'Chapitre 1: Généralités (4h)\nChapitre 2: Applications pratiques (6h)',
          active: true,
        })
      } else if (module === 'tarifs') {
        setFormData({
          typeFrais: 'SCOLARITE_SECOND_CYCLE',
          anneeScolaire: '2026-2027',
          niveau: '2nd_cycle',
          montantFCFA: 10000,
          description: 'Frais de scolarité réglementaires MINESEC',
          actif: true,
        })
      }
    }
  }, [open, module, item])

  if (!open) return null

  const handleChange = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
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
        onSaved(`Calendrier scolaire ${calData.academicYear} enregistré avec succès.`)
      } else if (module === 'bac') {
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
        onSaved(`Coefficient BAC pour ${bacData.subjectName} (${bacData.serie}) enregistré.`)
      } else if (module === 'templates') {
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
        onSaved(`Matière de référence ${subData.subjectName} (${subData.templateCode}) enregistrée.`)
      } else if (module === 'progressions') {
        // Parser le texte des chapitres si nécessaire
        let chapitres = formData.chapitres as { ordre: number; titre: string; volumeHeuresPrevu: number; sequenceCibleFin?: number }[]
        if (!chapitres && typeof formData.chapitresText === 'string') {
          chapitres = (formData.chapitresText as string)
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
          templateCode: String(formData.templateCode || ''),
          level: String(formData.level || ''),
          filiere: formData.filiere ? String(formData.filiere) : null,
          subjectName: String(formData.subjectName || ''),
          titre: String(formData.titre || `Programme ${formData.subjectName} ${formData.level}`),
          chapitres: chapitres || [],
          active: formData.active !== false,
        }
        await saveOfficialProgression(progData)
        onSaved(`Progression type «${progData.titre}» enregistrée.`)
      } else if (module === 'tarifs') {
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
        onSaved(`Tarif réglementaire MINESEC ${tarifData.typeFrais} (${tarifData.anneeScolaire}) enregistré.`)
      }
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
    } finally {
      setLoading(false)
    }
  }

  const titleMap: Record<ReferentielModule, string> = {
    calendar: item ? "Modifier l'Arrêté Calendrier Scolaire" : "Nouvel Arrêté Calendrier Scolaire",
    bac: item ? "Modifier un Coefficient BAC" : "Nouveau Coefficient BAC (Arrêté 92/22)",
    templates: item ? "Modifier Matière & Volume Horaire" : "Nouvelle Matière par Template",
    progressions: item ? "Modifier Programme / Progression Type" : "Nouveau Programme / Progression Type",
    tarifs: item ? "Modifier Tarif Réglementaire MINESEC" : "Nouveau Tarif MINESEC Réglementaire",
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb',
        fontFamily: 'var(--font-nunito), Nunito, sans-serif'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa',
          borderTopLeftRadius: 16, borderTopRightRadius: 16
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
              {titleMap[module]}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Donnée de référence nationale • Garde-fou d'isolation locale garanti
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
            padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
              color: '#b91c1c', fontSize: 13, fontWeight: 600
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Calendrier Scolaire Officiel */}
          {module === 'calendar' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Année Scolaire *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex. 2027-2028"
                    value={String(formData.academicYear || '')}
                    onChange={e => handleChange('academicYear', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Ministère / Sous-système
                  </label>
                  <select
                    value={String(formData.establishmentType || 'MINESEC')}
                    onChange={e => handleChange('establishmentType', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: 'white' }}
                  >
                    <option value="MINESEC">MINESEC (Secondaire & Technique)</option>
                    <option value="MINEDUB">MINEDUB (Primaire & Maternelle)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                  Référence de l'Arrêté Ministériel
                </label>
                <input
                  type="text"
                  placeholder="ex. Arrêté conjoint N° ... du 14 août ..."
                  value={String(formData.arreteReference || '')}
                  onChange={e => handleChange('arreteReference', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Date de Rentrée Officielle *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dateRentreeOfficielle ? String(formData.dateRentreeOfficielle).slice(0, 10) : ''}
                    onChange={e => handleChange('dateRentreeOfficielle', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Date de Clôture Officielle *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.dateClotureOfficielle ? String(formData.dateClotureOfficielle).slice(0, 10) : ''}
                    onChange={e => handleChange('dateClotureOfficielle', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                💡 Les trimestres et congés officiels sont automatiquement initialisés selon le schéma national (T1, T2, T3 et congés de Noël / Pâques).
              </div>
            </>
          )}

          {/* Coefficients BAC */}
          {module === 'bac' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Nom de la Matière *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex. Mathématiques, Histoire, LV2..."
                    value={String(formData.subjectName || '')}
                    onChange={e => handleChange('subjectName', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Série BAC *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="A1, A4, C, D, TI..."
                    value={String(formData.serie || '')}
                    onChange={e => handleChange('serie', e.target.value.toUpperCase())}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Niveau
                  </label>
                  <select
                    value={String(formData.niveau || 'TERMINALE')}
                    onChange={e => handleChange('niveau', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: 'white' }}
                  >
                    <option value="SECONDE">Seconde</option>
                    <option value="PREMIERE">Première</option>
                    <option value="TERMINALE">Terminale</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Coefficient *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    required
                    value={Number(formData.coefficient ?? 1)}
                    onChange={e => handleChange('coefficient', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Groupe
                  </label>
                  <select
                    value={Number(formData.groupe ?? 1)}
                    onChange={e => handleChange('groupe', Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: 'white' }}
                  >
                    <option value={1}>G1 (Fondamentale)</option>
                    <option value={2}>G2 (Transversale)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                  Source Officielle
                </label>
                <input
                  type="text"
                  value={String(formData.source || 'Arrêté N° 92/22 MINESEC du 17 Mars 2022')}
                  onChange={e => handleChange('source', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </div>
            </>
          )}

          {/* Matières & Volumes Horaires Template */}
          {module === 'templates' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Sous-système
                  </label>
                  <select
                    value={String(formData.subsystem || 'FRANCOPHONE')}
                    onChange={e => handleChange('subsystem', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: 'white' }}
                  >
                    <option value="FRANCOPHONE">Francophone</option>
                    <option value="ANGLOPHONE">Anglophone</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Code Template *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="LYCEE_FR, CES_FR, GHS_EN..."
                    value={String(formData.templateCode || '')}
                    onChange={e => handleChange('templateCode', e.target.value.toUpperCase())}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Niveau de classe *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="6e, 5e, 2nde, Form1, Form2..."
                    value={String(formData.classLevel || '')}
                    onChange={e => handleChange('classLevel', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Filière
                  </label>
                  <input
                    type="text"
                    placeholder="FR_GENERAL, FR_PEBS, EN_GENERAL..."
                    value={String(formData.filiere || 'FR_GENERAL')}
                    onChange={e => handleChange('filiere', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Matière *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex. Mathématiques"
                    value={String(formData.subjectName || '')}
                    onChange={e => handleChange('subjectName', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Coefficient *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={Number(formData.coefficient ?? 2)}
                    onChange={e => handleChange('coefficient', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Heures/Sem.
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={formData.weeklyPeriods ? Number(formData.weeklyPeriods) : ''}
                    onChange={e => handleChange('weeklyPeriods', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Programmes & Progressions */}
          {module === 'progressions' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Template Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="LYCEE_FR, CES_FR..."
                    value={String(formData.templateCode || 'LYCEE_FR')}
                    onChange={e => handleChange('templateCode', e.target.value.toUpperCase())}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Niveau *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="6e, 5e, 2nde, Form1..."
                    value={String(formData.level || '')}
                    onChange={e => handleChange('level', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Matière *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex. Mathématiques"
                    value={String(formData.subjectName || '')}
                    onChange={e => handleChange('subjectName', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                  Titre du Programme Officiel *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex. Programme National APC Mathématiques 6e"
                  value={String(formData.titre || '')}
                  onChange={e => handleChange('titre', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                  Chapitres Types (un chapitre par ligne)
                </label>
                <textarea
                  rows={4}
                  placeholder="Chapitre 1: Titre du chapitre (volume h)&#10;Chapitre 2: Titre suivant"
                  value={String(formData.chapitresText || '')}
                  onChange={e => handleChange('chapitresText', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontFamily: 'inherit' }}
                />
              </div>
            </>
          )}

          {/* Tarifs MINESEC */}
          {module === 'tarifs' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Type de Frais Réglementaire *
                  </label>
                  <select
                    value={String(formData.typeFrais || 'SCOLARITE_SECOND_CYCLE')}
                    onChange={e => handleChange('typeFrais', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, background: 'white' }}
                  >
                    <option value="SCOLARITE_PREMIER_CYCLE">Scolarité 1er Cycle</option>
                    <option value="SCOLARITE_SECOND_CYCLE">Scolarité 2nd Cycle</option>
                    <option value="EXAMEN_BEPC">Examen BEPC</option>
                    <option value="EXAMEN_PROBATOIRE">Examen Probatoire</option>
                    <option value="EXAMEN_BAC">Examen BAC</option>
                    <option value="EXAMEN_GCE_OL">Examen GCE O-Level</option>
                    <option value="EXAMEN_GCE_AL">Examen GCE A-Level</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Année Scolaire *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2026-2027"
                    value={String(formData.anneeScolaire || '')}
                    onChange={e => handleChange('anneeScolaire', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Niveau (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="1er_cycle, 2nd_cycle..."
                    value={String(formData.niveau || '')}
                    onChange={e => handleChange('niveau', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                    Montant Officiel (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    placeholder="10000"
                    value={Number(formData.montantFCFA ?? 0)}
                    onChange={e => handleChange('montantFCFA', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
                  Description / Arrêté de fixation
                </label>
                <input
                  type="text"
                  placeholder="ex. Barème officiel MINESEC fixant les droits scolaires publics"
                  value={String(formData.description || '')}
                  onChange={e => handleChange('description', e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                />
              </div>
            </>
          )}

          {/* Footer Buttons */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            marginTop: 12, paddingTop: 16, borderTop: '1px solid #f3f4f6'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db',
                background: 'white', color: '#374151', fontSize: 13, fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: '#1a2e1e', color: 'white', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <Save size={15} />
              {loading ? 'Enregistrement...' : 'Enregistrer le Référentiel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
