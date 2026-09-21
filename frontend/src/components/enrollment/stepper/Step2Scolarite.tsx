'use client'

import React, { useState, useEffect } from 'react'
import {
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Info,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import {
  type StepperFormState,
  type ClasseSuggestion,
  resoudreCycle,
} from './types'

interface Props {
  form: StepperFormState
  onChange: (updates: Partial<StepperFormState>) => void
  errors: Record<string, string>
  suggestions: ClasseSuggestion[]
  loadingSuggestions: boolean
}

export default function Step2Scolarite({
  form,
  onChange,
  errors,
  suggestions,
  loadingSuggestions,
}: Props) {
  const [niveauxDisponibles, setNiveauxDisponibles] = useState<string[]>([])

  // Récupérer la liste des niveaux réels de l'établissement depuis /api/v2/classes
  useEffect(() => {
    async function loadNiveaux() {
      try {
        const res = await fetchApi('/api/v2/classes')
        const data = await res.json()
        const classes = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])
        const levels = Array.from(
          new Set(
            classes
              .map((c: any) => c.level || c.name?.split(' ')[0])
              .filter(Boolean),
          ),
        ) as string[]
        if (levels.length > 0) {
          setNiveauxDisponibles(levels)
        } else {
          // Repli canonique MINESEC si l'école démarre
          setNiveauxDisponibles(
            form.sousSysteme === 'ANGLOPHONE'
              ? ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Lower Sixth', 'Upper Sixth']
              : ['6e', '5e', '4e', '3e', '2nde', '1ere', 'Tle'],
          )
        }
      } catch {
        setNiveauxDisponibles(
          form.sousSysteme === 'ANGLOPHONE'
            ? ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Lower Sixth', 'Upper Sixth']
            : ['6e', '5e', '4e', '3e', '2nde', '1ere', 'Tle'],
        )
      }
    }
    loadNiveaux()
  }, [form.sousSysteme])

  const cycle = resoudreCycle(form.level)
  const isSecondCycle = cycle === 'SECOND_CYCLE'
  const isNiveauConcours = form.level === '6e' || form.level === 'Form 1'
  const classeActive = suggestions.find((c) => c.id === form.classId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Niveau demandé & Série si 2nd cycle */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Niveau demandé <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
          </label>
          <select
            value={form.level}
            onChange={(e) => {
              const newLevel = e.target.value
              onChange({ level: newLevel, classId: '' })
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: errors.level ? '1.5px solid var(--red, #ef4444)' : '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
              background: 'var(--surface)',
            }}
          >
            <option value="">-- Sélectionner un niveau --</option>
            {niveauxDisponibles.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
          {errors.level && <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 3 }}>{errors.level}</div>}
        </div>

        {isSecondCycle && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Série / Filière (Second cycle)
            </label>
            <select
              value={form.serie || ''}
              onChange={(e) => onChange({ serie: e.target.value })}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #e5e7eb)',
                fontSize: 13,
                background: 'var(--surface)',
              }}
            >
              <option value="">Générale / Non spécifiée</option>
              <option value="A">Série A (Lettres & Philosophie)</option>
              <option value="C">Série C (Mathématiques & Physiques)</option>
              <option value="D">Série D (Sciences de la Vie & Terre)</option>
              <option value="TI">Série TI (Technologies de l'Information)</option>
            </select>
          </div>
        )}
      </div>

      {/* Message & Motif obligatoire si niveau admet le concours et origine = HORS_CONCOURS */}
      {isNiveauConcours && form.origine === 'HORS_CONCOURS' && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: 'rgba(230,126,34,0.08)',
            border: '1px solid rgba(230,126,34,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d35400', fontSize: 12, fontWeight: 700 }}>
            <Info size={15} />
            <span>Ce niveau admet habituellement sur concours</span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text2, #4b5563)', lineHeight: 1.4 }}>
            Ce dossier sera expressément signalé <strong>« Hors concours »</strong> à la direction. Un motif est obligatoire pour la validation.
          </p>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
              Motif de candidature hors concours <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Arrivée tardive dans la région, échec ou absence au concours d'entrée..."
              value={form.motifHorsConcours || ''}
              onChange={(e) => onChange({ motifHorsConcours: e.target.value })}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: 6,
                border: errors.motifHorsConcours ? '1.5px solid var(--red, #ef4444)' : '1px solid var(--border)',
                fontSize: 12,
              }}
            />
            {errors.motifHorsConcours && (
              <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 2 }}>{errors.motifHorsConcours}</div>
            )}
          </div>
        </div>
      )}

      {/* 2. Classes proposées sous forme de cartes triées par places disponibles */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)', marginBottom: 8 }}>
          Classe proposée <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
        </label>

        {loadingSuggestions ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
            Recherche des classes et capacités disponibles...
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ padding: 16, borderRadius: 8, background: 'var(--bg2)', color: 'var(--text3)', fontSize: 12, textAlign: 'center' }}>
            {form.level ? 'Aucune classe configurée pour ce niveau.' : 'Sélectionnez un niveau ci-dessus pour voir les classes disponibles.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {suggestions.map((cls) => {
              const isSelected = form.classId === cls.id
              return (
                <div
                  key={cls.id}
                  onClick={() => onChange({ classId: cls.id })}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    border: isSelected ? '2px solid var(--green, #16a34a)' : '1px solid var(--border, #e5e7eb)',
                    background: isSelected ? 'rgba(22,163,74,0.05)' : cls.estPleine ? 'var(--bg2, #f9fafb)' : 'var(--surface, #fff)',
                    cursor: 'pointer',
                    opacity: cls.estPleine && !isSelected ? 0.75 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: isSelected ? 'var(--green, #16a34a)' : 'var(--text, #111827)' }}>
                      {cls.name}
                    </span>
                    {cls.estPleine ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--red, #ef4444)', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Lock size={10} /> Pleine
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green, #16a34a)' }}>
                        {cls.placesRestantes} place(s)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)' }}>
                    {cls.effectifActuel} / {cls.capacity} élèves ({Math.round(cls.tauxRemplissage)}%)
                  </div>
                  {cls.estPleine && (
                    <div style={{ fontSize: 10, color: '#b45309', marginTop: 4, fontWeight: 600 }}>
                      Dérogation requise
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {errors.classId && <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 4 }}>{errors.classId}</div>}
      </div>

      {/* Dérogation de capacité si la classe sélectionnée est pleine */}
      {classeActive?.estPleine && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--red, #ef4444)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.derogationCapacite}
              onChange={(e) => onChange({ derogationCapacite: e.target.checked })}
            />
            Demande de dérogation de capacité pour cette classe
          </label>
          {form.derogationCapacite && (
            <div>
              <input
                type="text"
                placeholder="Motif de dérogation de capacité obligatoire..."
                value={form.motifDerogation || ''}
                onChange={(e) => onChange({ motifDerogation: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  fontSize: 12,
                }}
              />
              {errors.motifDerogation && (
                <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 2 }}>{errors.motifDerogation}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Antécédents scolaires & options */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Établissement d'origine
          </label>
          <input
            type="text"
            placeholder="Ex: École Publique de Bafia..."
            value={form.etablissementOrigine}
            onChange={(e) => onChange({ etablissementOrigine: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', fontSize: 13 }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Dernière classe suivie
          </label>
          <input
            type="text"
            placeholder="Ex: CM2"
            value={form.derniereClasseSuivie}
            onChange={(e) => onChange({ derniereClasseSuivie: e.target.value })}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)', fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.redoublant}
            onChange={(e) => onChange({ redoublant: e.target.checked })}
          />
          Élève redoublant
        </label>
      </div>
    </div>
  )
}
