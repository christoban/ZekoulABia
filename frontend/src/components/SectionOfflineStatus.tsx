'use client'
import { useState, useEffect } from 'react'
import { Wifi, WifiOff, CheckCircle2, FileText, Pin, RefreshCw, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { getPendingActions, deletePendingAction } from '@/lib/offline/db'
import { fetchApi } from '@/lib/fetchApi'
import type { PendingAction } from '@/lib/offline/db'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  namespace: 'teacher' | 'admin' | 'staff'
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  SYNCING: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  FAILED:  { bg: 'var(--red-light)', color: 'var(--red)' },
  CONFLICT: { bg: 'var(--purple-light)', color: 'var(--purple)' },
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }

export default function SectionOfflineStatus({ onToast, namespace }: Props) {
  const t = useT(namespace)
  const { pendingCount, syncing, isOnline, syncQueue } = useSyncQueue()
  const [actions, setActions] = useState<PendingAction[]>([])

  useEffect(() => {
    getPendingActions().then(setActions)
  }, [pendingCount])

  const handleSync = async () => {
    if (!isOnline) { onToast(t('sync.toast_no_internet'), 'error'); return }
    await syncQueue()
    onToast(t('sync.toast_sync_complete'), 'success')
    const updated = await getPendingActions()
    setActions(updated)
  }

  const handleDelete = async (id: number) => {
    await deletePendingAction(id)
    setActions(prev => prev.filter(a => a.id !== id))
    onToast(t('sync.toast_action_deleted'), 'info')
  }

  const handleResolveConflict = async (action: PendingAction, keepLocal: boolean) => {
    if (!action.conflictData) return

    if (keepLocal) {
      // "Garder ma version" doit RÉELLEMENT renvoyer la note au serveur, en forçant l'écrasement
      // — avant ce correctif, ce bouton supprimait juste l'action sans jamais rien envoyer.
      try {
        // Cas spécifique GRADE : l'endpoint où le conflit est détecté (/grades/submit) n'écrit
        // JAMAIS la valeur de la note — il ne fait que basculer le statut sur la ligne déjà en
        // base. La valeur est écrite par /grades/draft, qui n'a aucune vérification de version et
        // écrase donc toujours sans risque. Sans cet appel préalable, "Garder ma version" soumettait
        // la valeur du TIERS déjà en base, pas la valeur locale — confirmé par un test bout en bout
        // réel (curl + vérification directe en base).
        if (action.type === 'GRADE') {
          const payload = action.payload as {
            classId: string
            subjectId: string
            sequenceId: string
            grades: { studentId: string; value: number; observation?: string }[]
          }
          const draftRes = await fetchApi('/api/v2/grades/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
            body: JSON.stringify({
              classId: payload.classId,
              subjectId: payload.subjectId,
              sequenceId: payload.sequenceId,
              grades: payload.grades.map(g => ({ studentId: g.studentId, value: g.value, observation: g.observation })),
            }),
          })
          if (!draftRes.ok) throw new Error(`HTTP ${draftRes.status}`)
        }

        const res = await fetchApi(action.endpoint, {
          method: action.method,
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
          body: JSON.stringify({ ...(action.payload as object), forcerEcrasement: true }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await deletePendingAction(action.id!)
        setActions(prev => prev.filter(a => a.id !== action.id))
        onToast(t('sync.conflict_kept_local'), 'success')
      } catch {
        onToast(t('sync.conflict_resolve_error'), 'error')
      }
      return
    }

    // "Garder version serveur" : on abandonne la version locale, correct de simplement supprimer.
    await deletePendingAction(action.id!)
    setActions(prev => prev.filter(a => a.id !== action.id))
    onToast(t('sync.conflict_kept_server'), 'info')
  }

  const typeLabel = (type: string) => {
    if (type === 'ATTENDANCE') return { label: t('sync.type_attendance'), Icon: CheckCircle2 }
    if (type === 'GRADE') return { label: t('sync.type_grade'), Icon: FileText }
    return { label: type, Icon: Pin }
  }

  const statusLabel = (status: string) => {
    if (status === 'PENDING') return t('sync.status_pending')
    if (status === 'SYNCING') return t('sync.status_syncing')
    if (status === 'CONFLICT') return t('sync.status_conflict')
    return t('sync.status_failed')
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>{t('sync.title')}</div>
        <div style={sSub}>{t('sync.subtitle')}</div>
      </div>

      {/* Status card */}
      <div style={{ background: isOnline ? 'var(--green-light)' : 'var(--red-light)', borderRadius: 16, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>{isOnline ? <Wifi size={28} strokeWidth={2} /> : <WifiOff size={28} strokeWidth={2} />}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: isOnline ? 'var(--green)' : 'var(--red)' }}>
            {isOnline ? t('sync.online') : t('sync.offline')}
          </div>
          <div style={{ fontSize: 14, color: isOnline ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
            {t('sync.count_pending').replace('{count}', String(pendingCount))}
          </div>
        </div>
        {isOnline && pendingCount > 0 && (
          <button onClick={handleSync} disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: syncing ? 0.7 : 1 }}>
            {syncing ? <Loader2 size={16} strokeWidth={2} className="animate-spin" /> : <RefreshCw size={16} strokeWidth={2} />}
            {syncing ? t('sync.syncing') : t('sync.sync_now')}
          </button>
        )}
      </div>

      {actions.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><CheckCircle2 size={48} strokeWidth={2} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('sync.all_synced_title')}</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>{t('sync.all_synced_sub')}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text2)' }}>
              {t('sync.action_count').replace('{count}', String(actions.length))}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
              <thead>
                <tr>
                  {[t('sync.table_type'), t('sync.table_endpoint'), t('sync.table_date'), t('sync.table_status'), t('sync.table_action')].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actions.map(action => {
                  const meta = typeLabel(action.type)
                  const sc = STATUS_COLORS[action.status] || STATUS_COLORS.PENDING
                  const date = new Date(action.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                  return (
                    <tr key={action.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <meta.Icon size={16} strokeWidth={2} />{meta.label}
                      </td>
                      <td style={{ ...tdSt, fontFamily: 'monospace', fontSize: 14, color: 'var(--text2)' }}>{action.endpoint}</td>
                      <td style={{ ...tdSt, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{date}</td>
                      <td style={tdSt}>
                        <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: sc.bg, color: sc.color }}>
                          {statusLabel(action.status)}
                        </span>
                      </td>
                      <td style={tdSt}>
                        {action.status === 'CONFLICT' ? (
                          <>
                            {action.conflictData && action.conflictData.length > 0 && (
                              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 6 }}>
                                {action.conflictData.map(c => (
                                  <div key={c.studentId}>
                                    {t('sync.conflict_server_value')}: <strong>{c.versionServeur.sequenceScore ?? '—'}</strong>
                                    {' · '}
                                    {t('sync.conflict_local_value')}: <strong>{c.versionLocale.value ?? '—'}</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleResolveConflict(action, true)}
                                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                {t('sync.conflict_keep_local')}
                              </button>
                              <button onClick={() => handleResolveConflict(action, false)}
                                style={{ padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                                {t('sync.conflict_keep_server')}
                              </button>
                            </div>
                          </>
                        ) : (
                          <button onClick={() => handleDelete(action.id!)}
                            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {t('sync.btn_delete')}
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