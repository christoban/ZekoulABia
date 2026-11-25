'use client'

/**
 * Bascule de langue FR/EN — affiche TOUJOURS les deux options (pas seulement la langue
 * courante), pour qu'un utilisateur anglophone repère « EN » même quand l'interface est en
 * français. Le choix est mémorisé (surcharge persistante gérée par le LanguageProvider).
 * Utilisé notamment pendant l'onboarding, où la langue de l'établissement n'est pas encore fixée.
 */
import { useLanguage, useChangeLanguage } from '@/lib/i18n'

export default function LanguageSwitch({ style, compact }: { style?: React.CSSProperties; compact?: boolean }) {
  const { lang } = useLanguage()
  const change = useChangeLanguage()

  return (
    <div
      role="group"
      aria-label="Language / Langue"
      style={{
        display: 'inline-flex', gap: compact ? 2 : 3, background: 'var(--bg2)',
        border: '1.5px solid var(--border)', borderRadius: compact ? 8 : 10, padding: compact ? 2 : 3, ...style,
      }}
    >
      {(['fr', 'en'] as const).map((l) => {
        const active = lang === l
        return (
          <button
            key={l}
            onClick={() => { if (!active) change(l) }}
            aria-pressed={active}
            style={{
              padding: compact ? '3px 8px' : '6px 14px', borderRadius: compact ? 6 : 8, border: 'none',
              cursor: active ? 'default' : 'pointer', fontFamily: 'inherit',
              fontWeight: 800, fontSize: compact ? 10 : 13, letterSpacing: '0.3px',
              background: active ? 'var(--green)' : 'transparent',
              color: active ? 'white' : 'var(--text2)',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {l === 'fr' ? 'FR' : 'EN'}
          </button>
        )
      })}
    </div>
  )
}
