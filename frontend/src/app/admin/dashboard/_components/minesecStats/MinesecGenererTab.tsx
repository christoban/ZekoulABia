'use client'

import { useT } from '@/lib/i18n'
import { btnPri, btnSec, cardStyle, cardStyleCls, type ChampNonResolu, type Submission } from './types'

interface MinesecGenererTabProps {
  generating: boolean
  lastSubmission: Submission | null
  champsNonResolus: ChampNonResolu[]
  submissions: Submission[]
  onGenerer: () => void
  onDownload: (id: string) => void
}

export default function MinesecGenererTab({
  generating,
  lastSubmission,
  champsNonResolus,
  submissions,
  onGenerer,
  onDownload,
}: MinesecGenererTabProps) {
  const t = useT('admin')

  return (
    <div>
      <div className={cardStyleCls} style={cardStyle}>
        <p className="text-[11.5px] md:text-[12.5px]" style={{ color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>{t('minesecStats.generateDescription')}</p>
        <button onClick={onGenerer} disabled={generating} className="w-full justify-center" style={{ ...btnPri, display: 'inline-flex', alignItems: 'center' }}>
          {generating ? '...' : t('minesecStats.generateBtn')}
        </button>
      </div>

      {lastSubmission && (
        <div className={cardStyleCls} style={{ ...cardStyle, border: '1.5px solid var(--green)' }}>
          <p className="text-[12.5px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>{t('minesecStats.generationSuccess')}</p>
          <button onClick={() => onDownload(lastSubmission.id)} style={btnSec}>{t('minesecStats.downloadBtn')}</button>

          {champsNonResolus.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                {t('minesecStats.champsNonResolusTitle', { count: String(champsNonResolus.length) })}
              </p>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 7 }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 460 }}>
                    <thead>
                      <tr>
                        {[t('minesecStats.colChamp'), t('minesecStats.colFeuille'), t('minesecStats.colRaison')].map((h) => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--bg2)', color: 'var(--text3)', fontWeight: 700 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {champsNonResolus.map((c, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--bg)' }}>
                          <td style={{ padding: '5px 10px', color: 'var(--text)' }}>{c.fieldLabel}</td>
                          <td style={{ padding: '5px 10px', color: 'var(--text2)' }}>{c.sheetName}</td>
                          <td style={{ padding: '5px 10px', color: 'var(--text3)' }}>{c.raison}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={cardStyleCls} style={cardStyle}>
        <h3 className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('minesecStats.historyTitle')}</h3>
        {submissions.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t('minesecStats.historyEmpty')}</p>
        ) : (
          <>
            {/* ── Cartes empilées — mobile ── */}
            <div className="md:hidden flex flex-col" style={{ gap: 6 }}>
              {submissions.map((s) => (
                <div key={s.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05)]" style={{ background: 'var(--surface)', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{new Date(s.generatedAt).toLocaleString()}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{s.status}</div>
                  </div>
                  {s.filePath && <button onClick={() => onDownload(s.id)} style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, background: 'var(--bg2)', color: 'var(--text)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{t('minesecStats.downloadBtn')}</button>}
                </div>
              ))}
            </div>
            {/* ── Tableau — desktop ── */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 460 }}>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--bg)' }}>
                      <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{new Date(s.generatedAt).toLocaleString()}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text2)' }}>{s.status}</td>
                      <td style={{ padding: '6px 10px' }}>
                        {s.filePath && <button onClick={() => onDownload(s.id)} style={{ ...btnSec, padding: '3px 8px', fontSize: 11.5 }}>{t('minesecStats.downloadBtn')}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
