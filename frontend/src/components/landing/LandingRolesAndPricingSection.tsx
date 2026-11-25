'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  School, GraduationCap, Presentation, Users, Search, Check, Star,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { CARD, SH, btnPrimary, btnSecondary } from './landingStyles'
import type { LandingTexts } from './landingTexts'

const ROLES_ICONS: LucideIcon[] = [School, Presentation, Users, GraduationCap, Search]

interface LandingRolesAndPricingSectionProps {
  roles: LandingTexts['roles']
  pricing: LandingTexts['pricing']
  onOpenDemo: () => void
}

export default function LandingRolesAndPricingSection({
  roles,
  pricing,
  onOpenDemo,
}: LandingRolesAndPricingSectionProps) {
  const [tabRole, setTabRole] = useState(0)

  return (
    <>
      {/* ══════════════════════════════════════════════════
          ROLES — tabs + card, padding ultra-dense
      ══════════════════════════════════════════════════ */}
      <section className="px-4 md:px-10 py-10 md:py-14" style={{ background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 className="text-[22px] md:text-[28px] mb-5 md:mb-8" style={{ ...SH, fontSize: undefined, marginBottom: undefined }}>{roles.title}</h2>

          {/* Role tabs */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
            {roles.items.map((r, i) => {
              const Icon = ROLES_ICONS[i]
              return (
                <button key={i} onClick={() => setTabRole(i)}
                  style={{
                    padding: '7px 16px', fontSize: 11, fontWeight: 700, borderRadius: 20, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 150ms',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: tabRole === i ? 'var(--primary)' : 'var(--surface)',
                    color: tabRole === i ? 'white' : 'var(--text2)',
                    boxShadow: tabRole === i ? '0 3px 10px rgba(180,83,42,0.25)' : '0 1px 4px rgba(0,0,0,0.05)',
                    border: tabRole !== i ? '1px solid var(--border)' : '1px solid transparent',
                  }}>
                  <Icon size={13} strokeWidth={2} /> {r.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div key={tabRole}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
              className="px-5 md:px-8 py-5 md:py-7"
              style={{ ...CARD, padding: undefined }}>
              {(() => {
                const Icon = ROLES_ICONS[tabRole]
                return (
                  <div style={{ display: 'flex', color: 'var(--primary)', marginBottom: 10 }}><Icon size={36} strokeWidth={2} /></div>
                )
              })()}
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
                Espace {roles.items[tabRole].label}
              </div>
              <div className="grid-cols-1 md:grid-cols-2 gap-3" style={{ display: 'grid' }}>
                {roles.items[tabRole].benefits.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}><Check size={11} strokeWidth={2.5} /></div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{b}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PRICING — cards padding 20px, price 28px
      ══════════════════════════════════════════════════ */}
      <section id="plans" className="px-4 md:px-10 py-10 md:py-14" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 className="text-[22px] md:text-[28px]" style={{ ...SH, fontSize: undefined }}>{pricing.title}</h2>
            <p style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 8 }}>{pricing.subtitle}</p>
          </div>

          <div className="grid-cols-1 md:grid-cols-3 gap-4 md:gap-5" style={{ display: 'grid' }}>
            {pricing.plans.map(plan => (
              <div key={plan.name} className="px-5 md:px-6 py-5 md:py-6" style={{
                background: 'var(--surface)', borderRadius: 14,
                border: plan.recommended ? '2px solid var(--primary)' : '1px solid var(--border)',
                boxShadow: plan.recommended ? '0 8px 24px rgba(180,83,42,0.15)' : '0 2px 6px rgba(0,0,0,0.04)',
                position: 'relative',
                transition: 'transform 200ms,box-shadow 200ms',
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(-4px)'
                  el.style.boxShadow = plan.recommended ? '0 14px 32px rgba(180,83,42,0.22)' : '0 6px 20px rgba(0,0,0,0.07)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = plan.recommended ? '0 8px 24px rgba(180,83,42,0.15)' : '0 2px 6px rgba(0,0,0,0.04)'
                }}
              >
                {plan.recommended && (
                  <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: 'white', fontSize: 9, fontWeight: 900, borderRadius: 16, padding: '3px 12px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={10} strokeWidth={2} fill="currentColor" /> {pricing.recommended}
                  </div>
                )}
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{plan.name}</div>
                <div className="text-[24px] md:text-[28px]" style={{ fontWeight: 900, color: plan.recommended ? 'var(--primary)' : 'var(--text)', marginBottom: 16, lineHeight: 1 }}>{plan.price}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)' }}>
                      <span style={{ display: 'flex', color: 'var(--primary)' }}><Check size={13} strokeWidth={2.5} /></span>{f}
                    </div>
                  ))}
                </div>
                <button onClick={onOpenDemo}
                  style={plan.recommended
                    ? { ...btnPrimary, display: 'block', width: '100%', textAlign: 'center', fontSize: 12, padding: '9px 16px', borderRadius: 8 }
                    : { ...btnSecondary, display: 'block', width: '100%', textAlign: 'center', fontSize: 12, padding: '9px 16px', borderRadius: 8 }
                  }>{plan.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
