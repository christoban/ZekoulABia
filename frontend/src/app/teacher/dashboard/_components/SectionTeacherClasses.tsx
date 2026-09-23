'use client'
import { useState, useEffect, useCallback } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { Package } from 'lucide-react'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const MOY_COLOR = (v: number) => v >= 14 ? 'var(--green)' : v >= 10 ? 'var(--blue)' : 'var(--red)'

interface ClassStats {
  classId: string
  average: number | null
  attendanceRate: string | null
}

export default function SectionTeacherClasses({ onNav, onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [stats, setStats]     = useState<Record<string, ClassStats>>({})
  const [gradeStats, setGradeStats] = useState<Record<string, { total: number; submitted: number; draft: number }>>({})

  const fetchClassesFn = useCallback(async (): Promise<any[]> => {
    const res = await fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json())
    if (!res.success) throw new Error(t('classes.load_error'))
    return res.data
  }, [t])

  const { data: classesData, loading, error, fromCache, cachedAt, refetch: fetchData } = useCachedFetch<any[]>('teacher:classes', fetchClassesFn)
  const classes = classesData ?? []

  const fetchStats = async (classList: any[]) => {
    const statsMap: Record<string, ClassStats> = {}
    const gradeMap: Record<string, { total: number; submitted: number; draft: number }> = {}
    await Promise.all(classList.map(async (cls) => {
      try {
        const res = await fetchApi(`/api/v2/attendance/stats?classId=${cls.id}`, { credentials: 'include' })
        const d = await res.json()
        statsMap[cls.id] = {
          classId: cls.id,
          average: null,
          attendanceRate: res.ok && d.stats?.attendanceRate ? d.stats.attendanceRate : null,
        }
      } catch { statsMap[cls.id] = { classId: cls.id, average: null, attendanceRate: null } }
      try {
        const gr = await fetchApi(`/api/v2/grades/status/${cls.id}`, { credentials: 'include' })
        const gd = await gr.json()
        if (gr.ok && gd.stats) {
          gradeMap[cls.id] = {
            total: gd.stats.total,
            submitted: (gd.stats.SUBMITTED || 0) + (gd.stats.VALIDATED || 0) + (gd.stats.LOCKED || 0),
            draft: gd.stats.DRAFT || 0,
          }
        }
      } catch { /* silencieux — ne pas casser l'affichage */ }
    }))
    setStats(statsMap)
    setGradeStats(gradeMap)
  }

  useEffect(() => { if (classes.length > 0 && !fromCache) fetchStats(classes) }, [classes, fromCache]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalStudents = classes.reduce((sum: number, c: any) => sum + (c._count?.students || 0), 0)

  if (loading) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('user.loading')}</div>
      </div>
    )
  }

  if (error && error !== 'OFFLINE_NO_CACHE') {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={fetchData}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('classes.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div style={sTitle}>{t('classes.title')}</div>
        <div style={sSub}>{t('classes.subtitle').replace('{count}', String(classes.length)).replace('{students}', String(totalStudents))}</div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={13} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {classes.map((cls) => {
          const isPP = cls.professorPrincipalId === user?.id
          return (
            <div key={cls.id}
              style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 16, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', borderColor: 'var(--border2)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: 'var(--border)' })}>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                  {cls.name}
                </div>
                {isPP && (
                  <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                    {t('classes.badge_pp')}
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 12 }}>
                {t('classes.students_count').replace('{count}', String(cls._count?.students || 0))}
              </div>

              {/* Stats boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>{t('classes.stats_avg')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: stats[cls.id]?.average != null ? MOY_COLOR(stats[cls.id].average!) : 'var(--text3)' }}>
                    {stats[cls.id]?.average != null ? `${stats[cls.id].average!.toFixed(1)}` : '--'}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>/20</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>{t('classes.stats_attendance')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: stats[cls.id]?.attendanceRate ? 'var(--green)' : 'var(--text3)' }}>
                    {stats[cls.id]?.attendanceRate ?? '--'}
                  </div>
                </div>
              </div>

              {/* Grade submission status */}
              {(() => {
                const gs = gradeStats[cls.id]
                if (!gs) return null
                const done = gs.submitted
                const total = gs.total
                let label: string, bg: string, color: string
                if (total === 0) {
                  label = t('classes.grade_awaiting'); bg = 'var(--red-light)'; color = 'var(--red)'
                } else if (done === total) {
                  label = t('classes.grade_complete'); bg = 'var(--green-light)'; color = 'var(--green)'
                } else {
                  label = t('classes.grade_partial').replace('{done}', String(done)).replace('{total}', String(total)); bg = 'var(--amber-light)'; color = 'var(--amber)'
                }
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text3)' }}>{t('classes.grade_label')}</span>
                    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                      {label}
                    </span>
                    {total > 0 && done < total && (
                      <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(done / total) * 100}%`, height: '100%', background: 'var(--amber)', borderRadius: 3 }} />
                      </div>
                    )}
                  </div>
                )
              })()}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--primary)', color: 'var(--primary)' })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                  onClick={() => onNav('attendance')}>{t('classes.btn_attendance')}</button>
                <button
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--primary)', color: 'var(--primary)' })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                  onClick={() => onNav('grades')}>{t('classes.btn_grades')}</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }