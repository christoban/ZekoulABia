'use client'
import { Save, Loader2, Lock, Sparkles } from 'lucide-react'
import { QUICK_CHIPS_KEYS, type ReportCard, type TranslateFn } from './types'

interface Props {
  rc: ReportCard
  text: string
  locked: boolean
  isSaving: boolean
  isSaved: boolean
  isGeneratingAI: boolean
  hasAiError: boolean
  isOnline: boolean
  onChangeText: (val: string) => void
  onGenerateAI: () => void
  t: TranslateFn
}

export default function AppreciationStudentCard({
  rc,
  text,
  locked,
  isSaving,
  isSaved,
  isGeneratingAI,
  hasAiError,
  isOnline,
  onChangeText,
  onGenerateAI,
  t,
}: Props) {
  const charCount = text.length

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
      {/* Élève info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
            {rc.studentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{rc.studentName}</div>
            {rc.generalAverage !== null && (
              <div style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>{t('pp.average_label').replace('{average}', rc.generalAverage.toFixed(2))}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isSaving && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}><Loader2 size={11} strokeWidth={2} className="animate-spin" />{t('pp.saving')}</span>}
          {isSaved && !isSaving && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--green)', fontWeight: 700 }}><Save size={11} strokeWidth={2} />{t('pp.saved')}</span>}
          {locked && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--text2)', fontWeight: 700, background: 'var(--bg2)', padding: '2px 8px', borderRadius: 12 }}>
              <Lock size={11} strokeWidth={2} />{t('pp.locked')}
            </span>
          )}
        </div>
      </div>

      {locked ? (
        <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: 7, border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 12, fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lock size={12} strokeWidth={2} />{t('pp.council_locked')}</span>
          {text && <div style={{ marginTop: 4, color: 'var(--text2)', fontStyle: 'italic' }}>&ldquo;{text}&rdquo;</div>}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            <button
              onClick={onGenerateAI}
              disabled={!isOnline || isGeneratingAI}
              title={!isOnline ? t('pp.ai_offline_disabled') : undefined}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 12, fontSize: 11.5, fontWeight: 700,
                cursor: !isOnline || isGeneratingAI ? 'not-allowed' : 'pointer', border: '1px solid var(--purple)',
                background: 'var(--purple-light)', color: 'var(--purple)', fontFamily: 'inherit',
                opacity: !isOnline ? 0.5 : 1 }}>
              {isGeneratingAI ? <Loader2 size={11} strokeWidth={2} className="animate-spin" /> : <Sparkles size={11} strokeWidth={2} />}
              {isGeneratingAI ? t('pp.generating_ai') : t('pp.generate_ai')}
            </button>
            {hasAiError && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>{t('pp.ai_error')}</span>}

            {QUICK_CHIPS_KEYS.map(key => {
              const chip = t(`pp.${key}`)
              return (
                <button key={key} onClick={() => onChangeText(chip)}
                  style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'inherit', transition: 'all 0.12s' }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'var(--sidebar)', color: 'white', borderColor: 'var(--sidebar)' })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'var(--surface)', color: 'var(--text2)', borderColor: 'var(--border2)' })}>
                  {chip}
                </button>
              )
            })}
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              value={text}
              onChange={e => onChangeText(e.target.value)}
              maxLength={300}
              placeholder={t('pp.write_placeholder')}
              rows={2}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 500, color: 'var(--text)', resize: 'vertical', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--sidebar)')}
              onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
            />
            <div style={{ position: 'absolute', bottom: 6, right: 10, fontSize: 10, color: charCount > 270 ? 'var(--red)' : 'var(--text3)', fontWeight: 600 }}>
              {charCount}/300
            </div>
          </div>
        </>
      )}
    </div>
  )
}
