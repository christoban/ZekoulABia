'use client'

import React from 'react'
import {
  LayoutDashboard,
  ClipboardCheck,
  GraduationCap,
  Banknote,
  MessageCircle,
  Menu,
  UserPlus,
} from 'lucide-react'
import type { StaffSection } from '../_types'
import { useT } from '@/lib/i18n'
import { useUnreadMessagesCount } from '@/hooks/useUnreadMessagesCount'

interface Props {
  current: StaffSection
  onChange: (section: StaffSection) => void
  allowedSections: Set<StaffSection>
  onOpenMenu: () => void
  hasActiveEntranceExam?: boolean
}

interface BottomNavItem {
  id: StaffSection | 'more'
  targetSection?: StaffSection
  matchSections: StaffSection[]
  labelKey: string
  fallbackLabel: string
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  badge?: number
  isMenuTrigger?: boolean
}

export default function StaffBottomNav({ current, onChange, allowedSections, onOpenMenu, hasActiveEntranceExam = false }: Props) {
  const tnav = useT('navigation')
  const unreadMessages = useUnreadMessagesCount()

  const can = (s: StaffSection) => allowedSections.has(s)

  // 1. Accueil : toujours présent
  const items: BottomNavItem[] = [
    {
      id: 'dashboard',
      targetSection: 'dashboard',
      matchSections: ['dashboard'],
      labelKey: 'sidebar.dashboard',
      fallbackLabel: 'Accueil',
      icon: LayoutDashboard,
    },
  ]

  // 1b. Admissions & Concours (Secrétaire / Bursar / Intendant)
  const candidateAdmissions: StaffSection[] = hasActiveEntranceExam
    ? ['inscriptions', 'concours']
    : ['inscriptions']
  const admissionsAllowed: StaffSection[] = candidateAdmissions.filter(can)
  if (admissionsAllowed.length > 0) {
    items.push({
      id: admissionsAllowed[0]!,
      targetSection: admissionsAllowed[0]!,
      matchSections: candidateAdmissions,
      labelKey: 'sidebar.inscriptions',
      fallbackLabel: 'Admissions',
      icon: UserPlus,
    })
  }

  // 2. Vie scolaire (présences, discipline, suivi, emploi du temps)
  const vieScolaireAllowed: StaffSection[] = (['attendance', 'discipline', 'suivi-eleves', 'timetable'] as StaffSection[]).filter(can)
  if (vieScolaireAllowed.length > 0) {
    items.push({
      id: vieScolaireAllowed[0]!,
      targetSection: vieScolaireAllowed[0]!,
      matchSections: ['attendance', 'discipline', 'suivi-eleves', 'timetable'],
      labelKey: 'sidebar.attendance',
      fallbackLabel: 'Vie Scol.',
      icon: ClipboardCheck,
    })
  }

  // 3. Pédagogie / Conseils (conseils, anonymat, affectations, départements, orientation, bibliothèque)
  const pedagAllowed: StaffSection[] = (['council', 'anonymat', 'eleves-affectations', 'departements', 'orientation', 'library'] as StaffSection[]).filter(can)
  if (pedagAllowed.length > 0) {
    items.push({
      id: pedagAllowed[0]!,
      targetSection: pedagAllowed[0]!,
      matchSections: ['council', 'anonymat', 'eleves-affectations', 'departements', 'orientation', 'library'],
      labelKey: 'sidebar.council',
      fallbackLabel: 'Conseils',
      icon: GraduationCap,
    })
  }

  // 4. Finances (finance, apee)
  const financeAllowed: StaffSection[] = (['finance', 'apee'] as StaffSection[]).filter(can)
  if (financeAllowed.length > 0) {
    items.push({
      id: financeAllowed[0]!,
      targetSection: financeAllowed[0]!,
      matchSections: ['finance', 'apee'],
      labelKey: 'sidebar.finance',
      fallbackLabel: 'Finance',
      icon: Banknote,
    })
  }

  // 5. Messagerie (si autorisée)
  if (can('messagerie')) {
    items.push({
      id: 'messagerie',
      targetSection: 'messagerie',
      matchSections: ['messagerie'],
      labelKey: 'sidebar.messagerie',
      fallbackLabel: 'Messages',
      icon: MessageCircle,
      badge: unreadMessages > 0 ? unreadMessages : undefined,
    })
  }

  // Si on a moins de 5 items ou pour toujours offrir l'accès rapide à l'ensemble du drawer
  items.push({
    id: 'more',
    matchSections: [],
    labelKey: 'sidebar.menu',
    fallbackLabel: 'Menu',
    icon: Menu,
    isMenuTrigger: true,
  })

  // Limiter à 5 items maximum pour un affichage parfait sur mobile
  const finalItems = items.slice(0, 5)

  return (
    <nav
      aria-label="Navigation mobile principale staff"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] backdrop-blur-md"
      style={{
        background: 'var(--surface)',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 6,
      }}
    >
      <div className="flex items-center justify-around px-1 max-w-lg mx-auto">
        {finalItems.map(item => {
          const isActive = !item.isMenuTrigger && (item.targetSection === current || item.matchSections.includes(current))
          const Icon = item.icon
          const label = tnav(item.labelKey) || item.fallbackLabel

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
              style={{
                WebkitTapHighlightColor: 'transparent',
              }}
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
                  <span
                    className="absolute -top-1 -right-1 min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[9px] font-black px-1 text-white bg-red-500 shadow-sm"
                  >
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
