'use client'

import { useState } from 'react'
import { GraduationCap, ChevronDown } from 'lucide-react'
import AnimatedBackground from '../AnimatedBackground'
import LanguageSwitch from '@/components/LanguageSwitch'
import { DECO_BAND, SH } from './landingStyles'
import type { LandingTexts } from './landingTexts'

interface LandingFaqAndFooterSectionProps {
  faq: LandingTexts['faq']
  cta: LandingTexts['cta']
  footer: LandingTexts['footer']
  onOpenDemo: () => void
}

export default function LandingFaqAndFooterSection({
  faq,
  cta,
  footer,
  onOpenDemo,
}: LandingFaqAndFooterSectionProps) {
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  return (
    <>
      {/* ══════════════════════════════════════════════════
          FAQ — accordéon, border-radius 8px
      ══════════════════════════════════════════════════ */}
      <section className="px-4 md:px-10 py-10 md:py-14" style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 className="text-[22px] md:text-[28px] mb-6 md:mb-10" style={{ ...SH, fontSize: undefined, marginBottom: undefined }}>{faq.title}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {faq.items.map((item, i) => (
              <div key={i} style={{
                borderRadius: 8, overflow: 'hidden', transition: 'all 150ms',
                border: faqOpen === i ? '1px solid var(--primary)' : '1px solid var(--border)',
                borderLeft: faqOpen === i ? '3px solid var(--primary)' : '1px solid var(--border)',
                background: faqOpen === i ? 'var(--bg2)' : 'var(--surface)',
              }}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="px-3 md:px-4 py-3 md:py-3.5"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.q}</span>
                  <span style={{ display: 'flex', color: 'var(--primary)', transition: 'transform 150ms', transform: faqOpen === i ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, marginLeft: 12 }}><ChevronDown size={16} strokeWidth={2.5} /></span>
                </button>
                {faqOpen === i && (
                  <div className="px-3 md:px-4 pb-3 md:pb-3.5" style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, animation: 'fadeIn 0.15s ease' }}>
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          CTA FINAL — padding 60px, titre 32px
      ══════════════════════════════════════════════════ */}
      <section id="contact" style={{
        backgroundImage: 'url(https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=1600&q=80)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative',
      }}>
        {/* Overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,46,30,0.82)', zIndex: 0 }} />
        {/* Ciel étoilé superposé (teinte fixe, transparent pour préserver la photo) */}
        <AnimatedBackground variant="stars" transparent style={{ zIndex: 0 }} />
        {/* Deco band */}
        <div style={{ ...DECO_BAND, position: 'relative', zIndex: 1 }} />
        {/* Content */}
        <div className="px-4 md:px-10 py-10 md:py-16" style={{ position: 'relative', zIndex: 1, textAlign: 'center', overflow: 'hidden' }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: 24, left: '7%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(142,42,58,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 24, right: '6%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(5,150,105,0.07)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '35%', right: '18%', width: 90, height: 90, borderRadius: '50%', background: 'rgba(74,222,128,0.06)', pointerEvents: 'none' }} />

          <h2 className="text-[22px] md:text-[32px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'white', maxWidth: 600, margin: '0 auto 16px', lineHeight: 1.2 }}>
            {cta.title}
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 28 }}>
            {cta.subtitle}
          </p>
          <button onClick={onOpenDemo}
            className="px-5 md:px-8 py-2.5 md:py-3 text-[12px] md:text-[14px]"
            style={{
              background: 'var(--primary)', color: 'white',
              fontWeight: 900, borderRadius: 8,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 150ms', display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(180,83,42,0.32)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'var(--primary-hover)'
              el.style.boxShadow = '0 6px 24px rgba(180,83,42,0.48)'
              el.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'var(--primary)'
              el.style.boxShadow = '0 4px 16px rgba(180,83,42,0.32)'
              el.style.transform = 'translateY(0)'
            }}
          >
            <GraduationCap size={16} strokeWidth={2} />
            {cta.btn}
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER — padding 40px/28px, maxWidth 1000
      ══════════════════════════════════════════════════ */}
      <footer className="px-4 md:px-10 pt-8 md:pt-12 pb-6 md:pb-8" style={{ background: 'var(--sidebar2)', color: 'white' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-6 md:gap-8" style={{ display: 'grid', marginBottom: 36 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <img src="/logo.svg" alt="ZekoulABia" style={{ width: 22, height: 22, filter: 'brightness(0) invert(1)' }} />
                <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'white' }}>ZekoulABia</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', lineHeight: 1.6 }}>{footer.tagline}</div>
            </div>

            {/* Produit */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>{footer.cols.product.title}</div>
              {footer.cols.product.links.map(l => (
                <a key={l} href={l === footer.cols.product.links[2] ? '#securite' : '#'} style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 7, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Ressources */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>{footer.cols.resources.title}</div>
              {footer.cols.resources.links.map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 7, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Entreprise */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>{footer.cols.company.title}</div>
              {footer.cols.company.links.map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 7, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Contact */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>{footer.cols.contact.title}</div>
              {footer.cols.contact.info.map(l => (
                <div key={l} style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', marginBottom: 7 }}>{l}</div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>{footer.copyright}</div>
            <LanguageSwitch compact style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        </div>
      </footer>
    </>
  )
}
