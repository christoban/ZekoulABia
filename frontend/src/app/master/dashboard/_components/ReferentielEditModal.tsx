'use client'

import React, { useState, useEffect } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import type { ReferentielModule } from '../_types'
import {
  getDefaultReferentielFormData,
  getReferentielModalTitle,
  saveReferentielFormData,
} from './referentiels/referentielModalUtils'
import ReferentielCalendarAndTarifFields from './referentiels/ReferentielCalendarAndTarifFields'
import ReferentielCurriculumFields from './referentiels/ReferentielCurriculumFields'
import ReferentielProgressionReadOnlyView, {
  isImportedProgressionItem,
} from './referentiels/ReferentielProgressionReadOnlyView'

interface Props {
  open: boolean
  module: ReferentielModule
  item: Record<string, unknown> | null
  onClose: () => void
  onSaved: (msg: string) => void
}

export default function ReferentielEditModal({ open, module, item, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (!open) return
    setError(null)
    if (item) {
      setFormData({ ...item })
    } else {
      setFormData(getDefaultReferentielFormData(module))
    }
  }, [open, module, item])

  if (!open) return null

  const isImportedProgressionReadOnly =
    module === 'progressions' && isImportedProgressionItem(item)

  const handleChange = (key: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isImportedProgressionReadOnly) return
    setLoading(true)
    setError(null)
    try {
      const msg = await saveReferentielFormData(module, formData)
      onSaved(msg)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e5e7eb',
        fontFamily: 'var(--font-nunito), Nunito, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>
              {isImportedProgressionReadOnly
                ? 'Consulter Programme Officiel (Importé)'
                : getReferentielModalTitle(module, Boolean(item))}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Donnée de référence nationale • Garde-fou d&apos;isolation locale garanti
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
              padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
              color: '#b91c1c', fontSize: 13, fontWeight: 600,
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {(module === 'calendar' || module === 'tarifs') && (
            <ReferentielCalendarAndTarifFields
              module={module}
              formData={formData}
              onChange={handleChange}
            />
          )}

          {(module === 'bac' || module === 'templates' || (module === 'progressions' && !isImportedProgressionReadOnly)) && (
            <ReferentielCurriculumFields
              module={module}
              formData={formData}
              onChange={handleChange}
            />
          )}

          {isImportedProgressionReadOnly && item && (
            <ReferentielProgressionReadOnlyView item={item} />
          )}

          {/* Footer Buttons */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            marginTop: 12, paddingTop: 16, borderTop: '1px solid #f3f4f6',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db',
                background: 'white', color: '#374151', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isImportedProgressionReadOnly ? 'Fermer' : 'Annuler'}
            </button>
            {!isImportedProgressionReadOnly && (
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: 'var(--sidebar-bg)', color: 'white', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Save size={15} />
                {loading ? 'Enregistrement...' : 'Enregistrer le Référentiel'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
