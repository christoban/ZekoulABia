'use client'

import { Calendar, GraduationCap, BookOpen, Layers, Coins, Search, Upload, type LucideIcon } from 'lucide-react'
import type { ReferentielModule } from '../../_types'

const MODULE_TABS: { id: ReferentielModule; label: string; icon: LucideIcon }[] = [
  { id: 'calendar', label: '1. Calendrier Officiel', icon: Calendar },
  { id: 'bac', label: '2. Coeffs BAC (92/22)', icon: GraduationCap },
  { id: 'templates', label: '3. Matières par Template', icon: Layers },
  { id: 'progressions', label: '4. Progressions Types', icon: BookOpen },
  { id: 'tarifs', label: '5. Tarifs MINESEC', icon: Coins },
]

const BAC_SERIES = ['A1', 'A2', 'A3', 'A4', 'A5', 'ABI', 'C', 'D', 'E', 'TI', 'SH', 'AC']

interface Props {
  activeModule: ReferentielModule
  onSelectModule: (mod: ReferentielModule) => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  filterSerie: string
  onFilterSerieChange: (value: string) => void
  filterNiveau: string
  onFilterNiveauChange: (value: string) => void
  filterTemplate: string
  onFilterTemplateChange: (value: string) => void
  filterSubsystem: 'FRANCOPHONE' | 'ANGLOPHONE'
  onFilterSubsystemChange: (value: 'FRANCOPHONE' | 'ANGLOPHONE') => void
  filterAnnee: string
  onFilterAnneeChange: (value: string) => void
  filterProgLevel?: string
  onFilterProgLevelChange?: (value: string) => void
  filterProgFiliere?: string
  onFilterProgFiliereChange?: (value: string) => void
  progressionLevels?: string[]
  progressionFilieres?: string[]
  onOpenImportProgressions?: () => void
}

/** Barre de sélection des 5 piliers et zone de recherche / filtres contextuels */
export default function ReferentielsFiltersBar({
  activeModule,
  onSelectModule,
  searchTerm,
  onSearchTermChange,
  filterSerie,
  onFilterSerieChange,
  filterNiveau,
  onFilterNiveauChange,
  filterTemplate,
  onFilterTemplateChange,
  filterSubsystem,
  onFilterSubsystemChange,
  filterAnnee,
  onFilterAnneeChange,
  filterProgLevel = '',
  onFilterProgLevelChange,
  filterProgFiliere = '',
  onFilterProgFiliereChange,
  progressionLevels = [],
  progressionFilieres = [],
  onOpenImportProgressions,
}: Props) {
  const selectStyle = {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 700,
    background: 'var(--bg2)',
    color: 'var(--text)',
    fontFamily: 'inherit',
  } as const

  return (
    <>
      {/* ── Sélecteur de Module (Les 5 Piliers) ──────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 14, background: 'var(--bg2)', padding: 4, borderRadius: 10,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        {MODULE_TABS.map(mod => {
          const Icon = mod.icon
          const isActive = activeModule === mod.id
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => onSelectModule(mod.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 13px', borderRadius: 8, border: 'none',
                background: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text3)',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              <Icon size={15} />
              <span>{mod.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Zone Filtres & Recherche ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: '12px 14px',
        border: '1px solid var(--border)', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, flexWrap: 'wrap' }}>
          <div className="w-full sm:w-auto sm:flex-1" style={{ position: 'relative', minWidth: 180, maxWidth: 340 }}>
            <Search size={15} color="var(--text3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher une matière, référence..."
              value={searchTerm}
              onChange={e => onSearchTermChange(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)',
                fontSize: 13, outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          {activeModule === 'bac' && (
            <>
              <select value={filterSerie} onChange={e => onFilterSerieChange(e.target.value)} className="flex-1 sm:flex-initial" style={selectStyle}>
                <option value="">Toutes séries</option>
                {BAC_SERIES.map(s => (
                  <option key={s} value={s}>Série {s}</option>
                ))}
              </select>
              <select value={filterNiveau} onChange={e => onFilterNiveauChange(e.target.value)} className="flex-1 sm:flex-initial" style={selectStyle}>
                <option value="">Tous niveaux</option>
                <option value="SECONDE">Seconde</option>
                <option value="PREMIERE">Première</option>
                <option value="TERMINALE">Terminale</option>
              </select>
            </>
          )}

          {activeModule === 'templates' && (
            <>
              <select
                value={filterSubsystem}
                onChange={e => onFilterSubsystemChange(e.target.value as 'FRANCOPHONE' | 'ANGLOPHONE')}
                className="flex-1 sm:flex-initial"
                style={selectStyle}
              >
                <option value="FRANCOPHONE">Système Francophone</option>
                <option value="ANGLOPHONE">Système Anglophone</option>
              </select>
              <input
                type="text"
                placeholder="Template (ex. LYCEE_FR)"
                value={filterTemplate}
                onChange={e => onFilterTemplateChange(e.target.value.toUpperCase())}
                className="flex-1 sm:flex-initial"
                style={{ minWidth: 130, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
              />
            </>
          )}

          {activeModule === 'progressions' && (
            <>
              <select
                aria-label="Filtrer par niveau"
                value={filterProgLevel}
                onChange={e => onFilterProgLevelChange?.(e.target.value)}
                className="flex-1 sm:flex-initial"
                style={selectStyle}
              >
                <option value="">Tous niveaux</option>
                {progressionLevels.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
              <select
                aria-label="Filtrer par filière"
                value={filterProgFiliere}
                onChange={e => onFilterProgFiliereChange?.(e.target.value)}
                className="flex-1 sm:flex-initial"
                style={selectStyle}
              >
                <option value="">Toutes filières</option>
                {progressionFilieres.map(fil => (
                  <option key={fil} value={fil}>{fil}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Template (ex. __ALL__, LYCEE_FR)"
                value={filterTemplate}
                onChange={e => onFilterTemplateChange(e.target.value.toUpperCase())}
                className="flex-1 sm:flex-initial"
                style={{ minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
              />
              {onOpenImportProgressions && (
                <button
                  type="button"
                  onClick={onOpenImportProgressions}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 13px',
                    borderRadius: 8,
                    border: '1px solid var(--primary)',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Upload size={14} />
                  <span>Importer un fichier</span>
                </button>
              )}
            </>
          )}

          {activeModule === 'tarifs' && (
            <input
              type="text"
              placeholder="Année (ex. 2026-2027)"
              value={filterAnnee}
              onChange={e => onFilterAnneeChange(e.target.value)}
              className="flex-1 sm:flex-initial"
              style={{ minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
            />
          )}
        </div>
      </div>
    </>
  )
}
