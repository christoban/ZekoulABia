'use client'

/**
 * Écoute l'évènement `zekoulabia:highlight` (déclenché par AssistantWidget quand une
 * réponse du copilot référence une fiche d'aide avec des `relatedSelectors`) et
 * applique un halo pulsé temporaire sur les éléments réels de la page — pas juste
 * une description textuelle. Sans effet si le sélecteur ne correspond à rien
 * (élément pas encore rendu, ex. dans une modale fermée).
 */
import { useEffect } from 'react'

const HIGHLIGHT_DURATION_MS = 3000
const HIGHLIGHT_CLASS = 'zekoulabia-help-highlight'

export default function HighlightController() {
  useEffect(() => {
    function onHighlight(e: Event) {
      const selectors = (e as CustomEvent<{ selectors?: string[] }>).detail?.selectors ?? []
      for (const selector of selectors) {
        let el: Element | null = null
        try {
          el = document.querySelector(selector)
        } catch {
          continue // sélecteur invalide — on ignore silencieusement
        }
        if (!el) continue

        el.classList.add(HIGHLIGHT_CLASS)
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => el!.classList.remove(HIGHLIGHT_CLASS), HIGHLIGHT_DURATION_MS)
      }
    }

    window.addEventListener('zekoulabia:highlight', onHighlight)
    return () => window.removeEventListener('zekoulabia:highlight', onHighlight)
  }, [])

  return (
    <style>{`
      @keyframes zekoulabia-pulse-halo {
        0%, 100% { box-shadow: 0 0 0 0 rgba(142,42,58,0.55); }
        50% { box-shadow: 0 0 0 8px rgba(142,42,58,0); }
      }
      .${HIGHLIGHT_CLASS} {
        outline: 2.5px solid var(--primary) !important;
        outline-offset: 2px;
        border-radius: 8px;
        animation: zekoulabia-pulse-halo 0.9s ease-in-out 3;
      }
    `}</style>
  )
}
