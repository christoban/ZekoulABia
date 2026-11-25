'use client'
import { useState } from 'react'
import { BellRing, Check, CheckCircle2, Clock3, Loader2, MessageSquare, Send, X } from 'lucide-react'
import { CATEGORY_LABELS, type LiaisonEntryUi, type UnifiedInboxItemUi } from './carnetTypes'

interface CarnetEntryCardProps {
  role: 'PARENT' | 'TEACHER' | 'ADMIN' | 'STAFF'
  entry: LiaisonEntryUi
  unifiedMeta?: UnifiedInboxItemUi
  onMarkRead: (entryId: string) => Promise<void>
  onRespond: (entryId: string, confirmed: boolean | undefined, replyText: string) => Promise<void>
  onRelancer?: (entryId: string) => Promise<void>
}

export function CarnetEntryCard({
  role,
  entry,
  unifiedMeta,
  onMarkRead,
  onRespond,
  onRelancer,
}: CarnetEntryCardProps) {
  const [replyText, setReplyText] = useState('')
  const [busy, setBusy] = useState(false)

  const isParent = role === 'PARENT'
  const isRead = unifiedMeta ? unifiedMeta.isRead : entry.readReceipts.length > 0
  const confirmedByMe = unifiedMeta ? unifiedMeta.confirmedByMe : null

  const submitAction = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4 space-y-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--bg2)] text-[var(--text2)]">
              {CATEGORY_LABELS[entry.category] ?? entry.category}
            </span>
            {entry.studentName && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--blue-light)] text-[var(--blue)]">
                {entry.studentName}
              </span>
            )}
            {entry.isUrgent && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--red-light)] text-[var(--red)]">
                Urgent
              </span>
            )}
            {entry.requiresConfirmation && (
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[var(--amber-light)] text-[var(--amber)]">
                Confirmation requise
              </span>
            )}
          </div>
          <div className="text-sm font-bold text-[var(--text)]">{entry.title}</div>
          <div className="text-[11px] text-[var(--text3)]">
            {entry.authorName || entry.authorRole} · {new Date(entry.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isParent ? (
            isRead ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--green)]">
                <CheckCircle2 size={13} /> Lu
              </span>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitAction(() => onMarkRead(entry.id))}
                className="h-7 px-2.5 rounded-lg text-[11px] font-bold text-white cursor-pointer"
                style={{ background: 'var(--primary)' }}
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : "J'ai lu"}
              </button>
            )
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[var(--text3)] inline-flex items-center gap-1">
                {entry.readReceipts.length > 0 ? <CheckCircle2 size={12} className="text-[var(--green)]" /> : <Clock3 size={12} />}
                {entry.readReceipts.length} lu(s)
              </span>
              {onRelancer && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitAction(() => onRelancer(entry.id))}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-bold bg-[var(--amber-light)] text-[var(--amber)] border border-[var(--amber)]/30 inline-flex items-center gap-1 cursor-pointer"
                >
                  <BellRing size={11} /> Relancer non-lus
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs sm:text-[13px] text-[var(--text2)] whitespace-pre-line leading-relaxed">{entry.content}</p>

      {entry.requiresConfirmation && entry.confirmationPrompt && (
        <div className="text-xs font-semibold text-[var(--amber)] bg-[var(--amber-light)]/50 px-3 py-1.5 rounded-lg">
          {entry.confirmationPrompt}
        </div>
      )}

      {entry.responses.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-[var(--border)]">
          {entry.responses.map((resp) => (
            <div key={resp.id} className="text-xs bg-[var(--bg)] px-2.5 py-1.5 rounded-lg flex flex-wrap items-center gap-2">
              <span className="font-bold text-[var(--text)]">{resp.authorName || resp.authorRole} :</span>
              {resp.confirmed !== null && (
                <span
                  className="px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                  style={{
                    background: resp.confirmed ? 'var(--green-light)' : 'var(--red-light)',
                    color: resp.confirmed ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {resp.confirmed ? 'Oui / Confirmé' : 'Non / Refusé'}
                </span>
              )}
              {resp.replyText && <span className="text-[var(--text2)]">{resp.replyText}</span>}
            </div>
          ))}
        </div>
      )}

      {isParent && (
        <div className="pt-2 border-t border-[var(--border)] flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          {entry.requiresConfirmation && confirmedByMe === null && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitAction(() => onRespond(entry.id, true, replyText))}
                className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer bg-[var(--green-light)] text-[var(--green)] border border-[var(--green)]/30"
              >
                <Check size={13} /> Oui
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitAction(() => onRespond(entry.id, false, replyText))}
                className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer bg-[var(--red-light)] text-[var(--red)] border border-[var(--red)]/30"
              >
                <X size={13} /> Non
              </button>
            </div>
          )}
          <div className="flex flex-1 gap-1.5">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Ajouter une réponse ou précision..."
              className="flex-1 h-8 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs text-[var(--text)]"
            />
            <button
              type="button"
              disabled={busy || !replyText.trim()}
              onClick={() => void submitAction(async () => { await onRespond(entry.id, undefined, replyText); setReplyText('') })}
              className="h-8 px-3 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--primary)' }}
            >
              <Send size={12} /> Répondre
            </button>
          </div>
        </div>
      )}

      {!isParent && (
        <div className="pt-2 border-t border-[var(--border)] flex gap-1.5">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Répondre au parent..."
            className="flex-1 h-8 px-2.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-xs text-[var(--text)]"
          />
          <button
            type="button"
            disabled={busy || !replyText.trim()}
            onClick={() => void submitAction(async () => { await onRespond(entry.id, undefined, replyText); setReplyText('') })}
            className="h-8 px-3 rounded-lg text-xs font-bold bg-[var(--bg2)] text-[var(--text)] border border-[var(--border2)] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <MessageSquare size={12} /> Répondre
          </button>
        </div>
      )}
    </div>
  )
}

