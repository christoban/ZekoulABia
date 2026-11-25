'use client'
import { CheckCircle2 } from 'lucide-react'
import type { ProgAlerte, TranslateFn } from './types'

interface Props {
  alertes: ProgAlerte[]
  loading: boolean
  t: TranslateFn
}

export default function DeptProgressionTab({ alertes, loading, t }: Props) {
  return (
    <div>
      <div style={{ padding: '8px 12px', background: 'var(--green-light)', border: '1px solid var(--green-light)', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
        {t('department.progression_info')}
      </div>
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('department.progression_loading')}</div>
      ) : alertes.length === 0 ? (
        <div style={{ padding: 36, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><CheckCircle2 size={26} strokeWidth={2} color="var(--green)" /></div>
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>{t('department.progression_no_alerts')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('department.progression_no_alerts_hint')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertes.map((a, i) => {
            const isCritique = a.niveau === 'CRITIQUE'
            return (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, border: `1px solid ${isCritique ? 'var(--red-light)' : 'var(--amber-light)'}`, padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ background: isCritique ? 'var(--red-light)' : 'var(--amber-light)', borderRadius: 7, padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: isCritique ? 'var(--red)' : 'var(--amber)' }}>-{a.retardPct}%</div>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: isCritique ? 'var(--red)' : 'var(--amber)', textTransform: 'uppercase' }}>{a.niveau}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                      <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{a.className}</span>
                      <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{a.subjectName}</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{a.programmeTitre}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                      {t('department.progression_chapters').replace('{done}', String(a.chapitresRealises)).replace('{total}', String(a.chapitresTotal)).replace('{pct}', String(a.progressionPct)).replace('{expected}', String(a.attenduPct))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
