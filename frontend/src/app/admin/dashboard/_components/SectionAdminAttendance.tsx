'use client'
import { useState, useEffect, useCallback } from 'react'
import { Check, X, ClipboardList, AlarmClock, RefreshCw, CheckCircle2, Users, Search, Loader2, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { AttendanceDailyStatusPanel, AttendanceRepeatedAbsencesPanel } from '@/features/attendance/AttendanceSupervisionPanels'
import { AttendanceRecordActions, type SharedAttendanceRecord } from '@/features/attendance/AttendanceRecordActions'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface AttendanceStats { total: number; present: number; absent: number; late: number; attendanceRate: string }
interface ClassItem { id: string; name: string }
type AttendanceRecord = SharedAttendanceRecord

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; icon: LucideIcon }> = {
  PRESENT:          { bg: 'var(--green-light)', color: 'var(--green)', label: 'Présent', icon: Check },
  ABSENT:           { bg: 'var(--red-light)', color: 'var(--red)', label: 'Absent', icon: X },
  ABSENT_JUSTIFIED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: 'Justifié', icon: ClipboardList },
  LATE:             { bg: 'var(--blue-light)', color: 'var(--blue)', label: 'Retard', icon: AlarmClock },
}

export default function SectionAdminAttendance({ onToast }: Props) {
  const t = useT('admin')
  const { addToQueue } = useSyncQueue()
  const [stats, setStats]           = useState<AttendanceStats | null>(null)
  const [classes, setClasses]       = useState<ClassItem[]>([])
  const [classId, setClassId]       = useState('')
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading]       = useState(true)
  const [justifyingId, setJustifyingId] = useState<string | null>(null)
  const [activeTab, setActiveTab]   = useState<'journal' | 'daily' | 'repeated'>('journal')

  const fetchStats = useCallback(async () => {
    try {
      const cached = await getCachedData<AttendanceStats>('admin:attendance:stats')
      if (cached?.data) setStats(cached.data)
    } catch { /* silencieux */ }

    if (navigator.onLine) {
      try {
        const res = await fetchApi('/api/v2/attendance/stats', { credentials: 'include' })
        const data = await res.json()
        if (res.ok && data.stats) {
          setStats(data.stats)
          await putCachedData('admin:attendance:stats', data.stats).catch(() => {})
        }
      } catch { /* silencieux */ }
    }
  }, [])

  const fetchClasses = useCallback(async () => {
    try {
      const cached = (await getCachedData<ClassItem[]>('admin:classes').catch(() => null))
        || (await getCachedData<ClassItem[]>('admin:classes:list').catch(() => null))
        || (await getCachedData<ClassItem[]>('staff:classes').catch(() => null))
      if (cached?.data && Array.isArray(cached.data)) setClasses(cached.data)
    } catch { /* silencieux */ }

    if (navigator.onLine) {
      try {
        const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
        const data = await res.json()
        if (res.ok && Array.isArray(data.data)) {
          setClasses(data.data)
          await putCachedData('admin:classes', data.data).catch(() => {})
          await putCachedData('admin:classes:list', data.data).catch(() => {})
        }
      } catch { /* silencieux */ }
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchStats(), fetchClasses()]).finally(() => setLoading(false))
  }, [fetchStats, fetchClasses])

  const fetchRecordsFn = useCallback(async (): Promise<AttendanceRecord[]> => {
    const params = new URLSearchParams({ limit: '100' })
    if (classId) params.set('classId', classId)
    if (date) params.set('date', date)
    const res = await fetchApi(`/api/v2/attendance?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.records || []
  }, [classId, date])

  const { data: recordsData, loading: loadingRecords, error, fromCache, cachedAt, refetch: fetchRecords } = useCachedFetch<AttendanceRecord[]>(`admin:attendance:${classId}:${date}`, fetchRecordsFn)
  const records = recordsData ?? []

  // Rafraîchissement temps réel quand l'assistant IA justifie une absence.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'attendance') { fetchRecords(); fetchStats() }
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchRecords, fetchStats])

  const justify = async (recordId: string, approve = true) => {
    setJustifyingId(recordId)
    const payload = { justification: approve ? "Justifiée par l'administration" : "Justificatif refusé par l'administration", approve }

    if (!navigator.onLine) {
      try {
        await addToQueue({
          type: 'ATTENDANCE',
          endpoint: `/api/v2/attendance/${recordId}/justify`,
          method: 'PATCH',
          payload,
        })
        onToast('Absence justifiée hors-ligne (en attente de synchronisation)', 'info')
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Erreur', 'error')
      } finally {
        setJustifyingId(null)
      }
      return
    }

    try {
      const res = await fetchApi(`/api/v2/attendance/${recordId}/justify`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Absence justifiée', 'success')
      fetchRecords()
    } catch {
      // Repli hors-ligne en cas de coupure
      try {
        await addToQueue({
          type: 'ATTENDANCE',
          endpoint: `/api/v2/attendance/${recordId}/justify`,
          method: 'PATCH',
          payload,
        })
        onToast('Connexion perdue : justification enregistrée hors-ligne', 'info')
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Erreur', 'error')
      }
    } finally { setJustifyingId(null) }
  }

  const presentCount = records.filter(r => r.status === 'PRESENT').length
  const absentCount  = records.filter(r => r.status === 'ABSENT').length
  const lateCount    = records.filter(r => r.status === 'LATE').length

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <div className="text-[15px] md:text-[17px]" style={sTitle}>{t('attendance.title')}</div>
          <div className="text-[11px] md:text-[12px]" style={sSub}>Supervision · Toutes les classes de l&apos;établissement</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3.5px 9px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          className="min-h-[38px] inline-flex items-center gap-[5px] cursor-pointer font-nunito flex-shrink-0 rounded-full md:rounded-[8px] px-[12px] py-[6px] md:px-[13px] md:py-[6px] text-[11.5px] md:text-[13px] font-semibold md:font-bold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-[var(--bg2)] md:bg-[var(--surface)]"
          style={{ color: 'var(--text2)' }}
          onClick={() => { fetchStats(); fetchRecords() }}><RefreshCw size={13} /> Rafraîchir</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3" style={{ marginBottom: 14 }}>
              {([
                { icon: CheckCircle2, bg: 'var(--green-light)', val: stats.attendanceRate, label: 'Taux de présence', color: 'var(--green)' },
                { icon: Users, bg: 'var(--blue-light)', val: String(stats.total),   label: 'Enregistrements', color: 'var(--blue)' },
                { icon: X,  bg: 'var(--red-light)', val: String(stats.absent),  label: 'Absences',         color: 'var(--red)' },
                { icon: AlarmClock, bg: 'var(--amber-light)', val: String(stats.late),    label: 'Retards',           color: 'var(--amber)' },
              ] as { icon: LucideIcon; bg: string; val: string; label: string; color: string }[]).map((k, i) => (
                <div key={i} className="p-3 md:px-4 md:py-[12px] rounded-[12px] md:rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
                  <div className="w-[30px] h-[30px] md:w-8 md:h-8 [&>svg]:w-3.5 [&>svg]:h-3.5 md:[&>svg]:w-4 md:[&>svg]:h-4" style={{ borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}><k.icon color={k.color} /></div>
                  <div className="text-[18px] md:text-[20px] font-black" style={{ color: k.color }}>{k.val}</div>
                  <div className="text-[11px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              { id: 'journal' as const, label: 'Journal & Justificatifs' },
              { id: 'daily' as const, label: 'Appels du jour (Fait / Non fait)' },
              { id: 'repeated' as const, label: 'Absences répétées' },
            ].map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => setActiveTab(tb.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer border"
                style={{
                  background: activeTab === tb.id ? 'var(--primary)' : 'var(--surface)',
                  color: activeTab === tb.id ? 'white' : 'var(--text2)',
                  borderColor: activeTab === tb.id ? 'var(--primary)' : 'var(--border2)',
                }}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {activeTab === 'daily' ? (
            <AttendanceDailyStatusPanel date={date} />
          ) : activeTab === 'repeated' ? (
            <AttendanceRepeatedAbsencesPanel />
          ) : (
          <div className="rounded-none md:rounded-[12px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden' }}>
            <div className="p-0 mb-3 md:p-[10px] md:px-[16px] md:mb-0 md:border-b md:border-[var(--border)]" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={classId} onChange={e => setClassId(e.target.value)} className={`${filterStCls} flex-1 md:flex-none`} style={filterSt}>
                <option value="">Toutes les classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${filterStCls} flex-1 md:flex-none`} style={{ ...filterSt, cursor: 'pointer' }} />
              <button className="w-full md:w-auto justify-center" style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={fetchRecords} disabled={loadingRecords}>
                {loadingRecords ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Charger
              </button>
              {records.length > 0 && (
                <span className="text-[11.5px] md:text-[12.5px]" style={{ marginLeft: 'auto', color: 'var(--text3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Check size={12} /> {presentCount} · <X size={12} /> {absentCount} · <AlarmClock size={12} /> {lateCount}
                </span>
              )}
            </div>

            {loadingRecords && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            )}
            {!loadingRecords && error === 'OFFLINE_NO_CACHE' && (
              <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Aucune donnée en cache pour ce filtre — reconnectez-vous pour charger les présences.</div>
            )}
            {!loadingRecords && error && error !== 'OFFLINE_NO_CACHE' && <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} /> {error}</div>}
            {!loadingRecords && !error && records.length === 0 && (
              <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                {classId || date ? 'Aucun enregistrement pour ces filtres' : 'Sélectionnez une classe ou une date pour afficher les présences'}
              </div>
            )}
            {!loadingRecords && !error && records.length > 0 && (
              <>
              {/* ── Cartes empilées — mobile ── */}
              <div className="md:hidden flex flex-col" style={{ gap: 8 }}>
                {records.map(r => {
                  const st = STATUS_STYLE[r.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: r.status, icon: Check }
                  return (
                    <div key={r.id} className="rounded-[12px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1.5 }}>{r.class?.name ?? '—'} · {new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · {r.period}</div>
                        </div>
                        <span style={{ padding: '2.5px 7.5px', borderRadius: 14, fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: 3.5, flexShrink: 0 }}><st.icon size={11} /> {st.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</span>
                        <AttendanceRecordActions record={r} justifyingId={justifyingId} onJustify={justify} onCorrected={() => { fetchRecords(); fetchStats() }} onToast={onToast} />
                      </div>
                      {r.justification && (
                        <div className="mt-1.5 text-[11px] text-[var(--text2)] bg-[var(--bg)] px-2 py-1 rounded">
                          Motif {r.justificationStatus === 'PENDING' ? '(en attente)' : ''} : {r.justification}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* ── Tableau — desktop ── */}
              <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr>{['Élève', 'Classe', 'Date', 'Période', 'Statut', 'Saisi par', 'Actions'].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {records.map(r => {
                      const st = STATUS_STYLE[r.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: r.status, icon: Check }
                      return (
                        <tr key={r.id}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                          <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                            {r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}
                            {r.justification && <div className="text-[11px] font-normal text-[var(--text3)]">{r.justification}</div>}
                          </td>
                          <td style={tdSt}>{r.class?.name ?? '—'}</td>
                          <td style={tdSt}>{new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                          <td style={tdSt}>{r.period}</td>
                          <td style={tdSt}>
                            <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}><st.icon size={11} /> {st.label}</span>
                            {r.previousStatus && <div className="text-[10px] text-[var(--text3)] mt-0.5">Corrigé ({r.previousStatus})</div>}
                          </td>
                          <td style={tdSt}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</td>
                          <td style={tdSt}>
                            <AttendanceRecordActions record={r} justifyingId={justifyingId} onJustify={justify} onCorrected={() => { fetchRecords(); fetchStats() }} onToast={onToast} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
          )}
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterStCls = 'rounded-[8px] md:rounded-[7px] px-[10px] py-[7px] md:px-[10px] md:py-[6px] text-[12px] md:text-[13px] font-semibold md:font-bold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none'
const filterSt: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8.5px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
