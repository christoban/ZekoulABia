'use client'

import type { FormEvent } from 'react'
import type { AcademicYearItem } from './classesShared'

interface Props {
  isOpen: boolean
  academicYears: AcademicYearItem[]
  anneeActuelleId: string
  anneeSuivanteId: string
  proposing: boolean
  onChangeActuelle: (v: string) => void
  onChangeSuivante: (v: string) => void
  onClose: () => void
  onSubmit: (e: FormEvent) => void
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  background: 'var(--bg2)',
  border: '1px solid var(--border2)',
  color: 'var(--text)',
  fontSize: 12,
}

export default function ClassStaffProposeModal({
  isOpen,
  academicYears,
  anneeActuelleId,
  anneeSuivanteId,
  proposing,
  onChangeActuelle,
  onChangeSuivante,
  onClose,
  onSubmit,
}: Props) {
  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90%' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>Proposer la structure d&apos;année N+1</h2>
        <p style={{ fontSize: 12, color: 'var(--text2)', margin: '0 0 16px 0' }}>
          Duplique les classes actives de l&apos;année actuelle vers l&apos;année cible sous forme de classes DRAFT. La validation finale relève du Proviseur (ADMIN).
        </p>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              Année Actuelle (Source) *
            </label>
            {academicYears.length > 0 ? (
              <select value={anneeActuelleId} onChange={e => onChangeActuelle(e.target.value)} required style={fieldStyle}>
                <option value="">-- Sélectionner l&apos;année source --</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? '(Actuelle)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" value={anneeActuelleId} onChange={e => onChangeActuelle(e.target.value)} placeholder="ID de l'année actuelle" required style={fieldStyle} />
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              Année Cible N+1 *
            </label>
            {academicYears.length > 0 ? (
              <select value={anneeSuivanteId} onChange={e => onChangeSuivante(e.target.value)} required style={fieldStyle}>
                <option value="">-- Sélectionner l&apos;année cible N+1 --</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? '(Actuelle)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input type="text" value={anneeSuivanteId} onChange={e => onChangeSuivante(e.target.value)} placeholder="ID de l'année suivante N+1" required style={fieldStyle} />
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>
              Annuler
            </button>
            <button type="submit" disabled={proposing} style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--amber)', border: 'none', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {proposing ? 'Envoi...' : 'Proposer la structure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

