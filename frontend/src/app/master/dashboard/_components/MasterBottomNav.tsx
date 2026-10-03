'use client'

import React from 'react'
import { LayoutDashboard, School, ShieldCheck, Shield, Menu } from 'lucide-react'
import type { Section } from '../_types'

interface Props {
  currentSection: Section
  onNav: (section: Section) => void
  onOpenMenu: () => void
}

interface BottomNavItem {
  id: Section | 'menu'
  section?: Section
  label: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  isMenuTrigger?: boolean
  dotColor?: string
}

const NAV_ITEMS: BottomNavItem[] = [
  {
    id: 'overview',
    section: 'overview',
    label: "Aperçu",
    icon: LayoutDashboard,
    dotColor: '#4ade80',
  },
  {
    id: 'schools',
    section: 'schools',
    label: "Écoles",
    icon: School,
    dotColor: '#d97706',
  },
  {
    id: 'referentiels',
    section: 'referentiels',
    label: "Référentiels",
    icon: ShieldCheck,
    dotColor: '#60a5fa',
  },
  {
    id: 'logs',
    section: 'logs',
    label: "Sécurité",
    icon: Shield,
    dotColor: '#94a3b8',
  },
  {
    id: 'menu',
    label: "Compte",
    icon: Menu,
    isMenuTrigger: true,
  },
]

export default function MasterBottomNav({ currentSection, onNav, onOpenMenu }: Props) {
  return (
    <nav
      aria-label="Navigation mobile Super Admin"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
      style={{
        background: 'var(--surface)',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 6,
      }}
    >
      <div className="flex items-center justify-around px-1 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = !item.isMenuTrigger && item.section === currentSection
          const Icon = item.icon

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.isMenuTrigger) {
                  onOpenMenu()
                } else if (item.section) {
                  onNav(item.section)
                }
              }}
              className="flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl border-none bg-transparent cursor-pointer min-w-[56px]"
              style={{
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                className="w-10 h-7 rounded-full flex items-center justify-center transition-all duration-200 relative"
                style={{
                  background: isActive ? 'var(--sidebar-bg)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text3)',
                }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.4 : 1.8} />
                {item.dotColor && !isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 6,
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: item.dotColor,
                    }}
                  />
                )}
              </div>
              <span
                className="text-[10px] tracking-tight truncate max-w-[66px]"
                style={{
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? 'var(--text)' : 'var(--text3)',
                }}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
