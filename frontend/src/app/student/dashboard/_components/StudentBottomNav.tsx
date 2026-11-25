'use client'

import React from 'react'
import { LayoutDashboard, FileText, Calendar, MessageCircle, Menu } from 'lucide-react'
import type { StudentSection } from '../_types'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'
import { useUnreadBabillardCount } from '@/hooks/useUnreadBabillardCount'
import { AppBottomNav } from '@/components/shell/AppBottomNav'

interface Props {
  current: StudentSection
  onChange: (section: StudentSection) => void
  onOpenMenu: () => void
}

interface BottomNavItem {
  id: StudentSection | 'more'
  targetSection?: StudentSection
  matchSections: StudentSection[]
  labelKey: string
  fallbackLabel: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  badge?: number
  isMenuTrigger?: boolean
}

export default function StudentBottomNav({ current, onChange, onOpenMenu }: Props) {
  const t = useT('navigation')
  const unreadMessages = useUnreadMessagesCount()
  const unreadBabillard = useUnreadBabillardCount()
  const totalUnreadComm = unreadMessages + unreadBabillard

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
      id: 'grades',
      targetSection: 'grades',
      matchSections: ['grades', 'bulletins', 'academic-profile', 'orientation'],
      labelKey: 'sidebar.grades',
      fallbackLabel: 'Notes',
      icon: FileText,
    },
    {
      id: 'timetable',
      targetSection: 'timetable',
      matchSections: ['timetable', 'attendance', 'homework'],
      labelKey: 'sidebar.timetable',
      fallbackLabel: 'Agenda',
      icon: Calendar,
    },
    {
      id: 'messagerie',
      targetSection: 'messagerie',
      matchSections: ['messagerie', 'babillard', 'notifications'],
      labelKey: 'sidebar.messagerie',
      fallbackLabel: 'Messages',
      icon: MessageCircle,
      badge: totalUnreadComm > 0 ? totalUnreadComm : undefined,
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
      ariaLabel="Navigation mobile élève"
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
