'use client'

import React from 'react'
import { LayoutDashboard, Users, FileText, Banknote, Menu } from 'lucide-react'
import type { ParentSection } from '../_types'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'

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
      matchSections: ['grades', 'attendance'],
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
      icon: Users,
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
    <nav
      aria-label="Navigation mobile parent"
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
