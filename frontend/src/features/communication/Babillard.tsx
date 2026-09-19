'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Megaphone, Pin, CalendarClock, School, Users, GraduationCap, User, UserCircle2,
  Send, Trash2, Plus, Edit2, X, Search, Filter, AlertCircle, CheckCircle2
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
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const toggleRole = (value: string) => {
    setPublishRoles((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
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
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflow: 'auto', fontFamily: 'var(--font-nunito), Nunito, sans-serif' }}>
      {/* ── En-tête du Babillard ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
              }}
            >
              <Megaphone size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 className="text-[17px] md:text-[20px] font-bold font-spectral" style={{ color: 'var(--text)', margin: 0 }}>
                  {title}
                </h1>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                    background: 'var(--amber-light)',
                    color: 'var(--amber)',
                    border: '1px solid var(--amber)',
                  }}
                >
                  Tableau officiel
                </span>
              </div>
              <p className="text-[11px] md:text-[13px] font-medium" style={{ color: 'var(--text3)', marginTop: 2 }}>
                {subtitle}
              </p>
            </div>
          </div>

          {canPublish && (
            <button
              type="button"
              onClick={openCreateModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: '#1a2e1e',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                transition: 'transform 0.15s ease',
              }}
            >
              <Plus size={16} />
              <span>Publier un communiqué</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications flottantes */}
      {notice && (
        <div
          aria-live="polite"
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1px solid rgba(34, 197, 94, 0.35)',
            color: '#15803d',
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: 600,
            opacity: noticeVisible ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{notice}</span>
        </div>
      )}

      {errorNotice && (
        <div
          aria-live="assertive"
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.10)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#b91c1c',
            fontWeight: 700,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            maxWidth: 600,
            opacity: errorVisible ? 1 : 0,
            transition: 'opacity 200ms ease',
          }}
        >
          <AlertCircle size={16} />
          <span>{errorNotice}</span>
        </div>
      )}

      {/* ── Barre de Filtres & Recherche du Tableau d'Affichage ───────────────── */}
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 14,
          border: '1.5px solid var(--border)',
          padding: '12px 16px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: filterTab === 'all' ? '#1a2e1e' : 'transparent',
              color: filterTab === 'all' ? 'white' : 'var(--text3)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Toutes les annonces ({announcements.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('pinned')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: filterTab === 'pinned' ? '#1a2e1e' : 'transparent',
              color: filterTab === 'pinned' ? 'white' : 'var(--text3)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Pin size={13} color={filterTab === 'pinned' ? '#f59e0b' : 'var(--text3)'} />
            <span>Épinglées ({pinnedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('for_me')}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: filterTab === 'for_me' ? '#1a2e1e' : 'transparent',
              color: filterTab === 'for_me' ? 'white' : 'var(--text3)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Pour mon rôle ({role})
          </button>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: 280 }}>
          <Search size={15} color="var(--text3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Rechercher une annonce..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px 7px 32px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* ── LE TABLEAU D'AFFICHAGE (GRILLE DES ANNONCES) ─────────────────────── */}
      {loading ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--text3)',
            background: 'var(--surface)',
            borderRadius: 16,
            border: '1.5px solid var(--border)',
            fontSize: 14,
          }}
        >
          Chargement des communiqués du babillard...
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--text3)',
            background: 'var(--surface)',
            borderRadius: 16,
            border: '1.5px solid var(--border)',
          }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--amber-light)', color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Megaphone size={24} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
            {searchQuery ? 'Aucune annonce ne correspond à votre recherche.' : t('babillard.empty') ?? 'Aucun communiqué affiché pour le moment.'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
            {canPublish ? 'Utilisez le bouton « Publier un communiqué » en haut à droite pour diffuser une note officielle.' : 'Revenez plus tard pour consulter les nouvelles circulaires.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filteredAnnouncements.map((item) => {
            const isManageable = canManageItem(item)
            const expiresAt = item.expiresAt
              ? new Date(item.expiresAt).toLocaleDateString('fr-CM', { day: 'numeric', month: 'long', year: 'numeric' })
              : 'Permanent'
            const datePublication = new Date(item.createdAt).toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' })

            return (
              <article
                key={item.id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: 16,
                  border: item.isPinned ? '2px solid #f59e0b' : '1.5px solid var(--border)',
                  padding: 20,
                  boxShadow: item.isPinned ? '0 8px 24px rgba(245, 158, 11, 0.12)' : '0 2px 6px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Bandeau supérieur Épinglé */}
                {item.isPinned && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                    }}
                  />
                )}

                {/* En-tête de l'Annonce */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      {item.isPinned && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#fef3c7',
                            color: '#92400e',
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          <Pin size={12} fill="#d97706" color="#d97706" />
                          <span>À la une</span>
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
                        {datePublication}
                      </span>
                    </div>

                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)', lineHeight: 1.35 }}>
                      {item.title}
                    </h3>
                  </div>

                  {/* Actions (Modifier / Supprimer) STRICTEMENT RÉSERVÉES À L'ADMIN OU À L'AUTEUR */}
                  {isManageable && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        title="Modifier mon annonce"
                        style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          padding: '5px 8px',
                          cursor: 'pointer',
                          color: 'var(--text2)',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        title="Supprimer mon annonce"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 6,
                          padding: '5px 8px',
                          cursor: deletingId === item.id ? 'wait' : 'pointer',
                          color: '#dc2626',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Corps de l'Annonce */}
                <div
                  style={{
                    color: 'var(--text2)',
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                    flex: 1,
                    marginBottom: 16,
                  }}
                >
                  {item.content}
                </div>

                {/* Pied de l'Annonce : Métadonnées, rôles ciblés & Auteur */}
                <div
                  style={{
                    paddingTop: 12,
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    fontSize: 12,
                    color: 'var(--text3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    {/* Public ciblé */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700 }}>Destinataires:</span>
                      {item.targetRoles?.length > 0 ? (
                        item.targetRoles.map((tr) => (
                          <span
                            key={tr}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'var(--bg2)',
                              color: 'var(--text2)',
                              fontSize: 10.5,
                              fontWeight: 700,
                            }}
                          >
                            {ROLE_ICON[tr.toUpperCase()] ?? null}
                            <span>{tr}</span>
                          </span>
                        ))
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Tous publics</span>
                      )}
                    </div>

                    {/* Expiration */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                      <CalendarClock size={12} />
                      <span>{expiresAt}</span>
                    </div>
                  </div>

                  {/* Auteur */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
                      {item.author?.firstName?.[0] ?? 'A'}
                    </div>
                    <span>
                      {item.author ? `${item.author.firstName} ${item.author.lastName}` : 'Direction de l’établissement'}
                      <span style={{ fontWeight: 500, color: 'var(--text3)', marginLeft: 4 }}>
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

      {/* ── Pied de babillard discret (information et comptage) ─────────────── */}
      {filteredAnnouncements.length > 0 && (
        <div
          style={{
            marginTop: 32,
            padding: '14px 20px',
            borderRadius: 12,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'var(--text3)',
            fontSize: 12.5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <School size={14} />
            <span>Babillard officiel de l’établissement</span>
          </div>
          <div>
            {filteredAnnouncements.length} communiqué{filteredAnnouncements.length > 1 ? 's' : ''} affiché{filteredAnnouncements.length > 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* ── MODALE ÉLÉGANTE DE RÉDACTION / MODIFICATION ─────────────────────────── */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 18,
              width: '100%',
              maxWidth: 600,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header Modale */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#fafafa',
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Megaphone size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
                    {editingId ? 'Modifier le communiqué' : 'Publier sur le babillard'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                    {editingId ? 'Les modifications mettront à jour l’annonce affichée.' : 'L’annonce apparaîtra sur le tableau d’affichage officiel.'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Formulaire Body */}
            <form onSubmit={handlePublish} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                  Titre du communiqué *
                </label>
                <input
                  type="text"
                  required
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  placeholder="ex. Réunion solennelle de rentrée, Calendrier des devoirs..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1.5px solid #d1d5db',
                    fontSize: 13.5,
                    color: '#111827',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 5 }}>
                  Contenu de l'annonce *
                </label>
                <textarea
                  required
                  rows={6}
                  value={publishContent}
                  onChange={(e) => setPublishContent(e.target.value)}
                  placeholder="Rédigez le texte officiel du communiqué..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1.5px solid #d1d5db',
                    fontSize: 13.5,
                    color: '#111827',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Ciblage des Rôles */}
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                  Destinataires ciblés *
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ROLE_OPTIONS.map((item) => {
                    const selected = publishRoles.includes(item)
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleRole(item)}
                        style={{
                          border: selected ? '1.5px solid #d97706' : '1.5px solid #e5e7eb',
                          background: selected ? '#fef3c7' : '#ffffff',
                          color: selected ? '#92400e' : '#4b5563',
                          borderRadius: 999,
                          padding: '6px 14px',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'all 0.12s',
                        }}
                      >
                        {ROLE_ICON[item]}
                        <span>{t(`babillard.role_options.${item.toLowerCase()}`) ?? item}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Options : Épinglage et Expiration */}
              <div
                style={{
                  background: '#f9fafb',
                  borderRadius: 12,
                  padding: '12px 16px',
                  border: '1px solid #e5e7eb',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16,
                  alignItems: 'center',
                }}
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={publishPinned}
                    onChange={(e) => setPublishPinned(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span>Épingler en tête du babillard</span>
                </label>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={publishExpiryMode}
                    onChange={(e) => setPublishExpiryMode(e.target.value as 'none' | 'days')}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: 'white',
                      fontSize: 12.5,
                      fontWeight: 600,
                    }}
                  >
                    <option value="none">Sans expiration</option>
                    <option value="days">Expirer dans N jours</option>
                  </select>

                  {publishExpiryMode === 'days' && (
                    <input
                      type="number"
                      min={1}
                      value={publishExpiryDays}
                      onChange={(e) => setPublishExpiryDays(e.target.value)}
                      style={{
                        width: 80,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        fontSize: 12.5,
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Footer boutons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: '1px solid #f3f4f6',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    resetForm()
                  }}
                  disabled={publishing}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: 'white',
                    color: '#374151',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={publishing || !publishTitle.trim() || !publishContent.trim() || publishRoles.length === 0}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#1a2e1e',
                    color: 'white',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    opacity: publishing ? 0.7 : 1,
                  }}
                >
                  <Send size={15} />
                  <span>{publishing ? 'Publication...' : editingId ? 'Enregistrer les modifications' : 'Publier sur le tableau'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}