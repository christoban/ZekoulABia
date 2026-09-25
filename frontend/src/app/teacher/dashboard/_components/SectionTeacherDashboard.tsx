'use client'
import { useCallback } from 'react'
import { School, GraduationCap, FileText, CheckCircle2, Award, Target, MapPin, Siren, Hand, RefreshCw, Calendar, Bell, AlertTriangle, PenLine, ClipboardList, Package } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

interface TeacherDashData {
  classCount: number | null
  studentCount: number | null
  pendingGrades: number | null
  attendanceRate: string | null
  todaySlots: any[]
  rejectedGrades: number
}

export default function SectionTeacherDashboard({ onNav, onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')

  const fetchDataFn = useCallback(async (): Promise<TeacherDashData> => {
    const [classesRes, gradesPendingRes, statsRes, timetableRes, gradesRejectedRes] = await Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi(`/api/v2/grades?validationStatus=SUBMITTED`, { credentials: 'include' }).then(r => r.json()),
      fetchApi(`/api/v2/attendance/stats`, { credentials: 'include' }).then(r => r.json()),
      fetchApi(`/api/v2/timetables`, { credentials: 'include' }).then(r => r.json()),
      fetchApi(`/api/v2/grades?validationStatus=REJECTED`, { credentials: 'include' }).then(r => r.json()),
    ])

    const result: TeacherDashData = {
      classCount: null, studentCount: null, pendingGrades: null, attendanceRate: null, todaySlots: [], rejectedGrades: 0,
    }

    if (classesRes.success) {
      result.classCount = classesRes.data.length
      result.studentCount = classesRes.data.reduce((sum: number, c: any) => sum + (c._count?.students || 0), 0)
    }
    if (gradesPendingRes.grades) {
      result.pendingGrades = gradesPendingRes.pagination?.total || gradesPendingRes.grades.length
    }
    if (statsRes.stats) {
      result.attendanceRate = statsRes.stats.attendanceRate
    }
    if (timetableRes.success) {
      // getDay() : 0=Dimanche, 1=Lundi … 6=Samedi → converti en 0=Lundi … 5=Samedi, la
      // convention unique de TimetableSlot.dayOfWeek. Dimanche devient 6 et ne matche donc
      // aucun créneau, ce qui est le comportement voulu.
      const todayIdx = (new Date().getDay() + 6) % 7
      const teacherId = user?.id
      result.todaySlots = timetableRes.data.flatMap((tt: any) =>
        (tt.slots || [])
          .filter((s: any) => s.dayOfWeek === todayIdx && teacherId && s.teacher?.id === teacherId)
          .map((s: any) => ({
            time: `${s.startTime}–${s.endTime}`,
            classe: tt.class?.name || '',
            subject: s.subject?.name || '',
            salle: s.room || '',
            eleves: 0,
          }))
      )
    }
    if (gradesRejectedRes.grades) {
      result.rejectedGrades = gradesRejectedRes.grades.length
    }
    return result
  }, [user])

  const { data, loading, error, fromCache, cachedAt, refetch: fetchData } = useCachedFetch<TeacherDashData>(user ? `teacher:dashboard:${user.id}` : '', fetchDataFn)
  const classCount = data?.classCount ?? null
  const studentCount = data?.studentCount ?? null
  const pendingGrades = data?.pendingGrades ?? null
  const attendanceRate = data?.attendanceRate ?? null
  const todaySlots = data?.todaySlots ?? []
  const rejectedGrades = data?.rejectedGrades ?? 0

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const KPI_ITEMS = [
    { Icon: School, bg: 'var(--green-light)', val: classCount !== null ? String(classCount) : '...', label: t('dashboard.kpi_assigned_classes'), trend: t('dashboard.trend_2025_2026'), tBg: 'var(--green-light)', tC: 'var(--green)' },
    { Icon: GraduationCap, bg: 'var(--blue-light)', val: studentCount !== null ? String(studentCount) : '...', label: t('dashboard.kpi_total_students'), trend: t('dashboard.trend_year'), tBg: 'var(--green-light)', tC: 'var(--green)' },
    { Icon: FileText, bg: 'var(--amber-light)', val: pendingGrades !== null ? String(pendingGrades) : '...', label: t('dashboard.kpi_pending_grades'), trend: t('dashboard.trend_urgent'), tBg: 'var(--amber-light)', tC: 'var(--amber)', nav: 'grades', urgent: true },
    { Icon: CheckCircle2, bg: 'var(--green-light)', val: attendanceRate || '...', label: t('dashboard.kpi_attendance_rate'), trend: t('dashboard.trend_global'), tBg: 'var(--green-light)', tC: 'var(--green)', nav: 'attendance' },
  ]

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error && error !== 'OFFLINE_NO_CACHE') {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={fetchData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={14} strokeWidth={2} />{t('dashboard.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ ...sTitle, display: 'flex', alignItems: 'center', gap: 8 }}>{t('dashboard.greeting').replace('{name}', user?.firstName || tcommon('user.teacherFallback'))}<Hand size={18} strokeWidth={2} /></div>
          <div style={sSub}>{dateStr}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 7, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={12} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button style={{ ...btnSec, display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => { onToast(t('dashboard.refresh'), 'info'); fetchData() }}><RefreshCw size={12} strokeWidth={2} />{t('dashboard.refresh')}</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        {KPI_ITEMS.map((k, i) => (
          <div key={i}
            onClick={() => k.nav && onNav(k.nav)}
            style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '14px 16px', cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
            onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><k.Icon size={18} strokeWidth={2} /></div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: k.tBg, color: k.tC }}>
                {(k as any).urgent && <AlertTriangle size={11} strokeWidth={2} />}{k.trend}
              </span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{k.val}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Rôles spéciaux : Professeur Principal + Animateur Pédagogique ── */}
      {((user?.classesProfessorPrincipal?.length ?? 0) > 0 || (user?.headedDepartments?.length ?? 0) > 0) && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>

          {user?.classesProfessorPrincipal?.map(cls => (
            <div key={cls.id} style={{ flex: '1 1 280px', background: 'linear-gradient(135deg,var(--green-light),var(--green-light))', borderRadius: 12, border: '1.5px solid rgba(5,150,105,0.35)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(142,42,58,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Award size={20} strokeWidth={2} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1 }}>{t('dashboard.pp_badge')}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--green)', lineHeight: 1.1 }}>{cls.name}</div>
                {cls._count && (
                  <div style={{ fontSize: 11.5, color: 'var(--green2)', fontWeight: 700, marginTop: 2 }}>{t('dashboard.pp_students').replace('{count}', String(cls._count.students))}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <button onClick={() => onNav('pp-appreciations')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 800, background: 'rgba(5,150,105,0.15)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.3)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <PenLine size={12} strokeWidth={2} />{t('dashboard.pp_appreciations_btn')}
                </button>
                <button onClick={() => onNav('pp-classe')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 800, background: 'var(--surface)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.3)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <ClipboardList size={12} strokeWidth={2} />{t('dashboard.pp_class_btn')}
                </button>
              </div>
            </div>
          ))}

          {user?.headedDepartments?.map(dept => (
            <div key={dept.id} style={{ flex: '1 1 280px', background: `linear-gradient(135deg,${dept.color}20,${dept.color}08)`, borderRadius: 12, border: `1.5px solid ${dept.color}55`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${dept.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Target size={20} strokeWidth={2} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: dept.color, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 1 }}>{t('dashboard.ap_badge')}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{t('dashboard.ap_dept_prefix').replace('{name}', dept.name)}</div>
                {dept.subjects && dept.subjects.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginTop: 2 }}>
                    {dept.subjects.slice(0, 3).map(s => s.name).join(' · ')}{dept.subjects.length > 3 ? t('dashboard.more_subjects').replace('{count}', String(dept.subjects.length - 3)) : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <button onClick={() => onNav('ap-departement')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 800, background: `${dept.color}18`, color: dept.color, border: `1px solid ${dept.color}40`, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <Target size={12} strokeWidth={2} />{t('dashboard.ap_dept_btn')}
                </button>
              </div>
            </div>
          ))}

        </div>
      )}

      {/* 2 colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Cours aujourd'hui */}
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}><Calendar size={15} strokeWidth={2} />{t('dashboard.today_courses')}</span>
            <button style={btnSecSm} onClick={() => onNav('timetable')}>{t('dashboard.view_full_timetable')}</button>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todaySlots.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13, fontWeight: 600 }}>{t('dashboard.no_today_courses')}</div>
            ) : todaySlots.map((c, i) => (
              <div key={i}
                style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 14px', cursor: 'pointer', transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border)', boxShadow: 'none' })}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text3)' }}>{c.time}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20, background: 'var(--blue-light)', color: 'var(--blue)' }}>{c.classe}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{c.subject}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} strokeWidth={2} /> {c.salle || t('dashboard.room_undefined')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertes */}
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}><Bell size={15} strokeWidth={2} />{t('dashboard.alerts_title')}</span>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rejectedGrades > 0 && (
              <div
                onClick={() => onNav('grades')}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid', cursor: 'pointer', background: 'var(--red-light)', borderColor: 'rgba(220,38,38,0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}><Siren size={17} strokeWidth={2} /></span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--red)' }}>{t('dashboard.rejected_note').replace('{count}', String(rejectedGrades))}</div>
                  <div style={{ fontSize: 12, color: 'var(--red)', fontWeight: 500, marginTop: 2 }}>{t('dashboard.rejected_action')}</div>
                </div>
              </div>
            )}

            {/* Actions rapides */}
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button style={{ width: '100%', padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--primary)', color: 'var(--primary)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                onClick={() => onNav('attendance')}>
                <CheckCircle2 size={14} strokeWidth={2} />{t('dashboard.take_attendance')}
              </button>
              <button style={{ width: '100%', padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--primary)', color: 'var(--primary)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                onClick={() => onNav('grades')}>
                <FileText size={14} strokeWidth={2} />{t('dashboard.enter_grades')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const btnSec: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '4px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
