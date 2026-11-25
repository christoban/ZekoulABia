'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, Loader2, Megaphone, Plus, RefreshCw, WifiOff } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { CarnetEntryCard } from './CarnetEntryCard'
import {
  CATEGORY_LABELS,
  type CarnetClassOption,
  type CarnetStudentOption,
  type CarnetTemplateItem,
  type LiaisonEntryUi,
  type UnifiedInboxItemUi,
} from './carnetTypes'

interface Props {
  role: 'PARENT' | 'TEACHER' | 'ADMIN' | 'STAFF'
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function CarnetLiaisonView({ role, onToast }: Props) {
  const { isOnline, addToQueue } = useSyncQueue()
  const isParent = role === 'PARENT'

  const [templates, setTemplates] = useState<CarnetTemplateItem[]>([])
  const [classes, setClasses] = useState<CarnetClassOption[]>([])
  const [students, setStudents] = useState<CarnetStudentOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [unreadOnly, setUnreadOnly] = useState(false)

  const [inboxItems, setInboxItems] = useState<UnifiedInboxItemUi[]>([])
  const [entries, setEntries] = useState<LiaisonEntryUi[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingConfirmations, setPendingConfirmations] = useState(0)
  const [loading, setLoading] = useState(true)

  const [showCompose, setShowCompose] = useState(false)
  const [composeTemplate, setComposeTemplate] = useState('')
  const [composeTargetMode, setComposeTargetMode] = useState<'CLASS' | 'STUDENT'>('STUDENT')
  const [composeCategory, setComposeCategory] = useState(isParent ? 'PARENT_NOTE' : 'INFO')
  const [composeTitle, setComposeTitle] = useState('')
  const [composeContent, setComposeContent] = useState('')
  const [composeRequiresConf, setComposeRequiresConf] = useState(false)
  const [composePrompt, setComposePrompt] = useState('')
  const [composeUrgent, setComposeUrgent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadBootstrap = useCallback(async () => {
    try {
      const tplRes = await fetchApi('/api/v2/carnet-liaison/templates', { credentials: 'include' }).then((r) => r.json())
      if (tplRes.success && Array.isArray(tplRes.data)) setTemplates(tplRes.data)

      if (isParent) {
        const kidsRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then((r) => r.json())
        if (kidsRes.success && Array.isArray(kidsRes.data)) {
          const list: CarnetStudentOption[] = kidsRes.data.map((k: { studentId: string; prenom?: string; nom?: string }) => ({
            id: k.studentId,
            name: `${k.prenom || ''} ${k.nom || ''}`.trim() || 'Élève',
          }))
          setStudents(list)
          if (list.length === 1) setSelectedStudentId(list[0].id)
        }
      } else {
        const clsRes = await fetchApi('/api/v2/classes', { credentials: 'include' }).then((r) => r.json())
        if (clsRes.success && Array.isArray(clsRes.data) && clsRes.data.length > 0) {
          setClasses(clsRes.data)
          setSelectedClassId((prev) => prev || clsRes.data[0].id)
        }
      }
    } catch { /* offline tolerated */ }
  }, [isParent])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  useEffect(() => {
    if (isParent || !selectedClassId) return
    void fetchApi(`/api/v2/classes/${selectedClassId}/students`, { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setStudents(json.data.map((s: { id: string; firstName?: string; lastName?: string }) => ({
            id: s.id,
            name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Élève',
          })))
        }
      })
      .catch(() => {})
  }, [isParent, selectedClassId])

  const loadEntries = useCallback(async () => {
    setLoading(true)
    try {
      if (isParent) {
        const q = selectedStudentId ? `?studentId=${selectedStudentId}` : ''
        const res = await fetchApi(`/api/v2/carnet-liaison/parent/inbox${q}`, { credentials: 'include' }).then((r) => r.json())
        if (res.success && res.data) {
          setInboxItems(Array.isArray(res.data.items) ? res.data.items : [])
          setUnreadCount(Number(res.data.unreadCarnetCount ?? 0))
          setPendingConfirmations(Number(res.data.pendingConfirmationsCount ?? 0))
        }
      } else if (selectedStudentId) {
        const res = await fetchApi(`/api/v2/carnet-liaison/students/${selectedStudentId}`, { credentials: 'include' }).then((r) => r.json())
        setEntries(res.success && Array.isArray(res.data) ? res.data : [])
      } else if (selectedClassId) {
        const res = await fetchApi(`/api/v2/carnet-liaison/classes/${selectedClassId}`, { credentials: 'include' }).then((r) => r.json())
        setEntries(res.success && Array.isArray(res.data) ? res.data : [])
      } else {
        setEntries([])
      }
    } catch {
      onToast('Impossible de charger le carnet de liaison', 'warning')
    } finally {
      setLoading(false)
    }
  }, [isParent, selectedStudentId, selectedClassId, onToast])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const applyTemplate = (tplId: string) => {
    setComposeTemplate(tplId)
    const found = templates.find((t) => t.id === tplId)
    if (!found) return
    setComposeCategory(found.category)
    setComposeTitle(found.titleFr)
    setComposeRequiresConf(found.requiresConfirmation)
    if (found.requiresConfirmation && !composePrompt) {
      setComposePrompt('Confirmez-vous avoir pris connaissance de cette note ?')
    }
  }

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!composeTitle.trim() || !composeContent.trim()) {
      onToast('Titre et message sont requis.', 'warning')
      return
    }
    const targetStudentId = selectedStudentId || students[0]?.id
    if (isParent && !targetStudentId) {
      onToast('Sélectionnez un enfant.', 'warning')
      return
    }
    if (!isParent && composeTargetMode === 'STUDENT' && !targetStudentId) {
      onToast('Sélectionnez un élève ou basculez sur Classe entière.', 'warning')
      return
    }

    const payload = {
      studentId: isParent || composeTargetMode === 'STUDENT' ? targetStudentId : undefined,
      classId: !isParent && composeTargetMode === 'CLASS' ? selectedClassId : (!isParent ? selectedClassId || undefined : undefined),
      category: composeCategory,
      title: composeTitle.trim(),
      content: composeContent.trim(),
      requiresConfirmation: !isParent ? composeRequiresConf : false,
      confirmationPrompt: !isParent && composeRequiresConf ? (composePrompt.trim() || null) : undefined,
      isUrgent: composeUrgent,
      clientRecordedAt: new Date().toISOString(),
    }

    if (!isOnline) {
      await addToQueue({ type: 'CARNET_ENTRY_CREATE', endpoint: '/api/v2/carnet-liaison', method: 'POST', payload })
      onToast('Message enregistré hors-ligne et mis en file de synchronisation.', 'info')
      setShowCompose(false)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetchApi('/api/v2/carnet-liaison', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Erreur lors de l’envoi')
      if (json.clockSkewWarning) {
        onToast('Horloge décalée : horodatage serveur conservé.', 'warning')
      } else {
        onToast('Entrée ajoutée au carnet de liaison', 'success')
      }
      setShowCompose(false)
      setComposeTitle('')
      setComposeContent('')
      await loadEntries()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur réseau', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkRead = async (entryId: string) => {
    if (!isOnline) {
      await addToQueue({ type: 'CARNET_ACK_READ', endpoint: `/api/v2/carnet-liaison/${entryId}/lu`, method: 'POST', payload: {} })
      onToast('Accusé de lecture mis en file hors-ligne', 'info')
      return
    }
    const res = await fetchApi(`/api/v2/carnet-liaison/${entryId}/lu`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      onToast('Accusé de lecture enregistré', 'success')
      await loadEntries()
    }
  }

  const handleRespond = async (entryId: string, confirmed: boolean | undefined, replyText: string) => {
    const payload = {
      confirmed,
      replyText: replyText.trim() || undefined,
      clientRecordedAt: new Date().toISOString(),
    }
    if (!isOnline) {
      await addToQueue({ type: 'CARNET_CONFIRM_RESPONSE', endpoint: `/api/v2/carnet-liaison/${entryId}/repondre`, method: 'POST', payload })
      onToast('Réponse mise en file hors-ligne', 'info')
      return
    }
    const res = await fetchApi(`/api/v2/carnet-liaison/${entryId}/repondre`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (res.ok && json.success) {
      onToast('Réponse enregistrée dans le carnet', 'success')
      await loadEntries()
    } else {
      onToast(json.message || 'Erreur lors de la réponse', 'error')
    }
  }

  const handleRelancer = async (entryId: string) => {
    const res = await fetchApi(`/api/v2/carnet-liaison/${entryId}/relancer`, { method: 'POST', credentials: 'include' })
    const json = await res.json()
    if (res.ok && json.success) {
      onToast(`Relance envoyée (${json.data?.notifiedCount ?? 0} push, ${json.data?.smsCount ?? 0} SMS)`, 'success')
    } else {
      onToast(json.message || 'Erreur relance', 'error')
    }
  }

  const filteredInbox = useMemo(() => {
    return inboxItems.filter((it) => {
      if (unreadOnly && it.isRead) return false
      if (categoryFilter !== 'ALL' && it.category !== categoryFilter) return false
      return true
    })
  }, [inboxItems, unreadOnly, categoryFilter])

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => (categoryFilter === 'ALL' ? true : e.category === categoryFilter))
  }, [entries, categoryFilter])

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4 h-full overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2 font-spectral text-lg font-bold text-[var(--text)]">
            <BookOpen size={18} className="text-[var(--primary)]" />
            <span>Carnet de liaison numérique</span>
          </div>
          <div className="text-xs text-[var(--text3)] mt-0.5">
            {isParent
              ? `${unreadCount} message(s) non lu(s) · ${pendingConfirmations} confirmation(s) en attente`
              : 'Échanges tracés École ↔ Parents avec accusé de lecture et confirmation'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadEntries()}
            className="h-9 px-3 rounded-lg border border-[var(--border2)] bg-[var(--surface)] text-xs font-bold text-[var(--text2)] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} /> Actualiser
          </button>
          <button
            type="button"
            onClick={() => setShowCompose((v) => !v)}
            className="h-9 px-3.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
            style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
          >
            <Plus size={14} /> {isParent ? 'Écrire un mot' : 'Nouvelle note'}
          </button>
        </div>
      </div>

      {!isOnline && (
        <div className="rounded-lg p-2.5 border border-[var(--amber)] bg-[var(--amber-light)] text-[var(--amber)] text-xs font-bold flex items-center gap-2">
          <WifiOff size={14} /> Mode hors-ligne : vos messages et réponses seront synchronisés automatiquement.
        </div>
      )}

      {showCompose && (
        <form onSubmit={(e) => void handleCreateEntry(e)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select value={composeTemplate} onChange={(e) => applyTemplate(e.target.value)} className="h-9 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-semibold">
              <option value="">Modèle rapide (optionnel)</option>
              {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.titleFr}</option>)}
            </select>
            <select value={composeCategory} onChange={(e) => setComposeCategory(e.target.value)} className="h-9 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-semibold">
              {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'ALL').map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            {!isParent && (
              <select value={composeTargetMode} onChange={(e) => setComposeTargetMode(e.target.value as 'CLASS' | 'STUDENT')} className="h-9 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-semibold">
                <option value="STUDENT">Pour l&apos;élève sélectionné</option>
                <option value="CLASS">Toute la classe sélectionnée</option>
              </select>
            )}
          </div>
          <input
            type="text"
            value={composeTitle}
            onChange={(e) => setComposeTitle(e.target.value)}
            placeholder="Objet / Titre de la note"
            className="w-full h-9 px-3 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-semibold"
          />
          <textarea
            rows={3}
            value={composeContent}
            onChange={(e) => setComposeContent(e.target.value)}
            placeholder="Contenu du message dans le carnet de liaison..."
            className="w-full p-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs"
          />
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text2)]">
            {!isParent && (
              <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                <input type="checkbox" checked={composeRequiresConf} onChange={(e) => setComposeRequiresConf(e.target.checked)} />
                Confirmation parent Oui/Non requise
              </label>
            )}
            <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
              <input type="checkbox" checked={composeUrgent} onChange={(e) => setComposeUrgent(e.target.checked)} />
              Marquer comme urgent (Push + SMS)
            </label>
          </div>
          {!isParent && composeRequiresConf && (
            <input
              type="text"
              value={composePrompt}
              onChange={(e) => setComposePrompt(e.target.value)}
              placeholder="Question de confirmation (ex: Autorisez-vous la sortie du vendredi ?)"
              className="w-full h-8 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs"
            />
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCompose(false)} className="h-8 px-3 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-bold cursor-pointer">
              Annuler
            </button>
            <button type="submit" disabled={submitting} className="h-8 px-4 rounded-lg text-xs font-bold text-white cursor-pointer" style={{ background: 'var(--primary)' }}>
              {submitting ? 'Envoi...' : 'Publier dans le carnet'}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {!isParent && (
          <select value={selectedClassId} onChange={(e) => { setSelectedClassId(e.target.value); setSelectedStudentId('') }} className="h-8 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-bold">
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="h-8 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-bold">
          <option value="">{isParent ? 'Tous mes enfants (boîte unifiée)' : 'Toute la classe'}</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-8 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs font-bold">
          {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {isParent && (
          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text2)] ml-auto cursor-pointer">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
            Non lus uniquement
          </label>
        )}
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 size={22} className="animate-spin text-[var(--text3)]" /></div>
      ) : isParent ? (
        filteredInbox.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--text3)]">
            Aucune entrée dans le carnet de liaison pour ces filtres.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredInbox.map((item) =>
              item.kind === 'CARNET' && item.carnetEntry ? (
                <CarnetEntryCard
                  key={`carnet-${item.id}`}
                  role={role}
                  entry={item.carnetEntry}
                  unifiedMeta={item}
                  onMarkRead={handleMarkRead}
                  onRespond={handleRespond}
                />
              ) : (
                <div key={`ann-${item.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 space-y-1">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--primary)]">
                    <Megaphone size={13} /> <span>Annonce Babillard</span>
                  </div>
                  <div className="text-sm font-bold text-[var(--text)]">{item.title}</div>
                  <div className="text-xs text-[var(--text2)] line-clamp-3">{item.content.replace(/<[^>]+>/g, ' ')}</div>
                </div>
              ),
            )}
          </div>
        )
      ) : filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-xs text-[var(--text3)]">
          Aucune note dans le carnet de liaison pour cette sélection.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEntries.map((entry) => (
            <CarnetEntryCard
              key={entry.id}
              role={role}
              entry={entry}
              onMarkRead={handleMarkRead}
              onRespond={handleRespond}
              onRelancer={handleRelancer}
            />
          ))}
        </div>
      )}
    </div>
  )
}

