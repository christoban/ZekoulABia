'use client'

import { useState } from 'react'
import { Settings, UserPlus, School, Clock, Link2, Lock, Building2 } from 'lucide-react'
import type { StaffSection } from '../_types'
import { useT } from '@/lib/i18n'

import SectionImportElevesStaff from './SectionImportElevesStaff'
import SectionClassesStaff from './SectionClassesStaff'
import SectionRoomsStaff from './SectionRoomsStaff'
import SectionGrilleHoraire from './SectionGrilleHoraire'
import SectionAffectations from './SectionAffectations'
import SectionCautions from './SectionCautions'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  allowedSections: Set<StaffSection>
  initialTab?: string
}

type ConfigTab = 'import-eleves' | 'classes' | 'salles' | 'grille-horaire' | 'affectations' | 'cautions'

const TAB_CONFIGS: { id: ConfigTab; labelKey: string; icon: any; perm: StaffSection }[] = [
  { id: 'import-eleves', labelKey: 'config.tabs.import', icon: UserPlus, perm: 'import-eleves' },
  { id: 'classes', labelKey: 'config.tabs.classes', icon: School, perm: 'classes' },
  { id: 'salles', labelKey: 'config.tabs.rooms', icon: Building2, perm: 'classes' },
  { id: 'grille-horaire', labelKey: 'config.tabs.grid', icon: Clock, perm: 'grille-horaire' },
  { id: 'affectations', labelKey: 'config.tabs.assignments', icon: Link2, perm: 'affectations' },
  { id: 'cautions', labelKey: 'config.tabs.cautions', icon: Lock, perm: 'cautions' },
]

export default function SectionConfigurationStaff({ onToast, allowedSections, initialTab }: Props) {
  const t = useT('staff')
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
        className="px-3.5 sm:px-5 pt-3 bg-[var(--surface)] border-b border-[var(--border)] flex-shrink-0"
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
              flexShrink: 0,
            }}
          >
            <Settings size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="truncate text-sm sm:text-lg font-bold font-spectral"
              style={{
                color: 'var(--text)',
                lineHeight: 1.2,
              }}
            >
              {t('config.title')}
            </h1>
            <p className="hidden sm:block text-xs text-[var(--text3)] mt-0.5">
              {t('config.subtitle')}
            </p>
          </div>
        </div>

        {/* Tabs Bar — scrollable horizontalement sur mobile façon app native */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                <span>{t(tab.labelKey)}</span>
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
        {activeTab === 'salles' && allowedSections.has('classes') && (
          <SectionRoomsStaff onToast={onToast} />
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
