'use client'
import { useCallback } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const TIMES = ['07:30', '08:30', '09:30', '10:30', '12:00', '13:00', '14:00']
const TIMES_END = ['08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00']

type SlotType = { subject: string; teacher: string; color: string } | null

interface TimetableData {
  slots: Record<string, SlotType>
  className: string
}

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  const t = useT('student')
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
      {t('common.offline_badge').replace('{date}', date)}
    </div>
  )
}

export default function SectionStudentTimetable({ onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const DAYS = [t('timetable.day_monday'), t('timetable.day_tuesday'), t('timetable.day_wednesday'), t('timetable.day_thursday'), t('timetable.day_friday')]
  const classId = user?.studentProfile?.class?.id ?? ''
  const cacheKey = classId ? `student:timetable:${classId}` : ''

  const fetchFn = useCallback(async (): Promise<TimetableData> => {
    if (!classId) throw new Error(t('timetable.no_class'))
    const res = await fetchApi(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' }).then(r => r.json())
    if (!res.success) throw new Error(t('timetable.load_error'))

    const slotMap: Record<string, SlotType> = {}
    const colors = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--teal)', 'var(--red)', 'var(--orange)']
    let colorIdx = 0
    const subjectColors: Record<string, string> = {}

    res.data.forEach((tt: any) => {
      (tt.slots || []).forEach((s: any) => {
        const startIdx = TIMES.indexOf(s.startTime)
        if (startIdx === -1) return
        const subName = s.subject?.name || ''
        if (subName && !subjectColors[subName]) {
          subjectColors[subName] = colors[colorIdx % colors.length]
          colorIdx++
        }
        slotMap[`${s.dayOfWeek}-${startIdx}`] = {
          subject: subName,
          teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : '',
          color: subjectColors[subName] || 'var(--green)',
        }
      })
    })

    return { slots: slotMap, className: user?.studentProfile?.class?.name || '' }
  }, [classId, user])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<TimetableData>(cacheKey, fetchFn)

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return `${t('timetable.week_prefix')} ${fmt(monday)} au ${fmt(friday)}`
  }

  if (!user || loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (!classId) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', fontSize: 13, fontWeight: 700 }}>{t('timetable.no_class')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const slots = data?.slots ?? {}
  const className = data?.className ?? ''

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: fromCache ? 6 : 14 }}>
        <div style={sTitle}>{t('timetable.title')}</div>
        <div style={sSub}>{className} · {getWeekRange()}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 85 }}>{t('timetable.time_header')}</th>
                {DAYS.map(d => <th key={d} style={thSt}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((time, ti) => (
                <tr key={ti}>
                  <td style={{ padding: '6px 8px', background: 'var(--bg2)', fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {time}<br /><span style={{ fontSize: 10, color: 'var(--border2)' }}>{TIMES_END[ti]}</span>
                  </td>
                  {DAYS.map((_, di) => {
                    const slot = slots[`${di}-${ti}`]
                    return (
                      <td key={di} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 110, height: 56 }}>
                        {slot ? (
                          <div style={{ padding: '6px 8px', height: '100%', background: `${slot.color}12`, borderLeft: `3px solid ${slot.color}` }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: slot.color }}>{slot.subject}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{slot.teacher}</div>
                          </div>
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border2)', fontSize: 16 }}>·</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const thSt: React.CSSProperties = { padding: '7px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px' }
