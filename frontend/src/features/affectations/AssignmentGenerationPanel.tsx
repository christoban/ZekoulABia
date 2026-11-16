'use client'

import { Loader2, Sparkles, ChevronDown } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface GenerationCandidate {
  teacherId: string
  chargeActuelleHeures: number
  capaciteHeures: number | null
  estAP: boolean
}

export interface UnresolvedItem {
  classId: string
  className: string
  subjectName: string
  raison: string
  details?: {
    weeklyPeriods: number | null
    candidats: GenerationCandidate[]
  }
}

export interface GenerationResult {
  createdCount: number
  rebalancedCount?: number
  nonResolus: UnresolvedItem[]
  horsPerimetre: { classId: string; className: string; subjectName: string }[]
}

const sCard: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  padding: '14px 18px',
}

export function GenerateAllBanner({ generatingAll, onGenerateAll }: { generatingAll: boolean; onGenerateAll: () => void }) {
  const t = useT('staff')
  return (
    <div style={{ ...sCard, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('affectations.generateAllTitle')}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('affectations.generateAllHint')}</div>
      </div>
      <button type="button" onClick={onGenerateAll} disabled={generatingAll} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50 cursor-pointer border-0">
        {generatingAll ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
        {generatingAll ? t('affectations.generatingAll') : t('affectations.generateAllButton')}
      </button>
    </div>
  )
}

export function AssignmentGenerationPanel({
  generating,
  generationResult,
  onGenerate,
}: {
  generating: boolean
  generationResult: GenerationResult | null
  onGenerate: () => void
}) {
  const t = useT('staff')

  return (
    <div style={{ ...sCard, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('affectations.generateTitle')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('affectations.generateHint')}</div>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-btn-primary cursor-pointer border-0"
        >
          {generating ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <Sparkles size={15} strokeWidth={2} />}
          {t('affectations.generateButton')}
        </button>
      </div>

      {generationResult && (
        <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>
              {t('affectations.generatedCreated', { count: generationResult.createdCount })}
            </div>
            {generationResult.rebalancedCount !== undefined && generationResult.rebalancedCount > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 700 }}>
                {t('affectations.generatedRebalanced', { count: generationResult.rebalancedCount })}
              </div>
            )}
            {generationResult.nonResolus.length > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--orange)', fontWeight: 700 }}>
                {t('affectations.generatedUnresolved', { count: generationResult.nonResolus.length })}
              </div>
            )}
            {generationResult.horsPerimetre.length > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 700 }}>
                {t('affectations.generatedOutOfScope', { count: generationResult.horsPerimetre.length })}
              </div>
            )}
          </div>

          {generationResult.nonResolus.length > 0 && (
            <details style={{ marginBottom: 8 }}>
              <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--orange)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown size={14} /> {t('affectations.unresolvedTitle')}
              </summary>
              <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: 'var(--text2)' }}>
                {generationResult.nonResolus.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: 6 }}>
                    <div>{item.className} — {item.subjectName} : {t(`affectations.reason.${item.raison}`)}</div>
                    {item.details && item.details.candidats.length > 0 && (
                      <div style={{ marginTop: 3, color: 'var(--text3)', fontSize: 11 }}>
                        {item.details.candidats.map((candidate) => (
                          <div key={candidate.teacherId}>
                            {t('affectations.candidateLoad', {
                              teacher: candidate.teacherId,
                              load: candidate.chargeActuelleHeures,
                              capacity: candidate.capaciteHeures ?? t('affectations.capacityUnconfigured'),
                              ap: candidate.estAP ? t('affectations.apBadge') : '',
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {generationResult.horsPerimetre.length > 0 && (
            <details>
              <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronDown size={14} /> {t('affectations.outOfScopeTitle')}
              </summary>
              <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: 'var(--text2)' }}>
                {generationResult.horsPerimetre.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: 3 }}>{item.className} — {item.subjectName}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

