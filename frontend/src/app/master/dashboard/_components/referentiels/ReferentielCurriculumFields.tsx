'use client'

import { MODAL_LABEL_STYLE, MODAL_INPUT_STYLE, MODAL_SELECT_STYLE } from './referentielModalUtils'

interface Props {
  module: 'bac' | 'templates' | 'progressions'
  formData: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

/** Champs de formulaire pour les modules Coefficients BAC, Matières Template et Progressions Types */
export default function ReferentielCurriculumFields({ module, formData, onChange }: Props) {
  if (module === 'bac') {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={MODAL_LABEL_STYLE}>Nom de la Matière *</label>
            <input
              type="text"
              required
              placeholder="ex. Mathématiques, Histoire, LV2..."
              value={String(formData.subjectName || '')}
              onChange={e => onChange('subjectName', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Série BAC *</label>
            <input
              type="text"
              required
              placeholder="A1, A4, C, D, TI..."
              value={String(formData.serie || '')}
              onChange={e => onChange('serie', e.target.value.toUpperCase())}
              style={MODAL_INPUT_STYLE}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={MODAL_LABEL_STYLE}>Niveau</label>
            <select
              value={String(formData.niveau || 'TERMINALE')}
              onChange={e => onChange('niveau', e.target.value)}
              style={MODAL_SELECT_STYLE}
            >
              <option value="SECONDE">Seconde</option>
              <option value="PREMIERE">Première</option>
              <option value="TERMINALE">Terminale</option>
            </select>
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Coefficient *</label>
            <input
              type="number"
              step="0.5"
              min="1"
              max="10"
              required
              value={Number(formData.coefficient ?? 1)}
              onChange={e => onChange('coefficient', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Groupe</label>
            <select
              value={Number(formData.groupe ?? 1)}
              onChange={e => onChange('groupe', Number(e.target.value))}
              style={MODAL_SELECT_STYLE}
            >
              <option value={1}>G1 (Fondamentale)</option>
              <option value={2}>G2 (Transversale)</option>
            </select>
          </div>
        </div>

        <div>
          <label style={MODAL_LABEL_STYLE}>Source Officielle</label>
          <input
            type="text"
            value={String(formData.source || 'Arrêté N° 92/22 MINESEC du 17 Mars 2022')}
            onChange={e => onChange('source', e.target.value)}
            style={MODAL_INPUT_STYLE}
          />
        </div>
      </>
    )
  }

  if (module === 'templates') {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={MODAL_LABEL_STYLE}>Sous-système</label>
            <select
              value={String(formData.subsystem || 'FRANCOPHONE')}
              onChange={e => onChange('subsystem', e.target.value)}
              style={MODAL_SELECT_STYLE}
            >
              <option value="FRANCOPHONE">Francophone</option>
              <option value="ANGLOPHONE">Anglophone</option>
            </select>
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Code Template *</label>
            <input
              type="text"
              required
              placeholder="LYCEE_FR, CES_FR, GHS_EN..."
              value={String(formData.templateCode || '')}
              onChange={e => onChange('templateCode', e.target.value.toUpperCase())}
              style={MODAL_INPUT_STYLE}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={MODAL_LABEL_STYLE}>Niveau de classe *</label>
            <input
              type="text"
              required
              placeholder="6e, 5e, 2nde, Form1, Form2..."
              value={String(formData.classLevel || '')}
              onChange={e => onChange('classLevel', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Filière</label>
            <input
              type="text"
              placeholder="FR_GENERAL, FR_PEBS, EN_GENERAL..."
              value={String(formData.filiere || 'FR_GENERAL')}
              onChange={e => onChange('filiere', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={MODAL_LABEL_STYLE}>Matière *</label>
            <input
              type="text"
              required
              placeholder="ex. Mathématiques"
              value={String(formData.subjectName || '')}
              onChange={e => onChange('subjectName', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Coefficient *</label>
            <input
              type="number"
              step="0.5"
              min="1"
              required
              value={Number(formData.coefficient ?? 2)}
              onChange={e => onChange('coefficient', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
          <div>
            <label style={MODAL_LABEL_STYLE}>Heures/Sem.</label>
            <input
              type="number"
              min="1"
              max="15"
              value={formData.weeklyPeriods ? Number(formData.weeklyPeriods) : ''}
              onChange={e => onChange('weeklyPeriods', e.target.value)}
              style={MODAL_INPUT_STYLE}
            />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={MODAL_LABEL_STYLE}>Template Code *</label>
          <input
            type="text"
            required
            placeholder="LYCEE_FR, CES_FR..."
            value={String(formData.templateCode || 'LYCEE_FR')}
            onChange={e => onChange('templateCode', e.target.value.toUpperCase())}
            style={MODAL_INPUT_STYLE}
          />
        </div>
        <div>
          <label style={MODAL_LABEL_STYLE}>Niveau *</label>
          <input
            type="text"
            required
            placeholder="6e, 5e, 2nde, Form1..."
            value={String(formData.level || '')}
            onChange={e => onChange('level', e.target.value)}
            style={MODAL_INPUT_STYLE}
          />
        </div>
        <div>
          <label style={MODAL_LABEL_STYLE}>Matière *</label>
          <input
            type="text"
            required
            placeholder="ex. Mathématiques"
            value={String(formData.subjectName || '')}
            onChange={e => onChange('subjectName', e.target.value)}
            style={MODAL_INPUT_STYLE}
          />
        </div>
      </div>

      <div>
        <label style={MODAL_LABEL_STYLE}>Titre du Programme Officiel *</label>
        <input
          type="text"
          required
          placeholder="ex. Programme National APC Mathématiques 6e"
          value={String(formData.titre || '')}
          onChange={e => onChange('titre', e.target.value)}
          style={MODAL_INPUT_STYLE}
        />
      </div>

      <div>
        <label style={MODAL_LABEL_STYLE}>Chapitres Types (un chapitre par ligne)</label>
        <textarea
          rows={4}
          placeholder="Chapitre 1: Titre du chapitre (volume h)&#10;Chapitre 2: Titre suivant"
          value={String(formData.chapitresText || '')}
          onChange={e => onChange('chapitresText', e.target.value)}
          style={{ ...MODAL_INPUT_STYLE, fontFamily: 'inherit' }}
        />
      </div>
    </>
  )
}
