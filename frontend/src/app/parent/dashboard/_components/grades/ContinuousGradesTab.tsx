'use client'

import { Award } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { thSt, tdSt, type ContinuousGradeItem, type SequenceItem } from './types'

interface Props {
  sequences: SequenceItem[]
  selectedSequenceId: string
  onSelectSequence: (id: string) => void
  continuousAverage: number | null
  continuousGrades: ContinuousGradeItem[]
  seqLoading: boolean
}

export default function ContinuousGradesTab({
  sequences,
  selectedSequenceId,
  onSelectSequence,
  continuousAverage,
  continuousGrades,
  seqLoading,
}: Props) {
  const t = useT('parent')

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Barre de sélection de séquence & Moyenne */}
      <div
        className="p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[var(--text2)]">{t('continuousGrades.sequenceFilter')} :</span>
          {sequences.length > 0 ? (
            <select
              value={selectedSequenceId}
              onChange={(e) => onSelectSequence(e.target.value)}
              className="h-8 px-2.5 rounded-lg text-xs font-bold border cursor-pointer focus:outline-none"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.isCurrent ? '· En cours' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-[var(--text3)]">Chargement des séquences…</span>
          )}
        </div>

        {continuousAverage !== null && (
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="text-xs font-bold text-[var(--text3)]">{t('continuousGrades.average')} :</span>
            <span
              className="text-base sm:text-lg font-black"
              style={{
                color:
                  continuousAverage >= 14
                    ? 'var(--green)'
                    : continuousAverage >= 10
                    ? 'var(--blue)'
                    : 'var(--red)',
              }}
            >
              {continuousAverage.toFixed(2)}/20
            </span>
          </div>
        )}
      </div>

      {/* Tableau des notes séquentielles */}
      {seqLoading ? (
        <div className="py-12 text-center text-xs text-[var(--text3)] font-semibold">{t('loading')}</div>
      ) : continuousGrades.length === 0 ? (
        <div
          className="p-8 rounded-2xl border text-center space-y-2 shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <Award size={36} className="mx-auto text-[var(--text3)]" />
          <div className="text-sm font-bold text-[var(--text)]">{t('continuousGrades.empty')}</div>
        </div>
      ) : (
        <div
          className="rounded-2xl border overflow-hidden shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead>
                <tr>
                  <th style={thSt}>{t('continuousGrades.subject')}</th>
                  <th style={thSt}>{t('continuousGrades.coef')}</th>
                  <th style={thSt}>{t('continuousGrades.note')}</th>
                  <th style={thSt}>{t('continuousGrades.appreciation')}</th>
                </tr>
              </thead>
              <tbody>
                {continuousGrades.map((g) => {
                  const noteVal = g.value
                  const color =
                    noteVal !== null
                      ? noteVal >= 14
                        ? 'var(--green)'
                        : noteVal >= 10
                        ? 'var(--blue)'
                        : 'var(--red)'
                      : 'var(--text3)'

                  return (
                    <tr
                      key={g.id}
                      className="hover:bg-[var(--bg2)] transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                        {g.subject?.name || 'Matière'}
                      </td>
                      <td style={tdSt}>×{g.coefficient}</td>
                      <td style={{ ...tdSt, fontWeight: 900, fontSize: 14, color }}>
                        {noteVal !== null ? `${noteVal.toFixed(1)}/20` : '—'}
                      </td>
                      <td style={{ ...tdSt, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>
                        {g.appreciation || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
