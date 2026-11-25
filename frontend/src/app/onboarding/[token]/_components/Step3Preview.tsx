'use client'

import { School } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { templateDisplayName } from '@/lib/onboarding/templateSelection'
import { FIRST_CYCLE_LEVELS, SECOND_CYCLE_LEVELS } from '../_helpers/constants'
import type { PreviewData } from '../_helpers/types'

interface Props {
  template: TemplateCatalogEntry
  currentLang: string
  previewLoading: boolean
  previewData: PreviewData | null
}

function formatCycleLines(classes: PreviewData['classes'], levels: string[]): string {
  return levels
    .filter((lvl) => classes.some((c) => c.level === lvl))
    .map((lvl) => ({
      lvl,
      names: classes.filter((c) => c.level === lvl).map((c) => c.name),
    }))
    .map((g) => `${g.lvl} ${g.names.map((n) => n.replace(g.lvl + ' ', '')).join(' · ')}`)
    .join('\n')
}

export default function Step3Preview({ template, currentLang, previewLoading, previewData }: Props) {
  const t = useT('onboarding')

  return (
    <div style={{ marginTop: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', padding: '8px 0', borderBottom: '2px solid var(--border2)', marginBottom: 14 }}>
        {t('phase1.step3.preview.title')}
      </div>

      <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
          <School size={16} strokeWidth={2} /> {templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr')}
        </div>

        {previewLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
            <div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            {t('phase1.loading.computing')}
          </div>
        )}

        {!previewLoading && previewData && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green2)', marginBottom: 8 }}>
              {previewData.totalClasses} {t('phase1.step3.preview.totalClasses')}
            </div>

            {FIRST_CYCLE_LEVELS.filter((lvl) => previewData.classes.some((c) => c.level === lvl)).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                  {t('phase1.step3.preview.firstCycleGroup')} {previewData.classes.filter((c) => FIRST_CYCLE_LEVELS.includes(c.level)).length} classes :
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontWeight: 600 }}>
                  {formatCycleLines(previewData.classes, FIRST_CYCLE_LEVELS)}
                </div>
              </div>
            )}

            {SECOND_CYCLE_LEVELS.filter((lvl) => previewData.classes.some((c) => c.level === lvl)).length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                  {t('phase1.step3.preview.secondCycleGroup')} {previewData.classes.filter((c) => SECOND_CYCLE_LEVELS.includes(c.level)).length} classes :
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontWeight: 600 }}>
                  {formatCycleLines(previewData.classes, SECOND_CYCLE_LEVELS)}
                </div>
              </div>
            )}

            {previewData.subjects.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                {t('phase1.step3.preview.subjects')} {previewData.subjects.length} {t('phase1.step3.preview.withCoefficients')}
              </div>
            )}
          </div>
        )}

        {!previewLoading && !previewData && (
          <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>{t('phase1.step3.preview.placeholder')}</div>
        )}

        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{t('phase1.step3.preview.yearAutoConfig')}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{t('phase1.step3.preview.minesecConfig')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t('phase1.step3.preview.modifiableLater')}</div>
        </div>
      </div>
    </div>
  )
}
