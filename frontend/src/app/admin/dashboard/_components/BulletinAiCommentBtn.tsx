'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Copy } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  studentName: string
  average: number | null
  className: string
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function BulletinAiCommentBtn({ studentName, average, className, onToast }: Props) {
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/ai/bulletin-comment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          average: average ?? 10,
          className,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.comment) throw new Error(data.message || 'Erreur génération IA')
      setComment(data.comment)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur suggestion IA', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: '4.5px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: 700,
          background: 'var(--purple-light)', color: 'var(--purple)',
          border: '1px solid var(--purple)', cursor: loading ? 'wait' : 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
        }}
      >
        {loading ? <Loader2 size={12} style={{ animation: 'edu-spin 0.8s linear infinite' }} /> : <Sparkles size={12} />}
        IA
      </button>
      {comment && (
        <div style={{ maxWidth: 260, padding: '6px 8px', borderRadius: 7, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text2)', lineHeight: 1.4 }}>
          <div>{comment}</div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(comment)
              onToast('Appréciation IA copiée', 'success')
            }}
            style={{ marginTop: 4, border: 'none', background: 'transparent', color: 'var(--primary)', fontWeight: 700, fontSize: 11, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, padding: 0 }}
          >
            <Copy size={11} /> Copier
          </button>
        </div>
      )}
    </div>
  )
}

