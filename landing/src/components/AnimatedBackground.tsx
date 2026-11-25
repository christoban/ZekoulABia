'use client'

/**
 * Arrière-plan animé en Canvas — deux variantes à TEINTE FIXE (non liées au thème).
 *  - variant="stars"       : ciel étoilé (bleu nuit → vert forêt), points descendants, scintillement doux.
 *  - variant="celebration" : particules dorées/vertes montantes sur dégradé radial vert forêt.
 * Respecte prefers-reduced-motion (dégradé statique, aucune animation), le resize, et nettoie le RAF au démontage.
 * Réservé aux écrans regardés brièvement (connexion, célébrations) — jamais sur les écrans de travail.
 */
import { useRef, useEffect } from 'react'

type Variant = 'stars' | 'celebration'

interface Particle {
  x: number; y: number; r: number
  speed: number; drift: number
  opacity: number; opDir: 1 | -1
  color: string // "r,g,b"
}

function paintGradient(ctx: CanvasRenderingContext2D, variant: Variant, w: number, h: number) {
  let g: CanvasGradient
  if (variant === 'stars') {
    g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#0a1622')   // bleu nuit
    g.addColorStop(0.55, '#0b1a1c')
    g.addColorStop(1, '#0c1f15')    // vert forêt profond
  } else {
    g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.72)
    g.addColorStop(0, '#1a2e1e')
    g.addColorStop(1, '#0d1a12')
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

export default function AnimatedBackground({
  variant = 'stars',
  transparent = false,
  style,
}: {
  variant?: Variant
  /** true = particules seules (pas de dégradé de fond), pour superposer sur un fond existant. */
  transparent?: boolean
  style?: React.CSSProperties
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let W = 0, H = 0
    let parts: Particle[] = []

    function initParticles() {
      if (variant === 'stars') {
        const n = Math.round(Math.min(100, Math.max(60, (W * H) / 14000)))
        parts = Array.from({ length: n }, () => ({
          x: Math.random() * W, y: Math.random() * H,
          r: 0.3 + Math.random() * 1.3,
          speed: 0.03 + Math.random() * 0.15,
          drift: 0,
          opacity: 0.15 + Math.random() * 0.6, opDir: Math.random() < 0.5 ? 1 : -1,
          color: '255,255,255',
        }))
      } else {
        const n = Math.round(Math.min(40, Math.max(28, (W * H) / 26000)))
        parts = Array.from({ length: n }, () => ({
          x: Math.random() * W, y: Math.random() * H,
          r: 0.8 + Math.random() * 2.2,
          speed: 0.04 + Math.random() * 0.14,
          drift: (Math.random() - 0.5) * 0.25,
          opacity: 0.2 + Math.random() * 0.55, opDir: Math.random() < 0.5 ? 1 : -1,
          color: Math.random() < 0.5 ? '244,196,117' : '5,150,105', // doré / vert accent
        }))
      }
    }

    function resize() {
      W = canvas!.clientWidth
      H = canvas!.clientHeight
      canvas!.width = Math.floor(W * dpr)
      canvas!.height = Math.floor(H * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      initParticles()
      if (reduce) { // statique
        if (transparent) ctx!.clearRect(0, 0, W, H)
        else paintGradient(ctx!, variant, W, H)
      }
    }

    function frame() {
      if (transparent) ctx!.clearRect(0, 0, W, H)
      else paintGradient(ctx!, variant, W, H)
      for (const p of parts) {
        // scintillement doux (variation progressive d'opacité)
        p.opacity += p.opDir * 0.005
        if (p.opacity >= 0.85) { p.opacity = 0.85; p.opDir = -1 }
        else if (p.opacity <= 0.12) { p.opacity = 0.12; p.opDir = 1 }
        // déplacement lent + boucle infinie
        if (variant === 'stars') {
          p.y += p.speed
          if (p.y - p.r > H) { p.y = -p.r; p.x = Math.random() * W }
        } else {
          p.y -= p.speed
          p.x += p.drift
          if (p.y + p.r < 0) { p.y = H + p.r; p.x = Math.random() * W }
          if (p.x < -p.r) p.x = W + p.r
          else if (p.x > W + p.r) p.x = -p.r
        }
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${p.color},${p.opacity})`
        ctx!.fill()
      }
      raf = requestAnimationFrame(frame)
    }

    resize()
    if (!reduce) raf = requestAnimationFrame(frame)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', ...style }}
    />
  )
}
