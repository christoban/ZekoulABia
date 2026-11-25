'use client'
import { Download, Gavel } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { type CouncilSession, tdSt, thSt } from './disciplineTypes'

interface Props {
  councilLoading: boolean
  councilSessions: CouncilSession[]
  onOpenHold: (sessionId: string) => void
  onDownloadPV: (sessionId: string) => void
}

export default function DisciplineCouncilView({
  councilLoading,
  councilSessions,
  onOpenHold,
  onDownloadPV,
}: Props) {
  const t = useT('discipline')

  return (
    <div>
      {councilLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      ) : councilSessions.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><Gavel size={40} strokeWidth={1.8} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('council.empty_state.title')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('empty_state.description')}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="md:hidden divide-y divide-[var(--border)]">
            {councilSessions.map(s => {
              const delayOk = new Date(s.scheduledAt).getTime() - Date.now() <= 0
              return (
                <div key={s.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm text-[var(--text)]">{s.student.firstName} {s.student.lastName}</div>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, ...(s.status === 'TENU' ? { background: 'var(--green-light)', color: 'var(--green)' } : { background: 'var(--amber-light)', color: 'var(--amber)' }) }}>
                      {t(`council.status.${s.status}`)}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text2)]"><strong>Motif :</strong> {s.motif}</div>
                  <div className="text-xs text-[var(--text3)]">
                    Prévu le : {new Date(s.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {s.decision && (
                    <div className="text-xs text-[var(--text)]"><strong>Décision :</strong> {t(`sanction_types.${s.decision}`)}</div>
                  )}
                  <div className="pt-1 flex gap-2">
                    {s.status === 'CONVOQUE' && (
                      <button
                        style={{ flex: 1, minHeight: 38, borderRadius: 6, fontSize: 12, fontWeight: 800, background: delayOk ? 'var(--purple-light)' : 'var(--bg2)', color: delayOk ? 'var(--purple)' : 'var(--text3)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title={delayOk ? '' : t('council.hint_delay_not_elapsed')}
                        onClick={() => onOpenHold(s.id)}
                      >
                        {t('council.actions.hold')}
                      </button>
                    )}
                    {s.status === 'TENU' && (
                      <button
                        style={{ flex: 1, minHeight: 38, borderRadius: 6, fontSize: 12, fontWeight: 800, background: 'var(--bg2)', color: 'var(--text2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        onClick={() => onDownloadPV(s.id)}
                      >
                        <Download size={13} /> {t('council.actions.download_pv')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>{[
                  t('table_headers.student'), t('council.table_headers.motif'), t('council.table_headers.scheduled'),
                  t('council.table_headers.status'), t('council.table_headers.decision'), t('table_headers.actions'),
                ].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {councilSessions.map(s => {
                  const delayOk = new Date(s.scheduledAt).getTime() - Date.now() <= 0
                  return (
                    <tr key={s.id}>
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{s.student.firstName} {s.student.lastName}</td>
                      <td style={{ ...tdSt, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.motif}</td>
                      <td style={tdSt}>{new Date(s.scheduledAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={tdSt}>
                        <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800, ...(s.status === 'TENU' ? { background: 'var(--green-light)', color: 'var(--green)' } : { background: 'var(--amber-light)', color: 'var(--amber)' }) }}>
                          {t(`council.status.${s.status}`)}
                        </span>
                      </td>
                      <td style={tdSt}>{s.decision ? t(`sanction_types.${s.decision}`) : '—'}</td>
                      <td style={tdSt}>
                        {s.status === 'CONVOQUE' && (
                          <button
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, background: delayOk ? 'var(--purple-light)' : 'var(--bg2)', color: delayOk ? 'var(--purple)' : 'var(--text3)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                            title={delayOk ? '' : t('council.hint_delay_not_elapsed')}
                            onClick={() => onOpenHold(s.id)}
                          >
                            {t('council.actions.hold')}
                          </button>
                        )}
                        {s.status === 'TENU' && (
                          <button
                            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800, background: 'var(--bg2)', color: 'var(--text2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => onDownloadPV(s.id)}
                          >
                            <Download size={12} /> {t('council.actions.download_pv')}
                          </button>
                        )}
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
