'use client'
import { useState, useCallback } from 'react'
import { Hand, Trophy, TrendingUp, CheckCircle2, AlertTriangle, Siren, FileText, BookOpen, Package, UserPen, type LucideIcon } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import Lv2ChoiceBanner from './Lv2ChoiceBanner'
import OrientationCheckpointBanner from './OrientationCheckpointBanner'
import ProfileIncompleteBanner, { type CompletenessData } from './ProfileIncompleteBanner'
import EditStudentProfileModal from './EditStudentProfileModal'
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
  healthScore: number | null
  todaySlots: { time: string; subject: string; teacher: string; salle: string; color: string }[]
  upcomingHomework: { id: string; subject: string; task: string; dueDate: string | null }[]
}

export default function SectionStudentDashboard({ onNav, onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const [editProfileData, setEditProfileData] = useState<CompletenessData | null>(null)

  const fetchDataFn = useCallback(async (): Promise<StudentDashData> => {
    const result: StudentDashData = {
      avgGrade: null,
      rank: null,
      attendanceRate: 0,
      subjectCount: 0,
      healthScore: user?.studentProfile?.healthScore ?? null,
      todaySlots: [],
      upcomingHomework: [],
    }
    if (!user) return result

    const classId = user.studentProfile?.class?.id
    const userId = user.id

    const [statsRes, ayRes, attRes, healthRes] = await Promise.all([
      fetchApi('/api/v2/dashboard/stats', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetchApi('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      fetchApi('/api/v2/ai/health-tracking', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
    ])

    if (healthRes.children?.[0]?.healthScore !== undefined) {
      result.healthScore = healthRes.children[0].healthScore
    }

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

    if (classId && userId) {
      const promises: Promise<any>[] = [
        fetchApi(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
        fetchApi(`/api/v2/pedagogie/cahier-de-texte?classId=${classId}&limit=10`, { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
      ]

      if (sequenceId) {
        promises.push(
          fetchApi(`/api/v2/grades/average/${userId}?classId=${classId}&sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
          fetchApi(`/api/v2/grades?sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
        )
      }

      const responses = await Promise.all(promises)
      const ttRes = responses[0]
      const cahierRes = responses[1]
      const avgRes = sequenceId ? responses[2] : null
      const gradesRes = sequenceId ? responses[3] : null

      if (avgRes?.average !== undefined) result.avgGrade = avgRes.average
      if (avgRes?.rank !== undefined) result.rank = { pos: avgRes.rank, total: avgRes.totalStudents || 0 }

      if (ttRes?.success) {
        const todayIdx = (new Date().getDay() + 6) % 7
        const groupIds = user.studentProfile?.groupIds ?? []
        const rawTodaySlots = (ttRes.data || []).flatMap((tt: { slots?: Array<{ dayOfWeek: number; startTime: string; endTime: string; groupId?: string | null; subject?: { name?: string | null } | null; teacher?: { firstName: string; lastName: string } | null; room?: string | null }> }) =>
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

      if (cahierRes?.success && Array.isArray(cahierRes.data)) {
        result.upcomingHomework = cahierRes.data
          .filter((entry: any) => Boolean(entry.devoirsDonnes))
          .slice(0, 3)
          .map((entry: any) => ({
            id: entry.id,
            subject: entry.matiere?.name || entry.subject?.name || 'Cours',
            task: entry.devoirsDonnes,
            dueDate: entry.dateDevoir || null,
          }))
      }

      if (gradesRes?.grades) {
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
  const upcomingHomework = data?.upcomingHomework ?? []

  const displayAvg = avgGrade ?? 0
  const mention = getMention(displayAvg)
  const [mBg, mC] = MENTION_COLOR(mention)
  const matricule = user?.studentProfile?.matricule || user?.studentProfile?.numeroInterne || (user ? user.id.substring(0, 8).toUpperCase() : '')
  const indiceSante = data?.healthScore ?? user?.studentProfile?.healthScore ?? 75
  const [hBg, hC, hLabel] = HEALTH_LABEL(indiceSante)
  const rankDisplay = rank ? `${rank.pos}e / ${rank.total}` : '—'
  const className = user?.studentProfile?.class?.name || ''
  const lv2Name = user?.studentProfile?.lv2Subject?.name || null

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
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <ProfileIncompleteBanner onOpenEdit={setEditProfileData} />
      <Lv2ChoiceBanner onToast={onToast} />
      <OrientationCheckpointBanner onToast={onToast} user={user} />
      
      {/* Carte d'accueil et profil élève */}
      <div
        className="rounded-2xl p-4 sm:p-5 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-sm"
        style={{ background: 'linear-gradient(135deg,var(--sidebar),var(--sidebar2))' }}
      >
        <div style={{ position: 'absolute', right: -50, top: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(74,222,128,0.05)', pointerEvents: 'none' }} />
        <div className="min-w-0">
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hand size={18} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{t('dashboard.greeting').replace('{name}', user?.firstName || tcommon('user.studentFallback'))}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }} className="truncate">
            {className} · {t('dashboard.matricule_label')} {matricule}
          </div>
          {fromCache && cachedAt && (
            <div style={{ background: 'rgba(217,119,6,0.25)', border: '1px solid rgba(217,119,6,0.5)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'white', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={13} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
          <div className="flex gap-2 flex-wrap items-center mt-2.5">
            <span style={{ background: mBg, color: mC, padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Trophy size={13} strokeWidth={2} /> {rankDisplay}
            </span>
            <span style={{ background: hBg, color: hC, padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {(() => { const HIcon = HEALTH_ICON[hLabel]; return <HIcon size={13} strokeWidth={2} /> })()} {t(hLabel)}
            </span>
            {lv2Name && (
              <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                LV2 : {lv2Name}
              </span>
            )}
          </div>
        </div>

        {/* Moyenne générale en valeur clé */}
        <div className="flex sm:flex-col items-center justify-between sm:justify-center border-t sm:border-t-0 pt-2.5 sm:pt-0 border-white/10 shrink-0">
          <div className="text-left sm:text-center">
            <div style={{ fontSize: 28, fontWeight: 900, color: 'white', lineHeight: 1 }}>{displayAvg.toFixed(1)}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{t('dashboard.average_label')}</div>
          </div>
          <div style={{ background: mBg, color: mC, padding: '3px 10px', borderRadius: 16, fontSize: 11.5, fontWeight: 800 }} className="sm:mt-2">
            {({ TB: t('grades.mention_tb'), B: t('grades.mention_b'), AB: t('grades.mention_ab'), P: t('grades.mention_p'), I: t('grades.mention_i') } as Record<string, string>)[mention] ?? t('grades.mention_i')}
          </div>
        </div>
      </div>

      {/* Cartes statistiques KPIs (2 colonnes sur mobile, 4 sur desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {[
          { icon: FileText, bg: 'var(--green-light)', val: `${displayAvg.toFixed(1)}/20`, label: t('dashboard.general_avg_label'),  trend: mention,    tBg: mBg, tC: mC },
          { icon: Trophy, bg: 'var(--blue-light)', val: rank ? `${rank.pos}e` : '—', label: rank ? t('dashboard.rank_label').replace('{total}', String(rank.total)) : t('dashboard.rank_short'), trend: t('dashboard.trend_this_term'), tBg: 'var(--blue-light)', tC: 'var(--blue)' },
          { icon: CheckCircle2, bg: 'var(--amber-light)', val: `${attendanceRate}%`, label: t('dashboard.rate_label'), trend: t('dashboard.trend_term'),  tBg: 'var(--green-light)', tC: 'var(--green)' },
          { icon: BookOpen, bg: 'var(--purple-light)', val: String(subjectCount || '...'),  label: t('dashboard.subjects_label'), trend: t('dashboard.trend_year'), tBg: 'var(--purple-light)', tC: 'var(--purple)' },
        ].map((k, i) => (
          <div key={i}
            className="rounded-xl border p-3 sm:p-3.5 transition-all"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between gap-1 mb-2">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="shrink-0">
                <k.icon size={15} strokeWidth={2} />
              </div>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full truncate" style={{ background: k.tBg, color: k.tC }}>{k.trend}</span>
            </div>
            <div className="text-base sm:text-lg font-black leading-tight" style={{ color: 'var(--text)' }}>{k.val}</div>
            <div className="text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--text3)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Grille : Cours d'aujourd'hui & Devoirs récents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Cours d'aujourd'hui */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs sm:text-sm font-extrabold" style={{ color: 'var(--text)' }}>{t('dashboard.today_title')}</span>
            <button
              onClick={() => onNav('timetable')}
              className="text-[11px] font-bold border-none bg-transparent cursor-pointer p-0 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {t('sidebar.timetable')} →
            </button>
          </div>
          <div className="p-3 sm:p-3.5">
            {todaySlots.length === 0 ? (
              <div className="py-6 text-center text-xs font-semibold" style={{ color: 'var(--text3)' }}>{t('dashboard.today_empty')}</div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {todaySlots.map((c, i) => (
                  <div key={i} className="rounded-lg p-2.5 sm:p-3" style={{ background: 'var(--bg)', borderLeft: `3.5px solid ${c.color || 'var(--green)'}` }}>
                    <div className="text-[11px] font-extrabold mb-1" style={{ color: 'var(--text3)' }}>{c.time}</div>
                    <div className="text-xs sm:text-sm font-bold truncate" style={{ color: 'var(--text)' }}>{c.subject}</div>
                    <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--text3)' }}>{c.teacher}{c.salle ? ` · ${c.salle}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Devoirs & Travaux à faire */}
        <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-xs sm:text-sm font-extrabold" style={{ color: 'var(--text)' }}>
              {t('homework.title') || 'Devoirs & Travaux'}
            </span>
            <button
              onClick={() => onNav('homework')}
              className="text-[11px] font-bold border-none bg-transparent cursor-pointer p-0 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              {t('homework.view_all') || 'Voir tout'} →
            </button>
          </div>
          <div className="p-3 sm:p-3.5">
            {upcomingHomework.length === 0 ? (
              <div className="py-6 text-center text-xs font-semibold" style={{ color: 'var(--text3)' }}>
                {t('homework.empty_short') || 'Aucun devoir en attente'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {upcomingHomework.map((hw) => (
                  <div key={hw.id} className="rounded-lg p-2.5 sm:p-3" style={{ background: 'var(--bg)', borderLeft: '3.5px solid var(--amber)' }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-extrabold" style={{ color: 'var(--amber)' }}>{hw.subject}</span>
                      {hw.dueDate && (
                        <span className="text-[10.5px] font-semibold" style={{ color: 'var(--text3)' }}>
                          Pour le {new Date(hw.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--text)' }}>
                      {hw.task}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editProfileData && (
        <EditStudentProfileModal
          initialData={editProfileData}
          onClose={() => setEditProfileData(null)}
          onToast={onToast}
          onUpdated={fetchData}
        />
      )}
    </div>
  )
}
