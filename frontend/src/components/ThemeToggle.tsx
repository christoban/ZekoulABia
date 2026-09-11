'use client'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useT } from '@/lib/i18n'

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const t = useT('common')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={mounted ? (isDark ? t('theme.toLight') : t('theme.toDark')) : undefined}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--text)',
        flexShrink: 0,
        transition: 'background 0.2s, color 0.2s, border-color 0.2s',
      }}
    >
      {mounted ? (isDark ? <Sun size={15} /> : <Moon size={15} />) : <Sun size={15} />}
    </button>
  )
}
