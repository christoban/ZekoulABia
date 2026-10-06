'use client'

import { useCallback, useState, useEffect } from 'react'
import { ScrollText, Loader2, Download, WifiOff, Package, User, Award, BookOpen, Eye, Printer } from 'lucide-react'
import type { ChildWithStats, ReportCard } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'
import BulletinModalLight, { type BulletinData } from '@/components/bulletin/BulletinModalLight'
import { getUserSession, getCachedData, putCachedData } from '@/lib/offline/db'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

interface GradesData {
  children: ChildWithStats[]
  bulletins: ReportCard[]
}

interface SequenceItem {
  id: string
  name: string
  isCurrent: boolean
}

interface ContinuousGradeItem {
  id: string
  value: number | null
  coefficient: number
  appreciation?: string | null
  subject?: { name: string } | null
}

const MENTION_COLOR = (m: string | null): [string, string] => {
  const map: Record<string, [string, string]> = {
    TB: ['var(--green-light)', 'var(--green)'],
    B: ['var(--blue-light)', 'var(--blue)'],
    AB: ['var(--amber-light)', 'var(--amber)'],
    P: ['var(--orange-light)', 'var(--orange)'],
    I: ['var(--red-light)', 'var(--red)'],
  }
  return map[m ?? ''] ?? ['var(--bg2)', 'var(--text2)']
}

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  const t = useT('common')
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div
      style={{
        background: 'var(--amber-light)',
        border: '1px solid var(--amber)',
        borderRadius: 8,
        padding: '4px 10px',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--amber)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
      }}
    >
      <Package size={13} strokeWidth={2} />
      <span>{t('cacheBadge', { date })}</span>
    </div>
  )
}

export default function SectionParentGrades({ onToast, userId }: Props) {
  const t = useT('parent')
  const isOnline = useOnlineStatus()
  const [selectedChildIndex, setSelectedChildIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'continuous' | 'bulletins'>('continuous')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [selectedBulletin, setSelectedBulletin] = useState<BulletinData | null>(null)
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)

  useEffect(() => {
    if (userId) {
      getUserSession(userId).then(s => {
        if (s?.schoolInfo) setSchoolInfo(s.schoolInfo)
      }).catch(() => {})
    }
  }, [userId])

  // Séquences
  const [sequences, setSequences] = useState<SequenceItem[]>([])
  const [selectedSequenceId, setSelectedSequenceId] = useState<string>('')

  // 1. Fetch enfants et bulletins
  const cacheKey = userId ? `parent:grades:${userId}` : ''
  const fetchFn = useCallback(async (): Promise<GradesData> => {
    const childrenRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then((r) => r.json())
    if (!childrenRes.success) throw new Error(t('errorLoad'))
    const rcRes = await fetchApi('/api/v2/report-cards', { credentials: 'include' }).then((r) => r.json())
    return { children: childrenRes.data ?? [], bulletins: rcRes.reportCards ?? [] }
  }, [userId, t])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<GradesData>(cacheKey, fetchFn)

  const children = data?.children ?? []
  const bulletins = data?.bulletins ?? []
  const selectedChild = children[selectedChildIndex] ?? null
  const selectedStudentId = selectedChild?.studentId
  const selectedName = selectedChild ? `${selectedChild.prenom} ${selectedChild.nom}` : ''
  const filteredBulletins = bulletins.filter((b) => b.student?.id === selectedStudentId)

  // 2. Charger les séquences académiques (avec repli Dexie hors-connexion)
  useEffect(() => {
    let mounted = true

    const parseAcademicYears = (years: any[]) => {
      if (!years?.length) return
      const curYear = years.find((y: any) => y.isCurrent) ?? years[0]
      if (!curYear?.periods) return

      const allSeqs: SequenceItem[] = []
      for (const period of curYear.periods) {
        for (const s of period.sequences ?? []) {
          allSeqs.push({ id: s.id, name: s.name, isCurrent: Boolean(s.isCurrent) })
        }
      }
      setSequences(allSeqs)
      if (allSeqs.length > 0) {
        setSelectedSequenceId(prev => {
          if (prev && allSeqs.some(s => s.id === prev)) return prev
          const active = allSeqs.find((s) => s.isCurrent) ?? allSeqs[allSeqs.length - 1]
          return active?.id || ''
        })
      }
    }

    if (navigator.onLine) {
      fetchApi('/api/v2/academic-years', { credentials: 'include' })
        .then((r) => r.json())
        .then(async (ayRes) => {
          if (!mounted || !ayRes.success || !ayRes.data?.length) return
          await putCachedData('parent:academic-years', ayRes.data)
          parseAcademicYears(ayRes.data)
        })
        .catch(async () => {
          const cached = await getCachedData<any[]>('parent:academic-years')
          if (mounted && cached?.data) parseAcademicYears(cached.data)
        })
    } else {
      getCachedData<any[]>('parent:academic-years')
        .then(cached => {
          if (mounted && cached?.data) parseAcademicYears(cached.data)
        })
        .catch(() => {})
    }

    return () => {
      mounted = false
    }
  }, [])

  // 3. Charger les notes séquentielles de l'enfant
  const cacheKeySeqGrades =
    selectedStudentId && selectedSequenceId ? `parent:grades:seq:${selectedStudentId}:${selectedSequenceId}` : ''

  const fetchSeqGradesFn = useCallback(async (): Promise<{ grades: ContinuousGradeItem[]; avg: number | null }> => {
    if (!selectedStudentId || !selectedSequenceId) return { grades: [], avg: null }
    const classId = selectedChild?.classeId
    const [gradesRes, avgRes] = await Promise.all([
      fetchApi(`/api/v2/grades?studentId=${selectedStudentId}&sequenceId=${selectedSequenceId}`, {
        credentials: 'include',
      }).then((r) => r.json()).catch(() => ({})),
      classId
        ? fetchApi(`/api/v2/grades/average/${selectedStudentId}?classId=${classId}&sequenceId=${selectedSequenceId}`, {
            credentials: 'include',
          }).then((r) => r.json()).catch(() => null)
        : Promise.resolve(null),
    ])
    return {
      grades: gradesRes.items ?? gradesRes.grades ?? [],
      avg: avgRes?.average ?? null,
    }
  }, [selectedStudentId, selectedSequenceId, selectedChild?.classeId])

  const { data: seqData, loading: seqLoading } = useCachedFetch<{ grades: ContinuousGradeItem[]; avg: number | null }>(
    cacheKeySeqGrades,
    fetchSeqGradesFn
  )

  const continuousGrades = seqData?.grades ?? []
  const continuousAverage = seqData?.avg ?? null

  const downloadPdf = async (id: string, label: string) => {
    if (!isOnline) {
      onToast(t('grades.downloadUnavailable'), 'warning')
      return
    }
    setDownloading(id)
    try {
      const res = await fetchApi(`/api/v2/report-cards/${id}/pdf`, { credentials: 'include' })
      if (!res.ok) {
        onToast(t('grades.downloadError'), 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${t('grades.downloaded').replace(/\s/g, '_')}_${label.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onToast(t('grades.downloaded'), 'success')
    } catch {
      onToast(t('grades.downloadError'), 'error')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5 flex items-center justify-center h-full">
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5 h-full overflow-y-auto">
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button
            onClick={refetch}
            style={{
              padding: '6px 13px',
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              background: 'var(--surface)',
              color: 'var(--text2)',
              border: '1.5px solid var(--border2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4 h-full overflow-y-auto">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {t('grades.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
            {t('grades.subtitle')}
          </div>
        </div>

        {/* Sélecteur d'enfant */}
        {children.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {children.map((c, i) => {
              const isSelected = selectedChildIndex === i
              return (
                <button
                  key={c.studentId}
                  type="button"
                  onClick={() => setSelectedChildIndex(i)}
                  className={`flex-1 sm:flex-none min-w-[100px] h-9 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer shadow-xs whitespace-nowrap ${
                    isSelected ? 'text-white border-transparent' : 'text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg2)]'
                  }`}
                  style={{
                    background: isSelected ? 'var(--sidebar)' : 'var(--surface)',
                  }}
                >
                  <User size={12} className="inline mr-1" />
                  {c.prenom} {c.nom}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      {/* Onglets : Évaluations continues vs Bulletins officiels */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] w-fit">
        <button
          onClick={() => setActiveTab('continuous')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none flex items-center gap-1.5 ${
            activeTab === 'continuous'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <BookOpen size={13} />
          <span>{t('continuousGrades.title')}</span>
        </button>
        <button
          onClick={() => setActiveTab('bulletins')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none flex items-center gap-1.5 ${
            activeTab === 'bulletins'
              ? 'bg-[var(--primary)] text-white shadow-2xs'
              : 'bg-transparent text-[var(--text2)] hover:text-[var(--text)]'
          }`}
        >
          <ScrollText size={13} />
          <span>Bulletins officiels ({filteredBulletins.length})</span>
        </button>
      </div>

      {/* VUE 1 : ÉVALUATIONS CONTINUES & SÉQUENCES */}
      {activeTab === 'continuous' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Barre de sélection de séquence & Moyenne */}
          <div
            className="p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text2)]">{t('continuousGrades.sequenceFilter')} :</span>
              {sequences.length > 0 ? (
                <select
                  value={selectedSequenceId}
                  onChange={(e) => setSelectedSequenceId(e.target.value)}
                  className="h-8 px-2.5 rounded-lg text-xs font-bold border cursor-pointer focus:outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  {sequences.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isCurrent ? '· En cours' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-[var(--text3)]">Chargement des séquences…</span>
              )}
            </div>

            {continuousAverage !== null && (
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="text-xs font-bold text-[var(--text3)]">{t('continuousGrades.average')} :</span>
                <span
                  className="text-base sm:text-lg font-black"
                  style={{
                    color:
                      continuousAverage >= 14
                        ? 'var(--green)'
                        : continuousAverage >= 10
                        ? 'var(--blue)'
                        : 'var(--red)',
                  }}
                >
                  {continuousAverage.toFixed(2)}/20
                </span>
              </div>
            )}
          </div>

          {/* Tableau / Cartes des notes séquentielles */}
          {seqLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text3)] font-semibold">{t('loading')}</div>
          ) : continuousGrades.length === 0 ? (
            <div
              className="p-8 rounded-2xl border text-center space-y-2 shadow-xs"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <Award size={36} className="mx-auto text-[var(--text3)]" />
              <div className="text-sm font-bold text-[var(--text)]">{t('continuousGrades.empty')}</div>
            </div>
          ) : (
            <div
              className="rounded-2xl border overflow-hidden shadow-xs"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={thSt}>{t('continuousGrades.subject')}</th>
                      <th style={thSt}>{t('continuousGrades.coef')}</th>
                      <th style={thSt}>{t('continuousGrades.note')}</th>
                      <th style={thSt}>{t('continuousGrades.appreciation')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {continuousGrades.map((g) => {
                      const noteVal = g.value
                      const color =
                        noteVal !== null
                          ? noteVal >= 14
                            ? 'var(--green)'
                            : noteVal >= 10
                            ? 'var(--blue)'
                            : 'var(--red)'
                          : 'var(--text3)'

                      return (
                        <tr
                          key={g.id}
                          className="hover:bg-[var(--bg2)] transition-colors"
                          style={{ borderBottom: '1px solid var(--border)' }}
                        >
                          <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                            {g.subject?.name || 'Matière'}
                          </td>
                          <td style={tdSt}>×{g.coefficient}</td>
                          <td style={{ ...tdSt, fontWeight: 900, fontSize: 14, color }}>
                            {noteVal !== null ? `${noteVal.toFixed(1)}/20` : '—'}
                          </td>
                          <td style={{ ...tdSt, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>
                            {g.appreciation || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VUE 2 : BULLETINS OFFICIELS EN PDF */}
      {activeTab === 'bulletins' && (
        <>
          {filteredBulletins.length === 0 ? (
            <div
              className="rounded-xl border p-8 text-center"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <ScrollText size={36} strokeWidth={2} className="mx-auto mb-3 text-[var(--text3)]" />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                {t('grades.emptyTitle')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                {selectedName ? t('grades.emptyForChild').replace('{name}', selectedName) : t('grades.emptyDesc')}
              </div>
            </div>
          ) : (
            <>
              {/* Vue Mobile : Cartes tactiles */}
              <div className="md:hidden space-y-3">
                {filteredBulletins.map((b) => {
                  const [mBg, mC] = MENTION_COLOR(b.mention)
                  const avg = b.generalAverage
                  const avgColor =
                    avg !== null
                      ? avg >= 14
                        ? 'var(--green)'
                        : avg >= 10
                        ? 'var(--blue)'
                        : 'var(--red)'
                      : 'var(--text3)'

                  return (
                    <div
                      key={b.id}
                      className="rounded-xl border p-3.5 shadow-xs space-y-3"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-start justify-between gap-2 border-b pb-2.5" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div
                            className="text-xs font-extrabold"
                            style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}
                          >
                            {b.academicPeriod?.name || 'Période'}
                          </div>
                          {b.rank !== null && (
                            <div className="text-[11px] font-semibold text-[var(--text3)] mt-0.5">
                              Rang : {b.rank}e {b.totalStudents ? `/ ${b.totalStudents}` : ''}
                            </div>
                          )}
                        </div>
                        {b.mention && (
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, background: mBg, color: mC }}>
                            {b.mention}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10.5px] font-bold text-[var(--text3)]">{t('grades.average')}</div>
                          <div className="text-xl font-black leading-none mt-1" style={{ color: avgColor }}>
                            {avg !== null ? `${avg.toFixed(1)}/20` : '—'}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="h-10 px-3 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs border transition-transform active:scale-[0.98]"
                            style={{
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              borderColor: 'var(--border2)',
                            }}
                            onClick={() => {
                              const child = children[selectedChildIndex]
                              const studentName = child ? `${child.prenom} ${child.nom}`.trim() : 'Élève'
                              setSelectedBulletin({
                                ...b,
                                studentName,
                                schoolName: schoolInfo?.name,
                                schoolLogoUrl: schoolInfo?.logoUrl,
                              })
                            }}
                          >
                            <Eye size={13} strokeWidth={2} /> Consulter
                          </button>

                          <button
                            title={!isOnline ? t('grades.downloadUnavailable') : undefined}
                            className="h-10 px-3 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs border transition-transform active:scale-[0.98]"
                            style={{
                              background: isOnline ? 'var(--surface)' : 'var(--bg2)',
                              color: isOnline ? 'var(--green)' : 'var(--text3)',
                              borderColor: isOnline ? 'var(--green)' : 'var(--border2)',
                              opacity: downloading === b.id ? 0.6 : 1,
                            }}
                            onClick={() => downloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                            disabled={downloading === b.id || !isOnline}
                          >
                            {downloading === b.id ? (
                              <>
                                <Loader2 size={13} strokeWidth={2} className="animate-spin" /> {t('grades.downloading')}
                              </>
                            ) : isOnline ? (
                              <>
                                <Download size={13} strokeWidth={2} /> {t('grades.downloadPdf')}
                              </>
                            ) : (
                              <WifiOff size={13} strokeWidth={2} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Vue Desktop : Tableau complet */}
              <div
                className="hidden md:block rounded-xl border overflow-hidden shadow-xs"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                    <thead>
                      <tr>
                        {[t('grades.period'), t('grades.average'), t('grades.rank'), t('grades.mention'), t('grades.actions')].map((h) => (
                          <th key={h} style={thSt}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBulletins.map((b) => {
                        const [mBg, mC] = MENTION_COLOR(b.mention)
                        const avg = b.generalAverage
                        return (
                          <tr
                            key={b.id}
                            className="hover:bg-[var(--bg2)] transition-colors"
                            style={{ borderBottom: '1px solid var(--border)' }}
                          >
                            <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{b.academicPeriod?.name || 'Période'}</td>
                            <td
                              style={{
                                ...tdSt,
                                fontWeight: 900,
                                fontSize: 14.5,
                                color: avg !== null ? (avg >= 14 ? 'var(--green)' : avg >= 10 ? 'var(--blue)' : 'var(--red)') : 'var(--text3)',
                              }}
                            >
                              {avg !== null ? `${avg}/20` : '—'}
                            </td>
                            <td style={tdSt}>
                              {b.rank !== null ? `${b.rank}e` : '—'} {b.totalStudents ? `/ ${b.totalStudents}` : ''}
                            </td>
                            <td style={tdSt}>
                              {b.mention && (
                                <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11, fontWeight: 700, background: mBg, color: mC }}>
                                  {b.mention}
                                </span>
                              )}
                            </td>
                            <td style={tdSt}>
                              <div style={{ display: 'inline-flex', gap: 6 }}>
                                <button
                                  type="button"
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 7,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: 'var(--surface)',
                                    color: 'var(--text)',
                                    border: '1.5px solid var(--border2)',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                  onClick={() => {
                                    const child = children[selectedChildIndex]
                                    const studentName = child ? `${child.prenom} ${child.nom}`.trim() : 'Élève'
                                    setSelectedBulletin({
                                      ...b,
                                      studentName,
                                      schoolName: schoolInfo?.name,
                                      schoolLogoUrl: schoolInfo?.logoUrl,
                                    })
                                  }}
                                >
                                  <Eye size={13} strokeWidth={2} /> Consulter
                                </button>
                                <button
                                  title={!isOnline ? t('grades.downloadUnavailable') : undefined}
                                  style={{
                                    padding: '5px 10px',
                                    borderRadius: 7,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: isOnline ? 'var(--surface)' : 'var(--bg2)',
                                    color: isOnline ? 'var(--green)' : 'var(--text3)',
                                    border: `1.5px solid ${isOnline ? 'var(--green)' : 'var(--border2)'}`,
                                    cursor: isOnline ? 'pointer' : 'not-allowed',
                                    fontFamily: 'inherit',
                                    opacity: downloading === b.id ? 0.6 : 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                  onClick={() => downloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                                  disabled={downloading === b.id || !isOnline}
                                >
                                  {downloading === b.id ? (
                                    <>
                                      <Loader2 size={13} strokeWidth={2} className="animate-spin" /> {t('grades.downloading')}
                                    </>
                                  ) : isOnline ? (
                                    <>
                                      <Download size={13} strokeWidth={2} /> {t('grades.downloadPdf')}
                                    </>
                                  ) : (
                                    <WifiOff size={13} strokeWidth={2} />
                                  )}
                                </button>
                              </div>
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
        </>
      )}

      <BulletinModalLight bulletin={selectedBulletin} onClose={() => setSelectedBulletin(null)} />
    </div>
  )
}

const thSt: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--text3)',
  background: 'var(--bg2)',
  borderBottom: '1px solid var(--border)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
}

const tdSt: React.CSSProperties = {
  padding: '8.5px 12px',
  fontSize: 12.5,
  color: 'var(--text2)',
  verticalAlign: 'middle',
}
