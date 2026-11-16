'use client'

import React from 'react'
import { LayoutDashboard, Users, FileText, Banknote, Menu, Calendar } from 'lucide-react'
import type { ParentSection } from '../_types'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import { AppBottomNav } from '@/components/shell/AppBottomNav'

interface Props {
  current: ParentSection
  onChange: (section: ParentSection) => void
  onOpenMenu: () => void
}

interface BottomNavItem {
  id: ParentSection | 'more'
  targetSection?: ParentSection
  matchSections: ParentSection[]
  labelKey: string
  fallbackLabel: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  badge?: number
  isMenuTrigger?: boolean
}

export default function ParentBottomNav({ current, onChange, onOpenMenu }: Props) {
  const t = useT('navigation')
  const _unreadMessages = useUnreadMessagesCount()

  const items: BottomNavItem[] = [
    {
      id: 'children',
      targetSection: 'children',
      matchSections: ['children'],
      labelKey: 'sidebar.children',
      fallbackLabel: 'Accueil',
      icon: LayoutDashboard,
    },
    {
      id: 'grades',
      targetSection: 'grades',
      matchSections: ['grades', 'attendance', 'homework', 'documents'],
      labelKey: 'sidebar.grades',
      fallbackLabel: 'Notes',
      icon: FileText,
    },
    {
      id: 'timetable',
      targetSection: 'timetable',
      matchSections: ['timetable'],
      labelKey: 'sidebar.timetable',
      fallbackLabel: 'Emploi',
      icon: Calendar,
    },
    {
      id: 'payments',
      targetSection: 'payments',
      matchSections: ['payments', 'apee'],
      labelKey: 'sidebar.payments',
      fallbackLabel: 'Paiements',
      icon: Banknote,
    },
    {
      id: 'more',
      matchSections: [],
      labelKey: 'sidebar.menu',
      fallbackLabel: 'Plus',
      icon: Menu,
      isMenuTrigger: true,
    },
  ]

  return (
    <AppBottomNav
      ariaLabel="Navigation mobile parent"
      items={items.map((item) => {
        const rawLabel = t(item.labelKey)
        const label = rawLabel && rawLabel !== item.labelKey ? rawLabel : item.fallbackLabel
        return {
          id: item.id,
          label,
          icon: item.icon,
          badge: item.badge,
          isActive: !item.isMenuTrigger && (item.targetSection === current || item.matchSections.includes(current)),
          onClick: () => {
            if (item.isMenuTrigger) onOpenMenu()
            else if (item.targetSection) onChange(item.targetSection)
          },
        }
      })}
    />
  )
}
