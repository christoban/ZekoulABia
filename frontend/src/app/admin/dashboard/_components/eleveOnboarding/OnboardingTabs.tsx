'use client'

import React from 'react'
import { Clock, RotateCcw, XCircle, Archive } from 'lucide-react'
import type { TabType } from './types'

interface OnboardingTabsProps {
  activeTab: TabType
  countAValider: number
  countRenvoyes: number
  countRefuses: number
  countHistorique: number
  onSelectTab: (tab: TabType) => void
}

export default function OnboardingTabs({
  activeTab,
  countAValider,
  countRenvoyes,
  countRefuses,
  countHistorique,
  onSelectTab,
}: OnboardingTabsProps) {
  const tabs: Array<{
    id: TabType
    label: string
    icon: React.ReactNode
    activeColor: string
    count: number
    hideZeroBadge?: boolean
    badgeBg: string
    badgeColor: string
  }> = [
    {
      id: 'A_VALIDER',
      label: 'À valider',
      icon: <Clock size={15} />,
      activeColor: 'var(--green, #16a34a)',
      count: countAValider,
      badgeBg: countAValider > 0 ? 'rgba(234,179,8,0.2)' : 'var(--bg2)',
      badgeColor: countAValider > 0 ? '#b45309' : 'var(--text3)',
    },
    {
      id: 'RENVOYES',
      label: 'Renvoyés',
      icon: <RotateCcw size={15} />,
      activeColor: '#d97706',
      count: countRenvoyes,
      hideZeroBadge: true,
      badgeBg: 'rgba(245,158,11,0.2)',
      badgeColor: '#d97706',
    },
    {
      id: 'REFUSES',
      label: 'Refusés',
      icon: <XCircle size={15} />,
      activeColor: 'var(--red, #ef4444)',
      count: countRefuses,
      hideZeroBadge: true,
      badgeBg: 'rgba(239,68,68,0.15)',
      badgeColor: 'var(--red, #ef4444)',
    },
    {
      id: 'HISTORIQUE',
      label: 'Historique',
      icon: <Archive size={15} />,
      activeColor: 'var(--blue)',
      count: countHistorique,
      badgeBg: 'var(--bg2)',
      badgeColor: 'var(--text3)',
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border, #e5e7eb)',
        paddingBottom: 2,
        overflowX: 'auto',
      }}
    >
      {tabs.map((item) => {
        const isActive = activeTab === item.id
        const showBadge = !item.hideZeroBadge || item.count > 0
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: isActive ? 'var(--surface, #fff)' : 'transparent',
              borderBottom: isActive ? `2px solid ${item.activeColor}` : '2px solid transparent',
              color: isActive ? item.activeColor : 'var(--text2, #4b5563)',
              fontWeight: isActive ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {item.icon}
            <span>{item.label}</span>
            {showBadge && (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  background: item.badgeBg,
                  color: item.badgeColor,
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
