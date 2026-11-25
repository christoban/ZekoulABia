'use client'

import type { ChangeEvent, RefObject } from 'react'
import { Lock, Send } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface FilConversationInputProps {
  isStudentLocked: boolean
  draft: string
  sending: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
  onTextareaInput: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onSend: () => void
}

export function FilConversationInput({
  isStudentLocked,
  draft,
  sending,
  inputRef,
  onTextareaInput,
  onSend,
}: FilConversationInputProps) {
  const t = useT('common')

  if (isStudentLocked) {
    return (
      <div style={{
        padding: '14px 18px', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        background: 'var(--surface)', flexShrink: 0, color: 'var(--text2)',
        fontSize: 13, fontWeight: 600, textAlign: 'center',
      }}>
        <Lock size={16} style={{ color: 'var(--amber)', flexShrink: 0 }} />
        <span>
          {t('messagerie.student_announcements_notice') ?? 'Seuls les enseignants et l’administration peuvent envoyer des messages dans ce groupe.'}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      padding: '8px 10px', borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'flex-end', gap: 8,
      background: 'var(--surface)', flexShrink: 0,
    }}>
      <textarea
        ref={inputRef}
        value={draft}
        onChange={onTextareaInput}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend() } }}
        placeholder={t('messagerie.write_message') ?? 'Écrire un message...'}
        rows={1}
        style={{
          flex: 1, padding: '10px 14px', borderRadius: 20,
          border: '1.5px solid var(--border)', background: 'var(--bg)',
          color: 'var(--text)', fontSize: 13.5, fontFamily: 'inherit',
          resize: 'none', outline: 'none', lineHeight: 1.4,
          maxHeight: 120, minHeight: 40,
        }}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!draft.trim() || sending}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
          background: draft.trim() && !sending
            ? 'linear-gradient(135deg,var(--primary),var(--primary-hover))'
            : 'var(--bg2)',
          color: draft.trim() && !sending ? 'white' : 'var(--text3)',
          cursor: draft.trim() && !sending ? 'pointer' : 'default',
          transition: 'all 0.2s',
        }}
      >
        <Send size={17} style={{ marginLeft: 2 }} />
      </button>
    </div>
  )
}

