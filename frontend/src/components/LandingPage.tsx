'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, animate as motionAnimate, useInView, useReducedMotion } from 'framer-motion'
import {
  CheckCircle2, XCircle, Lock, Smartphone, WifiOff, School, GraduationCap, Presentation,
  FileText, Calendar, Bot, Mail, Rocket, Users, Search, Check, Star, ArrowRight, Play,
  ChevronDown, Wallet, AlertTriangle, ShieldCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import DemoModal from './DemoModal'
import AnimatedBackground from './AnimatedBackground'
import LanguageSwitch from '@/components/LanguageSwitch'
import { useLanguage } from '@/lib/i18n'

// Lookup tables for data-driven emoji-as-icon fields (same order FR/EN — see textsFR/textsEN below)
const STATS_ICONS: LucideIcon[] = [School, FileText, Lock, WifiOff]
const FEATURES_ICONS: LucideIcon[] = [FileText, CheckCircle2, Smartphone, Calendar, Bot, WifiOff]
const HOWITWORKS_ICONS: LucideIcon[] = [Mail, School, Rocket]
const ROLES_ICONS: LucideIcon[] = [School, Presentation, Users, GraduationCap, Search]
const TRUST_ICONS: LucideIcon[] = [CheckCircle2, Lock, Smartphone, WifiOff]
const SECURITY_ICONS: LucideIcon[] = [ShieldCheck, Lock, Users, Bot, FileText]

// ─────────────────────────────────────────────────────────────────────────────
// TRANSLATIONS
// ─────────────────────────────────────────────────────────────────────────────
const textsFR = {
  nav: {
    badge: 'MINESEC Cameroun',
    features: 'Fonctionnalités',
    howItWorks: 'Comment ça marche',
    plans: 'Plans',
    contact: 'Contact',
    demo: 'Demander une démo',
    login: 'Se connecter',
  },
  hero: {
    badge: '🇨🇲 Plateforme officielle · Système MINESEC Cameroun',
    title: 'La plateforme scolaire de référence au Cameroun',
    subtitle:
      'ZekoulABia centralise la gestion de votre établissement : notes, présences, bulletins, emploi du temps et paiements Mobile Money. Conforme MINESEC.',
    cta1: 'Demander une démo gratuite',
    cta2: 'Voir comment ça marche',
    trust: ['Conforme MINESEC', 'Données hébergées en Afrique', 'MTN MoMo & Orange Money', 'Mode hors-ligne inclus'],
  },
  stats: {
    items: [
      { value: '19', label: "Types d'établissements couverts" },
      { value: '6', label: 'Modèles de bulletins conformes MINESEC' },
      { value: '3', label: "Facteurs d'authentification (MFA)" },
      { value: '100%', label: 'Fonctionnel hors ligne' },
    ],
  },
  features: {
    title: 'Tout ce dont votre école a besoin',
    subtitle: 'Pensé pour le système éducatif camerounais',
    items: [
      { title: 'Notes & Bulletins', desc: 'Coefficients BAC MINESEC, calcul automatique des moyennes, bulletins PDF générés en un clic.' },
      { title: 'Présences intelligentes', desc: "Saisie rapide par l'enseignant, alertes SMS aux parents, statistiques en temps réel." },
      { title: 'Mobile Money intégré', desc: 'MTN MoMo & Orange Money via Campay. Rappels automatiques aux parents en retard de paiement.' },
      { title: 'Emploi du temps', desc: 'Détection de conflits (Loi 7 MINESEC ≤14h/AP), sous-groupes TP, publication en un clic.' },
      { title: 'IA Santé Scolaire', desc: 'Score 0-100 par élève : notes, présences, paiements, comportement. Alertes préventives Groq AI.' },
      { title: 'Mode hors-ligne', desc: 'Fonctionne sans internet (IndexedDB + service worker). Synchronisation automatique au retour du réseau.' },
    ],
  },
  security: {
    title: 'Sécurité et protection des données',
    subtitle: "Pensé dès la conception pour des données d'élèves mineurs",
    items: [
      { title: 'Double authentification obligatoire', desc: "Mot de passe, code email et application d'authentification (TOTP) à chaque connexion pour les comptes Administrateur, Staff et Enseignant — configuration forcée dès la première connexion, jamais désactivable." },
      { title: 'Isolation stricte par établissement', desc: "Chaque école est cloisonnée : aucune donnée n'est jamais accessible à un autre établissement, à aucun niveau du système." },
      { title: "Contrôle d'accès granulaire", desc: "Chaque rôle (Censeur, Intendant, Surveillant Général...) n'accède qu'aux fonctions qui lui sont explicitement autorisées." },
      { title: 'IA gouvernée, jamais autonome', desc: "L'assistant intelligent ne peut jamais exécuter une action au-delà des permissions réelles de l'utilisateur, et demande toujours confirmation avant une action sensible." },
      { title: 'Traçabilité complète', desc: 'Chaque action sensible est journalisée et consultable, pour un audit transparent à tout moment.' },
    ],
    note: "ZekoulABia est conçu dans l'esprit de la Loi n°2010/012 relative à la cybersécurité et à la cybercriminalité, et de la Loi n°2024/017 relative à la protection des données à caractère personnel au Cameroun.",
  },
  howItWorks: {
    title: 'Opérationnel en 72 heures',
    steps: [
      { title: 'Invitation', desc: "L'équipe ZekoulABia envoie une invitation à votre directeur. Lien d'activation valable 72 heures." },
      { title: 'Onboarding guidé', desc: 'Configurez classes, matières, enseignants. Notre assistant vous guide étape par étape.' },
      { title: 'Tout le monde connecté', desc: 'Chaque rôle accède à son espace dédié. Enseignants, parents et élèves reçoivent leurs accès.' },
    ],
  },
  roles: {
    title: 'Un espace dédié pour chaque acteur',
    items: [
      {
        label: 'Proviseur',
        benefits: ["Vue d'ensemble : KPIs, présences, recouvrement en temps réel", 'Gestion des utilisateurs, classes et matières', 'Clôture d\'année avec promotions automatiques MINESEC', 'Configuration complète de l\'établissement'],
      },
      {
        label: 'Enseignant',
        benefits: ['Saisie des présences en 2 minutes chrono', 'Notes par séquence avec calcul automatique', 'Emploi du temps personnel + alertes conflits', 'Demandes de rattrapage en un clic'],
      },
      {
        label: 'Parent',
        benefits: ['Suivi des notes et bulletins de ses enfants', 'Alertes absences en temps réel par SMS', "Paiements Mobile Money MTN/Orange depuis l'app", "Communication directe avec l'établissement"],
      },
      {
        label: 'Élève',
        benefits: ['Notes, moyennes et bulletins disponibles 24h/24', 'Emploi du temps personnel', 'Examens en ligne soumis directement dans la plateforme', 'Accessible hors-ligne'],
      },
      {
        label: 'Censeur',
        benefits: ['Validation des notes des enseignants', 'Conseil de classe avec décisions de promotion', 'Gestion des cautions et discipline', 'Mobile Money : suivi des impayés et rappels'],
      },
    ],
  },
  pricing: {
    title: 'Des plans adaptés à chaque établissement',
    subtitle: 'Démarrez gratuitement, sans carte bancaire',
    recommended: 'RECOMMANDÉ',
    plans: [
      { name: 'Découverte', price: 'Gratuit', recommended: false, features: ['50 élèves max', '2 classes', 'Notes & Présences', 'Support communautaire'], cta: 'Commencer gratuitement' },
      { name: 'Standard', price: 'Sur devis', recommended: true, features: ['300 élèves', 'Classes illimitées', 'Toutes fonctionnalités', 'Mobile Money', 'Support prioritaire'], cta: 'Demander un devis' },
      { name: 'Premium', price: 'Sur devis', recommended: false, features: ['Élèves illimités', 'IA Santé Scolaire', 'Multi-établissements', 'Support dédié + formation'], cta: "Contacter l'équipe" },
    ],
  },
  faq: {
    title: 'Questions fréquentes',
    items: [
      { q: 'ZekoulABia est-il conforme au MINESEC ?', a: 'Oui. Coefficients BAC, séquences, notes /20, seuils Art. 48 — préconfiguré selon les arrêtés MINESEC en vigueur.' },
      { q: 'Faut-il internet en permanence ?', a: 'Non. Mode hors-ligne complet (IndexedDB + PWA). Synchronisation automatique dès le retour du réseau.' },
      { q: 'Comment fonctionne le Mobile Money ?', a: "Via Campay (MTN MoMo & Orange Money). Paiement depuis le téléphone, confirmation en temps réel pour l'intendant." },
      { q: 'Combien de temps pour mettre en place ZekoulABia ?', a: '72 heures en moyenne avec l\'accompagnement de notre équipe.' },
      { q: 'Les données des élèves sont-elles sécurisées ?', a: 'Isolation stricte par établissement, hébergement en Afrique, chiffrement TLS, double authentification obligatoire pour les comptes Admin/Staff/Enseignant. Voir notre section Sécurité.' },
    ],
  },
  cta: {
    title: 'Rejoignez les établissements qui font confiance à ZekoulABia',
    subtitle: "Période d'essai gratuite · Aucune carte bancaire · Démarrage en 72h",
    btn: 'Demander une démo gratuite',
  },
  footer: {
    tagline: 'Gestion scolaire · Cameroun · MINESEC',
    copyright: '© 2026 ZekoulABia · Tous droits réservés',
    cols: {
      product: { title: 'Produit', links: ['Fonctionnalités', 'Plans tarifaires', 'Sécurité', 'API'] },
      resources: { title: 'Ressources', links: ['Documentation', 'Guides MINESEC', 'Blog', 'Support'] },
      company: { title: 'Entreprise', links: ['À propos', 'Carrières', 'Presse', 'Partenaires'] },
      contact: { title: 'Contact', info: ['Yaoundé, Cameroun', 'contact@zekoulabia.cm', '+237 6XX XXX XXX'] },
    },
  },
}

const textsEN = {
  nav: {
    badge: 'MINESEC Cameroon',
    features: 'Features',
    howItWorks: 'How it works',
    plans: 'Plans',
    contact: 'Contact',
    demo: 'Request a demo',
    login: 'Log in',
  },
  hero: {
    badge: '🇨🇲 Official platform · MINESEC Cameroon',
    title: 'The reference school management platform in Cameroon',
    subtitle: 'ZekoulABia centralizes your school management: grades, attendance, report cards, timetables and Mobile Money payments. MINESEC compliant.',
    cta1: 'Request a free demo',
    cta2: 'See how it works',
    trust: ['MINESEC Compliant', 'Data hosted in Africa', 'MTN MoMo & Orange Money', 'Offline mode included'],
  },
  stats: {
    items: [
      { value: '19', label: 'School types covered' },
      { value: '6', label: 'MINESEC-compliant report card templates' },
      { value: '3', label: 'Authentication factors (MFA)' },
      { value: '100%', label: 'Offline-capable' },
    ],
  },
  features: {
    title: 'Everything your school needs',
    subtitle: 'Designed for the Cameroonian education system',
    items: [
      { title: 'Grades & Report Cards', desc: 'MINESEC BAC coefficients, automatic average calculation, PDF report cards generated in one click.' },
      { title: 'Smart Attendance', desc: 'Quick teacher entry, SMS alerts to parents, real-time statistics.' },
      { title: 'Integrated Mobile Money', desc: 'MTN MoMo & Orange Money via Campay. Automatic reminders to late-paying parents.' },
      { title: 'Timetable', desc: 'Conflict detection (MINESEC Rule 7 ≤14h/week), lab groups, one-click publishing.' },
      { title: 'AI School Health', desc: 'Score 0-100 per student: grades, attendance, payments, behavior. Preventive Groq AI alerts.' },
      { title: 'Offline Mode', desc: 'Works without internet (IndexedDB + service worker). Auto-sync when network returns.' },
    ],
  },
  security: {
    title: 'Security & data protection',
    subtitle: 'Built from day one for the data of minor students',
    items: [
      { title: 'Mandatory two-factor authentication', desc: 'Password, email code, and authenticator app (TOTP) on every login for Admin, Staff, and Teacher accounts — setup enforced from the very first login, never optional to disable.' },
      { title: 'Strict per-school isolation', desc: 'Each school is fully siloed: no data is ever accessible to another establishment, at any level of the system.' },
      { title: 'Granular access control', desc: 'Each role (Vice-Principal, Bursar, Discipline Master...) only accesses the functions explicitly authorized for it.' },
      { title: 'Governed AI, never autonomous', desc: 'The AI assistant can never execute an action beyond the real permissions of the requesting user, and always asks for confirmation before a sensitive action.' },
      { title: 'Full traceability', desc: 'Every sensitive action is logged and auditable at any time.' },
    ],
    note: "ZekoulABia is designed in the spirit of Cameroon's Law No. 2010/012 on cybersecurity and cybercrime, and Law No. 2024/017 on the protection of personal data.",
  },
  howItWorks: {
    title: 'Operational in 72 hours',
    steps: [
      { title: 'Invitation', desc: 'The ZekoulABia team sends an invitation to your headmaster. Activation link valid 72 hours.' },
      { title: 'Guided Onboarding', desc: 'Set up classes, subjects, teachers. Our assistant guides you step by step.' },
      { title: 'Everyone connected', desc: 'Each role accesses their dedicated space. Teachers, parents and students receive their access.' },
    ],
  },
  roles: {
    title: 'A dedicated space for each stakeholder',
    items: [
      { label: 'Principal', benefits: ['Overview: KPIs, attendance, recovery in real time', 'User, class and subject management', 'Year-end with automatic MINESEC promotions', 'Complete school configuration'] },
      { label: 'Teacher', benefits: ['Attendance entry in 2 minutes', 'Grades per sequence with automatic calculation', 'Personal timetable + conflict alerts', 'Make-up class requests in one click'] },
      { label: 'Parent', benefits: ["Track children's grades and report cards", 'Real-time absence alerts by SMS', 'MTN/Orange Mobile Money payments from the app', 'Direct communication with the school'] },
      { label: 'Student', benefits: ['Grades, averages and report cards 24/7', 'Personal timetable', 'Online exams submitted directly in the platform', 'Offline accessible'] },
      { label: 'Vice-Principal', benefits: ['Validation of teacher grades', 'Class council with promotion decisions', 'Caution and discipline management', 'Mobile Money: overdue tracking and reminders'] },
    ],
  },
  pricing: {
    title: 'Plans for every school',
    subtitle: 'Start free, no credit card required',
    recommended: 'RECOMMENDED',
    plans: [
      { name: 'Discovery', price: 'Free', recommended: false, features: ['50 students max', '2 classes', 'Grades & Attendance', 'Community support'], cta: 'Start for free' },
      { name: 'Standard', price: 'On request', recommended: true, features: ['300 students', 'Unlimited classes', 'All features', 'Mobile Money', 'Priority support'], cta: 'Request a quote' },
      { name: 'Premium', price: 'On request', recommended: false, features: ['Unlimited students', 'AI School Health', 'Multi-school', 'Dedicated support + training'], cta: 'Contact the team' },
    ],
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      { q: 'Is ZekoulABia MINESEC compliant?', a: 'Yes. BAC coefficients, sequences, grades /20, Art. 48 thresholds — pre-configured according to current MINESEC regulations.' },
      { q: 'Do you need internet all the time?', a: 'No. Full offline mode (IndexedDB + PWA). Automatic sync when the network returns.' },
      { q: 'How does Mobile Money work?', a: 'Via Campay (MTN MoMo & Orange Money). Payment from the phone, real-time confirmation for the bursar.' },
      { q: 'How long does it take to set up ZekoulABia?', a: 'On average 72 hours with our team guidance.' },
      { q: 'Is student data secure?', a: 'Strict per-school isolation, hosted in Africa, TLS encryption, mandatory two-factor authentication for Admin/Staff/Teacher accounts. See our Security section.' },
    ],
  },
  cta: {
    title: 'Join the schools that trust ZekoulABia',
    subtitle: 'Free trial · No credit card · Up and running in 72h',
    btn: 'Request a free demo',
  },
  footer: {
    tagline: 'School management · Cameroon · MINESEC',
    copyright: '© 2026 ZekoulABia · All rights reserved',
    cols: {
      product: { title: 'Product', links: ['Features', 'Pricing', 'Security', 'API'] },
      resources: { title: 'Resources', links: ['Documentation', 'MINESEC Guides', 'Blog', 'Support'] },
      company: { title: 'Company', links: ['About', 'Careers', 'Press', 'Partners'] },
      contact: { title: 'Contact', info: ['Yaoundé, Cameroon', 'contact@zekoulabia.cm', '+237 6XX XXX XXX'] },
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STYLE TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const DECO_BAND: CSSProperties = {
  height: 5,
  background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 16px,var(--green) 16px,var(--green) 32px,var(--red) 32px,var(--red) 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)',
  flexShrink: 0,
}

// Cards avec border-radius moderne (16px au lieu de 13px)
const CARD: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  border: '1.5px solid var(--border)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
}

// Section heading helper
const SH: CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif',
  fontSize: 40,
  fontWeight: 700,
  color: 'var(--text)',
  textAlign: 'center',
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// HERO MOCKUP (pure HTML, no external images)
// ─────────────────────────────────────────────────────────────────────────────
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
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,var(--green),var(--green2))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><GraduationCap size={16} strokeWidth={2} /></div>
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
          <span>Aujourd'hui</span>
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
  const [tabRole, setTabRole] = useState(0)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)
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
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      const role = raw ? JSON.parse(raw)?.role : null
      const dest = role ? DASHBOARD_BY_ROLE[role] : null
      if (dest) { router.replace(dest); return }
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

  // shared button styles — taille standard landing page moderne
  const btnPrimary: CSSProperties = {
    background: 'linear-gradient(135deg,var(--green),var(--green2))',
    color: 'white',
    fontWeight: 800,
    fontSize: 15,
    padding: '14px 28px',
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(5,150,105,0.22)',
    fontFamily: 'inherit',
    transition: 'all 150ms',
    display: 'inline-block',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }
  const btnSecondary: CSSProperties = {
    background: 'var(--surface)',
    color: 'var(--text2)',
    fontWeight: 700,
    fontSize: 15,
    padding: '14px 28px',
    borderRadius: 10,
    border: '1.5px solid var(--border2)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 150ms',
    display: 'inline-block',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  }

  // Rien à afficher tant qu'on vérifie/redirige — évite le flash de la landing page pour un
  // utilisateur déjà connecté (voir l'effet de vérification de session plus haut).
  if (checkingSession) return null

  return (
    <div style={{ fontFamily: 'var(--font-nunito),Nunito,sans-serif', color: 'var(--text)', background: 'var(--bg)' }}>

      {/* ══════════════════════════════════════════════════
          NAVBAR — hauteur 72px, padding horizontal 56px
      ══════════════════════════════════════════════════ */}
      <nav className="px-4 md:px-8 lg:px-14 gap-2 md:gap-4 lg:gap-10" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        minHeight: 72, background: 'var(--surface)',
        borderBottom: '1.5px solid var(--border)',
        display: 'flex', alignItems: 'center',
        transition: 'box-shadow 200ms',
        boxShadow: navScrolled ? '0 2px 16px rgba(0,0,0,0.07)' : 'none',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, minWidth: 0 }}>
          <img src="/logo.svg" alt="ZekoulABia" style={{ width: 32, height: 32, flexShrink: 0 }} />
          <span className="truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>ZekoulABia</span>
          <span className="hidden xl:inline-block" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 14, fontWeight: 700, borderRadius: 20, padding: '2px 11px', marginLeft: 4, whiteSpace: 'nowrap' }}>
            {tx.nav.badge}
          </span>
        </div>

        {/* Links — cachés avant lg (1024px) : en dessous, pas assez de place pour tenir sur une
            ligne sans retour à la ligne (testé et cassé à 1024px avant l'ajout de ce seuil). */}
        <div className="hidden lg:flex gap-4 xl:gap-9" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {[
            { label: tx.nav.features, href: '#fonctionnalites' },
            { label: tx.nav.howItWorks, href: '#comment' },
            { label: tx.nav.plans, href: '#plans' },
            { label: tx.nav.contact, href: '#contact' },
          ].map(link => (
            <a key={link.href} href={link.href} className="text-[15px] xl:text-[17px]"
              style={{ fontWeight: 600, color: 'var(--text2)', textDecoration: 'none', transition: 'color 150ms', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--green)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)' }}
            >{link.label}</a>
          ))}
        </div>

        {/* Right actions */}
        <div className="gap-2 md:gap-3" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
          <span className="hidden sm:inline-flex"><LanguageSwitch /></span>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="hidden sm:inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--bg2)] transition-colors"
          >
            {tx.nav.login}
          </button>
          <button onClick={openDemo} className="hidden sm:inline-flex py-[9px] px-3 md:px-[18px] text-[14px] md:text-[17px] whitespace-nowrap" style={{ ...btnPrimary, padding: undefined, fontSize: undefined, display: undefined }}>{tx.nav.demo}</button>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════
          HERO — padding généreux, titre 66px
      ══════════════════════════════════════════════════ */}
      <section style={{ background: 'var(--bg)', paddingTop: 72 }}>
        <div style={DECO_BAND} />
        <div className="flex-col lg:flex-row px-5 md:px-16 py-16 md:py-28 gap-10 lg:gap-20" style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          {/* Left */}
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ display: 'inline-block', background: 'var(--green-light)', color: 'var(--green)', fontSize: 12, fontWeight: 900, borderRadius: 20, padding: '6px 16px', marginBottom: 26 }}>
              {tx.hero.badge}
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
              className="text-[38px] md:text-[66px]"
              style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', lineHeight: 1.1, maxWidth: 660, marginBottom: 26 }}>
              {tx.hero.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22, ease: 'easeOut' }}
              style={{ fontSize: 18, color: 'var(--text2)', maxWidth: 540, lineHeight: 1.7, marginBottom: 36, fontWeight: 500 }}>
              {tx.hero.subtitle}
            </motion.p>
            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.34, ease: 'easeOut' }}
              style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 32 }}>
              <motion.button onClick={openDemo}
                style={{ ...btnPrimary, fontSize: 16, padding: '16px 32px', display: 'inline-flex', alignItems: 'center', gap: 9 }}
                whileHover={{ scale: 1.04, boxShadow: '0 6px 20px rgba(5,150,105,0.38)' }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 350, damping: 20 }}
              ><GraduationCap size={17} strokeWidth={2} />{tx.hero.cta1}</motion.button>
              <a href="#comment" style={{ ...btnSecondary, fontSize: 16, padding: '16px 32px', display: 'inline-flex', alignItems: 'center', gap: 9 }}><Play size={16} strokeWidth={2} />{tx.hero.cta2}</a>
            </motion.div>
            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.44 }}
              style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              {tx.hero.trust.map((badge, i) => {
                const Icon = TRUST_ICONS[i]
                return (
                  <span key={badge} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--text2)', fontWeight: 700 }}>
                    <Icon size={15} strokeWidth={2} />{badge}
                  </span>
                )
              })}
            </motion.div>
          </div>

          {/* Right — mockup flottant */}
          <motion.div className="w-full lg:w-auto" style={{ flexShrink: 0 }}
            initial={{ opacity: 0, x: 36 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}>
            <motion.div
              animate={{ y: [0, -14, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}>
              <HeroMockup />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          STATS — chiffres 52px, padding 72px
      ══════════════════════════════════════════════════ */}
      <section className="px-5 md:px-16 py-12 md:py-[72px]" style={{ background: 'var(--surface)', borderTop: '1.5px solid var(--border)', borderBottom: '1.5px solid var(--border)' }}>
        <div className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8" style={{ maxWidth: 1000, margin: '0 auto', display: 'grid' }}>
          {tx.stats.items.map((s, i) => {
            const { num, suffix } = parseStatVal(s.value)
            const Icon = STATS_ICONS[i]
            return (
              <motion.div key={s.label} style={{ textAlign: 'center' }}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.55, delay: i * 0.1, ease: 'easeOut' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 8 }}><Icon size={36} strokeWidth={2} /></div>
                <div className="text-[36px] md:text-[52px]" style={{ fontFamily: 'var(--font-nunito),Nunito,sans-serif', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
                  <CompteurAnime valeur={num} suffix={suffix} />
                </div>
                <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600, marginTop: 8 }}>{s.label}</div>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FEATURES — grille 3×2, cards padding 32px
      ══════════════════════════════════════════════════ */}
      <section id="fonctionnalites" className="px-5 md:px-16 py-16 md:py-28" style={{ background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 68 }}>
            <h2 className="text-[28px] md:text-[40px]" style={{ ...SH, fontSize: undefined }}>{tx.features.title}</h2>
            <p style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600, marginTop: 10 }}>{tx.features.subtitle}</p>
          </div>

          <div className="grid-cols-1 md:grid-cols-3 gap-5 md:gap-7" style={{ display: 'grid' }}>
            {tx.features.items.map((f, i) => {
              const Icon = FEATURES_ICONS[i]
              return (
                <motion.div key={f.title}
                  style={{ ...CARD, padding: 32, cursor: 'default' }}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
                  whileHover={{ y: -5, boxShadow: '0 8px 28px rgba(0,0,0,0.09)', transition: { duration: 0.2 } }}
                >
                  <div style={{ color: 'var(--green)', marginBottom: 16 }}><Icon size={36} strokeWidth={2} /></div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>{f.desc}</div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SÉCURITÉ — grille 2×2, note légale en bas
      ══════════════════════════════════════════════════ */}
      <section id="securite" className="px-5 md:px-16 py-16 md:py-28" style={{ background: 'var(--surface)', borderTop: '1.5px solid var(--border)', borderBottom: '1.5px solid var(--border)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 68 }}>
            <h2 className="text-[28px] md:text-[40px]" style={{ ...SH, fontSize: undefined }}>{tx.security.title}</h2>
            <p style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600, marginTop: 10 }}>{tx.security.subtitle}</p>
          </div>

          <div className="grid-cols-1 md:grid-cols-2 gap-5 md:gap-7" style={{ display: 'grid', marginBottom: 40 }}>
            {tx.security.items.map((s, i) => {
              const Icon = SECURITY_ICONS[i]
              return (
                <motion.div key={s.title}
                  style={{ ...CARD, padding: 32, cursor: 'default' }}
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
                  whileHover={{ y: -5, boxShadow: '0 8px 28px rgba(0,0,0,0.09)', transition: { duration: 0.2 } }}
                >
                  <div style={{ color: 'var(--green)', marginBottom: 16 }}><Icon size={32} strokeWidth={2} /></div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{s.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>{s.desc}</div>
                </motion.div>
              )
            })}
          </div>

          <p style={{ fontSize: 12.5, color: 'var(--text3)', textAlign: 'center', maxWidth: 720, margin: '0 auto', lineHeight: 1.7 }}>{tx.security.note}</p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          HOW IT WORKS — cercles 58px, icônes 44px
      ══════════════════════════════════════════════════ */}
      <section id="comment" className="px-5 md:px-16 py-16 md:py-28" style={{ background: 'var(--surface)', borderTop: '1.5px solid var(--border)', borderBottom: '1.5px solid var(--border)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 className="text-[28px] md:text-[40px] mb-10 md:mb-[72px]" style={{ ...SH, fontSize: undefined, marginBottom: undefined }}>{tx.howItWorks.title}</h2>

          <div className="flex-col md:flex-row gap-8 md:gap-0" style={{ display: 'flex', alignItems: 'flex-start' }}>
            {tx.howItWorks.steps.map((step, i) => {
              const Icon = HOWITWORKS_ICONS[i]
              return (
                <Fragment key={i}>
                  <div className="px-3 md:px-8" style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      {i + 1}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 14 }}><Icon size={44} strokeWidth={2} /></div>
                    <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
                      Étape {i + 1} — {step.title}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 260, margin: '0 auto' }}>{step.desc}</div>
                  </div>
                  {i < tx.howItWorks.steps.length - 1 && (
                    <div className="hidden md:block" style={{ paddingTop: 22, color: 'var(--border2)', flexShrink: 0, alignSelf: 'flex-start' }}><ArrowRight size={28} strokeWidth={2} /></div>
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          ROLES — tabs + card, padding 40px
      ══════════════════════════════════════════════════ */}
      <section className="px-5 md:px-16 py-16 md:py-28" style={{ background: 'var(--bg)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 className="text-[28px] md:text-[40px] mb-6 md:mb-10" style={{ ...SH, fontSize: undefined, marginBottom: undefined }}>{tx.roles.title}</h2>

          {/* Role tabs */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
            {tx.roles.items.map((r, i) => {
              const Icon = ROLES_ICONS[i]
              return (
                <button key={i} onClick={() => setTabRole(i)}
                  style={{
                    padding: '10px 24px', fontSize: 14, fontWeight: 700, borderRadius: 28, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 150ms',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: tabRole === i ? 'var(--green)' : 'white',
                    color: tabRole === i ? 'white' : 'var(--text2)',
                    boxShadow: tabRole === i ? '0 4px 14px rgba(5,150,105,0.25)' : '0 2px 6px rgba(0,0,0,0.06)',
                    border: tabRole !== i ? '1.5px solid var(--border)' : '1.5px solid transparent',
                  }}>
                  <Icon size={15} strokeWidth={2} /> {r.label}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div key={tabRole}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}
              className="px-6 md:px-10 py-7 md:py-10"
              style={{ ...CARD, padding: undefined }}>
              {(() => { const Icon = ROLES_ICONS[tabRole]; return (
                <div style={{ display: 'flex', color: 'var(--green)', marginBottom: 14 }}><Icon size={52} strokeWidth={2} /></div>
              ) })()}
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>
                Espace {tx.roles.items[tabRole].label}
              </div>
              <div className="grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid' }}>
                {tx.roles.items[tabRole].benefits.map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}><Check size={13} strokeWidth={2.5} /></div>
                    <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6 }}>{b}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PRICING — cards padding 32px, price 38px
      ══════════════════════════════════════════════════ */}
      <section id="plans" className="px-5 md:px-16 py-16 md:py-28" style={{ background: 'var(--surface)', borderTop: '1.5px solid var(--border)', borderBottom: '1.5px solid var(--border)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 68 }}>
            <h2 className="text-[28px] md:text-[40px]" style={{ ...SH, fontSize: undefined }}>{tx.pricing.title}</h2>
            <p style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600, marginTop: 10 }}>{tx.pricing.subtitle}</p>
          </div>

          <div className="grid-cols-1 md:grid-cols-3 gap-5 md:gap-7" style={{ display: 'grid' }}>
            {tx.pricing.plans.map(plan => (
              <div key={plan.name} className="px-6 md:px-8 py-7 md:py-8" style={{
                background: 'var(--surface)', borderRadius: 18,
                border: plan.recommended ? '2px solid var(--green)' : '1.5px solid var(--border)',
                boxShadow: plan.recommended ? '0 10px 32px rgba(5,150,105,0.14)' : '0 2px 8px rgba(0,0,0,0.06)',
                position: 'relative',
                transition: 'transform 200ms,box-shadow 200ms',
              }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(-6px)'
                  el.style.boxShadow = plan.recommended ? '0 18px 44px rgba(5,150,105,0.22)' : '0 8px 28px rgba(0,0,0,0.09)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = plan.recommended ? '0 10px 32px rgba(5,150,105,0.14)' : '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                {plan.recommended && (
                  <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'var(--green)', color: 'white', fontSize: 10, fontWeight: 900, borderRadius: 20, padding: '4px 16px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Star size={11} strokeWidth={2} fill="currentColor" /> {tx.pricing.recommended}
                  </div>
                )}
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{plan.name}</div>
                <div className="text-[30px] md:text-[38px]" style={{ fontWeight: 900, color: plan.recommended ? 'var(--green)' : 'var(--text)', marginBottom: 22, lineHeight: 1 }}>{plan.price}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 14, color: 'var(--text2)' }}>
                      <span style={{ display: 'flex', color: 'var(--green)' }}><Check size={15} strokeWidth={2.5} /></span>{f}
                    </div>
                  ))}
                </div>
                <button onClick={openDemo}
                  style={plan.recommended
                    ? { ...btnPrimary, display: 'block', width: '100%', textAlign: 'center', fontSize: 14, padding: '13px 24px' }
                    : { ...btnSecondary, display: 'block', width: '100%', textAlign: 'center', fontSize: 14, padding: '13px 24px' }
                  }>{plan.cta}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FAQ — accordéon, border-radius 12px
      ══════════════════════════════════════════════════ */}
      <section className="px-5 md:px-16 py-16 md:py-28" style={{ background: 'var(--surface)', borderTop: '1.5px solid var(--border)', borderBottom: '1.5px solid var(--border)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 className="text-[28px] md:text-[40px] mb-9 md:mb-16" style={{ ...SH, fontSize: undefined, marginBottom: undefined }}>{tx.faq.title}</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tx.faq.items.map((faq, i) => (
              <div key={i} style={{
                borderRadius: 12, overflow: 'hidden', transition: 'all 150ms',
                border: faqOpen === i ? '1.5px solid var(--green)' : '1.5px solid var(--border)',
                borderLeft: faqOpen === i ? '4px solid var(--green)' : '1.5px solid var(--border)',
                background: faqOpen === i ? 'var(--bg2)' : 'white',
              }}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  className="px-4 md:px-6 py-4 md:py-5"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{faq.q}</span>
                  <span style={{ display: 'flex', color: 'var(--green)', transition: 'transform 150ms', transform: faqOpen === i ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0, marginLeft: 16 }}><ChevronDown size={20} strokeWidth={2.5} /></span>
                </button>
                {faqOpen === i && (
                  <div className="px-4 md:px-6 pb-4 md:pb-5" style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.75, animation: 'fadeIn 0.15s ease' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          CTA FINAL — padding 120px, titre 52px
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
        <div className="px-5 md:px-16 py-16 md:py-[120px]" style={{ position: 'relative', zIndex: 1, textAlign: 'center', overflow: 'hidden' }}>
          {/* Decorative circles */}
          <div style={{ position: 'absolute', top: 48, left: '7%', width: 240, height: 240, borderRadius: '50%', background: 'rgba(5,150,105,0.1)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 48, right: '6%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(5,150,105,0.07)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '35%', right: '18%', width: 140, height: 140, borderRadius: '50%', background: 'rgba(74,222,128,0.06)', pointerEvents: 'none' }} />

          <h2 className="text-[30px] md:text-[52px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'white', maxWidth: 720, margin: '0 auto 24px', lineHeight: 1.15 }}>
            {tx.cta.title}
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 44 }}>
            {tx.cta.subtitle}
          </p>
          <button onClick={openDemo}
            className="px-6 md:px-[52px] py-4 md:py-5 text-[15px] md:text-[18px]"
            style={{
              background: '#4ade80', color: 'var(--sidebar)',
              fontWeight: 900, borderRadius: 12,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 150ms', display: 'inline-flex', alignItems: 'center', gap: 10,
              boxShadow: '0 6px 24px rgba(74,222,128,0.32)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = 'var(--green)'
              el.style.boxShadow = '0 8px 32px rgba(74,222,128,0.48)'
              el.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.background = '#4ade80'
              el.style.boxShadow = '0 6px 24px rgba(74,222,128,0.32)'
              el.style.transform = 'translateY(0)'
            }}
          >
            <GraduationCap size={19} strokeWidth={2} />
            {tx.cta.btn}
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          FOOTER — padding 72px/44px, maxWidth 1200
      ══════════════════════════════════════════════════ */}
      <footer className="px-5 md:px-16 pt-12 md:pt-[72px] pb-8 md:pb-11" style={{ background: 'var(--sidebar2)', color: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-8 md:gap-14" style={{ display: 'grid', marginBottom: 56 }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <img src="/logo.svg" alt="ZekoulABia" style={{ width: 28, height: 28, filter: "brightness(0) invert(1)" }} />
                <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'white' }}>ZekoulABia</span>
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.42)', lineHeight: 1.75 }}>{tx.footer.tagline}</div>
            </div>

            {/* Produit */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{tx.footer.cols.product.title}</div>
              {tx.footer.cols.product.links.map(l => (
                <a key={l} href={l === tx.footer.cols.product.links[2] ? '#securite' : '#'} style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 10, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Ressources */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{tx.footer.cols.resources.title}</div>
              {tx.footer.cols.resources.links.map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 10, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Entreprise */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{tx.footer.cols.company.title}</div>
              {tx.footer.cols.company.links.map(l => (
                <a key={l} href="#" style={{ display: 'block', fontSize: 14, color: 'rgba(255,255,255,0.48)', textDecoration: 'none', marginBottom: 10, transition: 'color 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#4ade80' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.48)' }}
                >{l}</a>
              ))}
            </div>

            {/* Contact */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.32)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 16 }}>{tx.footer.cols.contact.title}</div>
              {tx.footer.cols.contact.info.map(l => (
                <div key={l} style={{ fontSize: 14, color: 'rgba(255,255,255,0.48)', marginBottom: 10 }}>{l}</div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)' }}>{tx.footer.copyright}</div>
            <LanguageSwitch style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        </div>
      </footer>

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
