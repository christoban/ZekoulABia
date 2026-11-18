'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import LanguageSwitch from '@/components/LanguageSwitch'
import ThemeToggle from '@/components/ThemeToggle'
import type { LandingTexts } from './landingTexts'

interface LandingNavbarProps {
  tx: LandingTexts['nav']
  navScrolled: boolean
  mobileMenuOpen: boolean
  onToggleMobileMenu: () => void
  onCloseMobileMenu: () => void
  onLoginClick: () => void
  onOpenDemo: () => void
}

export default function LandingNavbar({
  tx,
  navScrolled,
  mobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onLoginClick,
  onOpenDemo,
}: LandingNavbarProps) {
  const navLinks = [
    { label: tx.features, href: '#fonctionnalites' },
    { label: tx.howItWorks, href: '#comment' },
    { label: tx.plans, href: '#plans' },
    { label: tx.contact, href: '#contact' },
  ]

  return (
    <>
      {/* ══════════════════════════════════════════════════
          NAVBAR — responsive mobile & desktop
      ══════════════════════════════════════════════════ */}
      <nav className="px-3 sm:px-6 lg:px-10" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        height: 56, background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'box-shadow 200ms',
        boxShadow: navScrolled ? '0 1px 8px rgba(0,0,0,0.06)' : 'none',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 0 }}>
          <img src="/logo.svg" alt="ZekoulABia" style={{ width: 28, height: 28, flexShrink: 0 }} />
          <span className="text-[16px] sm:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>ZekoulABia</span>
          <span className="hidden xl:inline-block" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 11, fontWeight: 700, borderRadius: 16, padding: '1px 8px', marginLeft: 3, whiteSpace: 'nowrap' }}>
            {tx.badge}
          </span>
        </div>

        {/* Links desktop (≥ 1024px) */}
        <div className="hidden lg:flex gap-6 xl:gap-9" style={{ alignItems: 'center' }}>
          {navLinks.map(link => (
            <a key={link.href} href={link.href} className="text-[14px] xl:text-[16px]"
              style={{ fontWeight: 600, color: 'var(--text2)', textDecoration: 'none', transition: 'color 150ms', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--primary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)' }}
            >{link.label}</a>
          ))}
        </div>

        {/* Actions à droite */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Outils visibles à partir de md */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitch compact />
          </div>

          {/* Bouton Connexion */}
          <button
            type="button"
            onClick={onLoginClick}
            className="px-2.5 py-1.5 text-[12px] sm:px-3.5 sm:py-1.5 sm:text-[13px]"
            style={{
              background: 'var(--surface)',
              color: 'var(--text2)',
              fontWeight: 700,
              borderRadius: 8,
              border: '1.5px solid var(--border2)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="hidden sm:inline">{tx.login}</span>
            <span className="sm:hidden">{tx.loginShort}</span>
          </button>

          {/* Bouton Démo */}
          <button
            type="button"
            onClick={onOpenDemo}
            className="px-3 py-1.5 text-[12px] sm:px-4 sm:py-1.5 sm:text-[13px]"
            style={{
              background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
              color: 'white',
              fontWeight: 800,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 2px 6px rgba(142,42,58,0.2)',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="hidden sm:inline">{tx.demo}</span>
            <span className="sm:hidden">{tx.demoShort}</span>
          </button>

          {/* Bouton Hamburger pour mobile (< lg) */}
          <button
            type="button"
            className="lg:hidden"
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: mobileMenuOpen ? 'var(--bg2)' : 'transparent',
              border: '1px solid var(--border)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text)',
              marginLeft: 2,
            }}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {/* Menu déroulant mobile (< lg) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="lg:hidden"
            style={{
              position: 'fixed',
              top: 56,
              left: 0,
              right: 0,
              zIndex: 99,
              background: 'var(--surface)',
              borderBottom: '1.5px solid var(--border)',
              boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {/* Liens de navigation */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={onCloseMobileMenu}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 8,
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: 'var(--text)',
                    textDecoration: 'none',
                    background: 'var(--bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{link.label}</span>
                  <ArrowRight size={14} color="var(--text3)" />
                </a>
              ))}
            </div>

            {/* Séparateur */}
            <div style={{ height: 1, background: 'var(--border)' }} />

            {/* Contrôles Thème & Langue */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>Thème & Langue</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ThemeToggle />
                <LanguageSwitch compact />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
