'use client'
import { useState, useEffect, useCallback } from 'react'
import { Check, X, ClipboardList, AlarmClock, RefreshCw, CheckCircle2, Users, Search, Loader2, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface AttendanceStats { total: number; present: number; absent: number; late: number; attendanceRate: string }
interface ClassItem { id: string; name: string }
interface AttendanceRecord {
  id: string; date: string; status: string; period: string
  student: { id: string; firstName: string; lastName: string } | null
  class: { id: string; name: string } | null
  markedBy: { id: string; firstName: string; lastName: string } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string; icon: LucideIcon }> = {
  PRESENT:          { bg: 'var(--green-light)', color: 'var(--green)', label: 'Présent', icon: Check },
  ABSENT:           { bg: 'var(--red-light)', color: 'var(--red)', label: 'Absent', icon: X },
  ABSENT_JUSTIFIED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: 'Justifié', icon: ClipboardList },
  LATE:             { bg: 'var(--blue-light)', color: 'var(--blue)', label: 'Retard', icon: AlarmClock },
}

export default function SectionAdminAttendance({ onToast }: Props) {
  const t = useT('admin')
  const [stats, setStats]           = useState<AttendanceStats | null>(null)
  const [classes, setClasses]       = useState<ClassItem[]>([])
  const [classId, setClassId]       = useState('')
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading]       = useState(true)
  const [justifyingId, setJustifyingId] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/attendance/stats', { credentials: 'include' })
      const data = await res.json()
      if (res.ok && data.stats) setStats(data.stats)
    } catch { /* silencieux */ }
  }, [])

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setClasses(data.data || [])
    } catch { /* silencieux */ }
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

  const justify = async (recordId: string) => {
    setJustifyingId(recordId)
    try {
      const res = await fetchApi(`/api/v2/attendance/${recordId}/justify`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justification: 'Justifiée par l\'administration' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Absence justifiée', 'success')
      fetchRecords()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setJustifyingId(null) }
  }

  const presentCount = records.filter(r => r.status === 'PRESENT').length
  const absentCount  = records.filter(r => r.status === 'ABSENT').length
  const lateCount    = records.filter(r => r.status === 'LATE').length

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
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
          className="inline-flex items-center gap-[5px] cursor-pointer font-nunito flex-shrink-0 rounded-full md:rounded-[8px] px-[12px] py-[6px] md:px-[13px] md:py-[6px] text-[11.5px] md:text-[13px] font-semibold md:font-bold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-[var(--bg2)] md:bg-[var(--surface)]"
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</span>
                        {r.status === 'ABSENT' && (
                          <button
                            style={{ padding: '3.5px 8.5px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.25)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => justify(r.id)} disabled={justifyingId === r.id}>
                            {justifyingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <><ClipboardList size={11} /> Justifier</>}
                          </button>
                        )}
                      </div>
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
                          <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}</td>
                          <td style={tdSt}>{r.class?.name ?? '—'}</td>
                          <td style={tdSt}>{new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                          <td style={tdSt}>{r.period}</td>
                          <td style={tdSt}>
                            <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}><st.icon size={11} /> {st.label}</span>
                          </td>
                          <td style={tdSt}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</td>
                          <td style={tdSt}>
                            {r.status === 'ABSENT' && (
                              <button
                                style={{ padding: '3.5px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.25)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => justify(r.id)} disabled={justifyingId === r.id}>
                                {justifyingId === r.id ? <Loader2 size={11} className="animate-spin" /> : <><ClipboardList size={11} /> Justifier</>}
                              </button>
                            )}
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
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterStCls = 'rounded-[8px] md:rounded-[7px] px-[10px] py-[7px] md:px-[10px] md:py-[6px] text-[12px] md:text-[13px] font-semibold md:font-bold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none'
const filterSt: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8.5px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
