'use client'

import React, { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  Smartphone,
  ChevronUp,
  ChevronDown,
  Clock,
} from 'lucide-react'
import EnrollmentCompletenessRing from '../EnrollmentCompletenessRing'
import {
  type StepperFormState,
  type ClasseSuggestion,
  calculerProfilAcces,
} from './types'

interface Props {
  form: StepperFormState
  suggestions: ClasseSuggestion[]
  doublonsDetectes: Array<{ id: string; nomComplet: string; dateNaissance?: string }>
  scoreCompletude: number
  piecesManquantesCount: number
}

export default function EnrollmentSidebarSummary({
  form,
  suggestions,
  doublonsDetectes,
  scoreCompletude,
  piecesManquantesCount,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const classeSelectionnee = suggestions.find((s) => s.id === form.classId)
  const profilAcces = calculerProfilAcces(
    form.level,
    form.dispositifEleve,
    form.dispositifParent,
    form.aucunTelephoneDisponible,
  )

  const alertes: string[] = []
  if (doublonsDetectes.length > 0) {
    alertes.push(`Doublon potentiel : ${doublonsDetectes[0].nomComplet} déjà enregistré.`)
  }
  if (classeSelectionnee?.estPleine) {
    alertes.push(`${classeSelectionnee.name} est complète (${classeSelectionnee.effectifActuel}/${classeSelectionnee.capacity} places). Dérogation requise.`)
  }
  if (piecesManquantesCount > 0) {
    alertes.push(`${piecesManquantesCount} pièce(s) obligatoire(s) manquante(s).`)
  }

  const nomAffiche = form.nom.trim()
    ? `${form.nom.trim()} ${form.prenom.trim()}`.trim()
    : 'Nouvel élève'

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* En-tête résumé élève & Anneau */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 12,
          borderBottom: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: 'var(--text, #111827)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {nomAffiche}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2, #4b5563)', marginTop: 2 }}>
            {form.level ? `Niveau ${form.level}` : 'Niveau non sélectionné'}
            {classeSelectionnee ? ` • ${classeSelectionnee.name}` : ''}
          </div>
        </div>
        <EnrollmentCompletenessRing
          score={scoreCompletude}
          validableSousReserve={form.validableSousReserve}
          size="md"
        />
      </div>

      {/* Alertes en direct */}
      {alertes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3, #6b7280)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Alertes en direct ({alertes.length})
          </div>
          {alertes.map((msg, i) => (
            <div
              key={i}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(234,179,8,0.12)',
                border: '1px solid rgba(234,179,8,0.3)',
                color: '#b45309',
                fontSize: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                lineHeight: 1.4,
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{msg}</span>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(22,163,74,0.08)',
            color: 'var(--green, #16a34a)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={14} />
          <span>Aucune alerte ni blocage détecté</span>
        </div>
      )}

      {/* Capacité de classe */}
      {classeSelectionnee && (
        <div
          style={{
            padding: 10,
            borderRadius: 8,
            background: 'var(--bg2, rgba(0,0,0,0.02))',
            border: '1px solid var(--border, #e5e7eb)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
            <span>Capacité {classeSelectionnee.name}</span>
            <span>{classeSelectionnee.effectifActuel} / {classeSelectionnee.capacity}</span>
          </div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'var(--border, #e5e7eb)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(100, classeSelectionnee.tauxRemplissage)}%`,
                height: '100%',
                background: classeSelectionnee.estPleine ? 'var(--red, #ef4444)' : 'var(--green, #16a34a)',
              }}
            />
          </div>
        </div>
      )}

      {/* Accès numérique calculé */}
      <div
        style={{
          padding: 10,
          borderRadius: 8,
          background: 'rgba(37,99,235,0.05)',
          border: '1px solid rgba(37,99,235,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--blue, #2563eb)', marginBottom: 4 }}>
          <Smartphone size={13} />
          <span>Accès numérique résolu</span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text2, #4b5563)', lineHeight: 1.4 }}>
          {profilAcces.phraseClaire}
        </p>
      </div>

      {/* Horodatage d'enregistrement automatique */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3, #9ca3af)', marginTop: 'auto' }}>
        <Clock size={12} />
        <span>Brouillon enregistré en direct</span>
      </div>
    </div>
  )

  return (
    <>
      {/* Panneau fixe desktop (320px) */}
      <aside
        className="hidden lg:block"
        style={{
          width: 320,
          flexShrink: 0,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 14,
          padding: 18,
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
          position: 'sticky',
          top: 24,
          alignSelf: 'flex-start',
        }}
      >
        {content}
      </aside>

      {/* Bandeau mobile dépliable en bas */}
      <div
        className="block lg:hidden"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 80,
          background: 'var(--surface, #fff)',
          borderTop: '1px solid var(--border, #e5e7eb)',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
          padding: '10px 16px',
        }}
      >
        <div
          onClick={() => setMobileOpen((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <EnrollmentCompletenessRing
              score={scoreCompletude}
              validableSousReserve={form.validableSousReserve}
              size="sm"
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)' }}>
              Résumé dossier {alertes.length > 0 ? `(${alertes.length} alerte(s))` : ''}
            </span>
          </div>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer' }}
          >
            {mobileOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>

        {mobileOpen && (
          <div style={{ marginTop: 14, maxHeight: '60vh', overflowY: 'auto' }}>
            {content}
          </div>
        )}
      </div>
    </>
  )
}
