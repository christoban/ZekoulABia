'use client'

import React from 'react'
import { LayoutDashboard, BookOpen, Wallet, Users, Settings } from 'lucide-react'
import type { AdminSection } from '../_types'
import { useT } from '@/lib/i18n'

interface Props {
  current: AdminSection
  onChange: (section: AdminSection) => void
}

interface BottomNavItem {
  id: AdminSection
  matchSections: AdminSection[]
  labelKey: string
  fallbackLabel: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    id: 'dashboard',
    matchSections: ['dashboard'],
    labelKey: 'page.section_titles.dashboard',
    fallbackLabel: 'Accueil',
    icon: LayoutDashboard,
  },
  {
    id: 'pedagogie',
    matchSections: ['pedagogie', 'classes', 'subjects', 'grades', 'bulletins', 'council', 'bulletin-validation', 'academic-events'],
    labelKey: 'page.section_titles.pedagogie',
    fallbackLabel: 'Pédagogie',
    icon: BookOpen,
  },
  {
    id: 'finance',
    matchSections: ['finance', 'school-payments'],
    labelKey: 'page.section_titles.finance',
    fallbackLabel: 'Finance',
    icon: Wallet,
  },
  {
    id: 'users',
    matchSections: ['users', 'eleve-onboarding'],
    labelKey: 'page.section_titles.users',
    fallbackLabel: 'Comptes',
    icon: Users,
  },
  {
    id: 'settings',
    matchSections: ['settings', 'matricules', 'corbeille', 'sync-offline'],
    labelKey: 'page.section_titles.settings',
    fallbackLabel: 'Profil',
    icon: Settings,
  },
]

export default function AdminBottomNav({ current, onChange }: Props) {
  const t = useT('admin')

  return (
    <nav
      aria-label="Navigation mobile principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)]"
      style={{
        background: 'var(--surface)',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 6,
      }}
    >
      <div className="flex items-center justify-around px-1 max-w-lg mx-auto">
        {BOTTOM_NAV_ITEMS.map(item => {
          const isActive = item.id === current || item.matchSections.includes(current)
          const Icon = item.icon
          const label = t(item.labelKey) || item.fallbackLabel

          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-xl transition-colors border-none bg-transparent cursor-pointer min-w-[56px]"
              style={{
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                className="w-11 h-6 rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  background: isActive ? 'var(--sidebar)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text3)',
                }}
              >
                <Icon size={16} strokeWidth={isActive ? 2.4 : 2} />
              </div>
              <span
                className="text-[10.5px] tracking-tight truncate max-w-[64px]"
                style={{
                  fontWeight: isActive ? 800 : 500,
                  color: isActive ? 'var(--text)' : 'var(--text3)',
                }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
