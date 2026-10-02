'use client'

import { useCallback, useState, useMemo } from 'react'
import { Package, CheckCircle2, User, Clock, AlertTriangle, ShieldCheck, Filter, Calendar } from 'lucide-react'
import type { ChildWithStats } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

interface AttendanceRecord {
  id: string
  date: string
  period: string
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'ABSENT_JUSTIFIED'
  justification?: string | null
  studentId: string
  student?: { id: string; name: string } | null
  markedBy?: { name: string; role: string } | null
}

interface AttendanceApiResult {
  records: AttendanceRecord[]
  pagination: { total: number; page: number; pages: number; limit: number }
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
        borderRadius: 6,
        padding: '3px 8px',
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--amber)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        marginBottom: 12,
      }}
    >
      <Package size={13} strokeWidth={2} /> {t('cacheBadge', { date })}
    </div>
  )
}

export default function SectionParentAttendance({ onToast, userId }: Props) {
  const t = useT('parent')
  const [selectedChildIndex, setSelectedChildIndex] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ABSENT' | 'LATE' | 'JUSTIFIED'>('ALL')

  // 1. Fetch enfants avec stats
  const cacheKeyChildren = userId ? `parent:attendance:children:${userId}` : ''
  const fetchChildrenFn = useCallback(async () => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then((r) => r.json())
    if (!res.success) throw new Error(t('errorLoad'))
    return res.data as ChildWithStats[]
  }, [userId, t])

  const { data: children, loading: loadingChildren, error: errorChildren, fromCache: fromCacheKids, cachedAt: cachedAtKids, refetch: refetchKids } =
    useCachedFetch<ChildWithStats[]>(cacheKeyChildren, fetchChildrenFn)

  const childrenList = children ?? []
  const selectedChild = childrenList[selectedChildIndex] ?? null
  const studentId = selectedChild?.studentId

  // 2. Fetch journal détaillé d'assiduité pour l'enfant sélectionné
  const cacheKeyJournal = studentId ? `parent:attendance:journal:${studentId}` : ''
  const fetchJournalFn = useCallback(async (): Promise<AttendanceRecord[]> => {
    if (!studentId) return []
    const res = await fetchApi(`/api/v2/attendance?studentId=${studentId}&limit=50`, { credentials: 'include' })
    const json: AttendanceApiResult = await res.json()
    return json.records ?? []
  }, [studentId])

  const { data: journalData, loading: loadingJournal } = useCachedFetch<AttendanceRecord[]>(
    cacheKeyJournal,
    fetchJournalFn
  )

  const rawRecords = journalData ?? []

  // Filtrer les enregistrements par statut
  const filteredRecords = useMemo(() => {
    return rawRecords.filter((rec) => {
      if (statusFilter === 'ALL') return true
      if (statusFilter === 'ABSENT') return rec.status === 'ABSENT'
      if (statusFilter === 'LATE') return rec.status === 'LATE'
      if (statusFilter === 'JUSTIFIED') return rec.status === 'ABSENT_JUSTIFIED'
      return true
    })
  }, [rawRecords, statusFilter])

  if (loadingChildren) {
    return (
      <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('loading')}</div>
      </div>
    )
  }

  if (errorChildren === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (errorChildren) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{errorChildren}</div>
          <button
            onClick={refetchKids}
            style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!childrenList.length) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {t('attendance.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('attendance.subtitle')}</div>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 32, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <CheckCircle2 size={36} strokeWidth={2} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('attendance.emptyTitle')}</div>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: AttendanceRecord['status']) => {
    switch (status) {
      case 'PRESENT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-green-500/10 text-green-600">
            <CheckCircle2 size={11} strokeWidth={2.5} />
            {t('attendanceJournal.statusPresent')}
          </span>
        )
      case 'LATE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-amber-500/10 text-amber-600">
            <Clock size={11} strokeWidth={2.5} />
            {t('attendanceJournal.statusLate')}
          </span>
        )
      case 'ABSENT_JUSTIFIED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-blue-500/10 text-blue-600">
            <ShieldCheck size={11} strokeWidth={2.5} />
            {t('attendanceJournal.statusJustified')}
          </span>
        )
      case 'ABSENT':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 bg-red-500/10 text-red-600">
            <AlertTriangle size={11} strokeWidth={2.5} />
            {t('attendanceJournal.statusAbsent')}
          </span>
        )
    }
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {t('attendance.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t('attendance.subtitleExtended')}</div>
        </div>

        {/* Sélecteur d'enfant */}
        {childrenList.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {childrenList.map((child, idx) => {
              const isSelected = idx === selectedChildIndex
              return (
                <button
                  key={child.studentId}
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`flex-1 sm:flex-none h-9 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer shadow-xs whitespace-nowrap ${
                    isSelected ? 'text-white border-transparent' : 'text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg2)]'
                  }`}
                  style={{
                    background: isSelected ? 'var(--sidebar)' : 'var(--surface)',
                  }}
                >
                  <User size={12} className="inline mr-1" />
                  {child.prenom} {child.nom}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {fromCacheKids && <CacheBadge cachedAt={cachedAtKids} />}

      {/* Cartes statistiques globales de l'enfant sélectionné */}
      {selectedChild && (
        <div
          className="rounded-2xl border p-4 sm:p-5 shadow-xs space-y-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg,var(--primary),var(--blue))' }}
              >
                {selectedChild.prenom[0]}{selectedChild.nom[0]}
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-bold text-[var(--text)] truncate">
                  {selectedChild.prenom} {selectedChild.nom}
                </div>
                <div className="text-xs text-[var(--text3)] font-semibold mt-0.5">
                  {selectedChild.classeNom || 'Classe non assignée'}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-[var(--text3)] font-semibold">{t('attendance.absentDays')}</div>
              <div
                className="text-base sm:text-lg font-black"
                style={{ color: selectedChild.joursAbsent > 0 ? 'var(--red)' : 'var(--green)' }}
              >
                {selectedChild.joursAbsent} jour(s)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-[var(--text2)]">{t('attendance.rate')}</span>
                <span style={{ color: selectedChild.tauxPresence >= 90 ? 'var(--green)' : 'var(--amber)' }}>
                  {selectedChild.tauxPresence}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${selectedChild.tauxPresence}%`,
                    background: selectedChild.tauxPresence >= 90 ? 'var(--green)' : 'var(--amber)',
                  }}
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-[var(--text2)]">{t('attendance.punctuality')}</span>
                <span style={{ color: selectedChild.tauxPonctualite >= 90 ? 'var(--green)' : 'var(--amber)' }}>
                  {selectedChild.tauxPonctualite}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${selectedChild.tauxPonctualite}%`,
                    background: selectedChild.tauxPonctualite >= 90 ? 'var(--green)' : 'var(--amber)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Journal chronologique d'assiduité */}
      <div
        className="rounded-2xl border overflow-hidden shadow-xs"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="p-3.5 sm:p-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-[var(--primary)]" />
            <div className="text-sm font-bold text-[var(--text)]">{t('attendanceJournal.title')}</div>
          </div>

          {/* Filtres de statut */}
          <div className="flex items-center gap-1 text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-none ${
                statusFilter === 'ALL'
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg)] text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {t('attendanceJournal.allStatus')}
            </button>
            <button
              onClick={() => setStatusFilter('ABSENT')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-none ${
                statusFilter === 'ABSENT'
                  ? 'bg-red-500 text-white'
                  : 'bg-[var(--bg)] text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {t('attendanceJournal.statusAbsent')}
            </button>
            <button
              onClick={() => setStatusFilter('LATE')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer border-none ${
                statusFilter === 'LATE'
                  ? 'bg-amber-500 text-white'
                  : 'bg-[var(--bg)] text-[var(--text2)] hover:text-[var(--text)]'
              }`}
            >
              {t('attendanceJournal.statusLate')}
            </button>
          </div>
        </div>

        {loadingJournal ? (
          <div className="p-8 text-center text-xs text-[var(--text3)] font-semibold">{t('loading')}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--text3)] font-semibold">
            {t('attendanceJournal.empty')}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredRecords.map((item) => {
              const recDate = new Date(item.date).toLocaleDateString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })

              return (
                <div key={item.id} className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text)] capitalize">{recDate}</span>
                      <span className="text-[11px] font-semibold text-[var(--text3)]">· {item.period || 'Créneau standard'}</span>
                    </div>

                    {item.justification && (
                      <div className="text-xs text-[var(--text2)] italic bg-[var(--bg)] p-2 rounded-lg border border-[var(--border)]/40">
                        Motif : {item.justification}
                      </div>
                    )}

                    {item.markedBy && (
                      <div className="text-[11px] text-[var(--text3)]">
                        {t('attendanceJournal.recordedByCol')} : {item.markedBy.name}
                      </div>
                    )}
                  </div>

                  <div className="self-start sm:self-center shrink-0">
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
