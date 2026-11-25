'use client'

import React from 'react'
import { LayoutDashboard, BookOpen, Wallet, Users, Menu } from 'lucide-react'
import type { AdminSection } from '../_types'
import { useT } from '@/lib/i18n'
import { AppBottomNav } from '@/components/shell/AppBottomNav'

interface Props {
  current: AdminSection
  onChange: (section: AdminSection) => void
  onOpenMenu: () => void
}

interface BottomNavItem {
  id: AdminSection | 'more'
  targetSection?: AdminSection
  matchSections: AdminSection[]
  labelKey: string
  fallbackLabel: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  isMenuTrigger?: boolean
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  {
    id: 'dashboard',
    targetSection: 'dashboard',
    matchSections: ['dashboard'],
    labelKey: 'page.section_titles.dashboard',
    fallbackLabel: 'Accueil',
    icon: LayoutDashboard,
  },
  {
    id: 'pedagogie',
    targetSection: 'pedagogie',
    matchSections: ['pedagogie', 'classes', 'subjects', 'grades', 'bulletins', 'council', 'bulletin-validation', 'academic-events'],
    labelKey: 'page.section_titles.pedagogie',
    fallbackLabel: 'Pédagogie',
    icon: BookOpen,
  },
  {
    id: 'finance',
    targetSection: 'finance',
    matchSections: ['finance', 'school-payments'],
    labelKey: 'page.section_titles.finance',
    fallbackLabel: 'Finance',
    icon: Wallet,
  },
  {
    id: 'users',
    targetSection: 'users',
    matchSections: ['users', 'eleve-onboarding'],
    labelKey: 'page.section_titles.users',
    fallbackLabel: 'Comptes',
    icon: Users,
  },
  {
    id: 'more',
    matchSections: [],
    labelKey: 'sidebar.menu',
    fallbackLabel: 'Menu',
    icon: Menu,
    isMenuTrigger: true,
  },
]

export default function AdminBottomNav({ current, onChange, onOpenMenu }: Props) {
  const t = useT('admin')
  const tnav = useT('navigation')

  return (
    <AppBottomNav
      ariaLabel="Navigation mobile principale"
      items={BOTTOM_NAV_ITEMS.map((item) => ({
        id: item.id,
        label: item.isMenuTrigger
          ? (tnav(item.labelKey) || item.fallbackLabel)
          : (t(item.labelKey) || item.fallbackLabel),
        icon: item.icon,
        isActive: !item.isMenuTrigger && (item.targetSection === current || item.matchSections.includes(current)),
        onClick: () => {
          if (item.isMenuTrigger) onOpenMenu()
          else if (item.targetSection) onChange(item.targetSection)
        },
      }))}
    />
  )
}
