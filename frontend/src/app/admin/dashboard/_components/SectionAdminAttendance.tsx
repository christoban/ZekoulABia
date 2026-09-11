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
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('attendance.title')}</div>
          <div className="text-[12px] md:text-[13px]" style={sSub}>Supervision · Toutes les classes de l&apos;établissement</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          className="inline-flex items-center gap-[6px] cursor-pointer font-nunito flex-shrink-0 rounded-full md:rounded-[10px] px-[14px] py-[9px] md:px-[16px] md:py-[8px] text-[12.5px] md:text-[13px] font-semibold md:font-bold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-[var(--bg2)] md:bg-[var(--surface)]"
          style={{ color: 'var(--text2)' }}
          onClick={() => { fetchStats(); fetchRecords() }}><RefreshCw size={14} /> Rafraîchir</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 39 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-3" style={{ marginBottom: 14 }}>
              {([
                { icon: CheckCircle2, bg: 'var(--green-light)', val: stats.attendanceRate, label: 'Taux de présence', color: 'var(--green)' },
                { icon: Users, bg: 'var(--blue-light)', val: String(stats.total),   label: 'Enregistrements', color: 'var(--blue)' },
                { icon: X,  bg: 'var(--red-light)', val: String(stats.absent),  label: 'Absences',         color: 'var(--red)' },
                { icon: AlarmClock, bg: 'var(--amber-light)', val: String(stats.late),    label: 'Retards',           color: 'var(--amber)' },
              ] as { icon: LucideIcon; bg: string; val: string; label: string; color: string }[]).map((k, i) => (
                <div key={i} className="p-3 md:px-3.5 md:py-3 rounded-[10px] md:rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)' }}>
                  <div className="w-7 h-7 md:w-8 md:h-8" style={{ borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><k.icon size={16} color={k.color} /></div>
                  <div className="text-[18px] md:text-[18px] font-black" style={{ color: k.color }}>{k.val}</div>
                  <div className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-none md:rounded-[10px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden' }}>
            <div className="p-0 mb-4 md:p-3.5 md:mb-0 md:border-b md:border-[var(--border)]" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={classId} onChange={e => setClassId(e.target.value)} className={`${filterStCls} flex-1 md:flex-none`} style={filterSt}>
                <option value="">Toutes les classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${filterStCls} flex-1 md:flex-none`} style={{ ...filterSt, cursor: 'pointer' }} />
              <button className="w-full md:w-auto justify-center" style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={fetchRecords} disabled={loadingRecords}>
                {loadingRecords ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Charger
              </button>
              {records.length > 0 && (
                <span className="text-[12.5px] md:text-[12px]" style={{ marginLeft: 'auto', color: 'var(--text3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Check size={13} /> {presentCount} · <X size={13} /> {absentCount} · <AlarmClock size={13} /> {lateCount}
                </span>
              )}
            </div>

            {loadingRecords && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 26 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            )}
            {!loadingRecords && error === 'OFFLINE_NO_CACHE' && (
              <div style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--text3)' }}>Aucune donnée en cache pour ce filtre — reconnectez-vous pour charger les présences.</div>
            )}
            {!loadingRecords && error && error !== 'OFFLINE_NO_CACHE' && <div style={{ padding: '12px 14px', color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> {error}</div>}
            {!loadingRecords && !error && records.length === 0 && (
              <div style={{ padding: '26px 14px', textAlign: 'center', color: 'var(--text3)' }}>
                {classId || date ? 'Aucun enregistrement pour ces filtres' : 'Sélectionnez une classe ou une date pour afficher les présences'}
              </div>
            )}
            {!loadingRecords && !error && records.length > 0 && (
              <>
              <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
                {records.map(r => {
                  const st = STATUS_STYLE[r.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: r.status, icon: Check }
                  return (
                    <div key={r.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{r.class?.name ?? '—'} · {new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · {r.period}</div>
                        </div>
                        <span style={{ padding: '4px 10px', borderRadius: 10, fontSize: 11.5, fontWeight: 800, background: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}><st.icon size={12} /> {st.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</span>
                        {r.status === 'ABSENT' && (
                          <button
                            style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.25)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            onClick={() => justify(r.id)} disabled={justifyingId === r.id}>
                            {justifyingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <><ClipboardList size={13} /> Justifier</>}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
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
                            <span style={{ padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 800, background: st.bg, color: st.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}><st.icon size={13} /> {st.label}</span>
                          </td>
                          <td style={tdSt}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</td>
                          <td style={tdSt}>
                            {r.status === 'ABSENT' && (
                              <button
                                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.25)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                onClick={() => justify(r.id)} disabled={justifyingId === r.id}>
                                {justifyingId === r.id ? <Loader2 size={13} className="animate-spin" /> : <><ClipboardList size={13} /> Justifier</>}
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
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterStCls = 'rounded-[8px] md:rounded-[10px] px-[12px] py-[10px] md:px-[12px] md:py-[8px] text-[13px] md:text-[13px] font-semibold md:font-bold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none'
const filterSt: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 11px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 11px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
