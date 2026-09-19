'use client'

import { useState } from 'react'
import { Settings, UserPlus, School, Clock, Link2, Lock } from 'lucide-react'
import type { StaffSection } from '../_types'

import SectionImportElevesStaff from './SectionImportElevesStaff'
import SectionClassesStaff from './SectionClassesStaff'
import SectionGrilleHoraire from './SectionGrilleHoraire'
import SectionAffectations from './SectionAffectations'
import SectionCautions from './SectionCautions'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  allowedSections: Set<StaffSection>
  initialTab?: string
}

type ConfigTab = 'import-eleves' | 'classes' | 'grille-horaire' | 'affectations' | 'cautions'

const TAB_CONFIGS: { id: ConfigTab; label: string; icon: any; perm: StaffSection }[] = [
  { id: 'import-eleves', label: 'Import & Admissions', icon: UserPlus, perm: 'import-eleves' },
  { id: 'classes', label: 'Structure des Classes', icon: School, perm: 'classes' },
  { id: 'grille-horaire', label: 'Grille horaire', icon: Clock, perm: 'grille-horaire' },
  { id: 'affectations', label: 'Affectations profs', icon: Link2, perm: 'affectations' },
  { id: 'cautions', label: 'Gestion Cautions', icon: Lock, perm: 'cautions' },
]

export default function SectionConfigurationStaff({ onToast, allowedSections, initialTab }: Props) {
  // Filtrer les onglets accessibles selon les permissions de l'utilisateur
  const availableTabs = TAB_CONFIGS.filter(t => allowedSections.has(t.perm))
  
  const defaultTab = availableTabs.length > 0
    ? (initialTab && availableTabs.some(t => t.id === initialTab) ? (initialTab as ConfigTab) : availableTabs[0].id)
    : 'classes'

  const [activeTab, setActiveTab] = useState<ConfigTab>(defaultTab)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Banner / Tab bar Header */}
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 20px 0 20px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--blue-light)',
              color: 'var(--blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Settings size={16} />
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-spectral),Spectral,serif',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                lineHeight: 1.2,
              }}
            >
              Configuration & Administration Établissement
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Paramétrage des structures, grilles horaires, affectations, cautions et admissions
            </p>
          </div>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 1 }}>
          {availableTabs.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 13px',
                  borderRadius: '8px 8px 0 0',
                  fontSize: 12.5,
                  fontWeight: isActive ? 700 : 600,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                  background: isActive ? 'var(--bg)' : 'transparent',
                  color: isActive ? 'var(--blue)' : 'var(--text2)',
                  borderBottom: isActive ? '2px solid var(--blue)' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={14} color={isActive ? 'var(--blue)' : 'var(--text3)'} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', minHeight: 0 }}>
        {activeTab === 'import-eleves' && allowedSections.has('import-eleves') && (
          <SectionImportElevesStaff onToast={onToast} />
        )}
        {activeTab === 'classes' && allowedSections.has('classes') && (
          <SectionClassesStaff onToast={onToast} />
        )}
        {activeTab === 'grille-horaire' && allowedSections.has('grille-horaire') && (
          <SectionGrilleHoraire onToast={onToast} />
        )}
        {activeTab === 'affectations' && allowedSections.has('affectations') && (
          <SectionAffectations onToast={onToast} />
        )}
        {activeTab === 'cautions' && allowedSections.has('cautions') && (
          <SectionCautions onToast={onToast} />
        )}
      </div>
    </div>
  )
}
