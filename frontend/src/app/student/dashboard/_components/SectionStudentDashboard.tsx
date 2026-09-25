'use client'
import { useCallback } from 'react'
import { Hand, Trophy, TrendingUp, CheckCircle2, AlertTriangle, Siren, FileText, BookOpen, Package, type LucideIcon } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import Lv2ChoiceBanner from './Lv2ChoiceBanner'
import OrientationCheckpointBanner from './OrientationCheckpointBanner'
import { groupTimetableSlotsForStudent } from '@/lib/timetableSlotGrouping'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const MENTION_LEVELS = [
  { min: 16, label: 'TB' },
  { min: 14, label: 'B' },
  { min: 12, label: 'AB' },
  { min: 10, label: 'P' },
  { min: 0, label: 'I' },
]

const MENTION_COLOR = (m: string): [string, string] => ({
  TB: ['var(--green-light)', 'var(--green)'], B: ['var(--blue-light)', 'var(--blue)'],
  AB: ['var(--amber-light)', 'var(--amber)'], P: ['var(--orange-light)', 'var(--orange)'], I: ['var(--red-light)', 'var(--red)'],
} as Record<string, [string, string]>)[m] ?? ['var(--bg2)', 'var(--text2)']

const NOTE_COLOR = (n: number) => n >= 14 ? 'var(--green)' : n >= 10 ? 'var(--blue)' : 'var(--red)'

function getMention(avg: number): string {
  for (const level of MENTION_LEVELS) {
    if (avg >= level.min) return level.label
  }
  return 'I'
}

const HEALTH_LABEL = (s: number): [string, string, string] =>
  s >= 86 ? ['var(--green-light)', 'var(--green)', 'dashboard.health_high']
  : s >= 71 ? ['var(--blue-light)', 'var(--blue)', 'dashboard.health_medium_high']
  : s >= 51 ? ['var(--amber-light)', 'var(--amber)', 'dashboard.health_medium']
  : ['var(--red-light)', 'var(--red)', 'dashboard.health_low']

const HEALTH_ICON: Record<string, LucideIcon> = {
  'dashboard.health_high': TrendingUp,
  'dashboard.health_medium_high': CheckCircle2,
  'dashboard.health_medium': AlertTriangle,
  'dashboard.health_low': Siren,
}

interface StudentDashData {
  avgGrade: number | null
  rank: { pos: number; total: number } | null
  attendanceRate: number
  subjectCount: number
  todaySlots: { time: string; subject: string; teacher: string; salle: string; color: string }[]
}

export default function SectionStudentDashboard({ onNav, onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')

  const fetchDataFn = useCallback(async (): Promise<StudentDashData> => {
    const result: StudentDashData = { avgGrade: null, rank: null, attendanceRate: 0, subjectCount: 0, todaySlots: [] }
    if (!user) return result

    const classId = user.studentProfile?.class?.id
    const userId = user.id

    const [statsRes, ayRes, attRes] = await Promise.all([
      fetchApi('/api/v2/dashboard/stats', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()),
    ])

    if (statsRes.stats?.avgGrade && statsRes.stats.avgGrade !== 'N/A') {
      result.avgGrade = Number(statsRes.stats.avgGrade)
    }
    if (attRes.stats?.attendanceRate) {
      result.attendanceRate = Number(attRes.stats.attendanceRate.replace('%', ''))
    }

    let sequenceId = ''
    if (ayRes.success) {
      const curYear = ayRes.data.find((y: any) => y.isCurrent)
      if (curYear) {
        const curPeriod = curYear.periods?.find((p: any) => p.isCurrent)
        if (curPeriod) {
          const curSeq = curPeriod.sequences?.find((s: any) => s.isCurrent)
          if (curSeq) sequenceId = curSeq.id
        }
      }
    }

    if (classId && userId && sequenceId) {
      const [avgRes, ttRes, gradesRes] = await Promise.all([
        fetchApi(`/api/v2/grades/average/${userId}?classId=${classId}&sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json()),
        fetchApi(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' }).then(r => r.json()),
        fetchApi(`/api/v2/grades?sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json()),
      ])

      if (avgRes.average !== undefined) result.avgGrade = avgRes.average
      if (avgRes.rank !== undefined) result.rank = { pos: avgRes.rank, total: avgRes.totalStudents || 0 }

      if (ttRes.success) {
        // getDay() : 0=Dimanche, 1=Lundi … → converti en 0=Lundi … 5=Samedi, la convention
        // unique de TimetableSlot.dayOfWeek. Dimanche (6) ne matche aucun créneau.
        const todayIdx = (new Date().getDay() + 6) % 7
        const groupIds = user.studentProfile?.groupIds ?? []
        const rawTodaySlots = ttRes.data.flatMap((tt: { slots?: Array<{ dayOfWeek: number; startTime: string; endTime: string; groupId?: string | null; subject?: { name?: string | null } | null; teacher?: { firstName: string; lastName: string } | null; room?: string | null }> }) =>
          (tt.slots || []).filter(slot => slot.dayOfWeek === todayIdx),
        )
        result.todaySlots = [...groupTimetableSlotsForStudent<{ dayOfWeek: number; startTime: string; endTime: string; groupId?: string | null; subject?: { name?: string | null } | null; teacher?: { firstName: string; lastName: string } | null; room?: string | null }>(rawTodaySlots, groupIds).values()]
          .flatMap(entries => entries.map(entry => ({
            time: entry.startTime,
            subject: 'unassigned' in entry ? t('timetable.notAssignedToGroup') : entry.subject?.name || '',
            teacher: 'unassigned' in entry ? '' : entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : '',
            salle: 'unassigned' in entry ? '' : entry.room || '',
            color: 'var(--green)',
          })))
          .sort((a, b) => a.time.localeCompare(b.time))
          .slice(0, 3)
      }

      if (gradesRes.grades) {
        const uniqueSubjects = new Set(gradesRes.grades.map((g: any) => g.subjectId))
        result.subjectCount = uniqueSubjects.size
      }
    } else if (statsRes.stats?.avgGrade && statsRes.stats.avgGrade !== 'N/A') {
      const gradeFromStats = Number(statsRes.stats.avgGrade)
      if (!isNaN(gradeFromStats)) result.avgGrade = gradeFromStats
    }

    return result
  }, [user])

  const groupIds = user?.studentProfile?.groupIds ?? []
  const { data, loading, error, fromCache, cachedAt, refetch: fetchData } = useCachedFetch<StudentDashData>(user ? `student:dashboard:${user.id}:${[...groupIds].sort().join(',')}` : '', fetchDataFn)
  const avgGrade = data?.avgGrade ?? null
  const rank = data?.rank ?? null
  const attendanceRate = data?.attendanceRate ?? 0
  const subjectCount = data?.subjectCount ?? 0
  const todaySlots = data?.todaySlots ?? []

  const displayAvg = avgGrade ?? 0
  const mention = getMention(displayAvg)
  const [mBg, mC] = MENTION_COLOR(mention)
  const matricule = user ? `MAT-${user.id.substring(0, 6).toUpperCase()}` : ''
  const indiceSante = Math.round(displayAvg * 3 + attendanceRate * 0.5)
  const [hBg, hC, hLabel] = HEALTH_LABEL(indiceSante)
  const rankDisplay = rank ? `${rank.pos}e / ${rank.total}` : '—'
  const className = user?.studentProfile?.class?.name || ''

  if (loading) {
    return (
      <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error && error !== 'OFFLINE_NO_CACHE') {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={fetchData}
            style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%' }}>
      <Lv2ChoiceBanner onToast={onToast} />
      <OrientationCheckpointBanner onToast={onToast} />
      <div style={{ background: 'linear-gradient(135deg,var(--sidebar),var(--sidebar2))', borderRadius: 12, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(74,222,128,0.05)', pointerEvents: 'none' }} />
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hand size={18} strokeWidth={2} />
            {t('dashboard.greeting').replace('{name}', user?.firstName || tcommon('user.studentFallback'))}
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
            {className} · {t('dashboard.matricule_label')} {matricule}
          </div>
          {fromCache && cachedAt && (
            <div style={{ background: 'rgba(217,119,6,0.25)', border: '1px solid rgba(217,119,6,0.5)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'white', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={13} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: mBg, color: mC, padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Trophy size={13} strokeWidth={2} /> {rankDisplay}
            </span>
            <span style={{ background: hBg, color: hC, padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {(() => { const HIcon = HEALTH_ICON[hLabel]; return <HIcon size={13} strokeWidth={2} /> })()} {t(hLabel)}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: 'white', lineHeight: 1 }}>{displayAvg.toFixed(1)}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{t('dashboard.average_label')}</div>
          <div style={{ marginTop: 6, background: mBg, color: mC, padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 800, display: 'inline-block' }}>
            {({ TB: t('grades.mention_tb'), B: t('grades.mention_b'), AB: t('grades.mention_ab'), P: t('grades.mention_p'), I: t('grades.mention_i') } as Record<string, string>)[mention] ?? t('grades.mention_i')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { icon: FileText, bg: 'var(--green-light)', val: `${displayAvg.toFixed(1)}/20`, label: t('dashboard.general_avg_label'),  trend: mention,    tBg: mBg, tC: mC },
          { icon: Trophy, bg: 'var(--blue-light)', val: rank ? `${rank.pos}e` : '—', label: rank ? t('dashboard.rank_label').replace('{total}', String(rank.total)) : t('dashboard.rank_short'), trend: t('dashboard.trend_this_term'), tBg: 'var(--blue-light)', tC: 'var(--blue)' },
          { icon: CheckCircle2, bg: 'var(--amber-light)', val: `${attendanceRate}%`, label: t('dashboard.rate_label'), trend: t('dashboard.trend_term'),  tBg: 'var(--green-light)', tC: 'var(--green)' },
          { icon: BookOpen, bg: 'var(--purple-light)', val: String(subjectCount || '...'),  label: t('dashboard.subjects_label'), trend: t('dashboard.trend_year'), tBg: 'var(--purple-light)', tC: 'var(--purple)' },
        ].map((k, i) => (
          <div key={i}
            style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><k.icon size={16} strokeWidth={2} /></div>
              <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 12, background: k.tBg, color: k.tC, whiteSpace: 'nowrap' }}>{k.trend}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{t('dashboard.today_title')}</span>
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {todaySlots.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5, fontWeight: 600, width: '100%' }}>{t('dashboard.today_empty')}</div>
          ) : todaySlots.map((c, i) => (
            <div key={i} style={{ flex: 1, minWidth: 160, background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', borderLeft: `3px solid ${c.color || 'var(--green)'}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', marginBottom: 3 }}>{c.time}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{c.subject}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{c.teacher}{c.salle ? ` · ${c.salle}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
