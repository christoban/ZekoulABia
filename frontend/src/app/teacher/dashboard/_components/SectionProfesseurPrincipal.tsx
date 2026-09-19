'use client'
import { useState, useCallback } from 'react'
import { Inbox, CheckCircle2, AlertTriangle, Circle, BarChart3, ClipboardList, AlarmClock, Package } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Props {
  user: UserInfo
  classeId: string
  classeNom: string
}

interface StudentRow {
  id: string
  firstName: string
  lastName: string
  rang: number
  moyenne: number | null
  tauxPresence: number
}

interface AttendanceRecord {
  id: string
  date: string
  studentId: string
  studentName?: string
  status: string
}

type Tab = 'eleves' | 'presences'
type DateFilter = 'semaine' | 'mois'

const BADGE = (moy: number | null) => {
  if (moy === null) return { bg: 'var(--bg2)', color: 'var(--text3)', label: '—' }
  if (moy >= 12) return { bg: 'var(--green-light)', color: 'var(--green)', label: String(moy.toFixed(2)) }
  if (moy >= 8)  return { bg: 'var(--amber-light)', color: 'var(--amber)', label: String(moy.toFixed(2)) }
  return { bg: 'var(--red-light)', color: 'var(--red)', label: String(moy.toFixed(2)) }
}

export default function SectionProfesseurPrincipal({ user: _user, classeId, classeNom }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [tab, setTab] = useState<Tab>('eleves')
  const [dateFilter, setDateFilter] = useState<DateFilter>('semaine')

  const fetchStudentsFn = useCallback(async (): Promise<StudentRow[]> => {
    const res = await fetchApi(`/api/v2/classes/${classeId}/students`, { credentials: 'include' })
    const d = await res.json()
    if (!d.success) throw new Error(t('pp.load_error_students'))
    return d.data
  }, [classeId, t])
  const { data: studentsData, loading: studentsLoading, error: studentsError, fromCache: studFromCache, cachedAt: studCachedAt } =
    useCachedFetch<StudentRow[]>(tab === 'eleves' ? `teacher:pp-students:${classeId}` : '', fetchStudentsFn)
  const students = studentsData ?? []

  const fetchAttendancesFn = useCallback(async (): Promise<AttendanceRecord[]> => {
    const since = dateFilter === 'semaine'
      ? new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
      : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
    const res = await fetchApi(`/api/v2/attendance?classId=${classeId}&from=${since}&limit=200`, { credentials: 'include' })
    const d = await res.json()
    return Array.isArray(d.attendances) ? d.attendances : []
  }, [classeId, dateFilter])
  const { data: attendancesData, loading: attLoading, fromCache: attFromCache, cachedAt: attCachedAt } =
    useCachedFetch<AttendanceRecord[]>(tab === 'presences' ? `teacher:pp-attendance:${classeId}:${dateFilter}` : '', fetchAttendancesFn)
  const attendances = attendancesData ?? []

  const loading = tab === 'eleves' ? studentsLoading : attLoading
  const error = tab === 'eleves' && studentsError && studentsError !== 'OFFLINE_NO_CACHE' ? studentsError : null
  const fromCache = tab === 'eleves' ? studFromCache : attFromCache
  const cachedAt = tab === 'eleves' ? studCachedAt : attCachedAt

  const tabBtn = (tabId: Tab, label: string, Icon: typeof BarChart3) => (
    <button
      onClick={() => setTab(tabId)}
      style={{
        padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700,
        fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === tabId ? 'var(--sidebar)' : 'var(--bg2)',
        color: tab === tabId ? 'white' : 'var(--text2)',
        transition: 'all 0.15s',
        display: 'inline-flex', alignItems: 'center', gap: 5,
      }}>
      <Icon size={13} strokeWidth={2} />{label}
    </button>
  )

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={18} strokeWidth={2} />{t('pp.class_title').replace('{name}', classeNom)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
          {t('pp.view_title')}
        </div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={13} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabBtn('eleves',   t('pp.tab_students'), BarChart3)}
        {tabBtn('presences',t('pp.tab_attendance'), CheckCircle2)}
      </div>

      {tab === 'eleves' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Élèves — {classeNom}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{students.length} élève{students.length > 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Chargement...</div>
          ) : error ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', fontSize: 12.5 }}>{error}</div>
          ) : students.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>Aucune note saisie pour cette classe</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    {['Rang', 'Élève', 'Moyenne /20', 'Présence', 'Niveau'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const badge = BADGE(s.moyenne)
                    return (
                      <tr key={s.id} style={{ borderTop: '1px solid var(--bg)', background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                        <td style={{ padding: '8px 12px', fontSize: 12, fontWeight: 800, color: 'var(--text3)' }}>#{s.rang}</td>
                        <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{s.lastName} {s.firstName}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800 }}>
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>
                          {s.tauxPresence}%
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {s.moyenne !== null && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                              background: s.moyenne >= 12 ? 'var(--green-light)' : s.moyenne >= 8 ? 'var(--amber-light)' : 'var(--red-light)',
                              color: s.moyenne >= 12 ? 'var(--green)' : s.moyenne >= 8 ? 'var(--amber)' : 'var(--red)' }}>
                              {s.moyenne >= 12 ? <CheckCircle2 size={11} strokeWidth={2} /> : s.moyenne >= 8 ? <AlertTriangle size={11} strokeWidth={2} /> : <Circle size={7} fill="var(--red)" stroke="none" />}
                              {s.moyenne >= 12 ? 'Admis' : s.moyenne >= 8 ? 'Passable' : 'En difficulté'}
                            </span>
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
      )}

      {tab === 'presences' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Présences — {classeNom}</span>
            {(['semaine', 'mois'] as DateFilter[]).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: dateFilter === f ? 'var(--sidebar)' : 'var(--bg2)', color: dateFilter === f ? 'white' : 'var(--text2)' }}>
                {f === 'semaine' ? '7 derniers jours' : '30 derniers jours'}
              </button>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Chargement...</div>
          ) : attendances.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Aucune présence enregistrée sur cette période</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    {['Date', 'Élève', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendances.map((a, i) => {
                    const statusStyle: Record<string, { bg: string; color: string; label: string; Icon?: typeof CheckCircle2; dot?: boolean }> = {
                      PRESENT:          { bg: 'var(--green-light)', color: 'var(--green)', label: 'Présent', Icon: CheckCircle2 },
                      ABSENT:           { bg: 'var(--red-light)', color: 'var(--red)', label: 'Absent', dot: true },
                      ABSENT_JUSTIFIED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: 'Justifié', Icon: ClipboardList },
                      LATE:             { bg: 'var(--blue-light)', color: 'var(--blue)', label: 'Retard', Icon: AlarmClock },
                    }
                    const s = statusStyle[a.status] ?? { bg: 'var(--bg2)', color: 'var(--text3)', label: a.status }
                    return (
                      <tr key={a.id} style={{ borderTop: '1px solid var(--bg)', background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                        <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                          {new Date(a.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                          {a.studentName ?? a.studentId}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: s.bg, color: s.color, padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>
                            {s.dot ? <Circle size={7} fill="var(--red)" stroke="none" /> : s.Icon ? <s.Icon size={12} strokeWidth={2} /> : null}
                            {s.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
