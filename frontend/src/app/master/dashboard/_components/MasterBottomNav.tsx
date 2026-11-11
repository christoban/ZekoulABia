'use client'

import React from 'react'
import { LayoutDashboard, Building2, BookOpen, Shield, FlaskConical, Users } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { Section } from '../_types'

interface Props {
  currentSection: Section
  userRole?: string
  onNav: (section: Section) => void
  onOpenMenu?: () => void
}

interface BottomNavItem {
  id: Section
  section: Section
  labelKey: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
}

const NAV_ITEMS: BottomNavItem[] = [
  {
    id: 'overview',
    section: 'overview',
    labelKey: 'nav.overview_short',
    icon: LayoutDashboard,
  },
  {
    id: 'schools',
    section: 'schools',
    labelKey: 'nav.schools',
    icon: Building2,
  },
  {
    id: 'referentiels',
    section: 'referentiels',
    labelKey: 'nav.referentiels_short',
    icon: BookOpen,
  },
  {
    id: 'logs',
    section: 'logs',
    labelKey: 'nav.logs_short',
    icon: Shield,
  },
  {
    id: 'mode-test',
    section: 'mode-test',
    labelKey: 'nav.mode_test',
    icon: FlaskConical,
  },
  {
    id: 'team',
    section: 'team',
    labelKey: 'nav.team_short',
    icon: Users,
  },
]

export default function MasterBottomNav({ currentSection, userRole, onNav }: Props) {
  const t = useT('master')

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.id === 'team') return userRole === 'super_admin'
    if (item.id === 'mode-test') return userRole === 'super_admin' || userRole === 'platform_admin' || userRole === 'school_manager'
    if (item.id === 'referentiels') return userRole === 'super_admin' || userRole === 'platform_admin'
    return true
  })

  return (
    <nav
      aria-label="Navigation mobile Master"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
      style={{
        background: 'var(--surface)',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 5,
      }}
    >
      <div className="flex items-center justify-around px-1 max-w-lg mx-auto overflow-x-auto">
        {visibleItems.map((item) => {
          const isActive = item.section === currentSection
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNav(item.section)}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl border-none bg-transparent cursor-pointer min-w-[46px] flex-1"
              style={{
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                className="w-9 h-7 rounded-full flex items-center justify-center transition-all duration-200 relative"
                style={{
                  background: isActive ? 'var(--sidebar-bg)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text3)',
                }}
              >
                <Icon size={16} strokeWidth={isActive ? 2.4 : 1.8} />
              </div>
              <span
                className="text-[9.5px] tracking-tight truncate max-w-[62px]"
                style={{
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? 'var(--text)' : 'var(--text3)',
                }}
              >
                {t(item.labelKey)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
