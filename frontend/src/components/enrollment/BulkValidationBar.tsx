'use client'

import React, { useState } from 'react'
import { CheckCircle2, X, Loader2, AlertCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  selectedIds: string[]
  onClearSelection: () => void
  onSuccess: (valides: number, echecs: number) => void
}

export default function BulkValidationBar({
  selectedIds,
  onClearSelection,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (selectedIds.length === 0) return null

  const handleBulkValidate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi('/api/v2/eleve-onboarding/bulk-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingIds: selectedIds }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        onSuccess(data.data.validesCount, data.data.echecsCount)
        onClearSelection()
      } else {
        setError(data.message || 'Erreur lors de la validation groupée')
      }
    } catch {
      setError('Erreur réseau lors de la validation groupée')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface, #1e293b)',
        color: 'var(--text, #fff)',
        padding: '12px 20px',
        borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        zIndex: 9000,
        border: '1px solid var(--border, rgba(255,255,255,0.15))',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        {selectedIds.length} dossier(s) sélectionné(s)
      </div>

      {error && (
        <div style={{ fontSize: 12, color: 'var(--red, #ef4444)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={handleBulkValidate}
          disabled={loading}
          style={{
            padding: '7px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--green, #16a34a)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Valider le lot
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          style={{
            padding: 6,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--text3, #9ca3af)',
            cursor: 'pointer',
          }}
          title="Annuler la sélection"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
