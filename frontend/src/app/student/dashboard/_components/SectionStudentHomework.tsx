'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { BookOpen, CheckCircle, Clock, Calendar, Check, AlertCircle, Package } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useT } from '@/lib/i18n'
import type { UserInfo } from '../_types'

interface Props {
  user: UserInfo | null
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

export default function SectionStudentHomework({ user, onToast }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL')
  const [completedIds, setCompletedIds] = useState<string[]>([])

  const classId = user?.studentProfile?.class?.id
  const cacheKey = user && classId ? `student:cahier:${user.id}:${classId}` : ''

  // Charger les devoirs marqués terminés par l'élève depuis le stockage local
  useEffect(() => {
    if (!user) return
    try {
      const stored = localStorage.getItem(`student:homework:done:${user.id}`)
      if (stored) setCompletedIds(JSON.parse(stored))
    } catch {
      // pas de blocage
    }
  }, [user])

  const toggleDone = (id: string) => {
    if (!user) return
    const next = completedIds.includes(id)
      ? completedIds.filter((x) => x !== id)
      : [...completedIds, id]
    setCompletedIds(next)
    try {
      localStorage.setItem(`student:homework:done:${user.id}`, JSON.stringify(next))
      if (!completedIds.includes(id)) {
        onToast(t('homework.toast_done') || 'Devoir marqué comme terminé !', 'success')
      }
    } catch {
      // ignorer
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

  const { data: entries, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<CahierEntry[]>(
    cacheKey,
    fetchFn
  )

  const rawEntries = entries ?? []

  // Extraire les matières uniques pour le filtre
  const subjects = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of rawEntries) {
      const s = e.matiere || e.subject
      if (s?.id && s?.name) map.set(s.id, s.name)
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [rawEntries])

  // Filtrer selon l'onglet actif et la matière
  const filteredEntries = useMemo(() => {
    return rawEntries.filter((e) => {
      const sId = (e.matiere || e.subject)?.id
      if (selectedSubject !== 'ALL' && sId !== selectedSubject) return false
      if (tab === 'pending') {
        return Boolean(e.devoirsDonnes && !completedIds.includes(e.id))
      }
      return true
    })
  }, [rawEntries, selectedSubject, tab, completedIds])

  const pendingCount = useMemo(() => {
    return rawEntries.filter((e) => Boolean(e.devoirsDonnes && !completedIds.includes(e.id))).length
  }, [rawEntries, completedIds])

  if (!user || (loading && !entries)) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black m-0" style={{ color: 'var(--text)' }}>
            {t('homework.title') || 'Cahier de Texte & Devoirs'}
          </h2>
          <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
            {user.studentProfile?.class?.name || 'Ma classe'} · {t('homework.subtitle') || 'Suivi des cours dispensés et devoirs à faire'}
          </p>
        </div>

        {/* Onglets Devoirs vs Cahier complet */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl border bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setTab('pending')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer inline-flex items-center gap-1.5"
            style={{
              background: tab === 'pending' ? 'var(--sidebar)' : 'transparent',
              color: tab === 'pending' ? '#ffffff' : 'var(--text2)',
            }}
          >
            <Clock size={13} strokeWidth={2} />
            <span>{t('homework.tab_pending') || 'Devoirs à faire'}</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('all')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-0 cursor-pointer inline-flex items-center gap-1.5"
            style={{
              background: tab === 'all' ? 'var(--sidebar)' : 'transparent',
              color: tab === 'all' ? '#ffffff' : 'var(--text2)',
            }}
          >
            <BookOpen size={13} strokeWidth={2} />
            <span>{t('homework.tab_all') || 'Tout le cahier'}</span>
          </button>
        </div>
      </div>

      {fromCache && cachedAt && (
        <div style={{ background: 'rgba(217,119,6,0.15)', border: '1px solid rgba(217,119,6,0.35)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Package size={13} strokeWidth={2} />
          <span>{tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}</span>
        </div>
      )}

      {/* Filtre matière */}
      {subjects.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedSubject('ALL')}
            className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
            style={{
              background: selectedSubject === 'ALL' ? 'var(--sidebar)' : 'var(--surface)',
              color: selectedSubject === 'ALL' ? '#ffffff' : 'var(--text2)',
              borderColor: selectedSubject === 'ALL' ? 'var(--sidebar)' : 'var(--border)',
            }}
          >
            {t('homework.all_subjects') || 'Toutes les matières'}
          </button>
          {subjects.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSelectedSubject(sub.id)}
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
              style={{
                background: selectedSubject === sub.id ? 'var(--sidebar)' : 'var(--surface)',
                color: selectedSubject === sub.id ? '#ffffff' : 'var(--text2)',
                borderColor: selectedSubject === sub.id ? 'var(--sidebar)' : 'var(--border)',
              }}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Liste des séances / devoirs */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border p-10 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: 'var(--bg)', color: 'var(--text3)' }}>
            <CheckCircle size={24} strokeWidth={1.8} />
          </div>
          <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
            {tab === 'pending'
              ? (t('homework.empty_pending') || 'Bravo ! Aucun devoir en attente pour le moment.')
              : (t('homework.empty_all') || 'Aucune séance renseignée dans le cahier de texte.')}
          </div>
          <div className="text-xs font-medium mt-1" style={{ color: 'var(--text3)' }}>
            {tab === 'pending' ? 'Tous vos travaux sont à jour.' : 'Le professeur n\'a pas encore publié d\'entrée pour cette sélection.'}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const hasHomework = Boolean(entry.devoirsDonnes)
            const isDone = completedIds.includes(entry.id)
            const subjectName = (entry.matiere || entry.subject)?.name || 'Matière'
            const teacherName = entry.enseignant ? `${entry.enseignant.firstName} ${entry.enseignant.lastName}` : null
            const formattedDate = new Date(entry.dateSeance).toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })
            const formattedDueDate = entry.dateDevoir
              ? new Date(entry.dateDevoir).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
              : null

            return (
              <div
                key={entry.id}
                className="rounded-xl border p-3.5 sm:p-4 transition-all relative overflow-hidden"
                style={{
                  background: 'var(--surface)',
                  borderColor: isDone ? 'var(--border)' : hasHomework ? 'var(--amber)' : 'var(--border)',
                  opacity: isDone ? 0.75 : 1,
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2.5 py-1 rounded-md text-xs font-extrabold"
                      style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}
                    >
                      {subjectName}
                    </span>
                    <span className="text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--text3)' }}>
                      <Calendar size={12} /> {formattedDate}
                    </span>
                    {teacherName && (
                      <span className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
                        · {teacherName}
                      </span>
                    )}
                  </div>

                  {hasHomework && (
                    <button
                      onClick={() => toggleDone(entry.id)}
                      className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer inline-flex items-center gap-1.5 self-start"
                      style={{
                        background: isDone ? 'var(--green-light)' : 'var(--surface)',
                        color: isDone ? 'var(--green)' : 'var(--text2)',
                        borderColor: isDone ? 'var(--green)' : 'var(--border)',
                      }}
                    >
                      {isDone ? <Check size={13} strokeWidth={2.5} /> : <div className="w-3 h-3 rounded border border-current" />}
                      <span>{isDone ? (t('homework.status_done') || 'Fait') : (t('homework.action_mark_done') || 'Marquer fait')}</span>
                    </button>
                  )}
                </div>

                {/* Titre & Chapitre du cours */}
                <div className="mb-2">
                  <div className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
                    {entry.chapitre || entry.sousTitre || 'Séance de cours'}
                  </div>
                  {entry.sousTitre && entry.chapitre && (
                    <div className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>
                      {entry.sousTitre}
                    </div>
                  )}
                </div>

                {/* Résumé du cours */}
                <div className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text2)' }}>
                  {entry.contenu}
                </div>

                {/* Bloc Devoirs */}
                {hasHomework && (
                  <div
                    className="p-3 rounded-lg border mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    style={{
                      background: isDone ? 'var(--bg)' : 'var(--amber-light)',
                      borderColor: isDone ? 'var(--border)' : 'rgba(217,119,6,0.3)',
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider mb-0.5" style={{ color: isDone ? 'var(--text3)' : 'var(--amber)' }}>
                        <AlertCircle size={13} strokeWidth={2.2} />
                        <span>{t('homework.assignment_label') || 'Travail à préparer'}</span>
                        {formattedDueDate && (
                          <span className="font-semibold capitalize text-xs">
                            — Pour le {formattedDueDate}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs font-semibold ${isDone ? 'line-through text-[var(--text3)]' : 'text-[var(--text)]'}`}>
                        {entry.devoirsDonnes}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
