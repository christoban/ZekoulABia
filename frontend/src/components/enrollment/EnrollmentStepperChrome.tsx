'use client'

import React from 'react'
import {
  Users,
  BookOpen,
  Home,
  Smartphone,
  FileText,
  FileCheck,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  PlusCircle,
} from 'lucide-react'
import type { OrigineDossier } from './stepper/types'

const ETAPES = [
  { id: 1, label: 'Élève', icon: Users },
  { id: 2, label: 'Scolarité', icon: BookOpen },
  { id: 3, label: 'Famille', icon: Home },
  { id: 4, label: 'Accès numérique', icon: Smartphone },
  { id: 5, label: 'Pièces', icon: FileText },
  { id: 6, label: 'Récapitulatif', icon: FileCheck },
]

interface ProgressBarProps {
  etapeActive: number
  etapesValidees: number[]
  onSelectStep: (stepId: number) => void
}

export function EnrollmentStepperProgressBar({
  etapeActive,
  etapesValidees,
  onSelectStep,
}: ProgressBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--surface, #fff)',
        padding: '12px 16px',
        borderRadius: 12,
        border: '1px solid var(--border, #e5e7eb)',
        overflowX: 'auto',
        gap: 8,
      }}
    >
      {ETAPES.map((step) => {
        const isActif = etapeActive === step.id
        const isValide = etapesValidees.includes(step.id)
        return (
          <button
            key={step.id}
            type="button"
            disabled={!isValide && !isActif}
            onClick={() => isValide && onSelectStep(step.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 8,
              border: 'none',
              background: isActif ? 'rgba(37,99,235,0.08)' : 'transparent',
              color: isActif ? 'var(--blue, #2563eb)' : isValide ? 'var(--green, #16a34a)' : 'var(--text3, #9ca3af)',
              fontWeight: isActif ? 800 : 600,
              fontSize: 12,
              cursor: isValide ? 'pointer' : 'default',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isActif ? 'var(--blue, #2563eb)' : isValide ? 'var(--green, #16a34a)' : 'var(--border)',
                color: isActif || isValide ? '#fff' : 'var(--text3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {isValide ? '✓' : step.id}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        )
      })}
    </div>
  )
}

interface NavFooterProps {
  etapeActive: number
  onPrev: () => void
  onNext: () => void
  onCancel?: () => void
}

export function EnrollmentStepperNavFooter({
  etapeActive,
  onPrev,
  onNext,
  onCancel,
}: NavFooterProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 24,
        paddingTop: 16,
        borderTop: '1px solid var(--border, #e5e7eb)',
        position: 'sticky',
        bottom: 0,
        background: 'var(--surface, #fff)',
        zIndex: 20,
        paddingBottom: 12,
      }}
    >
      {etapeActive > 1 ? (
        <button
          type="button"
          onClick={onPrev}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface, #fff)',
            color: 'var(--text, #111827)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <ChevronLeft size={16} /> Précédent
        </button>
      ) : (
        onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: 'var(--text3)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
        )
      )}

      <button
        type="button"
        onClick={onNext}
        style={{
          padding: '9px 20px',
          borderRadius: 8,
          border: 'none',
          background: 'var(--blue, #2563eb)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginLeft: 'auto',
        }}
      >
        Continuer <ChevronRight size={16} />
      </button>
    </div>
  )
}

interface SuccessProps {
  nom: string
  prenom: string
  origine: OrigineDossier
  onNewDossier: () => void
  onBackToDossiers: () => void
}

export function EnrollmentStepperSuccess({
  nom,
  prenom,
  origine,
  onNewDossier,
  onBackToDossiers,
}: SuccessProps) {
  return (
    <div
      style={{
        maxWidth: 640,
        margin: '40px auto',
        background: 'var(--surface, #fff)',
        borderRadius: 14,
        padding: 32,
        border: '1px solid var(--border, #e5e7eb)',
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      }}
    >
      <CheckCircle2 size={56} style={{ color: 'var(--green, #16a34a)', margin: '0 auto 16px' }} />
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text, #111827)', margin: 0 }}>
        Dossier enregistré avec succès !
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text2, #4b5563)', margin: '10px 0 24px', lineHeight: 1.5 }}>
        Le dossier de <strong>{nom} {prenom}</strong> a été {origine === 'CONCOURS' ? 'finalisé' : 'soumis à la direction pour validation'}.
      </p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          type="button"
          onClick={onNewDossier}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <PlusCircle size={15} /> Nouveau dossier
        </button>
        <button
          type="button"
          onClick={onBackToDossiers}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--green, #16a34a)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Retour aux dossiers
        </button>
      </div>
    </div>
  )
}
