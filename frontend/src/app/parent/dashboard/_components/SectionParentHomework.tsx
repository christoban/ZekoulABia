'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { BookOpen, CheckCircle, Clock, Calendar, Check, AlertCircle, Package, User } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useT } from '@/lib/i18n'
import type { ChildWithStats } from '../_types'

interface Props {
  childrenList?: ChildWithStats[]
  userId?: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface CahierEntry {
  id: string
  dateSeance: string
  chapitre: string | null
  sousTitre: string | null
  contenu: string
  devoirsDonnes: string | null
  dateDevoir: string | null
  matiere?: { id: string; name: string } | null
  subject?: { id: string; name: string } | null
  enseignant?: { firstName: string; lastName: string } | null
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

export default function SectionParentHomework({ childrenList, userId, onToast }: Props) {
  const t = useT('parent')
  const [selectedChildIndex, setSelectedChildIndex] = useState(0)
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL')
  const [completedIds, setCompletedIds] = useState<string[]>([])

  const childrenCacheKey = userId ? `parent:children:${userId}` : 'parent:children:homework'
  const fetchChildrenFn = useCallback(async (): Promise<ChildWithStats[]> => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' })
    const d = await res.json()
    if (!d.success) return []
    return d.data || []
  }, [])
  const { data: cachedChildren } = useCachedFetch<ChildWithStats[]>(
    childrenList ? '' : childrenCacheKey,
    fetchChildrenFn
  )
  const effectiveChildren = childrenList ?? cachedChildren ?? []
  const currentChild = effectiveChildren[selectedChildIndex] ?? null
  const classId = currentChild?.classeId
  const studentId = currentChild?.studentId

  const cacheKey = currentChild && classId ? `parent:cahier:${studentId}:${classId}` : ''

  // Charger les devoirs marqués terminés à la maison
  useEffect(() => {
    if (!studentId) return
    try {
      const stored = localStorage.getItem(`parent:homework:done:${studentId}`)
      if (stored) setCompletedIds(JSON.parse(stored))
      else setCompletedIds([])
    } catch {
      setCompletedIds([])
    }
  }, [studentId])

  const toggleDone = (id: string) => {
    if (!studentId) return
    const next = completedIds.includes(id)
      ? completedIds.filter((x) => x !== id)
      : [...completedIds, id]
    setCompletedIds(next)
    try {
      localStorage.setItem(`parent:homework:done:${studentId}`, JSON.stringify(next))
      if (!completedIds.includes(id)) {
        onToast(t('homework.toastDone'), 'success')
      } else {
        onToast(t('homework.toastPending'), 'info')
      }
    } catch {
      // Ignorer erreur de stockage local
    }
  }

  const fetchFn = useCallback(async (): Promise<CahierEntry[]> => {
    if (!classId) return []
    const res = await fetchApi(`/api/v2/pedagogie/cahier-de-texte?classId=${classId}&limit=100`, {
      credentials: 'include',
    })
    const json = await res.json()
    if (json.success && Array.isArray(json.data)) {
      return json.data
    }
    return []
  }, [classId])

  const { data: entries, loading, error, fromCache, cachedAt } = useCachedFetch<CahierEntry[]>(
    cacheKey,
    fetchFn
  )

  const rawEntries = entries ?? []

  // Matières uniques pour le filtre
  const subjects = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of rawEntries) {
      const s = e.matiere || e.subject
      if (s?.id && s?.name) map.set(s.id, s.name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [rawEntries])

  // Filtrer les entrées qui ont des devoirs donnés
  const homeworkEntries = useMemo(() => {
    return rawEntries.filter((e) => Boolean(e.devoirsDonnes && e.devoirsDonnes.trim() !== ''))
  }, [rawEntries])

  // Filtrer par matière et statut (à faire / tous)
  const filteredEntries = useMemo(() => {
    return homeworkEntries.filter((e) => {
      const s = e.matiere || e.subject
      const subjectMatch = selectedSubject === 'ALL' || s?.id === selectedSubject
      if (!subjectMatch) return false

      const isCompleted = completedIds.includes(e.id)
      if (tab === 'pending') {
        return !isCompleted
      }
      return true
    })
  }, [homeworkEntries, selectedSubject, tab, completedIds])

  const getDueBadge = (dateDevoir: string | null) => {
    if (!dateDevoir) return null
    const due = new Date(dateDevoir)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)

    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
          style={{ background: 'var(--red-light)', color: 'var(--red)' }}
        >
          <AlertCircle size={11} strokeWidth={2.5} />
          {t('homework.overdue')}
        </span>
      )
    }
    if (diffDays === 0) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
          style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}
        >
          <Clock size={11} strokeWidth={2.5} />
          {t('homework.dueToday')}
        </span>
      )
    }
    if (diffDays === 1) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold"
          style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}
        >
          <Calendar size={11} strokeWidth={2.5} />
          {t('homework.dueTomorrow')}
        </span>
      )
    }
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-[var(--text2)]"
        style={{ background: 'var(--bg2)' }}
      >
        <Calendar size={11} strokeWidth={2} />
        {t('homework.dueDate', { date: due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) })}
      </span>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            {t('homework.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
            {t('homework.subtitle')}
          </div>
        </div>

        {/* Sélecteur d'enfant */}
        {effectiveChildren.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {effectiveChildren.map((child, idx) => {
              const isSelected = idx === selectedChildIndex
              return (
                <button
                  key={child.studentId}
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`flex-1 sm:flex-none h-9 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer shadow-xs whitespace-nowrap ${
                    isSelected
                      ? 'text-white border-transparent'
                      : 'text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg2)]'
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

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      {/* Barre d'état de l'élève sélectionné */}
      {currentChild && (
        <div
          className="p-3 sm:p-4 rounded-xl border flex flex-wrap items-center justify-between gap-2 shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))' }}
            >
              {currentChild.prenom[0]}{currentChild.nom[0]}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--text)] truncate">
                {currentChild.prenom} {currentChild.nom}
              </div>
              <div className="text-xs text-[var(--text3)] font-semibold mt-0.5">
                {currentChild.classeNom || 'Classe non assignée'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="px-3 py-1 rounded-lg text-xs font-bold text-[var(--primary)]"
              style={{ background: 'var(--bg2)' }}
            >
              {homeworkEntries.length - completedIds.length} {t('homework.tabPending').toLowerCase()}
            </div>
          </div>
        </div>
      )}

      {/* Filtres & Onglets */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)] w-fit">
          <button
            onClick={() => setTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none ${
              tab === 'pending'
                ? 'bg-[var(--primary)] text-white shadow-2xs'
                : 'bg-transparent text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            {t('homework.tabPending')} ({homeworkEntries.length - completedIds.length})
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border-none ${
              tab === 'all'
                ? 'bg-[var(--primary)] text-white shadow-2xs'
                : 'bg-transparent text-[var(--text2)] hover:text-[var(--text)]'
            }`}
          >
            {t('homework.tabAll')} ({homeworkEntries.length})
          </button>
        </div>

        {subjects.length > 0 && (
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="h-9 px-3 rounded-xl text-xs font-bold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            <option value="ALL">{t('homework.allSubjects')}</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Liste des devoirs */}
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-[var(--text3)]">
          {t('loading')}
        </div>
      ) : !classId ? (
        <div
          className="p-8 rounded-2xl border text-center space-y-2 shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <AlertCircle size={32} className="mx-auto text-[var(--amber)]" />
          <div className="text-sm font-bold text-[var(--text)]">Classe non assignée</div>
          <div className="text-xs text-[var(--text3)]">
            Cet élève n&apos;est pas encore rattaché à une classe avec un cahier de textes actif.
          </div>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div
          className="p-8 rounded-2xl border text-center space-y-2 shadow-xs"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <CheckCircle size={36} className="mx-auto text-[var(--green)]" />
          <div className="text-sm font-bold text-[var(--text)]">
            {tab === 'pending' ? t('homework.emptyPending') : t('homework.emptyAll')}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((item) => {
            const isCompleted = completedIds.includes(item.id)
            const subjectName = item.matiere?.name || item.subject?.name || 'Matière'
            const teacherName = item.enseignant ? `${item.enseignant.firstName} ${item.enseignant.lastName}` : null

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all shadow-xs ${
                  isCompleted ? 'opacity-70 bg-[var(--surface)]' : 'bg-[var(--surface)]'
                }`}
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] uppercase tracking-wider">
                        {subjectName}
                      </span>
                      {getDueBadge(item.dateDevoir)}
                    </div>

                    {item.chapitre && (
                      <div className="text-xs font-bold text-[var(--text)] mt-1.5">
                        {t('homework.chapter')} {item.chapitre}
                        {item.sousTitre && ` — ${item.sousTitre}`}
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-[var(--bg2)] text-xs text-[var(--text)] font-medium leading-relaxed whitespace-pre-line mt-2 border border-[var(--border)]/40">
                      {item.devoirsDonnes}
                    </div>

                    {teacherName && (
                      <div className="text-[11px] text-[var(--text3)] font-semibold pt-1">
                        {t('homework.teacher')} {teacherName}
                      </div>
                    )}
                  </div>

                  {/* Bouton cocher fait/à faire */}
                  <button
                    onClick={() => toggleDone(item.id)}
                    title={isCompleted ? t('homework.markPending') : t('homework.markDone')}
                    className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                      isCompleted
                        ? 'bg-[var(--green)] border-[var(--green)] text-white'
                        : 'border-[var(--border)] hover:border-[var(--primary)] text-transparent hover:text-[var(--primary)]'
                    }`}
                  >
                    <Check size={16} strokeWidth={3} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
