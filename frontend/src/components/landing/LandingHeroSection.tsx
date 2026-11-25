'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useMotionValue, animate as motionAnimate, useInView, useReducedMotion } from 'framer-motion'
import {
  CheckCircle2, Lock, Smartphone, WifiOff, School, GraduationCap,
  FileText, Play, Wallet, AlertTriangle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DECO_BAND, CARD, btnPrimary, btnSecondary } from './landingStyles'
import type { LandingTexts } from './landingTexts'

const STATS_ICONS: LucideIcon[] = [School, FileText, Lock, WifiOff]
const TRUST_ICONS: LucideIcon[] = [CheckCircle2, Lock, Smartphone, WifiOff]

function parseStatVal(v: string): { num: number; suffix: string } {
  const m = v.match(/^([\d\s,]+)(.*)$/)
  if (!m) return { num: 0, suffix: v }
  const num = parseInt(m[1].replace(/[\s,]/g, ''), 10)
  return { num: isNaN(num) ? 0 : num, suffix: m[2].trim() }
}

function CompteurAnime({ valeur, suffix = '' }: { valeur: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const enVue = useInView(ref, { once: true, amount: 0.5 })
  const count = useMotionValue(0)
  const [displayed, setDisplayed] = useState('0')
  const reduced = useReducedMotion()

  useEffect(() => count.on('change', (v) => setDisplayed(Math.round(v).toLocaleString('fr-FR'))), [count])

  useEffect(() => {
    if (!enVue) return
    if (reduced) { count.set(valeur); return }
    const controls = motionAnimate(count, valeur, { duration: 1.8, ease: 'easeOut' })
    return controls.stop
  }, [enVue, valeur, reduced, count])

  return <span ref={ref}>{displayed}{suffix}</span>
}

function HeroMockup() {
  const kpis: { label: string; value: string; icon: LucideIcon; bg: string; text: string }[] = [
    { label: 'Élèves présents', value: '418 / 460', icon: CheckCircle2, bg: 'var(--green-light)', text: 'var(--green)' },
    { label: 'Notes à valider', value: '12', icon: FileText, bg: 'var(--amber-light)', text: 'var(--amber)' },
    { label: 'Frais recouvrés', value: '76%', icon: Wallet, bg: 'var(--blue-light)', text: 'var(--blue)' },
    { label: 'Alertes actives', value: '3', icon: AlertTriangle, bg: 'var(--red-light)', text: 'var(--red)' },
  ]
  const bars = [
    { cls: '3ème A', pct: 92 },
    { cls: '4ème B', pct: 78 },
    { cls: 'Tle C', pct: 95 },
    { cls: '2nde D', pct: 65 },
  ]

  return (
    <div style={{ ...CARD, padding: 24, width: '100%', maxWidth: 460, boxShadow: '0 24px 72px rgba(0,0,0,0.14)', borderRadius: 20 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><GraduationCap size={16} strokeWidth={2} /></div>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>Tableau de bord — Trimestre 2</div>
        <div style={{ marginLeft: 'auto', background: 'var(--green-light)', color: 'var(--green)', fontSize: 10, fontWeight: 900, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>LIVE</div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ color: k.text, marginBottom: 3 }}><k.icon size={18} strokeWidth={2} /></div>
            <div style={{ fontSize: 19, fontWeight: 900, color: k.text, lineHeight: 1.1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: k.text, opacity: 0.7, fontWeight: 600, marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Attendance bars */}
      <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10 }}>
          <span>Présences par classe</span>
          <span>Aujourd&apos;hui</span>
        </div>
        {bars.map(row => (
          <div key={row.cls} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <div style={{ width: 46, fontSize: 10, color: 'var(--text3)', fontWeight: 700, flexShrink: 0 }}>{row.cls}</div>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 5, height: 7 }}>
              <div style={{
                width: `${row.pct}%`,
                background: row.pct >= 90 ? 'var(--green)' : row.pct >= 75 ? 'var(--amber)' : 'var(--red)',
                borderRadius: 5, height: 7, transition: 'width 600ms ease',
              }} />
            </div>
            <div style={{ width: 30, textAlign: 'right', fontSize: 10, color: 'var(--text)', fontWeight: 900, flexShrink: 0 }}>{row.pct}%</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, textAlign: 'center', fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>
        ZekoulABia · Lycée Bilingue de Yaoundé · Séquence 3
      </div>
    </div>
  )
}

interface LandingHeroSectionProps {
  hero: LandingTexts['hero']
  stats: LandingTexts['stats']
  onOpenDemo: () => void
}

export default function LandingHeroSection({ hero, stats, onOpenDemo }: LandingHeroSectionProps) {
  return (
    <>
      {/* ═══════════════════════════════════════════════════
          HERO — padding réduit, titre 32px
      ══════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--bg)', paddingTop: 56 }}>
        <div style={DECO_BAND} />
        <div className="flex-col lg:flex-row px-4 md:px-10 py-10 md:py-14 gap-6 lg:gap-12" style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          {/* Left */}
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ display: 'inline-block', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 10, fontWeight: 900, borderRadius: 16, padding: '4px 12px', marginBottom: 18 }}>
              {hero.badge}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' }}
              className="text-[32px] md:text-[32px]"
              style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', lineHeight: 1.05, maxWidth: 600, marginBottom: 16 }}>
              {hero.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18, ease: 'easeOut' }}
              style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 480, lineHeight: 1.5, marginBottom: 22, fontWeight: 500 }}>
              {hero.subtitle}
            </motion.p>
            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.26, ease: 'easeOut' }}
              style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              <motion.button onClick={onOpenDemo}
                style={{ ...btnPrimary, fontSize: 13, padding: '9px 20px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                whileHover={{ scale: 1.03, boxShadow: '0 4px 14px rgba(142,42,58,0.3)' }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              ><GraduationCap size={14} strokeWidth={2} />{hero.cta1}</motion.button>
              <a href="#comment" style={{ ...btnSecondary, fontSize: 13, padding: '9px 20px', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Play size={13} strokeWidth={2} />{hero.cta2}</a>
            </motion.div>
            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.36 }}
              style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {hero.trust.map((badge, i) => {
                const Icon = TRUST_ICONS[i]
                return (
                  <span key={badge} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>
                    <Icon size={12} strokeWidth={2} />{badge}
                  </span>
                )
              })}
            </motion.div>
          </div>

          {/* Right — mockup flottant */}
          <motion.div className="w-full lg:w-auto" style={{ flexShrink: 0 }}
            initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.12, ease: 'easeOut' }}>
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}>
              <HeroMockup />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STATS — chiffres 28px, padding réduit
      ═════════════════════════════════════════════════ */}
      <section className="px-4 md:px-10 py-8 md:py-12" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5" style={{ maxWidth: 1000, margin: '0 auto', display: 'grid' }}>
          {stats.items.map((s, i) => {
            const { num, suffix } = parseStatVal(s.value)
            const Icon = STATS_ICONS[i]
            return (
              <motion.div key={s.label} style={{ textAlign: 'center' }}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: i * 0.07, ease: 'easeOut' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--primary)', marginBottom: 5 }}><Icon size={28} strokeWidth={2} /></div>
                <div className="text-[28px] md:text-[28px]" style={{ fontFamily: 'var(--font-nunito),Nunito,sans-serif', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
                  <CompteurAnime valeur={num} suffix={suffix} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 5 }}>{s.label}</div>
              </motion.div>
            )
          })}
        </div>
      </section>
    </>
  )
}
