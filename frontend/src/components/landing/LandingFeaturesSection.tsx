'use client'

import { Fragment } from 'react'
import { motion } from 'framer-motion'
import {
  CheckCircle2, Lock, Smartphone, WifiOff, School,
  FileText, Calendar, Bot, Mail, Rocket, Users, ArrowRight, ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CARD, SH } from './landingStyles'
import type { LandingTexts } from './landingTexts'

const FEATURES_ICONS: LucideIcon[] = [FileText, CheckCircle2, Smartphone, Calendar, Bot, WifiOff]
const HOWITWORKS_ICONS: LucideIcon[] = [Mail, School, Rocket]
const SECURITY_ICONS: LucideIcon[] = [ShieldCheck, Lock, Users, Bot, FileText]

interface LandingFeaturesSectionProps {
  features: LandingTexts['features']
  security: LandingTexts['security']
  howItWorks: LandingTexts['howItWorks']
}

export default function LandingFeaturesSection({
  features,
  security,
  howItWorks,
}: LandingFeaturesSectionProps) {
  return (
    <>
      {/* ══════════════════════════════════════════════════
          FEATURES — grille 3×2, cards padding 24px
      ══════════════════════════════════════════════════ */}
      <section id="fonctionnalites" className="px-4 md:px-10 py-10 md:py-14" style={{ background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 className="text-[22px] md:text-[28px]" style={{ ...SH, fontSize: undefined }}>{features.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 8 }}>{features.subtitle}</p>
          </div>

          <div className="grid-cols-1 md:grid-cols-3 gap-4 md:gap-5" style={{ display: 'grid' }}>
            {features.items.map((f, i) => {
              const Icon = FEATURES_ICONS[i]
              return (
                <motion.div key={f.title}
                  style={{ ...CARD, padding: 20, cursor: 'default' }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.12 }}
                  transition={{ duration: 0.45, delay: i * 0.07, ease: 'easeOut' }}
                  whileHover={{ y: -3, boxShadow: '0 5px 16px rgba(0,0,0,0.07)', transition: { duration: 0.18 } }}
                >
                  <div style={{ color: 'var(--primary)', marginBottom: 12 }}><Icon size={28} strokeWidth={2} /></div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>{f.desc}</div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SÉCURITÉ — grille 2×2, note légale en bas
      ═════════════════════════════════════════════════ */}
      <section id="securite" className="px-4 md:px-10 py-10 md:py-14" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 className="text-[22px] md:text-[28px]" style={{ ...SH, fontSize: undefined }}>{security.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 8 }}>{security.subtitle}</p>
          </div>

          <div className="grid-cols-1 md:grid-cols-2 gap-4 md:gap-5" style={{ display: 'grid', marginBottom: 32 }}>
            {security.items.map((s, i) => {
              const Icon = SECURITY_ICONS[i]
              return (
                <motion.div key={s.title}
                  style={{ ...CARD, padding: 20, cursor: 'default' }}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.12 }}
                  transition={{ duration: 0.45, delay: i * 0.07, ease: 'easeOut' }}
                  whileHover={{ y: -3, boxShadow: '0 5px 16px rgba(0,0,0,0.07)', transition: { duration: 0.18 } }}
                >
                  <div style={{ color: 'var(--primary)', marginBottom: 12 }}><Icon size={28} strokeWidth={2} /></div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 7 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>{s.desc}</div>
                </motion.div>
              )
            })}
          </div>

          <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', maxWidth: 720, margin: '0 auto', lineHeight: 1.6 }}>{security.note}</p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS — cercles 44px, icônes 32px
      ══════════════════════════════════════════════════ */}
      <section id="comment" className="px-4 md:px-10 py-10 md:py-14" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 className="text-[22px] md:text-[28px] mb-7 md:mb-12" style={{ ...SH, fontSize: undefined, marginBottom: undefined }}>{howItWorks.title}</h2>

          {/* md:items-start indispensable : alignItems inline s'applique à l'axe transversal,
              qui est horizontal en flex-col (mobile) — sans lui les cartes restent collées à gauche. */}
          <div className="flex-col md:flex-row gap-6 md:gap-0 md:items-start" style={{ display: 'flex' }}>
            {howItWorks.steps.map((step, i) => {
              const Icon = HOWITWORKS_ICONS[i]
              return (
                <Fragment key={i}>
                  <div className="px-2 md:px-6" style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 18, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      {i + 1}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--primary)', marginBottom: 11 }}><Icon size={32} strokeWidth={2} /></div>
                    <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                      Étape {i + 1} — {step.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 220, margin: '0 auto' }}>{step.desc}</div>
                  </div>
                  {i < howItWorks.steps.length - 1 && (
                    <div className="hidden md:block" style={{ paddingTop: 16, color: 'var(--border2)', flexShrink: 0, alignSelf: 'flex-start' }}><ArrowRight size={22} strokeWidth={2} /></div>
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
