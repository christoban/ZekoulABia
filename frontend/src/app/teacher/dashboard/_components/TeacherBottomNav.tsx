'use client'

import React from 'react'
import { LayoutDashboard, School, ClipboardCheck, FileText, Menu } from 'lucide-react'
import type { TeacherSection } from '../_types'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import { AppBottomNav } from '@/components/shell/AppBottomNav'

interface Props {
  current: TeacherSection
  onChange: (section: TeacherSection) => void
  onOpenMenu: () => void
  pendingGrades?: number
}

interface BottomNavItem {
  id: TeacherSection | 'more'
  targetSection?: TeacherSection
  matchSections: TeacherSection[]
  labelKey: string
  fallbackLabel: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  badge?: number
  isMenuTrigger?: boolean
}

export default function TeacherBottomNav({ current, onChange, onOpenMenu, pendingGrades }: Props) {
  const t = useT('navigation')
  const unreadMessages = useUnreadMessagesCount()

  const items: BottomNavItem[] = [
    {
      id: 'dashboard',
      targetSection: 'dashboard',
      matchSections: ['dashboard'],
      labelKey: 'sidebar.dashboard',
      fallbackLabel: 'Accueil',
      icon: LayoutDashboard,
    },
    {
      id: 'classes',
      targetSection: 'classes',
      matchSections: ['classes', 'timetable', 'cahier-de-texte'],
      labelKey: 'sidebar.myClasses',
      fallbackLabel: 'Classes',
      icon: School,
    },
    {
      id: 'attendance',
      targetSection: 'attendance',
      matchSections: ['attendance'],
      labelKey: 'sidebar.attendance',
      fallbackLabel: 'Présences',
      icon: ClipboardCheck,
    },
    {
      id: 'grades',
      targetSection: 'grades',
      matchSections: ['grades', 'correction-anonyme'],
      labelKey: 'sidebar.grades',
      fallbackLabel: 'Notes',
      icon: FileText,
      badge: pendingGrades && pendingGrades > 0 ? pendingGrades : (unreadMessages > 0 ? unreadMessages : undefined),
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
      ariaLabel="Navigation mobile enseignant"
      items={items.map((item) => ({
        id: item.id,
        label: t(item.labelKey) || item.fallbackLabel,
        icon: item.icon,
        badge: item.badge,
        isActive: !item.isMenuTrigger && (item.targetSection === current || item.matchSections.includes(current)),
        onClick: () => {
          if (item.isMenuTrigger) onOpenMenu()
          else if (item.targetSection) onChange(item.targetSection)
        },
      }))}
    />
  )
}
