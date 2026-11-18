'use client'

import React from 'react'
import { CheckCircle2, RotateCcw, XCircle, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

export type DrawerActionType = 'VALIDATE' | 'RETURN' | 'REJECT'

interface ExecuteValidationParams {
  dossierId: string
  actionType: DrawerActionType
  commentaire: string
  derogationCapacite: boolean
}

export async function executerValidationAction({
  dossierId,
  actionType,
  commentaire,
  derogationCapacite,
}: ExecuteValidationParams): Promise<{ ok: true } | { ok: false; error: string }> {
  if (actionType === 'RETURN' && !commentaire.trim()) {
    return { ok: false, error: 'Le commentaire de renvoi est obligatoire pour guider la famille.' }
  }
  if (actionType === 'REJECT' && !commentaire.trim()) {
    return { ok: false, error: 'Le motif de rejet est obligatoire.' }
  }

  const config =
    actionType === 'VALIDATE'
      ? {
          url: `/api/v2/eleve-onboarding/${dossierId}/inscrire`,
          body: {
            derogationCapacite,
            motifDerogation: derogationCapacite ? commentaire : undefined,
          },
          failMsg: 'Échec de la validation',
          networkMsg: 'Erreur réseau lors de la validation',
        }
      : actionType === 'RETURN'
      ? {
          url: `/api/v2/eleve-onboarding/${dossierId}/return`,
          body: { commentaire },
          failMsg: 'Échec du renvoi',
          networkMsg: 'Erreur réseau',
        }
      : {
          url: `/api/v2/eleve-onboarding/${dossierId}/reject`,
          body: { reason: commentaire },
          failMsg: 'Échec du rejet',
          networkMsg: 'Erreur réseau',
        }

  try {
    const res = await fetchApi(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.body),
    })
    const data = await res.json()
    if (data.success) return { ok: true }
    return { ok: false, error: data.message || config.failMsg }
  } catch {
    return { ok: false, error: config.networkMsg }
  }
}

interface ActionFormProps {
  actionType: DrawerActionType
  commentaire: string
  derogationCapacite: boolean
  actionLoading: boolean
  onCommentaireChange: (val: string) => void
  onDerogationChange: (checked: boolean) => void
  onCancel: () => void
  onConfirm: () => void
}

export function ValidationDrawerActionForm({
  actionType,
  commentaire,
  derogationCapacite,
  actionLoading,
  onCommentaireChange,
  onDerogationChange,
  onCancel,
  onConfirm,
}: ActionFormProps) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: '1px solid var(--border, #e5e7eb)',
        background: 'var(--surface2, #f9fafb)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>
        {actionType === 'VALIDATE' && 'Confirmer la validation & inscription'}
        {actionType === 'RETURN' && 'Renvoyer le dossier à la famille'}
        {actionType === 'REJECT' && 'Rejeter définitivement la demande'}
      </div>

      {actionType === 'VALIDATE' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={derogationCapacite}
            onChange={(e) => onDerogationChange(e.target.checked)}
          />
          Forcer l&apos;inscription sous dérogation de capacité
        </label>
      )}

      {(actionType === 'RETURN' || actionType === 'REJECT' || derogationCapacite) && (
        <textarea
          rows={3}
          placeholder={
            actionType === 'RETURN'
              ? 'Commentaire précisant les pièces ou informations manquantes...'
              : 'Motif justifié...'
          }
          value={commentaire}
          onChange={(e) => onCommentaireChange(e.target.value)}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            fontSize: 12,
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--border, #e5e7eb)',
            background: 'transparent',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Annuler
        </button>

        <button
          type="button"
          disabled={actionLoading}
          onClick={onConfirm}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background:
              actionType === 'VALIDATE'
                ? 'var(--green, #16a34a)'
                : actionType === 'RETURN'
                ? '#d97706'
                : 'var(--red, #ef4444)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: actionLoading ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {actionLoading && <Loader2 size={13} className="animate-spin" />}
          Confirmer
        </button>
      </div>
    </div>
  )
}

interface FooterBarProps {
  onSelectAction: (action: DrawerActionType) => void
}

export function ValidationDrawerFooterBar({ onSelectAction }: FooterBarProps) {
  return (
    <div
      style={{
        padding: '14px 20px',
        borderTop: '1px solid var(--border, #e5e7eb)',
        background: 'var(--surface2, #f9fafb)',
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end',
      }}
    >
      <button
        type="button"
        onClick={() => onSelectAction('REJECT')}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid var(--border, #e5e7eb)',
          background: 'transparent',
          color: 'var(--red, #ef4444)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <XCircle size={14} />
        Rejeter
      </button>

      <button
        type="button"
        onClick={() => onSelectAction('RETURN')}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #d97706',
          background: 'rgba(217,119,6,0.08)',
          color: '#b45309',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <RotateCcw size={14} />
        Renvoyer
      </button>

      <button
        type="button"
        onClick={() => onSelectAction('VALIDATE')}
        style={{
          padding: '8px 16px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--green, #16a34a)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <CheckCircle2 size={14} />
        Inscrire l&apos;élève
      </button>
    </div>
  )
}
