'use client'

/**
 * Assistant ZekoulABia — copilot exécutant (rôle Admin).
 *
 * L'admin décrit une intention en langage naturel ; l'assistant l'exécute dans
 * l'interface via POST /api/v2/assistant/execute (function calling Groq côté serveur).
 *  - Action non-destructive → exécutée directement, carte de confirmation + bouton
 *    « Annuler » actif 5 minutes.
 *  - Action destructive → AUCUNE exécution ; encart de confirmation détaillant ce qui
 *    sera perdu, avec « Confirmer la suppression » / « Annuler ».
 *  - Question simple → réponse texte.
 *
 * Après chaque changement, l'interface métier derrière se met à jour EN TEMPS RÉEL et
 * navigue vers l'écran concerné via des évènements window (zekoulabia:navigate / :data-changed).
 */
import { useState, useRef, useEffect } from 'react'
import { X, Bot, Hand, AlertTriangle, Undo2, Check, Send, LifeBuoy, Lock } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useIdleDetection } from '@/hooks/useIdleDetection'

const UNDO_WINDOW_MS = 5 * 60 * 1000

/** Écrans identifiés comme les plus fréquentés/complexes — seuls concernés par la bulle d'aide discrète. */
const PRIORITY_SCREENS = ['grades', 'lv2-choice', 'pebs-exams', 'matricules', 'bulletins']
const IDLE_THRESHOLD_MS = 90 * 1000

interface Props {
  /** Section active du dashboard (ex. 'grades') — sert à dériver le screenKey ('admin.grades') transmis au copilot. */
  section?: string
  /** Préfixe du screenKey — 'admin' par défaut. Passer 'teacher' pour le dashboard Enseignant, etc. */
  rolePrefix?: string
  /** Suggestions affichées au premier ouverture — spécifiques au rôle. */
  suggestions?: string[]
}

type ChatItem =
  | { kind: 'user'; id: number; text: string }
  | { kind: 'assistant'; id: number; text: string }
  | { kind: 'error'; id: number; text: string }
  | { kind: 'action'; id: number; actionLogId: string; label: string; section?: string | null; entity?: string | null; undoable: boolean; undone: boolean; executedAt: number }
  | { kind: 'pending'; id: number; pendingActionId: string; summary: string; resolved?: 'confirmed' | 'cancelled' }
  | { kind: 'escalate'; id: number; text: string; supportContact: string }

const DEFAULT_SUGGESTIONS = [
  'Crée une classe de 4e D',
  'Nomme un professeur principal pour la 3e A',
  'Combien d’élèves ai-je par classe ?',
]

/** Omit qui se distribue sur chaque membre de l'union (sinon seules les clés communes survivent). */
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never

let itemId = 0

/** Notifie l'interface métier : navigation vers l'écran + rafraîchissement des données. */
function notifyInterface(section?: string | null, entity?: string | null) {
  if (section) window.dispatchEvent(new CustomEvent('zekoulabia:navigate', { detail: { section } }))
  if (entity) window.dispatchEvent(new CustomEvent('zekoulabia:data-changed', { detail: { entity } }))
}

/** Déclenche le surlignage des éléments UI référencés par une fiche d'aide (écouté par HighlightController). */
function highlightElements(selectors?: string[]) {
  if (!selectors || selectors.length === 0) return
  window.dispatchEvent(new CustomEvent('zekoulabia:highlight', { detail: { selectors } }))
}

export default function AssistantWidget({ section, rolePrefix = 'admin', suggestions = DEFAULT_SUGGESTIONS }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ChatItem[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [, setTick] = useState(0)
  const t = useT('admin')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [modalActive, setModalActive] = useState(false)
  const isPriorityScreen = !!section && PRIORITY_SCREENS.includes(section)
  const isIdle = useIdleDetection(IDLE_THRESHOLD_MS, isPriorityScreen && !open)
  const isMessagerieSection = section === 'messagerie'
  // Fil de conversation — généré côté serveur au premier message, réutilisé pour tous
  // les suivants afin que l'historique soit reconstitué à chaque appel (clarifications).
  const conversationIdRef = useRef<string | null>(null)

  useEffect(() => {
    const handleModal = (e: Event) => {
      const isOpen = Boolean((e as CustomEvent<{ open?: boolean }>).detail?.open)
      setModalActive(isOpen)
      if (isOpen) setOpen(false)
    }
    window.addEventListener('zekoulabia:modal-open', handleModal)
    return () => window.removeEventListener('zekoulabia:modal-open', handleModal)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [items, loading])

  // Ré-évalue périodiquement l'expiration des fenêtres d'annulation (5 min).
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 20000)
    return () => clearInterval(t)
  }, [])

  const push = (item: DistributiveOmit<ChatItem, 'id'>) => setItems(prev => [...prev, { ...item, id: ++itemId } as ChatItem])

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || loading) return
    push({ kind: 'user', text: clean })
    setInput('')
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/assistant/execute', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean, screenKey: section ? `${rolePrefix}.${section}` : null, conversationId: conversationIdRef.current }),
      })
      const data = await res.json()
      if (data.conversationId) conversationIdRef.current = data.conversationId
      if (!data.success) {
        push({ kind: 'error', text: data.message || t('assistant.unavailable') })
        return
      }

      if (data.type === 'escalate') {
        push({ kind: 'escalate', text: data.response, supportContact: data.supportContact })
        return
      }

      if (data.type === 'message') {
        push({ kind: 'assistant', text: data.response || 'Je n’ai pas compris la demande.' })
        highlightElements(data.highlightSelectors)
        return
      }

      if (data.response) push({ kind: 'assistant', text: data.response })

      for (const ex of (data.executed ?? [])) {
        if (ex.error) {
          push({ kind: 'error', text: ex.error })
          continue
        }
        push({
          kind: 'action',
          actionLogId: ex.actionLogId,
          label: ex.label,
          section: ex.section,
          entity: ex.entity,
          undoable: !!ex.undoable,
          undone: false,
          executedAt: Date.now(),
        })
        notifyInterface(ex.section, ex.entity)
      }

      for (const p of (data.pending ?? [])) {
        push({ kind: 'pending', pendingActionId: p.pendingActionId, summary: p.summary })
      }
    } catch {
      push({ kind: 'error', text: 'Erreur réseau. Réessayez.' })
    } finally {
      setLoading(false)
    }
  }

  async function undo(actionLogId: string) {
    try {
      const res = await fetchApi('/api/v2/assistant/undo-action', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionLogId }),
      })
      const data = await res.json()
      if (data.success && data.undone) {
        setItems(prev => prev.map(it => (it.kind === 'action' && it.actionLogId === actionLogId ? { ...it, undone: true } : it)))
        notifyInterface(data.section, data.entity)
      } else {
        push({ kind: 'error', text: data.message || 'Annulation impossible.' })
      }
    } catch {
      push({ kind: 'error', text: 'Erreur réseau lors de l’annulation.' })
    }
  }

  async function confirm(pendingActionId: string, confirmed: boolean) {
    try {
      const res = await fetchApi('/api/v2/assistant/confirm-action', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingActionId, confirmed }),
      })
      const data = await res.json()
      setItems(prev => prev.map(it =>
        it.kind === 'pending' && it.pendingActionId === pendingActionId
          ? { ...it, resolved: confirmed && data.success ? 'confirmed' : 'cancelled' }
          : it,
      ))
      if (confirmed && data.success && data.executed) {
        push({ kind: 'action', actionLogId: data.executed.actionLogId, label: data.executed.label, section: data.executed.section, entity: data.executed.entity, undoable: false, undone: false, executedAt: Date.now() })
        notifyInterface(data.executed.section, data.executed.entity)
      } else if (confirmed && !data.success) {
        push({ kind: 'error', text: data.message || 'Échec de la suppression.' })
      }
    } catch {
      push({ kind: 'error', text: 'Erreur réseau. Réessayez.' })
    }
  }

  return (
    <>
      {/* Bulle d'aide discrète — inactivité prolongée sur un écran prioritaire, widget fermé et pas de modale active */}
      {isIdle && !open && !modalActive && (
        <button
          onClick={() => setOpen(true)}
          className={`fixed z-[1199] ${isMessagerieSection ? 'bottom-[calc(200px+env(safe-area-inset-bottom,0px))] md:bottom-[152px]' : 'bottom-[calc(136px+env(safe-area-inset-bottom,0px))] md:bottom-[92px]'} right-4 md:right-6 border-[1.5px] border-[var(--border)] rounded-xl md:rounded-2xl p-2.5 md:px-4 md:py-2.5 text-[12px] md:text-[13.5px] font-bold text-[var(--text)] cursor-pointer shadow-lg flex items-center gap-2 max-w-[200px] md:max-w-[220px]`}
          style={{
            background: 'var(--surface)',
            fontFamily: 'inherit',
            animation: 'edu-nudge-in 0.3s ease both',
          }}>
          <style>{`@keyframes edu-nudge-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
          <Bot size={16} style={{ flexShrink: 0, color: 'var(--green)' }} /> {t('assistant.idle_nudge')}
        </button>
      )}

      {/* Bouton flottant — masqué quand le panneau est ouvert ou qu'une modale est active */}
      {!open && !modalActive && (
        <button
          onClick={() => setOpen(o => !o)}
          className={`fixed z-[1200] ${isMessagerieSection ? 'bottom-[calc(130px+env(safe-area-inset-bottom,0px))] md:bottom-[72px]' : 'bottom-[calc(70px+env(safe-area-inset-bottom,0px))] md:bottom-6'} right-4 md:right-6 w-[52px] h-[52px] md:w-auto md:h-[58px] rounded-[16px] md:rounded-[30px] md:px-[18px] border-none cursor-pointer flex items-center justify-center gap-2 md:gap-2.5 font-extrabold text-[14px] md:text-[15px]`}
          style={{
            background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white',
            fontFamily: 'inherit',
            boxShadow: '0 8px 24px rgba(5,150,105,0.4)',
          }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><Bot size={22} /></span>
          <span className="hidden md:inline">{t('assistant.title')}</span>
        </button>
      )}

      {/* Panneau — sous md : feuille flottante avec marges de tous côtés (pas collée aux bords),
          le FAB masqué evite le chevauchement sans avoir besoin d'ancrer la feuille au ras du bas.
          À partir de md : boîte flottante ancrée en bas à droite, inchangée. */}
      {open && (
        <>
          <div className="md:hidden" onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 1199, background: 'rgba(15,17,12,0.5)' }} />
          <div onClick={e => e.stopPropagation()}
            className="fixed z-[1200] flex flex-col overflow-hidden left-4 right-4 bottom-[calc(16px+env(safe-area-inset-bottom))] h-[60dvh] max-h-[560px] rounded-[20px] md:left-auto md:right-[24px] md:bottom-[92px] md:w-[400px] md:h-[560px] md:max-w-[calc(100vw-32px)] md:max-h-[calc(100vh-140px)] md:rounded-[18px]"
            style={{
              background: 'var(--surface)', border: '1.5px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
            }}>
          <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
          {/* Header — bouton fermer dedie dans le panneau (maquette) ; le FAB garde une icone
              fixe (ne bascule plus en X) puisque cette croix suffit desormais a fermer. */}
          <div className="gap-[10px] px-[16px] py-[13px] md:px-[18px] md:py-[16px]" style={{ background: 'linear-gradient(135deg,var(--sidebar),var(--green))', color: 'white', display: 'flex', alignItems: 'center' }}>
            <div className="w-[32px] h-[32px] md:w-9 md:h-9" style={{ borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={20} /></div>
            <div style={{ flex: 1 }}>
              <div className="text-[14.5px] md:text-[15.5px]" style={{ fontWeight: 800 }}>{t('assistant.title')}</div>
              <div className="text-[11px] md:text-[12px]" style={{ color: 'rgba(255,255,255,0.6)' }}>Décrivez une action, je l’exécute</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="flex-shrink-0"
              style={{ width: 32, height: 32, borderRadius: 16, border: 'none', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={14} color="white" />
            </button>
          </div>

          {/* Bandeau de confiance — gouvernance RBAC de l'assistant, visible en permanence */}
          <div style={{ padding: '7px 18px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>
            <Lock size={12} style={{ flexShrink: 0 }} /> Encadré par vos permissions · confirmation requise pour toute action sensible
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="p-[14px] md:p-[16px]" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
            {items.length === 0 && (
              <div>
                <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 14, display: 'flex', gap: 8 }}>
                  <Hand size={16} style={{ flexShrink: 0, marginTop: 2 }} /> <span>Bonjour ! Demandez-moi de créer une classe, une matière, d’assigner un enseignant… ou posez-moi une question sur votre établissement.</span>
                </div>
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)} style={{
                    display: 'block', width: '100%', textAlign: 'left', marginBottom: 8,
                    background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 10,
                    padding: '10px 13px', fontSize: 13.5, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                  }}>{s}</button>
                ))}
              </div>
            )}

            {items.map(it => {
              if (it.kind === 'user' || it.kind === 'assistant') {
                return (
                  <div key={it.id} style={{ display: 'flex', justifyContent: it.kind === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                    <div className="max-w-[80%] md:max-w-[82%] rounded-[14px] md:rounded-[13px] px-[13px] py-[10px] text-[14px]" style={{
                      lineHeight: 1.5, whiteSpace: 'pre-wrap',
                      background: it.kind === 'user' ? 'linear-gradient(135deg,var(--green),var(--green2))' : 'white',
                      color: it.kind === 'user' ? 'white' : 'var(--text)',
                      border: it.kind === 'user' ? 'none' : '1.5px solid var(--border)',
                    }}>{it.text}</div>
                  </div>
                )
              }

              if (it.kind === 'escalate') {
                return (
                  <div key={it.id} style={{ marginBottom: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8 }}>{it.text}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      <LifeBuoy size={15} style={{ flexShrink: 0 }} /> {it.supportContact}
                    </div>
                  </div>
                )
              }

              if (it.kind === 'error') {
                return (
                  <div key={it.id} style={{ marginBottom: 10, background: 'var(--red-light)', border: '1.5px solid var(--red-light)', borderRadius: 12, padding: '10px 13px', fontSize: 13.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} /> {it.text}
                  </div>
                )
              }

              if (it.kind === 'action') {
                const expired = Date.now() - it.executedAt > UNDO_WINDOW_MS
                const canUndo = it.undoable && !it.undone && !expired
                return (
                  <div key={it.id} style={{ marginBottom: 10, background: it.undone ? 'var(--bg2)' : 'var(--green-light)', border: `1.5px solid ${it.undone ? 'var(--border)' : 'var(--green-light)'}`, borderRadius: 12, padding: '11px 13px' }}>
                    <div style={{ fontSize: 13.5, color: it.undone ? 'var(--text3)' : 'var(--green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center' }}>{it.undone ? <Undo2 size={13} /> : <Check size={13} />}</span>
                      <span style={{ textDecoration: it.undone ? 'line-through' : 'none' }}>{it.label}</span>
                    </div>
                    {it.undone && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Action annulée.</div>}
                    {canUndo && (
                      <button onClick={() => undo(it.actionLogId)} style={{
                        marginTop: 8, background: 'var(--surface)', border: '1.5px solid var(--green-light)', color: 'var(--green2)',
                        borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}>{t('assistant.btn_cancel_action')}</button>
                    )}
                    {it.undoable && !it.undone && expired && (
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>{t('assistant.expired')}</div>
                    )}
                  </div>
                )
              }

              // pending (destructif)
              return (
                <div key={it.id} style={{ marginBottom: 10, background: 'var(--amber-light)', border: '1.5px solid var(--amber-light)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13.5, color: 'var(--amber)', lineHeight: 1.5, display: 'flex', gap: 6 }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    <span>{it.summary}</span>
                  </div>
                  {!it.resolved && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                      <button onClick={() => confirm(it.pendingActionId, true)} style={{
                        background: 'linear-gradient(135deg,var(--red),var(--red))', color: 'white', border: 'none',
                        borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}>{t('assistant.btn_confirm')}</button>
                      <button onClick={() => confirm(it.pendingActionId, false)} style={{
                        background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)',
                        borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                      }}>{t('assistant.btn_cancel')}</button>
                    </div>
                  )}
                  {it.resolved === 'confirmed' && <div style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 8, fontWeight: 700 }}>Suppression effectuée.</div>}
                  {it.resolved === 'cancelled' && <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 8 }}>Suppression annulée — rien n’a été supprimé.</div>}
                </div>
              )
            })}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 13 }}>
                <div style={{ width: 16, height: 16, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                L’assistant travaille…
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-[10px] md:p-[12px]" style={{ borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send(input)}
              placeholder="Ex. « Crée une classe de 4e D »…"
              className="rounded-[12px] md:rounded-[10px] px-[12px] py-[10px] text-[14px]"
              style={{ flex: 1, border: '1.5px solid var(--border)', outline: 'none', fontFamily: 'inherit', color: 'var(--text)' }}
            />
            <button onClick={() => send(input)} disabled={loading || !input.trim()}
              className="w-[42px] h-[42px] rounded-[12px] md:w-auto md:h-auto md:rounded-[10px] md:px-[16px]"
              style={{
                background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none',
                cursor: loading || !input.trim() ? 'default' : 'pointer',
                opacity: loading || !input.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Send size={17} /></button>
          </div>
          </div>
        </>
      )}
    </>
  )
}
