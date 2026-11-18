'use client'

import { MODAL_LABEL_STYLE, MODAL_INPUT_STYLE, MODAL_SELECT_STYLE } from './referentielModalUtils'

interface Props {
  module: 'calendar' | 'tarifs'
  formData: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

/** Champs de formulaire pour les modules Calendrier Officiel et Tarifs MINESEC */
export default function ReferentielCalendarAndTarifFields({ module, formData, onChange }: Props) {
  if (module === 'calendar') {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={MODAL_LABEL_STYLE}>Année Scolaire *</label>
            <input
              type="text"
              required
              placeholder="ex. 2027-2028"
              value={String(formData.academicYear || '')}
              onChange={e => onChange('academicYear', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Ministère / Sous-système</label>
            <select
              value={String(formData.establishmentType || 'MINESEC')}
              onChange={e => onChange('establishmentType', e.target.value)}
              style={MODAL_SELECT_STYLE}
            >
              <option value="MINESEC">MINESEC (Secondaire &amp; Technique)</option>
              <option value="MINEDUB">MINEDUB (Primaire &amp; Maternelle)</option>
            </select>
          </div>
        </div>

        <div>
          <label style={MODAL_LABEL_STYLE}>Référence de l&apos;Arrêté Ministériel</label>
          <input
            type="text"
            placeholder="ex. Arrêté conjoint N° ... du 14 août ..."
            value={String(formData.arreteReference || '')}
            onChange={e => onChange('arreteReference', e.target.value)}
            style={MODAL_INPUT_STYLE}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={MODAL_LABEL_STYLE}>Date de Rentrée Officielle *</label>
            <input
              type="date"
              required
              value={formData.dateRentreeOfficielle ? String(formData.dateRentreeOfficielle).slice(0, 10) : ''}
              onChange={e => onChange('dateRentreeOfficielle', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Date de Clôture Officielle *</label>
            <input
              type="date"
              required
              value={formData.dateClotureOfficielle ? String(formData.dateClotureOfficielle).slice(0, 10) : ''}
              onChange={e => onChange('dateClotureOfficielle', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
        </div>

        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
          💡 Les trimestres et congés officiels sont automatiquement initialisés selon le schéma national (T1, T2, T3 et congés de Noël / Pâques).
        </div>
      </>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={MODAL_LABEL_STYLE}>Type de Frais Réglementaire *</label>
          <select
            value={String(formData.typeFrais || 'SCOLARITE_SECOND_CYCLE')}
            onChange={e => onChange('typeFrais', e.target.value)}
            style={MODAL_SELECT_STYLE}
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
          <label style={MODAL_LABEL_STYLE}>Année Scolaire *</label>
          <input
            type="text"
            required
            placeholder="2026-2027"
            value={String(formData.anneeScolaire || '')}
            onChange={e => onChange('anneeScolaire', e.target.value)}
            style={MODAL_INPUT_STYLE}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={MODAL_LABEL_STYLE}>Niveau (optionnel)</label>
          <input
            type="text"
            placeholder="1er_cycle, 2nd_cycle..."
            value={String(formData.niveau || '')}
            onChange={e => onChange('niveau', e.target.value)}
            style={MODAL_INPUT_STYLE}
          />
        </div>
        <div>
          <label style={MODAL_LABEL_STYLE}>Montant Officiel (FCFA) *</label>
          <input
            type="number"
            min="0"
            step="500"
            required
            placeholder="10000"
            value={Number(formData.montantFCFA ?? 0)}
            onChange={e => onChange('montantFCFA', e.target.value)}
            style={MODAL_INPUT_STYLE}
          />
        </div>
      </div>

      <div>
        <label style={MODAL_LABEL_STYLE}>Description / Arrêté de fixation</label>
        <input
          type="text"
          placeholder="ex. Barème officiel MINESEC fixant les droits scolaires publics"
          value={String(formData.description || '')}
          onChange={e => onChange('description', e.target.value)}
          style={MODAL_INPUT_STYLE}
        />
      </div>
    </>
  )
}
