'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import DemoModal from './DemoModal'
import { useLanguage } from '@/lib/i18n'
import { textsFR, textsEN } from './landing/landingTexts'
import LandingNavbar from './landing/LandingNavbar'
import LandingHeroSection from './landing/LandingHeroSection'
import LandingFeaturesSection from './landing/LandingFeaturesSection'
import LandingRolesAndPricingSection from './landing/LandingRolesAndPricingSection'
import LandingFaqAndFooterSection from './landing/LandingFaqAndFooterSection'

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
// Même mapping rôle → tableau de bord que login/page.tsx (ROLE_CONFIG) — dupliqué ici
// volontairement, ce composant reste autonome tant qu'il vit dans la même app Next.js que le
// reste du produit (voir note plus bas sur la séparation en projet marketing indépendant).
const DASHBOARD_BY_ROLE: Record<string, string> = {
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  PARENT: '/parent/dashboard',
  STUDENT: '/student/dashboard',
  STAFF: '/staff/dashboard',
}

export default function LandingPage() {
  const { lang } = useLanguage()
  const router = useRouter()
  const [navScrolled, setNavScrolled] = useState(false)
  // true tant qu'on n'a pas fini de vérifier si une session valide existe déjà — évite un flash
  // de la landing page pour un utilisateur déjà connecté qui revient sur "/" (ex. favori, lien
  // partagé). Vérification volontairement légère : présence de zekoulabia_user en localStorage
  // (même convention que les tableaux de bord existants pour hydrater sessionUser), pas un appel
  // réseau — si le token sous-jacent est en réalité expiré, le premier appel API du tableau de
  // bord déclenchera le refresh silencieux déjà en place (fetchApi.ts), ou échouera proprement.
  const [checkingSession, setCheckingSession] = useState(true)

  const tx = lang === 'fr' ? textsFR : textsEN

  const [demoOpen, setDemoOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      const role = raw ? JSON.parse(raw)?.role : null
      const dest = role ? DASHBOARD_BY_ROLE[role] : null
      if (dest) {
        const search = typeof window !== 'undefined' ? window.location.search : ''
        router.replace(`${dest}${search}`)
        return
      }
    } catch { /* localStorage absent/corrompu — afficher la landing page normalement */ }
    setCheckingSession(false)
  }, [router])

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const openDemo = () => setDemoOpen(true)

  // Rien à afficher tant qu'on vérifie/redirige — évite le flash de la landing page pour un
  // utilisateur déjà connecté (voir l'effet de vérification de session plus haut).
  if (checkingSession) return null

  return (
    <div style={{ fontFamily: 'var(--font-nunito),Nunito,sans-serif', color: 'var(--text)', background: 'var(--bg)' }}>
      <LandingNavbar
        tx={tx.nav}
        navScrolled={navScrolled}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onLoginClick={() => router.push('/login')}
        onOpenDemo={openDemo}
      />

      <LandingHeroSection hero={tx.hero} stats={tx.stats} onOpenDemo={openDemo} />

      <LandingFeaturesSection
        features={tx.features}
        security={tx.security}
        howItWorks={tx.howItWorks}
      />

      <LandingRolesAndPricingSection
        roles={tx.roles}
        pricing={tx.pricing}
        onOpenDemo={openDemo}
      />

      <LandingFaqAndFooterSection
        faq={tx.faq}
        cta={tx.cta}
        footer={tx.footer}
        onOpenDemo={openDemo}
      />

      {/* ── DEMO MODAL ───────────────────────────────── */}
      <DemoModal
        isOpen={demoOpen}
        onClose={() => setDemoOpen(false)}
        onSuccess={() => {
          setDemoOpen(false)
          setToast({ msg: 'Demande envoyée ! Nous vous contactons dans les 24h.', type: 'success' })
        }}
        onError={msg => setToast({ msg, type: 'error' })}
        lang={lang}
      />

      {/* ── TOAST ────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div key="toast"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
            style={{
              position: 'fixed', bottom: 32, right: 32, zIndex: 300,
              background: toast.type === 'success' ? 'var(--green)' : 'var(--red)',
              color: 'white', padding: '14px 22px', borderRadius: 12,
              fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
              maxWidth: 400, lineHeight: 1.5,
            }}>
            {toast.type === 'success' ? <CheckCircle2 size={18} strokeWidth={2} style={{ flexShrink: 0 }} /> : <XCircle size={18} strokeWidth={2} style={{ flexShrink: 0 }} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
