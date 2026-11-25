export const textsFR = {
  nav: {
    badge: 'MINESEC Cameroun',
    features: 'Fonctionnalités',
    howItWorks: 'Comment ça marche',
    plans: 'Plans',
    contact: 'Contact',
    demo: 'Demander une démo',
    demoShort: 'Démo',
    login: 'Se connecter',
    loginShort: 'Connexion',
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
      contact: { title: 'Contact', info: ['Yaoundé, Cameroun', 'zekoulabia.noreply@gmail.com', '+237 695 557 891'] },
    },
  },
}

export const textsEN: typeof textsFR = {
  nav: {
    badge: 'MINESEC Cameroon',
    features: 'Features',
    howItWorks: 'How it works',
    plans: 'Plans',
    contact: 'Contact',
    demo: 'Request a demo',
    demoShort: 'Demo',
    login: 'Log in',
    loginShort: 'Login',
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
      contact: { title: 'Contact', info: ['Yaoundé, Cameroon', 'zekoulabia.noreply@gmail.com', '+237 695 557 891'] },
    },
  },
}

export type LandingTexts = typeof textsFR
