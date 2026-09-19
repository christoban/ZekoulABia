'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { CheckCircle2, Users, X, AlarmClock, Loader2, Search, AlertTriangle, Package } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface AttendanceStats {
  total: number; present: number; absent: number; late: number; attendanceRate: string
}

interface ClassItem { id: string; name: string }

interface AttendanceRecord {
  id: string; date: string; status: string; period: string
  student: { id: string; firstName: string; lastName: string } | null
  class: { id: string; name: string } | null
  markedBy: { id: string; firstName: string; lastName: string } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PRESENT:          { bg: 'var(--green-light)', color: 'var(--green)' },
  ABSENT:           { bg: 'var(--red-light)', color: 'var(--red)' },
  ABSENT_JUSTIFIED: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  LATE:             { bg: 'var(--blue-light)', color: 'var(--blue)' },
}

export default function SectionAttendanceStaff({ onToast }: Props) {
  const t = useT('staff')
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
    const params = new URLSearchParams({ limit: '50' })
    if (classId) params.set('classId', classId)
    if (date) params.set('date', date)
    const res = await fetchApi(`/api/v2/attendance?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.records || []
  }, [classId, date])

  const { data: recordsData, loading: loadingRecords, error, fromCache, cachedAt, refetch: fetchRecords } = useCachedFetch<AttendanceRecord[]>(`staff:attendance:${classId}:${date}`, fetchRecordsFn)
  const records = recordsData ?? []

  const justify = async (recordId: string) => {
    setJustifyingId(recordId)
    try {
      const res = await fetchApi(`/api/v2/attendance/${recordId}/justify`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justification: 'Justifiée par le personnel' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('attendance.justifySuccess'), 'success')
      fetchRecords()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setJustifyingId(null)
    }
  }

  const presentCount = records.filter(r => r.status === 'PRESENT').length
  const absentCount  = records.filter(r => r.status === 'ABSENT').length
  const lateCount    = records.filter(r => r.status === 'LATE').length

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={sTitle}>{t('attendance.title')}</div>
          <div style={sSub}>{t('attendance.subtitle')}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3.5px 9px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={13} strokeWidth={2} /> {t('dashboard.cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button style={btnSec} onClick={() => { fetchStats(); fetchRecords() }}>{t('attendance.refresh')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && (
        <>
          {/* KPIs globaux */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 md:gap-3" style={{ marginBottom: 14 }}>
              {[
                { icon: <CheckCircle2 size={16} strokeWidth={2} />, bg: 'var(--green-light)', val: stats.attendanceRate, label: t('attendance.kpiRate'), color: 'var(--green)' },
                { icon: <Users size={16} strokeWidth={2} />, bg: 'var(--blue-light)', val: String(stats.total),   label: t('attendance.kpiRecords'), color: 'var(--blue)' },
                { icon: <X size={16} strokeWidth={2} />,  bg: 'var(--red-light)', val: String(stats.absent),  label: t('attendance.kpiAbsences'), color: 'var(--red)' },
                { icon: <AlarmClock size={16} strokeWidth={2} />, bg: 'var(--amber-light)', val: String(stats.late),    label: t('attendance.kpiLate'), color: 'var(--amber)' },
              ].map((k, i) => (
                <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 14px' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 5 }}>{k.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filtres */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={classId} onChange={e => setClassId(e.target.value)} style={filterSt}>
                <option value="">{t('attendance.filterAllClasses')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...filterSt, cursor: 'pointer' }} />
              <button style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={fetchRecords} disabled={loadingRecords}>
                {loadingRecords ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Search size={13} strokeWidth={2} />} {t('attendance.filter')}
              </button>
              {records.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--text3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} /> {presentCount} · <X size={12} /> {absentCount} · <AlarmClock size={12} /> {lateCount}
                </span>
              )}
            </div>

            {loadingRecords && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            )}

            {!loadingRecords && error === 'OFFLINE_NO_CACHE' && (
              <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>{t('attendance.noSelection')}</div>
            )}

            {!loadingRecords && error && error !== 'OFFLINE_NO_CACHE' && (
              <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} strokeWidth={2} /> {error}</div>
            )}

            {!loadingRecords && !error && records.length === 0 && (
              <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
                {classId || date ? t('attendance.noRecords') : t('attendance.noSelection')}
              </div>
            )}

            {!loadingRecords && !error && records.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                  <thead>
                    <tr>{[
                      t('attendance.tableHeaderStudent'),
                      t('attendance.tableHeaderClass'),
                      t('attendance.tableHeaderDate'),
                      t('attendance.tableHeaderPeriod'),
                      t('attendance.tableHeaderStatus'),
                      t('attendance.tableHeaderMarkedBy'),
                      t('attendance.tableHeaderActions'),
                    ].map(h => (
                      <th key={h} style={thSt}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const st = STATUS_STYLE[r.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                      return (
                        <tr key={r.id}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                          <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                            {r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}
                          </td>
                          <td style={tdSt}>{r.class?.name ?? '—'}</td>
                          <td style={tdSt}>{new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                          <td style={tdSt}>{r.period}</td>
                          <td style={tdSt}>
                            <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.color }}>
                              {t(`attendance.${r.status === 'PRESENT' ? 'presentLabel' : r.status === 'ABSENT' ? 'absentLabel' : r.status === 'ABSENT_JUSTIFIED' ? 'justifiedLabel' : 'lateLabel'}`)}
                            </span>
                          </td>
                          <td style={tdSt}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</td>
                          <td style={tdSt}>
                            {r.status === 'ABSENT' && (
                              <button
                                style={{ padding: '3.5px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                                onClick={() => justify(r.id)}
                                disabled={justifyingId === r.id}>
                                {justifyingId === r.id ? <Loader2 size={11} strokeWidth={2} className="animate-spin" /> : t('attendance.justify')}
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 7, padding: '6px 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8.5px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
