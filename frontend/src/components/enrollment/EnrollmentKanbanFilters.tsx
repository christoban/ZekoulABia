'use client'

import React from 'react'
import { Search } from 'lucide-react'

export type KanbanFiltrePuce = 'TOUS' | 'CONCOURS' | 'REJECTED' | 'EXPIRED'

interface EnrollmentKanbanFiltersProps {
  recherche: string
  onRechercheChange: (value: string) => void
  filtreClasse: string
  onFiltreClasseChange: (value: string) => void
  classesDisponibles: string[]
  filtrePuce: KanbanFiltrePuce
  onFiltrePuceChange: (value: KanbanFiltrePuce) => void
  totalCount: number
  countConcours: number
  countRefuses: number
  countExpires: number
}

export default function EnrollmentKanbanFilters({
  recherche,
  onRechercheChange,
  filtreClasse,
  onFiltreClasseChange,
  classesDisponibles,
  filtrePuce,
  onFiltrePuceChange,
  totalCount,
  countConcours,
  countRefuses,
  countExpires,
}: EnrollmentKanbanFiltersProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        background: 'var(--surface, #fff)',
        padding: 10,
        borderRadius: 10,
        border: '1px solid var(--border, #e5e7eb)',
      }}
    >
      <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--text3, #9ca3af)' }} />
          <input
            type="text"
            placeholder="Rechercher par nom, N° interne..."
            value={recherche}
            onChange={(e) => onRechercheChange(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              fontSize: 12,
            }}
          />
        </div>

        <select
          value={filtreClasse}
          onChange={(e) => onFiltreClasseChange(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            fontSize: 12,
            background: 'var(--surface, #fff)',
          }}
        >
          <option value="ALL">Toutes les classes</option>
          {classesDisponibles.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Puces de filtre rapide */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onFiltrePuceChange('TOUS')}
          style={{
            padding: '4px 10px',
            borderRadius: 16,
            border: filtrePuce === 'TOUS' ? '1px solid var(--blue, #2563eb)' : '1px solid var(--border, #e5e7eb)',
            background: filtrePuce === 'TOUS' ? 'rgba(37,99,235,0.08)' : 'transparent',
            color: filtrePuce === 'TOUS' ? 'var(--blue, #2563eb)' : 'var(--text2, #4b5563)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Tous ({totalCount})
        </button>

        {countConcours > 0 && (
          <button
            type="button"
            onClick={() => onFiltrePuceChange('CONCOURS')}
            style={{
              padding: '4px 10px',
              borderRadius: 16,
              border: filtrePuce === 'CONCOURS' ? '1px solid var(--green, #16a34a)' : '1px solid var(--border, #e5e7eb)',
              background: filtrePuce === 'CONCOURS' ? 'rgba(22,163,74,0.08)' : 'transparent',
              color: filtrePuce === 'CONCOURS' ? 'var(--green, #16a34a)' : 'var(--text2, #4b5563)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Admis à finaliser ({countConcours})
          </button>
        )}

        {countRefuses > 0 && (
          <button
            type="button"
            onClick={() => onFiltrePuceChange('REJECTED')}
            style={{
              padding: '4px 10px',
              borderRadius: 16,
              border: filtrePuce === 'REJECTED' ? '1px solid var(--red, #ef4444)' : '1px solid var(--border, #e5e7eb)',
              background: filtrePuce === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'transparent',
              color: filtrePuce === 'REJECTED' ? 'var(--red, #ef4444)' : 'var(--text2, #4b5563)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Refusés ({countRefuses})
          </button>
        )}

        {countExpires > 0 && (
          <button
            type="button"
            onClick={() => onFiltrePuceChange('EXPIRED')}
            style={{
              padding: '4px 10px',
              borderRadius: 16,
              border: filtrePuce === 'EXPIRED' ? '1px solid var(--text3)' : '1px solid var(--border, #e5e7eb)',
              background: filtrePuce === 'EXPIRED' ? 'var(--bg2)' : 'transparent',
              color: 'var(--text3)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Expirés ({countExpires})
          </button>
        )}
      </div>
    </div>
  )
}
