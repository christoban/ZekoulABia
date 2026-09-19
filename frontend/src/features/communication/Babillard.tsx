'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Megaphone, Pin, CalendarClock, School, Users, GraduationCap, User, UserCircle2,
  Send, Trash2, Plus, Edit2, X, Search, AlertCircle, CheckCircle2, ArrowLeft, Check
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'

interface AnnouncementAuthor {
  id: string
  firstName: string
  lastName: string
  role: string
}

interface AnnouncementItem {
  id: string
  authorId?: string
  title: string
  content: string
  targetRoles: string[]
  isPinned: boolean
  expiresAt: string | null
  createdAt: string
  author?: AnnouncementAuthor | null
}

interface Props {
  role?: string
  currentUserId?: string
  title?: string
  subtitle?: string
}

const ROLE_OPTIONS = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'] as const

const ROLE_ICON: Record<string, ReactNode> = {
  ADMIN: <School size={12} />,
  STAFF: <Users size={12} />,
  TEACHER: <GraduationCap size={12} />,
  PARENT: <User size={12} />,
  STUDENT: <UserCircle2 size={12} />,
}

export default function Babillard({
  role = 'ADMIN',
  currentUserId,
  title = 'Babillard numérique',
  subtitle = 'Communiqués, résultats et annonces officielles de l’établissement',
}: Props) {
  const t = useT('common')
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Filtres
  const [filterTab, setFilterTab] = useState<'all' | 'pinned' | 'for_me'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Notifications
  const [notice, setNotice] = useState<string | null>(null)
  const [noticeVisible, setNoticeVisible] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const [errorVisible, setErrorVisible] = useState(false)

  // Formulaire d'édition / création
  const [publishTitle, setPublishTitle] = useState('')
  const [publishContent, setPublishContent] = useState('')
  const [publishRoles, setPublishRoles] = useState<string[]>([role])
  const [publishPinned, setPublishPinned] = useState(false)
  const [publishExpiryMode, setPublishExpiryMode] = useState<'none' | 'days'>('none')
  const [publishExpiryDays, setPublishExpiryDays] = useState('7')
  const [showExpiryPicker, setShowExpiryPicker] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canPublish = role === 'ADMIN' || role === 'STAFF'

  // Règle d'or : Seul l'Admin peut modifier/supprimer les annonces d'autrui.
  // Les membres du personnel (STAFF) ne peuvent modifier/supprimer QUE leurs propres annonces.
  // Les autres rôles (TEACHER, PARENT, STUDENT) ne peuvent ni publier, ni modifier, ni supprimer.
  const canManageItem = (item: AnnouncementItem) => {
    if (role === 'ADMIN') return true
    if (!canPublish || !currentUserId) return false
    const authorId = item.author?.id ?? item.authorId
    return Boolean(authorId && authorId === currentUserId)
  }

  useEffect(() => {
    let mounted = true
    fetchApi('/api/v2/announcements')
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return
        if (d.success) setAnnouncements(d.data ?? [])
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // Synchronisation avec l'Assistant IA pour masquer son FAB pendant que la modale est active
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('zekoulabia:modal-open', { detail: { open: isModalOpen } }))
    return () => {
      window.dispatchEvent(new CustomEvent('zekoulabia:modal-open', { detail: { open: false } }))
    }
  }, [isModalOpen])

  const toggleRole = (r: string) => {
    setPublishRoles((prev) =>
      prev.includes(r) ? prev.filter((item) => item !== r) : [...prev, r]
    )
  }

  const resetForm = () => {
    setEditingId(null)
    setPublishTitle('')
    setPublishContent('')
    setPublishRoles([role])
    setPublishPinned(false)
    setPublishExpiryMode('none')
    setPublishExpiryDays('7')
    setShowExpiryPicker(false)
  }

  const openCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const handleEdit = (item: AnnouncementItem) => {
    setEditingId(item.id)
    setPublishTitle(item.title)
    setPublishContent(item.content)
    setPublishRoles(item.targetRoles.length > 0 ? item.targetRoles : [role])
    setPublishPinned(item.isPinned)
    setShowExpiryPicker(false)
    if (item.expiresAt) {
      setPublishExpiryMode('days')
      const remainingDays = Math.max(
        1,
        Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      )
      setPublishExpiryDays(String(remainingDays))
    } else {
      setPublishExpiryMode('none')
      setPublishExpiryDays('7')
    }
    setIsModalOpen(true)
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    const titleTrimmed = publishTitle.trim()
    const contentTrimmed = publishContent.trim()
    if (!titleTrimmed || !contentTrimmed || publishRoles.length === 0) return

    setPublishing(true)
    setErrorNotice(null)
    try {
      const expiresAt =
        publishExpiryMode === 'days'
          ? new Date(Date.now() + Math.max(1, Number(publishExpiryDays || '1')) * 24 * 60 * 60 * 1000).toISOString()
          : null

      const response = await fetchApi(editingId ? `/api/v2/announcements/${editingId}` : '/api/v2/announcements', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleTrimmed,
          content: contentTrimmed,
          targetRoles: publishRoles,
          isPinned: publishPinned,
          expiresAt,
        }),
      })

      const payload = await response.json()
      if (payload.success) {
        setAnnouncements((current) => {
          const next = current.filter((item) => item.id !== payload.data.id)
          return [payload.data, ...next]
        })
        setNotice(
          editingId
            ? t('babillard.update_success') ?? 'Communiqué modifié avec succès.'
            : t('babillard.create_success') ?? 'Communiqué publié avec succès.'
        )
        setNoticeVisible(true)
        setIsModalOpen(false)
        resetForm()
      } else {
        setErrorNotice(payload.message ?? t('babillard.generic_error') ?? 'Une erreur est survenue.')
        setErrorVisible(true)
      }
    } catch {
      setErrorNotice(t('babillard.generic_error') ?? 'Une erreur est survenue.')
      setErrorVisible(true)
    } finally {
      setPublishing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (deletingId) return
    const confirmed = typeof window === 'undefined' ? true : window.confirm('Supprimer ce communiqué du babillard ?')
    if (!confirmed) return

    setDeletingId(id)
    setErrorNotice(null)
    try {
      const response = await fetchApi(`/api/v2/announcements/${id}`, {
        method: 'DELETE',
      })
      const payload = await response.json()
      if (payload.success) {
        setAnnouncements((current) => current.filter((item) => item.id !== id))
        setNotice('Communiqué retiré du babillard.')
        setNoticeVisible(true)
      } else {
        setErrorNotice(payload.message ?? t('babillard.generic_error') ?? 'Une erreur est survenue.')
        setErrorVisible(true)
      }
    } catch {
      setErrorNotice(t('babillard.generic_error') ?? 'Une erreur est survenue.')
      setErrorVisible(true)
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    if (!notice) return
    const hideTimer = window.setTimeout(() => setNoticeVisible(false), 3000)
    const clearTimer = window.setTimeout(() => setNotice(null), 3300)
    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(clearTimer)
    }
  }, [notice])

  useEffect(() => {
    if (!errorNotice) return
    const hideTimer = window.setTimeout(() => setErrorVisible(false), 4200)
    const clearTimer = window.setTimeout(() => setErrorNotice(null), 4500)
    return () => {
      window.clearTimeout(hideTimer)
      window.clearTimeout(clearTimer)
    }
  }, [errorNotice])

  // Filtrage des annonces
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      if (filterTab === 'pinned' && !item.isPinned) return false
      if (filterTab === 'for_me' && item.targetRoles.length > 0 && !item.targetRoles.includes(role)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = item.title.toLowerCase().includes(q)
        const matchContent = item.content.toLowerCase().includes(q)
        if (!matchTitle && !matchContent) return false
      }
      return true
    })
  }, [announcements, filterTab, searchQuery, role])

  const pinnedCount = announcements.filter((a) => a.isPinned).length

  return (
    <div
      className="px-3 py-3.5 sm:px-6 sm:py-5 md:px-8 md:py-6 pb-[calc(78px+env(safe-area-inset-bottom,0px))] md:pb-8 overflow-y-auto h-full font-nunito"
      style={{
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* ── En-tête du Babillard ────────────────────────────────────────────── */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-md"
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
              }}
            >
              <Megaphone size={19} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[16px] sm:text-[20px] font-bold font-spectral truncate" style={{ color: 'var(--text)' }}>
                  {title}
                </h1>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black"
                  style={{
                    background: 'var(--amber-light)',
                    color: 'var(--amber)',
                    border: '1px solid var(--amber)',
                  }}
                >
                  Officiel
                </span>
              </div>
              <p className="text-[11px] sm:text-[12.5px] font-medium text-[var(--text3)] mt-0.5 truncate">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Bouton visible sur mobile et desktop pour publier */}
          {canPublish && (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer shadow-sm transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
              }}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>
                <span className="sm:hidden">Publier</span>
                <span className="hidden sm:inline">Publier un communiqué</span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications flottantes */}
      {notice && (
        <div
          aria-live="polite"
          className="mb-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2 max-w-xl transition-opacity duration-200"
          style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#15803d',
            opacity: noticeVisible ? 1 : 0,
          }}
        >
          <CheckCircle2 size={16} className="flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {errorNotice && (
        <div
          aria-live="assertive"
          className="mb-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2 max-w-xl transition-opacity duration-200"
          style={{
            background: 'rgba(239, 68, 68, 0.10)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#b91c1c',
            opacity: errorVisible ? 1 : 0,
          }}
        >
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* ── Barre de Filtres & Recherche ─────────────────────────────────────── */}
      <div
        className="p-2.5 sm:p-3.5 mb-4 sm:mb-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-2.5"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
      >
        {/* Onglets Pills défilables horizontalement */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border-none cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: filterTab === 'all' ? 'var(--sidebar)' : 'var(--bg2)',
              color: filterTab === 'all' ? '#ffffff' : 'var(--text2)',
            }}
          >
            Tous ({announcements.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('pinned')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border-none cursor-pointer whitespace-nowrap transition-all inline-flex items-center gap-1.5"
            style={{
              background: filterTab === 'pinned' ? 'var(--sidebar)' : 'var(--bg2)',
              color: filterTab === 'pinned' ? '#ffffff' : 'var(--text2)',
            }}
          >
            <Pin size={13} className={filterTab === 'pinned' ? 'text-amber-400' : 'text-[var(--text3)]'} />
            <span>À la une ({pinnedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('for_me')}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border-none cursor-pointer whitespace-nowrap transition-all"
            style={{
              background: filterTab === 'for_me' ? 'var(--sidebar)' : 'var(--bg2)',
              color: filterTab === 'for_me' ? '#ffffff' : 'var(--text2)',
            }}
          >
            Pour moi ({role})
          </button>
        </div>

        {/* Champ de recherche : pleine largeur sur mobile */}
        <div className="relative w-full md:w-64 flex-shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
          <input
            type="text"
            placeholder="Rechercher une annonce..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 pl-8 pr-3 rounded-xl text-xs font-medium outline-none transition-colors"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
          />
        </div>
      </div>

      {/* ── LE TABLEAU D'AFFICHAGE (GRILLE DES ANNONCES) ─────────────────────── */}
      {loading ? (
        <div
          className="p-10 text-center rounded-2xl text-xs sm:text-sm font-semibold text-[var(--text3)]"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          Chargement des communiqués du babillard...
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div
          className="p-8 sm:p-12 text-center rounded-2xl"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl inline-flex items-center justify-center mb-3"
            style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}
          >
            <Megaphone size={24} strokeWidth={2} />
          </div>
          <div className="text-sm sm:text-base font-extrabold text-[var(--text)]">
            {searchQuery ? 'Aucune annonce ne correspond à votre recherche.' : t('babillard.empty') ?? 'Aucun communiqué affiché pour le moment.'}
          </div>
          <div className="text-xs text-[var(--text3)] mt-1.5 max-w-sm mx-auto">
            {canPublish ? 'Appuyez sur le bouton pour diffuser une note officielle à l’établissement.' : 'Revenez plus tard pour consulter les nouvelles circulaires officielles.'}
          </div>
        </div>
      ) : (
        /* Grille 1 colonne sur mobile, 2 colonnes sur tablette, 3 sur desktop */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
          {filteredAnnouncements.map((item) => {
            const isManageable = canManageItem(item)
            const expiresAt = item.expiresAt
              ? new Date(item.expiresAt).toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Permanent'
            const datePublication = new Date(item.createdAt).toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' })

            return (
              <article
                key={item.id}
                className="p-3.5 sm:p-4 md:p-5 rounded-2xl flex flex-col relative transition-all duration-150 overflow-hidden"
                style={{
                  background: 'var(--surface)',
                  border: item.isPinned ? '2px solid #f59e0b' : '1px solid var(--border)',
                  boxShadow: item.isPinned ? '0 6px 20px rgba(245, 158, 11, 0.12)' : '0 2px 6px rgba(0,0,0,0.02)',
                }}
              >
                {/* Bandeau supérieur Épinglé */}
                {item.isPinned && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: 'linear-gradient(90deg, #f59e0b, #d97706)' }}
                  />
                )}

                {/* En-tête de l'Annonce */}
                <div className="flex justify-between items-start gap-2 mb-2 sm:mb-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {item.isPinned && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black"
                          style={{
                            background: '#fef3c7',
                            color: '#92400e',
                          }}
                        >
                          <Pin size={11} fill="#d97706" color="#d97706" />
                          <span>À la une</span>
                        </span>
                      )}
                      <span className="text-[10.5px] sm:text-[11px] font-semibold text-[var(--text3)]">
                        {datePublication}
                      </span>
                    </div>

                    <h3 className="text-[14.5px] sm:text-[16px] font-black text-[var(--text)] leading-snug break-words">
                      {item.title}
                    </h3>
                  </div>

                  {/* Actions (Modifier / Supprimer) */}
                  {isManageable && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        title="Modifier mon annonce"
                        className="p-1.5 rounded-lg border cursor-pointer transition-colors"
                        style={{
                          background: 'var(--bg2)',
                          borderColor: 'var(--border)',
                          color: 'var(--text2)',
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        title="Supprimer mon annonce"
                        className="p-1.5 rounded-lg border cursor-pointer transition-colors"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          borderColor: 'rgba(239, 68, 68, 0.25)',
                          color: '#dc2626',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Corps de l'Annonce */}
                <div
                  className="text-xs sm:text-[13px] text-[var(--text2)] leading-relaxed whitespace-pre-wrap flex-1 mb-3.5 break-words"
                >
                  {item.content}
                </div>

                {/* Pied de l'Annonce */}
                <div
                  className="pt-2.5 border-t border-[var(--border)] flex flex-col gap-2 text-xs text-[var(--text3)]"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {/* Public ciblé */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10.5px] font-bold">Cible :</span>
                      {item.targetRoles?.length > 0 ? (
                        item.targetRoles.map((tr) => (
                          <span
                            key={tr}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold"
                            style={{
                              background: 'var(--bg2)',
                              color: 'var(--text2)',
                            }}
                          >
                            {ROLE_ICON[tr.toUpperCase()] ?? null}
                            <span>{tr}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[var(--text3)] font-semibold">Tous publics</span>
                      )}
                    </div>

                    {/* Expiration */}
                    <div className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--text3)]">
                      <CalendarClock size={11} />
                      <span>{expiresAt}</span>
                    </div>
                  </div>

                  {/* Auteur */}
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text)]">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9.5px] font-black"
                      style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}
                    >
                      {item.author?.firstName?.[0] ?? 'A'}
                    </div>
                    <span className="truncate">
                      {item.author ? `${item.author.firstName} ${item.author.lastName}` : 'Direction de l’établissement'}
                      <span className="font-medium text-[var(--text3)] ml-1">
                        ({item.author?.role ?? 'ADMIN'})
                      </span>
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ── MODALE FLOTTANTE ÉLÉGANTE (PRÉSERVE TOPBAR & BOTTOMBAR AVEC MARGES LATÉRALES) ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-150 px-3.5 sm:px-6 pt-[calc(56px+env(safe-area-inset-top,0px))] pb-[calc(76px+env(safe-area-inset-bottom,0px))]"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false)
              resetForm()
            }
          }}
        >
          <div
            className="w-full max-w-lg max-h-full rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-[var(--border)] animate-in zoom-in-95 duration-200"
            style={{
              background: 'var(--surface)',
            }}
          >
            {/* Header de la modale avec icône, titre et bouton fermeture */}
            <div
              className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0"
              style={{ background: 'var(--surface)' }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0 shadow-sm"
                  style={{ background: 'var(--amber-light)' }}
                >
                  <Megaphone size={17} strokeWidth={2.4} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-extrabold text-[var(--text)] truncate">
                    {editingId ? 'Modifier le communiqué' : 'Nouveau communiqué'}
                  </div>
                  <div className="text-[11px] text-[var(--text3)] truncate">
                    Babillard officiel • {role}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full border-none bg-[var(--bg2)] text-[var(--text2)] flex items-center justify-center cursor-pointer hover:opacity-80 active:scale-90 transition-all flex-shrink-0"
              >
                <X size={17} strokeWidth={2.2} />
              </button>
            </div>

            {/* Formulaire complet avec corps défilable et footer fixe */}
            <form onSubmit={handlePublish} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5" style={{ WebkitOverflowScrolling: 'touch' }}>
                {/* Champ Titre */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                    Titre du communiqué <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={publishTitle}
                    onChange={(e) => setPublishTitle(e.target.value)}
                    placeholder="ex. Assemblée Générale, Retrait des bulletins..."
                    className="w-full h-10 px-3.5 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    style={{
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                    }}
                  />
                </div>

                {/* Champ Message */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text)] mb-1.5">
                    Message officiel <span className="text-amber-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={publishContent}
                    onChange={(e) => setPublishContent(e.target.value)}
                    placeholder="Rédigez le texte officiel du communiqué..."
                    className="w-full p-3 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all resize-y min-h-[100px] focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                    style={{
                      border: '1.5px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                    }}
                  />
                </div>

                {/* Public cible (Audience) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-[var(--text)]">
                      Public cible <span className="text-amber-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (publishRoles.length === ROLE_OPTIONS.length) {
                          setPublishRoles([role])
                        } else {
                          setPublishRoles([...ROLE_OPTIONS])
                        }
                      }}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-transparent border-none cursor-pointer hover:underline"
                    >
                      {publishRoles.length === ROLE_OPTIONS.length ? 'Réduire' : 'Tous les rôles'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                    {ROLE_OPTIONS.map((item) => {
                      const selected = publishRoles.includes(item)
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => toggleRole(item)}
                          className="flex items-center justify-center sm:justify-start gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all border active:scale-95"
                          style={{
                            background: selected ? 'var(--amber-light)' : 'var(--bg)',
                            borderColor: selected ? 'var(--amber)' : 'var(--border)',
                            color: selected ? 'var(--amber)' : 'var(--text2)',
                          }}
                        >
                          {ROLE_ICON[item]}
                          <span className="truncate">{t(`babillard.role_options.${item.toLowerCase()}`) ?? item}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Paramètres de diffusion (À la une et Durée) */}
                <div
                  className="p-3 rounded-2xl border space-y-2.5"
                  style={{
                    background: 'var(--bg)',
                    borderColor: 'var(--border)',
                  }}
                >
                  {/* Toggle Épinglé */}
                  <label className="flex items-center gap-2.5 text-xs font-bold text-[var(--text)] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={publishPinned}
                      onChange={(e) => setPublishPinned(e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer accent-amber-500"
                    />
                    <span className="flex items-center gap-1.5">
                      <Pin size={13} className={publishPinned ? 'text-amber-500' : 'text-[var(--text3)]'} />
                      <span>Épingler en haut du babillard (À la une)</span>
                    </span>
                  </label>

                  {/* Sélecteur de durée / expiration */}
                  <div className="pt-2 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-[var(--text2)] flex items-center gap-1">
                        <CalendarClock size={12} className="text-[var(--text3)]" />
                        <span>Durée de visibilité :</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { mode: 'none' as const, label: 'Permanent' },
                        { mode: 'days' as const, days: '3', label: '3 jours' },
                        { mode: 'days' as const, days: '7', label: '7 jours' },
                        { mode: 'days' as const, days: '15', label: '15 jours' },
                        { mode: 'days' as const, days: '30', label: '30 jours' },
                      ].map((preset) => {
                        const active =
                          preset.mode === 'none'
                            ? publishExpiryMode === 'none'
                            : publishExpiryMode === 'days' && publishExpiryDays === preset.days
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setPublishExpiryMode(preset.mode)
                              if (preset.days) setPublishExpiryDays(preset.days)
                            }}
                            className="h-7 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer active:scale-95"
                            style={{
                              background: active ? 'var(--amber-light)' : 'var(--surface)',
                              borderColor: active ? 'var(--amber)' : 'var(--border)',
                              color: active ? 'var(--amber)' : 'var(--text2)',
                            }}
                          >
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer boutons fixe en bas */}
              <div
                className="px-4 py-3 sm:px-5 sm:py-3 border-t border-[var(--border)] flex items-center justify-end gap-2.5 flex-shrink-0"
                style={{ background: 'var(--surface)' }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    resetForm()
                  }}
                  disabled={publishing}
                  className="flex-1 sm:flex-none h-10 px-4 rounded-xl text-xs font-bold cursor-pointer transition-colors border active:scale-95 text-center justify-center inline-flex items-center"
                  style={{
                    background: 'var(--bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--text2)',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={publishing || !publishTitle.trim() || !publishContent.trim() || publishRoles.length === 0}
                  className="flex-1 sm:flex-none h-10 inline-flex items-center justify-center gap-2 px-5 rounded-xl text-xs font-black text-white cursor-pointer border-none shadow-md transition-all hover:opacity-95 active:scale-95 disabled:opacity-50 min-w-[120px]"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                  }}
                >
                  <Send size={14} strokeWidth={2.4} />
                  <span>{publishing ? 'En cours...' : editingId ? 'Enregistrer' : 'Diffuser'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}