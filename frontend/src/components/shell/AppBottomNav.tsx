'use client'

import type { ComponentType } from 'react'

export interface AppBottomNavItem {
  id: string
  label: string
  icon: ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  isActive: boolean
  badge?: number
  onClick: () => void
}

interface AppBottomNavProps {
  items: ReadonlyArray<AppBottomNavItem>
  ariaLabel: string
  activeBg?: string
  compact?: boolean
}

export function AppBottomNav({
  items,
  ariaLabel,
  activeBg = 'var(--sidebar)',
  compact = false,
}: AppBottomNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={`md:hidden fixed bottom-0 left-0 right-0 border-t border-[var(--border)] backdrop-blur-md ${
        compact ? 'z-50 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]' : 'z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]'
      }`}
      style={{
        background: 'var(--surface)',
        paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        paddingTop: compact ? 5 : 6,
      }}
    >
      <div className={`flex items-center justify-around px-1 max-w-lg mx-auto ${compact ? 'overflow-x-auto' : ''}`}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={
                compact
                  ? 'flex flex-col items-center justify-center gap-0.5 py-1 px-1 rounded-xl border-none bg-transparent cursor-pointer min-w-[46px] flex-1'
                  : 'flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl transition-colors border-none bg-transparent cursor-pointer min-w-[54px] relative'
              }
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div
                className={`${compact ? 'w-9 h-7' : 'w-11 h-6'} rounded-full flex items-center justify-center transition-all duration-200 relative`}
                style={{
                  background: item.isActive ? activeBg : 'transparent',
                  color: item.isActive ? '#ffffff' : 'var(--text3)',
                }}
              >
                <Icon size={16} strokeWidth={item.isActive ? 2.4 : compact ? 1.8 : 2} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[9px] font-black px-1 text-white bg-red-500 shadow-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={`${compact ? 'text-[9.5px]' : 'text-[10px]'} tracking-tight truncate max-w-[62px]`}
                style={{
                  fontWeight: item.isActive ? 800 : compact ? 600 : 500,
                  color: item.isActive ? 'var(--text)' : 'var(--text3)',
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

