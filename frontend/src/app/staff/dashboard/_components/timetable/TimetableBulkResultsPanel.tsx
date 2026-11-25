'use client'
import type React from 'react'
import { Eye, Loader2, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { type BulkResult, btnPrim, btnSec } from './timetableStaffTypes'

interface Props {
  classId: string
  bulkPropose: { current: number; total: number; className: string; errors: string[]; warnings: string[] } | null
  bulkResults: BulkResult[]
  selectedPartialIds: Set<string>
  setSelectedPartialIds: React.Dispatch<React.SetStateAction<Set<string>>>
  applyingAll: boolean
  previewLoading: boolean
  onClearBulkResults: () => void
  onOpenPreview: (result: BulkResult) => void
  onApplyAll: () => void
  onApplySelectedPartials: () => void
}

export default function TimetableBulkResultsPanel({
  classId,
  bulkPropose,
  bulkResults,
  selectedPartialIds,
  setSelectedPartialIds,
  applyingAll,
  previewLoading,
  onClearBulkResults,
  onOpenPreview,
  onApplyAll,
  onApplySelectedPartials,
}: Props) {
  const t = useT('staff')
  const applicableResults = bulkResults.filter(result => (result.status === 'success' || result.status === 'DEGRADE') && result.timetableId && result.proposal)
  const selectedPartialResults = bulkResults.filter(result => result.status === 'PARTIEL' && selectedPartialIds.has(result.classId) && result.timetableId && result.proposal)

  return (
    <>
      {bulkPropose && (
        <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: 'var(--text2)' }}>
          <div style={{ fontWeight: 700 }}>{t('timetable.bulkProposeProgress', { current: bulkPropose.current, total: bulkPropose.total, className: bulkPropose.className })}</div>
          {bulkPropose.errors.length > 0 && <div style={{ marginTop: 4, color: 'var(--red)' }}>{bulkPropose.errors.join(' · ')}</div>}
          {bulkPropose.warnings.length > 0 && <div style={{ marginTop: 4, color: 'var(--amber)' }}>{bulkPropose.warnings.join(' · ')}</div>}
        </div>
      )}

      {!classId && bulkResults.length > 0 && !bulkPropose && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <div>
              <strong style={{ fontSize: 13, color: 'var(--text)' }}>{t('timetable.bulkResultsTitle')}</strong>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('timetable.bulkApplyHelp')}</div>
            </div>
            <button type="button" style={btnSec} onClick={onClearBulkResults}><Trash2 size={13} /> {t('timetable.bulkClear')}</button>
          </div>
          {bulkResults.map(result => (
            <div key={result.classId} style={{ padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 12, color: result.status === 'error' ? 'var(--red)' : result.status === 'PARTIEL' ? 'var(--amber)' : result.status === 'applied' ? 'var(--green)' : 'var(--text2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <strong>{result.className}</strong> — {result.status === 'error' ? result.error : result.status === 'PARTIEL' ? t('timetable.bulkPartial', { hours: (result.heuresNonPlacees ?? []).reduce((total, item) => total + item.nbHeures, 0) }) : result.status === 'applied' ? t('timetable.bulkApplied') : result.status === 'DEGRADE' ? t('timetable.bulkDegraded') : t('timetable.bulkProposed')}
                  {result.status === 'DEGRADE' && result.degradeDetails?.[0] && <div style={{ marginTop: 3, color: 'var(--amber)' }}>{result.degradeDetails[0]}</div>}
                  {result.warnings.map(warning => <div key={warning} style={{ marginTop: 3, color: 'var(--amber)' }}>{warning}</div>)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {result.status === 'PARTIEL' && result.proposal && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--amber)', fontSize: 10.5, whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={selectedPartialIds.has(result.classId)}
                        onChange={event => setSelectedPartialIds(previous => {
                          const next = new Set(previous)
                          if (event.target.checked) next.add(result.classId)
                          else next.delete(result.classId)
                          return next
                        })}
                        disabled={applyingAll}
                      />
                      {t('timetable.bulkPartialSelect')}
                    </label>
                  )}
                  {result.proposal && (
                    <button type="button" style={{ ...btnSec, padding: '5px 9px', fontSize: 11 }} onClick={() => onOpenPreview(result)} disabled={previewLoading}>
                      <Eye size={13} /> {t('timetable.bulkPreview')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {applyingAll && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, padding: '8px 10px', background: 'var(--blue-light)', borderRadius: 7, color: 'var(--blue)', fontSize: 11.5, fontWeight: 700 }}>
              <Loader2 size={14} className="animate-spin" /> {t('timetable.bulkApplyingProgress', { count: applicableResults.length + selectedPartialResults.length })}
            </div>
          )}
          {applicableResults.length > 0 && (
            <button type="button" style={{ ...btnPrim, marginTop: 10 }} onClick={onApplyAll} disabled={applyingAll}>
              {applyingAll ? <Loader2 size={14} className="animate-spin" /> : null} {applyingAll ? t('timetable.bulkApplying') : t('timetable.bulkApplyAll')}
            </button>
          )}
          {selectedPartialResults.length > 0 && (
            <button type="button" style={{ ...btnSec, marginTop: 8, color: 'var(--amber)', borderColor: 'var(--amber)' }} onClick={onApplySelectedPartials} disabled={applyingAll}>
              {t('timetable.bulkApplySelectedPartials', { count: selectedPartialResults.length })}
            </button>
          )}
          {bulkResults.some(result => result.status === 'PARTIEL') && selectedPartialResults.length === 0 && (
            <div style={{ marginTop: 8, color: 'var(--amber)', fontSize: 11.5 }}>{t('timetable.bulkPartialSelectionHelp')}</div>
          )}
          {applicableResults.length === 0 && bulkResults.some(result => result.status === 'success' || result.status === 'DEGRADE') && (
            <div style={{ marginTop: 10, color: 'var(--amber)', fontSize: 11.5 }}>{t('timetable.bulkNoApplicable')}</div>
          )}
        </div>
      )}
    </>
  )
}
