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

interface GradesData {
  grades: any[]
  avg: number | null
  rank: { pos: number; total: number } | null
}

const MENTION_LEVELS = [
  { min: 16, label: 'TB' },
  { min: 14, label: 'B' },
  { min: 12, label: 'AB' },
  { min: 10, label: 'P' },
  { min: 0,  label: 'I' },
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

export default function SectionStudentGrades({ onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const cacheKey = user ? `student:grades:${user.id}` : ''

  const fetchFn = useCallback(async (): Promise<GradesData> => {
    const classId = user!.studentProfile?.class?.id
    const userId = user!.id

    const ayRes = await fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json())
    let sequenceId = ''
    if (ayRes.success && ayRes.data?.length) {
      // Préférer l'année courante, sinon la première disponible
      const curYear = ayRes.data.find((y: any) => y.isCurrent) ?? ayRes.data[0]
      if (curYear) {
        const periods = curYear.periods ?? []
        const curPeriod = periods.find((p: any) => p.isCurrent) ?? periods[0]
        if (curPeriod) {
          const seqs = curPeriod.sequences ?? []
          const curSeq = seqs.find((s: any) => s.isCurrent) ?? seqs[seqs.length - 1]
          if (curSeq) sequenceId = curSeq.id
        }
      }
    }

    const [gradesRes, avgRes] = await Promise.all([
      fetchApi(`/api/v2/grades?sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json()),
      classId && sequenceId
        ? fetchApi(`/api/v2/grades/average/${userId}?classId=${classId}&sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json())
        : Promise.resolve(null),
    ])

    return {
      grades: gradesRes.grades ?? [],
      avg: avgRes?.average ?? null,
      rank: avgRes?.rank != null ? { pos: avgRes.rank, total: avgRes.totalStudents || 0 } : null,
    }
  }, [user])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<GradesData>(cacheKey, fetchFn)

  if (!user || loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
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

  const grades = data?.grades ?? []
  const avg = data?.avg ?? null
  const rank = data?.rank ?? null
  const displayAvg = avg ?? 0
  const mention = getMention(displayAvg)
  const mentionFull = ({ TB: t('grades.mention_tb'), B: t('grades.mention_b'), AB: t('grades.mention_ab'), P: t('grades.mention_p'), I: t('grades.mention_i') } as Record<string, string>)[mention] ?? t('grades.mention_i')
  const [mBg, mC] = MENTION_COLOR(mention)
  const subjectsAbove10 = grades.filter(g => (g.sequenceScore ?? g.sequenceAverage ?? 0) >= 10).length

  const subjectRows = grades
    .filter(g => g.subject)
    .reduce((acc: any[], g: any) => {
      if (acc.find(a => a.subjectId === g.subjectId)) return acc
      acc.push({
        subjectId: g.subjectId,
        name: g.subject?.name || '',
        coeff: g.coefficient || g.subject?.coefficient || 1,
        note: g.sequenceScore ?? g.sequenceAverage ?? 0,
      })
      return acc
    }, [])
    .sort((a: any, b: any) => a.name.localeCompare(b.name))

  void mBg; void mC

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 6 : 12 }}>
        <div style={sTitle}>{t('grades.title')}</div>
        <div style={sSub}>{t('grades.subtitle')}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      {/* Résumé de performance globale */}
      <div
        className="rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 shadow-sm"
        style={{ background: 'linear-gradient(135deg,var(--sidebar),var(--sidebar2))' }}
      >
        <div className="flex items-center gap-4 sm:flex-col sm:items-center shrink-0">
          <div style={{ fontSize: 28, fontWeight: 900, color: 'white', lineHeight: 1 }}>{displayAvg.toFixed(1)}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{t('grades.average_label')}</div>
        </div>

        <div className="hidden sm:block w-px h-10 bg-white/10 shrink-0" />

        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-6 w-full border-t sm:border-t-0 pt-2.5 sm:pt-0 border-white/10">
          {[
            { label: t('grades.rank_label'), val: rank ? `${rank.pos}e / ${rank.total}` : '—' },
            { label: t('grades.mention_label'), val: mentionFull },
            { label: t('grades.subjects_above_10'), val: `${subjectsAbove10}/${subjectRows.length}` },
          ].map((s, i) => (
            <div key={i} className="min-w-0">
              <div className="text-[10px] sm:text-xs font-bold truncate text-white/50">{s.label}</div>
              <div className="text-xs sm:text-sm font-extrabold text-white mt-0.5 truncate">{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Conteneur des notes */}
      {subjectRows.length === 0 ? (
        <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>{t('grades.empty')}</div>
        </div>
      ) : (
        <>
          {/* Vue Mobile (md:hidden) : Cartes de notes tactiles */}
          <div className="md:hidden space-y-2.5">
            {subjectRows.map((sub) => {
              const subMention = getMention(sub.note)
              const [smBg, smC] = MENTION_COLOR(subMention)
              const pct = Math.min(100, Math.max(0, (sub.note / 20) * 100))
              return (
                <div
                  key={sub.subjectId}
                  className="rounded-xl border p-3 shadow-xs space-y-2"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold truncate" style={{ color: 'var(--text)' }}>
                        {sub.name}
                      </div>
                      <div className="mt-1">
                        <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 6px', borderRadius: 10, fontSize: 10.5, fontWeight: 800 }}>
                          Coef ×{sub.coeff}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black leading-none" style={{ color: NOTE_COLOR(sub.note) }}>
                        {sub.note.toFixed(1)}
                        <span className="text-[10px] font-bold text-[var(--text3)] ml-0.5">/20</span>
                      </div>
                      <div className="mt-1">
                        <span style={{ padding: '2px 7px', borderRadius: 12, fontSize: 10.5, fontWeight: 800, background: smBg, color: smC }}>
                          {subMention}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Jauge visuelle de progression */}
                  <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg2)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, background: NOTE_COLOR(sub.note) }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Vue Desktop (hidden md:block) : Tableau complet */}
          <div className="hidden md:block rounded-xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr>{[
                    t('grades.table_header_subject'),
                    t('grades.table_header_coeff'),
                    t('grades.table_header_grade'),
                    t('grades.table_header_mention'),
                  ].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {subjectRows.map((sub) => {
                    const subMention = getMention(sub.note)
                    const [smBg, smC] = MENTION_COLOR(subMention)
                    return (
                      <tr key={sub.subjectId}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{sub.name}</td>
                        <td style={tdSt}>
                          <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2.5px 7px', borderRadius: 14, fontSize: 11, fontWeight: 800 }}>×{sub.coeff}</span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ fontSize: 15, fontWeight: 900, color: NOTE_COLOR(sub.note) }}>{sub.note.toFixed(1)}</span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11, fontWeight: 700, background: smBg, color: smC }}>{subMention}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8.5px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
