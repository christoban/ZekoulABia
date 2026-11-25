'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, MoreHorizontal, type LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { Section } from '../../_types'

export interface MasterNavItem {
  id: Section
  labelKey: string
  icon: LucideIcon
}

interface Props {
  visibleNav: MasterNavItem[]
  currentSection: Section
  onNav: (s: Section) => void
}

function renderNavButton(
  n: MasterNavItem,
  currentSection: Section,
  onNav: (s: Section) => void,
  label: string,
) {
  const Icon = n.icon
  const active = currentSection === n.id
  return (
    <button
      key={n.id}
      type="button"
      onClick={() => onNav(n.id)}
      style={{
        padding: '6px 12px',
        borderRadius: 8,
        outline: 'none',
        background: active ? 'rgba(255, 255, 255, 0.22)' : 'transparent',
        border: active ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid transparent',
        boxShadow: active ? '0 1px 4px rgba(0, 0, 0, 0.2)' : 'none',
        color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.84)',
        fontSize: 12.5,
        fontWeight: active ? 800 : 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        transition: 'all 0.14s ease',
      }}
    >
      <Icon size={14} style={{ opacity: active ? 1 : 0.84, flexShrink: 0 }} />
      <span>{label}</span>
    </button>
  )
}

/** Barre de navigation desktop (>= xl) et tablette avec menu "Plus" (md..<xl) */
export default function MasterHeaderNavigation({ visibleNav, currentSection, onNav }: Props) {
  const t = useT('master')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const primaryNav = visibleNav.slice(0, 4)
  const overflowNav = visibleNav.slice(4)
  const isOverflowActive = overflowNav.some(n => n.id === currentSection)

  return (
    <>
      {/* Navigation >= 1280px (xl): Option A libère toute la place de droite, tous les onglets tiennent largement */}
      <nav
        className="hidden xl:flex"
        style={{
          alignItems: 'center',
          gap: 6,
          margin: '0 12px',
          flex: 1,
          minWidth: 0,
        }}
      >
        {visibleNav.map(n => renderNavButton(n, currentSection, onNav, t(n.labelKey)))}
      </nav>

      {/* Navigation md .. < xl (768px..1279px): 4 onglets principaux + menu "Plus / More" */}
      <nav
        className="hidden md:flex xl:hidden"
        style={{
          alignItems: 'center',
          gap: 6,
          margin: '0 8px',
          flex: 1,
          minWidth: 0,
        }}
      >
        {primaryNav.map(n => renderNavButton(n, currentSection, onNav, t(n.labelKey)))}
        {overflowNav.length > 0 && (
          <div ref={moreRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setMoreOpen(v => !v)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                outline: 'none',
                background: isOverflowActive || moreOpen ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                border: isOverflowActive ? '1px solid rgba(255, 255, 255, 0.28)' : '1px solid rgba(255, 255, 255, 0.14)',
                color: isOverflowActive ? '#ffffff' : 'rgba(255, 255, 255, 0.85)',
                fontSize: 12.5,
                fontWeight: isOverflowActive ? 800 : 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              <MoreHorizontal size={15} />
              <span>{t('nav.more')}</span>
              <ChevronDown
                size={13}
                style={{
                  opacity: 0.8,
                  transform: moreOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s',
                }}
              />
            </button>
            {moreOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  minWidth: 210,
                  background: 'var(--surface)',
                  border: '1px solid var(--border2)',
                  borderRadius: 10,
                  boxShadow: '0 14px 32px rgba(0, 0, 0, 0.35)',
                  padding: 6,
                  zIndex: 90,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {overflowNav.map(n => {
                  const Icon = n.icon
                  const active = currentSection === n.id
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onNav(n.id)
                        setMoreOpen(false)
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 7,
                        outline: 'none',
                        background: active ? 'var(--amber-light)' : 'transparent',
                        color: active ? 'var(--amber)' : 'var(--text)',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: active ? 800 : 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                    >
                      <Icon size={15} />
                      <span>{t(n.labelKey)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  )
}
