'use client'

import { useCallback, useState, useEffect } from 'react'
import {
  Hand, RefreshCw, FileText, GraduationCap, Banknote, CheckCircle2,
  KeyRound, BookOpen, Package, Award, AlertTriangle, Clock, ArrowRight,
  UserCheck, Users, Mail, Printer, MessageCircle, AlertCircle,
  type LucideIcon
} from 'lucide-react'
import type { StaffSection, SessionUser } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useT, useLanguage } from '@/lib/i18n'
import { getStaffDisplayTitle } from '../_types'

interface Props {
  sessionUser: SessionUser | null
  allowedSections: Set<StaffSection>
  onNav: (s: StaffSection) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface KpiData {
  openCouncils: number
  pendingInvoices: number
  attendanceRate: string | null
  overdueBooks: number
}

interface AdmissionsSummary {
  activeEvent: {
    title: string
    phase: string
    endDate?: string
    candidatsCount: number
    placesCount: number
  } | null
  aCompleter: number
  admisAFinaliser: number
  brouillons: number
  chezLaFamille: number
  enAttenteDirection: number
}

interface CenseurSummary {
  activeClassesCount: number
  classesWithoutPPCount: number
  unassignedSubjectsCount: number
  openCouncilsCount: number
  activeAnonymatSessionsCount: number
  studentsAtRiskCount: number
  gridConfigured: boolean
}

export default function SectionStaffDashboard({ sessionUser, allowedSections, onNav, onToast }: Props) {
  const t = useT('staff')
  const { lang } = useLanguage()
  const displayRoleTitle = getStaffDisplayTitle(sessionUser, lang)
  const can = (s: StaffSection) => allowedSections.has(s)
  const isSecretary = can('inscriptions') || (sessionUser?.staffTitle?.toLowerCase().includes('secr') ?? false)
  const isCenseur = !isSecretary && (
    can('timetable') || can('classes') || can('affectations') ||
    (sessionUser?.staffTitle?.toLowerCase().includes('censeur') ?? false) ||
    (sessionUser?.staffTitle?.toLowerCase().includes('vice') ?? false)
  )

  // 1. KPIs standards (Conseils, Finance, Présence, Bibliothèque)
  const fetchKpis = useCallback(async (): Promise<KpiData> => {
    const results = await Promise.allSettled([
      can('council')    ? fetchApi('/api/v2/class-councils',                { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('finance')    ? fetchApi('/api/v2/finance/invoices?status=PENDING&limit=1', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('attendance') ? fetchApi('/api/v2/attendance/stats',              { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('library')    ? fetchApi('/api/v2/library/loans?status=OVERDUE&limit=1', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
    ])

    const [councilRes, financeRes, attendanceRes, libraryRes] = results

    return {
      openCouncils:    councilRes.status === 'fulfilled'   && councilRes.value?.sessions  != null ? councilRes.value.sessions.filter((s: Record<string, unknown>) => s.status !== 'LOCKED').length : 0,
      pendingInvoices: financeRes.status === 'fulfilled'   && financeRes.value?.pagination != null ? financeRes.value.pagination.total : 0,
      attendanceRate:  attendanceRes.status === 'fulfilled' && attendanceRes.value?.stats  != null ? attendanceRes.value.stats.attendanceRate : null,
      overdueBooks:    libraryRes.status === 'fulfilled'   && libraryRes.value?.pagination != null ? libraryRes.value.pagination.total : 0,
    }
  }, [allowedSections]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, fromCache, cachedAt, refetch } = useCachedFetch<KpiData>('staff-dashboard-kpis', fetchKpis)
  const kpi: KpiData = data ?? { openCouncils: 0, pendingInvoices: 0, attendanceRate: null, overdueBooks: 0 }

  // 2. Synthèse Cockpit Censeur (Direction des Études)
  const fetchCenseurSummary = useCallback(async (): Promise<CenseurSummary> => {
    const results = await Promise.allSettled([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/teaching-assignments/issues', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/class-councils', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/assessments/sessions', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/ai/students-health', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
    ])

    const [classesRes, issuesRes, councilRes, assessRes, healthRes, gridRes] = results

    let activeClassesCount = 0
    let classesWithoutPPCount = 0
    if (classesRes.status === 'fulfilled' && classesRes.value) {
      const clsList = Array.isArray(classesRes.value.data) ? classesRes.value.data : Array.isArray(classesRes.value) ? classesRes.value : []
      activeClassesCount = clsList.length
      classesWithoutPPCount = clsList.filter((c: Record<string, unknown>) => !c.mainTeacher).length
    }

    let unassignedSubjectsCount = 0
    if (issuesRes.status === 'fulfilled' && issuesRes.value?.data && Array.isArray(issuesRes.value.data)) {
      unassignedSubjectsCount = issuesRes.value.data.filter((i: Record<string, unknown>) => i.status !== 'RESOLVED').length
    }

    let openCouncilsCount = 0
    if (councilRes.status === 'fulfilled' && Array.isArray(councilRes.value?.sessions)) {
      openCouncilsCount = councilRes.value.sessions.filter((s: Record<string, unknown>) => s.status !== 'LOCKED').length
    }

    let activeAnonymatSessionsCount = 0
    if (assessRes.status === 'fulfilled' && Array.isArray(assessRes.value?.data)) {
      activeAnonymatSessionsCount = assessRes.value.data.filter((s: Record<string, unknown>) => s.isAnonymized || (s.anonymatStatus && s.anonymatStatus !== 'NONE')).length
    }

    let studentsAtRiskCount = 0
    if (healthRes.status === 'fulfilled' && healthRes.value?.summary) {
      studentsAtRiskCount = (Number(healthRes.value.summary.critical) || 0) + (Number(healthRes.value.summary.warning) || 0)
    }

    const gridConfigured = gridRes.status === 'fulfilled' && gridRes.value?.success && !!gridRes.value?.data?.config

    return {
      activeClassesCount,
      classesWithoutPPCount,
      unassignedSubjectsCount,
      openCouncilsCount,
      activeAnonymatSessionsCount,
      studentsAtRiskCount,
      gridConfigured,
    }
  }, [])

  const { data: censeurData, refetch: refetchCenseur } = useCachedFetch<CenseurSummary>(
    isCenseur ? 'staff:censeur-summary' : '',
    fetchCenseurSummary
  )
  const censeur: CenseurSummary = censeurData ?? {
    activeClassesCount: 0,
    classesWithoutPPCount: 0,
    unassignedSubjectsCount: 0,
    openCouncilsCount: 0,
    activeAnonymatSessionsCount: 0,
    studentsAtRiskCount: 0,
    gridConfigured: true,
  }

  // 3. Admissions & Concours summary (spécifique Secrétariat — zéro mock en dur)
  const [admissions, setAdmissions] = useState<AdmissionsSummary>({
    activeEvent: null,
    aCompleter: 0,
    admisAFinaliser: 0,
    brouillons: 0,
    chezLaFamille: 0,
    enAttenteDirection: 0,
  })

  useEffect(() => {
    if (!isSecretary) return
    let mounted = true

    // Charger les événements actifs
    fetchApi('/api/v2/academic-events/active', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        const events = Array.isArray(d?.data) ? d.data : []
        const examEvent = events.find((e: Record<string, unknown>) => e.type === 'CONCOURS_ENTREE' || String(e.name ?? '').toLowerCase().includes('concours'))
        if (examEvent) {
          setAdmissions(prev => ({
            ...prev,
            activeEvent: {
              title: String(examEvent.name ?? "Session de concours"),
              phase: String(examEvent.currentPhase ?? 'INSCRIPTION'),
              candidatsCount: Number(examEvent.candidatsCount || 0),
              placesCount: Number(examEvent.placesCount || 0),
            }
          }))
        }
      })
      .catch(() => {})

    // Charger les dossiers d'onboarding
    fetchApi('/api/v2/eleve-onboarding', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        const dossiers = Array.isArray(d?.data) ? d.data : []
        let returned = 0
        let draft = 0
        let family = 0
        let pending = 0
        
        for (const item of dossiers) {
          if (item.status === 'RETURNED') returned++
          else if (item.status === 'DRAFT') draft++
          else if (item.status === 'LINK_SENT') family++
          else if (item.status === 'SUBMITTED') pending++
        }

        setAdmissions(prev => ({
          ...prev,
          aCompleter: returned,
          brouillons: draft,
          chezLaFamille: family,
          enAttenteDirection: pending,
        }))
      })
      .catch(() => {})

    return () => { mounted = false }
  }, [isSecretary])

  const nomAffiche = sessionUser?.firstName ?? 'Staff'

  const kpiCards = [
    can('council')    && !isCenseur && { icon: GraduationCap, bg: 'var(--purple-light)', val: String(kpi.openCouncils),   label: t('dashboard.openCouncils'),     trend: t('dashboard.toProcess'),         tBg: 'var(--purple-light)', tC: 'var(--purple)', nav: 'council' as StaffSection },
    can('finance')    && !isCenseur && { icon: Banknote, bg: 'var(--blue-light)', val: String(kpi.pendingInvoices),label: t('dashboard.pendingPayments'), trend: 'Finances',       tBg: 'var(--blue-light)', tC: 'var(--blue)', nav: 'finance' as StaffSection },
    can('attendance') && { icon: CheckCircle2, bg: 'var(--green-light)', val: kpi.attendanceRate ?? '—',  label: t('dashboard.attendanceRate'),     trend: t('dashboard.today'),        tBg: 'var(--green-light)', tC: 'var(--green)', nav: 'attendance' as StaffSection },
    can('library')    && !isCenseur && { icon: BookOpen, bg: 'var(--red-light)', val: String(kpi.overdueBooks),  label: t('dashboard.overdueBooks'),     trend: kpi.overdueBooks > 0 ? t('dashboard.urgent') : t('dashboard.upToDate'), tBg: kpi.overdueBooks > 0 ? 'var(--red-light)' : 'var(--green-light)', tC: kpi.overdueBooks > 0 ? 'var(--red)' : 'var(--green)', nav: 'library' as StaffSection },
  ].filter(Boolean) as { icon: LucideIcon; bg: string; val: string; label: string; trend: string; tBg: string; tC: string; nav: StaffSection }[]

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 overflow-y-auto h-full space-y-3.5 sm:space-y-4">
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 text-base md:text-lg font-extrabold text-[var(--text)]">
            {t('dashboard.greeting')}, {nomAffiche} <Hand size={18} strokeWidth={2} />
          </div>
          <div className="text-xs md:text-[13px] text-[var(--text3)] mt-0.5">2025–2026 · {displayRoleTitle}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={13} strokeWidth={2} /> {t('dashboard.cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          className="min-h-[38px] px-3 py-1.5 md:px-3.5 md:py-2 rounded-lg text-xs md:text-[13px] font-bold inline-flex items-center gap-1.5 cursor-pointer font-inherit transition-all"
          style={{ border: '1.5px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)' }}
          onClick={() => { refetch(); onToast(t('dashboard.refreshing'), 'info') }}
        >
          <RefreshCw size={13} strokeWidth={2} /> {t('dashboard.refresh')}
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* SECTION ADMISSIONS SECRÉTARIAT (§3.2 BLUEPRINT) */}
      {!loading && isSecretary && (
        <div className="space-y-4">
          {/* Bandeau Événement en cours */}
          {admissions.activeEvent ? (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center flex-shrink-0">

                  <Award size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm md:text-base text-[var(--text)]">{admissions.activeEvent.title}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      Phase : {admissions.activeEvent.phase}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text3)] mt-0.5">
                    {admissions.activeEvent.candidatsCount} candidats inscrits sur {admissions.activeEvent.placesCount} places ouvertes
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNav('concours')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--primary)] text-white hover:opacity-95 transition-all"
                >
                  Ouvrir le concours
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between text-xs text-[var(--text3)]">
              <div className="flex items-center gap-2">
                <Clock size={16} />
                <span>Aucune session de concours actif. Prochaine étape : Inscriptions annuelles ordinaires.</span>
              </div>
              <button onClick={() => onNav('inscriptions')} className="font-bold text-[var(--primary)] hover:underline">
                Voir les dossiers &rarr;
              </button>
            </div>
          )}

          {/* 5 Cartes d'action Inscriptions */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            {/* 1. À compléter (Orange prioritaire) */}
            <div
              onClick={() => onNav('inscriptions')}
              className="p-3 rounded-xl border border-orange-500/40 bg-orange-500/10 cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-orange-600 dark:text-orange-400 mb-1">
                <span className="text-xs font-extrabold">À compléter</span>
                <AlertTriangle size={15} />
              </div>
              <div className="text-2xl font-black text-orange-600 dark:text-orange-400">{admissions.aCompleter}</div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">Renvoyés par la direction</div>
            </div>

            {/* 2. Admis à finaliser */}
            <div
              onClick={() => onNav('concours')}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-success mb-1">
                <span className="text-xs font-bold">Admis à finaliser</span>
                <UserCheck size={15} />
              </div>
              <div className="text-2xl font-black text-[var(--text)]">{admissions.admisAFinaliser}</div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">Issus du concours</div>
            </div>

            {/* 3. Brouillons */}
            <div
              onClick={() => onNav('inscriptions')}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                <span className="text-xs font-bold">Brouillons</span>
                <FileText size={15} />
              </div>
              <div className="text-2xl font-black text-[var(--text)]">{admissions.brouillons}</div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">Saisie guichet en cours</div>
            </div>

            {/* 4. Chez la famille */}
            <div
              onClick={() => onNav('inscriptions')}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
                <span className="text-xs font-bold">Chez la famille</span>
                <Mail size={15} />
              </div>
              <div className="text-2xl font-black text-[var(--text)]">{admissions.chezLaFamille}</div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">Liens envoyés aux parents</div>
            </div>

            {/* 5. En attente direction */}
            <div
              onClick={() => onNav('inscriptions')}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
                <span className="text-xs font-bold">En attente</span>
                <Clock size={15} />
              </div>
              <div className="text-2xl font-black text-[var(--text)]">{admissions.enAttenteDirection}</div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">À valider par la direction</div>
            </div>
          </div>

          {/* 2 Colonnes: À faire maintenant (2/3) + Raccourcis Rapides (1/3) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* Liste prioritaire "À faire maintenant" */}
            <div className="md:col-span-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-orange-500 dark:text-orange-400" />
                  <span className="font-extrabold text-sm text-[var(--text)]">À faire maintenant</span>
                </div>
                <span className="text-[11px] text-[var(--text3)] font-semibold">Priorités de la journée</span>
              </div>

              <div className="space-y-2">
                {admissions.aCompleter > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400" />
                      <span className="font-semibold text-[var(--text)]">
                        {admissions.aCompleter} dossier{admissions.aCompleter > 1 ? 's' : ''} renvoyé{admissions.aCompleter > 1 ? 's' : ''} par la direction requièrent des compléments
                      </span>
                    </div>
                    <button onClick={() => onNav('inscriptions')} className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
                      Examiner &rarr;
                    </button>
                  </div>
                )}

                {admissions.chezLaFamille > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                      <span className="text-[var(--text2)]">
                        {admissions.chezLaFamille} dossier{admissions.chezLaFamille > 1 ? 's' : ''} chez les familles en cours de complétion
                      </span>
                    </div>
                    <button onClick={() => onNav('inscriptions')} className="font-bold text-[var(--primary)] hover:underline">
                      Relancer &rarr;
                    </button>
                  </div>
                )}

                {admissions.enAttenteDirection > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                      <span className="text-[var(--text2)]">
                        {admissions.enAttenteDirection} dossier{admissions.enAttenteDirection > 1 ? 's' : ''} soumis en attente d&apos;approbation
                      </span>
                    </div>
                    <button onClick={() => onNav('inscriptions')} className="font-bold text-[var(--primary)] hover:underline">
                      Examiner &rarr;
                    </button>
                  </div>
                )}

                {admissions.aCompleter === 0 && admissions.chezLaFamille === 0 && admissions.enAttenteDirection === 0 && (
                  <div className="p-3 text-center text-xs text-[var(--text3)]">
                    Aucun dossier en attente de traitement prioritaire.
                  </div>
                )}
              </div>
            </div>

            {/* Raccourcis utiles Secrétariat */}
            <div className="md:col-span-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
              <span className="font-extrabold text-sm text-[var(--text)] block pb-2 border-b border-[var(--border)]">
                Raccourcis Secrétariat
              </span>
              <div className="space-y-1.5 text-xs font-semibold">
                <button
                  onClick={() => onNav('inscriptions')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                   <span className="flex items-center gap-2"><FileText size={14} className="text-blue-500 dark:text-blue-400" /> Nouveau dossier</span>

                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
                <button
                  onClick={() => onNav('eleves-familles')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                  <span className="flex items-center gap-2"><Users size={14} className="text-primary" /> Élèves & familles</span>
                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
                <button
                  onClick={() => window.open('/api/v2/eleve-onboarding/fiche-vierge-pdf', '_blank')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                   <span className="flex items-center gap-2"><Printer size={14} className="text-amber-500 dark:text-amber-400" /> Fiche vierge PDF</span>

                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
                <button
                  onClick={() => onNav('messagerie')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                   <span className="flex items-center gap-2"><MessageCircle size={14} className="text-purple-500 dark:text-purple-400" /> Messagerie</span>

                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION COCKPIT CENSEUR (DIRECTION DES ÉTUDES & PÉDAGOGIE) */}
      {!loading && isCenseur && (
        <div className="space-y-4">
          {/* Bandeau d'état de la rentrée pédagogique */}
          {!censeur.gridConfigured ? (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <span className="font-extrabold text-sm md:text-base text-[var(--text)]">
                    Configuration de la grille horaire requise
                  </span>
                  <p className="text-xs text-[var(--text3)] mt-0.5">
                    Définissez les créneaux, pauses et volumes horaires journaliers pour activer la génération automatique des emplois du temps.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onNav('configuration')}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--primary)] text-white hover:opacity-95 transition-all flex-shrink-0"
              >
                Configurer la grille &rarr;
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between text-xs text-[var(--text3)]">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success flex-shrink-0" />
                <span className="font-semibold text-[var(--text)]">
                  {t('dashboard.censeurTitle')} : structure académique active et opérationnelle.
                </span>
              </div>
              <button onClick={() => onNav('timetable')} className="font-bold text-[var(--primary)] hover:underline">
                Ouvrir l&apos;emploi du temps &rarr;
              </button>
            </div>
          )}

          {/* 6 Cartes d'indicateurs pédagogiques clés */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {/* 1. Classes actives */}
            <div
              onClick={() => onNav('classes')}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
                <span className="text-xs font-bold">{t('dashboard.activeClasses')}</span>
                <BookOpen size={15} />
              </div>
              <div className="text-2xl font-black text-[var(--text)]">{censeur.activeClassesCount}</div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
                {t('dashboard.activeClassesDesc', { count: censeur.activeClassesCount })}
              </div>
            </div>

            {/* 2. Classes sans PP */}
            <div
              onClick={() => onNav('classes')}
              className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
                censeur.classesWithoutPPCount > 0
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
            >
              <div className={`flex items-center justify-between mb-1 ${censeur.classesWithoutPPCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-success'}`}>
                <span className="text-xs font-bold">{t('dashboard.classesWithoutPP')}</span>
                <Users size={15} />
              </div>
              <div className={`text-2xl font-black ${censeur.classesWithoutPPCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text)]'}`}>
                {censeur.classesWithoutPPCount}
              </div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
                {t('dashboard.classesWithoutPPDesc', { count: censeur.classesWithoutPPCount })}
              </div>
            </div>

            {/* 3. Matières non affectées */}
            <div
              onClick={() => onNav('affectations')}
              className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
                censeur.unassignedSubjectsCount > 0
                  ? 'border-red-500/40 bg-red-500/10'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
            >
              <div className={`flex items-center justify-between mb-1 ${censeur.unassignedSubjectsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-success'}`}>
                <span className="text-xs font-bold">{t('dashboard.unassignedSubjects')}</span>
                <AlertTriangle size={15} />
              </div>
              <div className={`text-2xl font-black ${censeur.unassignedSubjectsCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--text)]'}`}>
                {censeur.unassignedSubjectsCount}
              </div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
                {t('dashboard.unassignedSubjectsDesc', { count: censeur.unassignedSubjectsCount })}
              </div>
            </div>

            {/* 4. Conseils de classe */}
            <div
              onClick={() => onNav('council')}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
                <span className="text-xs font-bold">{t('dashboard.councilsOpen')}</span>
                <GraduationCap size={15} />
              </div>
              <div className="text-2xl font-black text-[var(--text)]">{censeur.openCouncilsCount}</div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
                {t('dashboard.councilsOpenDesc', { count: censeur.openCouncilsCount })}
              </div>
            </div>

            {/* 5. Anonymat examens */}
            <div
              onClick={() => onNav('anonymat')}
              className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-1">
                <span className="text-xs font-bold">{t('dashboard.examsAnonymat')}</span>
                <UserCheck size={15} />
              </div>
              <div className="text-2xl font-black text-[var(--text)]">{censeur.activeAnonymatSessionsCount}</div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
                {t('dashboard.examsAnonymatDesc', { count: censeur.activeAnonymatSessionsCount })}
              </div>
            </div>

            {/* 6. Vigilance élèves */}
            <div
              onClick={() => onNav('suivi-eleves')}
              className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
                censeur.studentsAtRiskCount > 0
                  ? 'border-orange-500/40 bg-orange-500/10'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
            >
              <div className={`flex items-center justify-between mb-1 ${censeur.studentsAtRiskCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-success'}`}>
                <span className="text-xs font-bold">{t('dashboard.academicVigilance')}</span>
                <AlertCircle size={15} />
              </div>
              <div className={`text-2xl font-black ${censeur.studentsAtRiskCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--text)]'}`}>
                {censeur.studentsAtRiskCount}
              </div>
              <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">
                {t('dashboard.academicVigilanceDesc', { count: censeur.studentsAtRiskCount })}
              </div>
            </div>
          </div>

          {/* 2 Colonnes: Priorités Pédagogiques (2/3) + Raccourcis Direction des Études (1/3) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            {/* Colonne gauche : Priorités académiques */}
            <div className="md:col-span-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-primary" />
                  <span className="font-extrabold text-sm text-[var(--text)]">{t('dashboard.censeurPriorities')}</span>
                </div>
                <span className="text-[11px] text-[var(--text3)] font-semibold">{t('dashboard.censeurPrioritiesSubtitle')}</span>
              </div>

              <div className="space-y-2">
                {censeur.unassignedSubjectsCount > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500 dark:bg-red-400" />
                      <span className="font-semibold text-[var(--text)]">
                        {censeur.unassignedSubjectsCount} matière{censeur.unassignedSubjectsCount > 1 ? 's' : ''} sans enseignant affecté nécessitent votre arbitrage
                      </span>
                    </div>
                    <button onClick={() => onNav('affectations')} className="font-bold text-red-600 dark:text-red-400 hover:underline">
                      Affecter &rarr;
                    </button>
                  </div>
                )}

                {censeur.classesWithoutPPCount > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                      <span className="text-[var(--text2)]">
                        {censeur.classesWithoutPPCount} classe{censeur.classesWithoutPPCount > 1 ? 's' : ''} sans Professeur Principal désigné
                      </span>
                    </div>
                    <button onClick={() => onNav('classes')} className="font-bold text-amber-600 dark:text-amber-400 hover:underline">
                      Désigner &rarr;
                    </button>
                  </div>
                )}

                {censeur.openCouncilsCount > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400" />
                      <span className="text-[var(--text2)]">
                        {censeur.openCouncilsCount} session{censeur.openCouncilsCount > 1 ? 's' : ''} de conseil de classe à délibérer
                      </span>
                    </div>
                    <button onClick={() => onNav('council')} className="font-bold text-purple-600 dark:text-purple-400 hover:underline">
                      Délibérer &rarr;
                    </button>
                  </div>
                )}

                {censeur.studentsAtRiskCount > 0 && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400" />
                      <span className="text-[var(--text2)]">
                        {censeur.studentsAtRiskCount} élève{censeur.studentsAtRiskCount > 1 ? 's' : ''} signalé{censeur.studentsAtRiskCount > 1 ? 's' : ''} en risque ou décrochage scolaire
                      </span>
                    </div>
                    <button onClick={() => onNav('suivi-eleves')} className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
                      Consulter &rarr;
                    </button>
                  </div>
                )}

                {censeur.unassignedSubjectsCount === 0 && censeur.classesWithoutPPCount === 0 && censeur.openCouncilsCount === 0 && censeur.studentsAtRiskCount === 0 && (
                  <div className="p-3 text-center text-xs text-[var(--text3)]">
                    Structure pédagogique équilibrée. Aucun arbitrage urgent requis.
                  </div>
                )}
              </div>
            </div>

            {/* Colonne droite : Raccourcis Censeur */}
            <div className="md:col-span-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
              <span className="font-extrabold text-sm text-[var(--text)] block pb-2 border-b border-[var(--border)]">
                {t('dashboard.censeurShortcuts')}
              </span>
              <div className="space-y-1.5 text-xs font-semibold">
                <button
                  onClick={() => onNav('timetable')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                  <span className="flex items-center gap-2"><Clock size={14} className="text-blue-500 dark:text-blue-400" /> {t('dashboard.manageTimetables')}</span>
                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
                <button
                  onClick={() => onNav('affectations')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                  <span className="flex items-center gap-2"><Users size={14} className="text-primary" /> {t('dashboard.manageAssignments')}</span>
                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
                <button
                  onClick={() => onNav('council')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                  <span className="flex items-center gap-2"><GraduationCap size={14} className="text-purple-500 dark:text-purple-400" /> {t('dashboard.manageCouncils')}</span>
                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
                <button
                  onClick={() => onNav('anonymat')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                  <span className="flex items-center gap-2"><UserCheck size={14} className="text-indigo-500 dark:text-indigo-400" /> {t('dashboard.manageAnonymat')}</span>
                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
                <button
                  onClick={() => onNav('classes')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                  <span className="flex items-center gap-2"><BookOpen size={14} className="text-emerald-500 dark:text-emerald-400" /> {t('dashboard.manageClasses')}</span>
                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
                <button
                  onClick={() => onNav('suivi-eleves')}
                  className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
                >
                  <span className="flex items-center gap-2"><AlertCircle size={14} className="text-orange-500 dark:text-orange-400" /> {t('dashboard.studentFollowUp')}</span>
                  <ArrowRight size={13} className="text-[var(--text3)]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPIS ET ALERTES CLASSIQUES (Pédagogie / Finance / Bibliothèque) */}
      {!loading && kpiCards.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold text-[var(--text3)] uppercase tracking-wider">
            Indicateurs de fonctionnement
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {kpiCards.map((k, i) => (
              <div
                key={i}
                onClick={() => onNav(k.nav)}
                className="p-3 md:p-4 cursor-pointer transition-all duration-150 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: k.bg }}>
                    <k.icon size={15} strokeWidth={2} />
                  </div>
                  <span className="text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: k.tBg, color: k.tC }}>
                    {k.trend}
                  </span>
                </div>
                <div className="text-xl md:text-2xl font-black text-[var(--text)]">{k.val}</div>
                <div className="text-xs text-[var(--text3)] mt-0.5 font-semibold truncate">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* État vide si aucune permission */}
      {allowedSections.size === 1 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '28px 20px', textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><KeyRound size={36} strokeWidth={1.75} /></div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('dashboard.noSectionAssignedTitle')}</div>
          <div className="text-xs md:text-[13px] text-[var(--text3)]" style={{ lineHeight: 1.6 }}>
            {t('dashboard.noSectionAssignedDesc')}
          </div>
        </div>
      )}
    </div>
  )
}
