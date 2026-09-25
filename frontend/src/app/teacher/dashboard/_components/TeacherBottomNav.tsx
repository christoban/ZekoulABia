'use client'

import React from 'react'
import { LayoutDashboard, School, ClipboardCheck, FileText, Menu } from 'lucide-react'
import type { TeacherSection } from '../_types'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'

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
    <nav
      aria-label="Navigation mobile enseignant"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] backdrop-blur-md"
      style={{
        background: 'var(--surface)',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 6,
      }}
    >
      <div className="flex items-center justify-around px-1 max-w-lg mx-auto">
        {items.map(item => {
          const isActive = !item.isMenuTrigger && (item.targetSection === current || item.matchSections.includes(current))
          const Icon = item.icon
          const label = t(item.labelKey) || item.fallbackLabel

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isMenuTrigger) {
                  onOpenMenu()
                } else if (item.targetSection) {
                  onChange(item.targetSection)
                }
              }}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl transition-colors border-none bg-transparent cursor-pointer min-w-[54px] relative"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div
                className="w-11 h-6 rounded-full flex items-center justify-center transition-all duration-200 relative"
                style={{
                  background: isActive ? 'var(--sidebar)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text3)',
                }}
              >
                <Icon size={16} strokeWidth={isActive ? 2.4 : 2} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[9px] font-black px-1 text-white bg-red-500 shadow-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className="text-[10px] tracking-tight truncate max-w-[62px]"
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
