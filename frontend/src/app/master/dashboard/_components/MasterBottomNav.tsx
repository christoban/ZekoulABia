'use client'

import React from 'react'
import { LayoutDashboard, Building2, BookOpen, Shield, FlaskConical, Users, FileText } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { Section } from '../_types'
import { AppBottomNav } from '@/components/shell/AppBottomNav'

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
    id: 'atelier-bulletins',
    section: 'atelier-bulletins',
    labelKey: 'nav.atelier_bulletins_short',
    icon: FileText,
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
    <AppBottomNav
      ariaLabel="Navigation mobile Master"
      activeBg="var(--sidebar-bg)"
      compact
      items={visibleItems.map((item) => ({
        id: item.id,
        label: t(item.labelKey),
        icon: item.icon,
        isActive: item.section === currentSection,
        onClick: () => onNav(item.section),
      }))}
    />
  )
}
