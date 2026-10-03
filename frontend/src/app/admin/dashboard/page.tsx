'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logoutUser } from '@/lib/userAuth'
import { fetchApi } from '@/lib/fetchApi'
import AdminSidebar from './_components/AdminSidebar'
import AdminTopbar from './_components/AdminTopbar'
import SectionDashboard from './_components/SectionDashboard'
import SectionUsers from './_components/SectionUsers'
import SectionClasses from './_components/SectionClasses'
import SectionSubjects from './_components/SectionSubjects'
import SectionGrades from './_components/SectionGrades'
import SectionBulletins from './_components/SectionBulletins'
import SectionTimetable from './_components/SectionTimetable'
import SectionSettings from './_components/SectionSettings'
import SectionCorbeille from './_components/SectionCorbeille'
import NotificationCenter from '@/components/NotificationCenter'
import SectionFinance from './_components/SectionFinance'
import SectionPlaceholder from './_components/SectionPlaceholder'
import AdminBottomNav from './_components/AdminBottomNav'
import SectionAdminAttendance from './_components/SectionAdminAttendance'
import SectionAdminCouncil from './_components/SectionAdminCouncil'
import SectionBulletinValidation from '../../staff/dashboard/_components/SectionBulletinValidation'
import SectionAdminAI from './_components/SectionAdminAI'
import SectionStatistics from './_components/SectionStatistics'
import SectionPedagogie from './_components/SectionPedagogie'
import AnomaliesAlertBanner from './_components/AnomaliesAlertBanner'
import SectionRH from './_components/SectionRH'
import SectionMatricules from './_components/SectionMatricules'
import SectionSchoolPayments from './_components/SectionSchoolPayments'
import SectionAdminLV2Choice from './_components/SectionAdminLV2Choice'
import SectionAdminEntranceExams from './_components/SectionAdminEntranceExams'
import SectionEleveOnboarding from './_components/SectionEleveOnboarding'
import SectionMinesecStatistics from './_components/SectionMinesecStatistics'
import SectionMinedubStatistics from './_components/SectionMinedubStatistics'
import SectionAdminPebsExams from './_components/SectionAdminPebsExams'
import SectionAdminAcademicEvents from './_components/SectionAdminAcademicEvents'
import SectionAdminGroupTransfers from './_components/SectionAdminGroupTransfers'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import AdminToast from './_components/AdminToast'
import AssistantWidget from './_components/AssistantWidget'
import HighlightController from './_components/HighlightController'
import SectionOrgPedagogyHub from './_components/SectionOrgPedagogyHub'
import ClotureAnneeModal from './_components/ClotureAnneeModal'
import type { AdminSection, Toast } from './_types'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import { useT } from '@/lib/i18n'
import Babillard from '@/features/communication/Babillard'
import Messagerie from '@/features/messagerie'
import SectionOfflineStatus from '@/components/SectionOfflineStatus'

let toastId = 0

const ADMIN_SECTIONS: AdminSection[] = [
  'dashboard', 'users', 'classes', 'subjects',
  'attendance', 'grades', 'bulletins', 'timetable',
  'council', 'academic-events', 'finance', 'ai', 'statistics', 'communications', 'babillard', 'messagerie', 'settings', 'corbeille', 'sync-offline',
  'bulletin-validation',
  'pedagogie', 'rh', 'lv2-choice', 'entrance-exams', 'pebs-exams', 'matricules', 'school-payments', 'eleve-onboarding', 'minesec-stats', 'minedub-stats', 'ministerial-stats', 'group-transfers',
  'org-pedagogy',
]

const PLACEHOLDERS: Partial<Record<AdminSection, { icon: string; desc: string }>> = {}

interface SchoolInfo { id?: string; name: string; logoUrl: string | null; subdomain?: string; city?: string; phone?: string; email?: string; isPrimaire?: boolean | null }
interface AdminBadges { users?: string; classes?: string; grades?: string; finance?: string; 'eleve-onboarding'?: string }
interface SessionUser { id?: string; userId?: string; nomComplet?: string; firstName?: string; role?: string; avatarUrl?: string | null }

export default function AdminDashboard() {
  const t = useT('admin')
  const router = useRouter()
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [badges, setBadges] = useState<AdminBadges>({})
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  // Types d'événements académiques actuellement actifs — gate l'affichage des menus de
  // fonctionnalités événementielles (ex. 'lv2-choice') dans la sidebar : jamais visibles pour
  // rien toute l'année, seulement quand la fonctionnalité réelle qu'ils représentent est ouverte.
  const [activeEventTypes, setActiveEventTypes] = useState<string[]>([])
  // Concours 6e / PEBS : pas de AcademicEvent dédié — le statut réel de la session (déjà sa
  // propre machine à états) pilote directement la visibilité, sans dupliquer l'information.
  const [hasActiveEntranceExam, setHasActiveEntranceExam] = useState(false)
  const [hasActivePebs, setHasActivePebs] = useState(false)
  const [hasPendingGroupTransfers, setHasPendingGroupTransfers] = useState(false)
  const [clotureModalOpen, setClotureModalOpen] = useState(false)
  const [visitedSections, setVisitedSections] = useState<Set<AdminSection>>(() => new Set(['dashboard']))

  useEffect(() => {
    setVisitedSections(prev => {
      if (prev.has(section)) return prev
      const next = new Set(prev)
      next.add(section)
      return next
    })
  }, [section])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) setSessionUser(JSON.parse(raw) as SessionUser)
    } catch { /* ignore */ }

    const handleUserUpdated = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail) {
        setSessionUser(prev => prev ? { ...prev, ...customEvent.detail } : customEvent.detail)
      }
    }
    window.addEventListener('zekoulabia:user-updated', handleUserUpdated)

    fetchApi('/api/v2/school/me')
      .then(r => {
        if (r.status === 401) {
          try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
          router.replace('/login')
          return Promise.reject('auth')
        }
        return r.json()
      })
      .then(d => {
        if (!d || !d.success) {
          try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
          router.replace('/login')
          return
        }
        const { status } = d.data as { status: string }
        if (status === 'APPROVED') { router.replace('/admin/configuration'); return }
        if (status !== 'ACTIVE') {
          try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
          router.replace('/login')
          return
        }
        setSchoolInfo(d.data)

        const params = new URLSearchParams(window.location.search)
        if (params.get('activated') === '1') {
          showToast(t('page.toast.welcome_active'), 'success')
          window.history.replaceState(null, '', '/admin/dashboard')
        }
        const targetSection = params.get('section')
        const convId = params.get('conversationId')
        if (convId) {
          setSection('messagerie')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('zekoulabia:open-conversation', { detail: { conversationId: convId } }))
          }, 150)
        } else if (targetSection && ADMIN_SECTIONS.includes(targetSection as AdminSection)) {
          setSection(targetSection as AdminSection)
        }
      })
      .catch(err => { if (err !== 'auth') console.warn('[dashboard] Erreur réseau:', err) })

    fetchApi('/api/v2/dashboard/admin-badges')
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const { users, classes, pendingGrades, pendingInvoices, pendingOnboardings } = d.data as { users: number; classes: number; pendingGrades: number; pendingInvoices: number; pendingOnboardings?: number }
        setBadges({
          users:   users > 0         ? String(users)         : undefined,
          classes: classes > 0       ? String(classes)       : undefined,
          grades:  undefined,
          finance: pendingInvoices > 0 ? String(pendingInvoices) : undefined,
          'eleve-onboarding': (pendingOnboardings && pendingOnboardings > 0) ? String(pendingOnboardings) : undefined,
        })
      })
      .catch(() => { /* badges not critical */ })

    fetchApi('/api/v2/academic-events/active')
      .then(r => r.json())
      .then(d => { if (d.success) setActiveEventTypes((d.data || []).map((e: { type: string }) => e.type)) })
      .catch(() => { /* gating non critique — le menu reste masqué par défaut si l'appel échoue */ })

    fetchApi('/api/v2/entrance-exams')
      .then(r => r.json())
      .then(d => { if (d.success) setHasActiveEntranceExam((d.data || []).some((s: { status: string }) => s.status !== 'CLOSED')) })
      .catch(() => {})

    fetchApi('/api/v2/pebs-exams')
      .then(r => r.json())
      .then(d => { if (d.success) setHasActivePebs((d.data || []).some((s: { status: string }) => s.status !== 'APPLIED')) })
      .catch(() => {})

    fetchApi('/api/v2/group-transfers/incoming')
      .then(r => r.json())
      .then(d => { if (d.success) setHasPendingGroupTransfers((d.data || []).length > 0) })
      .catch(() => {})

    return () => window.removeEventListener('zekoulabia:user-updated', handleUserUpdated)
  }, [router, showToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/login')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

  // Navigation temps réel déclenchée par l'assistant IA (copilot) : quand il exécute
  // une action, on bascule vers l'écran concerné pour que le changement soit visible.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const section = (e as CustomEvent<{ section?: string }>).detail?.section
      if (section && ADMIN_SECTIONS.includes(section as AdminSection)) setSection(section as AdminSection)
    }
    window.addEventListener('zekoulabia:navigate', onNavigate)
    return () => window.removeEventListener('zekoulabia:navigate', onNavigate)
  }, [])

  // Déclenchement automatique de la modal de clôture depuis la cloche de notification
  useEffect(() => {
    const onOpenCloture = () => setClotureModalOpen(true)
    window.addEventListener('zekoulabia:open-cloture-modal', onOpenCloture)
    return () => window.removeEventListener('zekoulabia:open-cloture-modal', onOpenCloture)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-nunito),Nunito,sans-serif', background: 'var(--bg)' }}>
      <AdminSidebar current={section} onChange={setSection} schoolName={schoolInfo?.name} logoUrl={schoolInfo?.logoUrl} onLogout={logoutUser} badges={badges} sessionUser={sessionUser} activeEventTypes={activeEventTypes} hasActiveEntranceExam={hasActiveEntranceExam} hasActivePebs={hasActivePebs} hasPendingGroupTransfers={hasPendingGroupTransfers} isPrimaire={schoolInfo?.isPrimaire} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <AdminTopbar title={t(`page.section_titles.${section}`)} onNavigate={s => setSection(s as AdminSection)} onChangePassword={() => setChangePwdOpen(true)} onMenuClick={() => setMobileNavOpen(true)} sessionUser={sessionUser} onLogout={logoutUser} />
        <EventCenterWidget onNav={s => setSection(s as AdminSection)} />
        <AnomaliesAlertBanner onNav={s => setSection(s as AdminSection)} />

        <main className="flex-1 overflow-hidden pb-[60px] md:pb-0">
          <div style={{ display: section === 'dashboard' ? 'contents' : 'none' }}>
            <SectionDashboard
              onNav={s => setSection(s as AdminSection)}
              onInvite={() => showToast(t('page.toast.feature_coming'), 'info')}
              onToast={showToast}
            />
          </div>
          {visitedSections.has('org-pedagogy') && (
            <div style={{ display: section === 'org-pedagogy' ? 'contents' : 'none' }}>
              <SectionOrgPedagogyHub onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('users') && (
            <div style={{ display: section === 'users' ? 'contents' : 'none' }}>
              <SectionUsers onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('classes') && (
            <div style={{ display: section === 'classes' ? 'contents' : 'none' }}>
              <SectionClasses onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('subjects') && (
            <div style={{ display: section === 'subjects' ? 'contents' : 'none' }}>
              <SectionSubjects onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('grades') && (
            <div style={{ display: section === 'grades' ? 'contents' : 'none' }}>
              <SectionGrades onToast={showToast} />
            </div>
          )}
          {visitedSections.has('bulletins') && (
            <div style={{ display: section === 'bulletins' ? 'contents' : 'none' }}>
              <SectionBulletins onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('timetable') && (
            <div style={{ display: section === 'timetable' ? 'contents' : 'none' }}>
              <SectionTimetable onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('academic-events') && (
            <div style={{ display: section === 'academic-events' ? 'contents' : 'none' }}>
              <SectionAdminAcademicEvents onToast={showToast} />
            </div>
          )}
          {visitedSections.has('finance') && (
            <div style={{ display: section === 'finance' ? 'contents' : 'none' }}>
              <SectionFinance onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('attendance') && (
            <div style={{ display: section === 'attendance' ? 'contents' : 'none' }}>
              <SectionAdminAttendance onToast={showToast} />
            </div>
          )}
          {visitedSections.has('council') && (
            <div style={{ display: section === 'council' ? 'contents' : 'none' }}>
              <SectionAdminCouncil onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('bulletin-validation') && (
            <div style={{ display: section === 'bulletin-validation' ? 'contents' : 'none' }}>
              <SectionBulletinValidation onToast={showToast} />
            </div>
          )}
          {visitedSections.has('ai') && (
            <div style={{ display: section === 'ai' ? 'contents' : 'none' }}>
              <SectionAdminAI onToast={showToast} />
            </div>
          )}
          {visitedSections.has('statistics') && (
            <div style={{ display: section === 'statistics' ? 'contents' : 'none' }}>
              <SectionStatistics onToast={showToast} />
            </div>
          )}
          {visitedSections.has('babillard') && (
            <div style={{ display: section === 'babillard' ? 'contents' : 'none' }}>
              <Babillard role={sessionUser?.role ?? 'ADMIN'} title={t('page.section_titles.babillard')} subtitle={t('page.section_titles.babillard_subtitle')} currentUserId={sessionUser?.userId ?? sessionUser?.id} />
            </div>
          )}
          {visitedSections.has('messagerie') && (
            <div style={{ display: section === 'messagerie' ? 'contents' : 'none' }}>
              <Messagerie />
            </div>
          )}
          {visitedSections.has('pedagogie') && (
            <div style={{ display: section === 'pedagogie' ? 'contents' : 'none' }}>
              <SectionPedagogie onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('rh') && (
            <div style={{ display: section === 'rh' ? 'contents' : 'none' }}>
              <SectionRH onToast={showToast} />
            </div>
          )}
          {visitedSections.has('matricules') && (
            <div style={{ display: section === 'matricules' ? 'contents' : 'none' }}>
              <SectionMatricules onToast={showToast} />
            </div>
          )}
          {visitedSections.has('school-payments') && (
            <div style={{ display: section === 'school-payments' ? 'contents' : 'none' }}>
              <SectionSchoolPayments onToast={showToast} />
            </div>
          )}
          {visitedSections.has('entrance-exams') && (
            <div style={{ display: section === 'entrance-exams' ? 'contents' : 'none' }}>
              <SectionAdminEntranceExams onToast={showToast} />
            </div>
          )}
          {visitedSections.has('eleve-onboarding') && (
            <div style={{ display: section === 'eleve-onboarding' ? 'contents' : 'none' }}>
              <SectionEleveOnboarding onNav={s => setSection(s as AdminSection)} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('minesec-stats') && (
            <div style={{ display: section === 'minesec-stats' ? 'contents' : 'none' }}>
              <SectionMinesecStatistics onToast={showToast} />
            </div>
          )}
          {visitedSections.has('minedub-stats') && (
            <div style={{ display: section === 'minedub-stats' ? 'contents' : 'none' }}>
              <SectionMinedubStatistics onToast={showToast} />
            </div>
          )}
          {visitedSections.has('ministerial-stats') && (
            <div style={{ display: section === 'ministerial-stats' ? 'contents' : 'none' }}>
              {schoolInfo?.isPrimaire === true ? <SectionMinedubStatistics onToast={showToast} /> : <SectionMinesecStatistics onToast={showToast} />}
            </div>
          )}
          {visitedSections.has('pebs-exams') && (
            <div style={{ display: section === 'pebs-exams' ? 'contents' : 'none' }}>
              <SectionAdminPebsExams onToast={showToast} />
            </div>
          )}
          {visitedSections.has('lv2-choice') && (
            <div style={{ display: section === 'lv2-choice' ? 'contents' : 'none' }}>
              <SectionAdminLV2Choice onToast={showToast} />
            </div>
          )}
          {visitedSections.has('group-transfers') && (
            <div style={{ display: section === 'group-transfers' ? 'contents' : 'none' }}>
              <SectionAdminGroupTransfers onToast={showToast} />
            </div>
          )}
          {visitedSections.has('notifications') && (
            <div style={{ display: section === 'notifications' ? 'contents' : 'none' }}>
              <NotificationCenter onNav={s => setSection(s as AdminSection)} />
            </div>
          )}
          {visitedSections.has('settings') && (
            <div style={{ display: section === 'settings' ? 'contents' : 'none' }}>
              <SectionSettings onToast={showToast} schoolInfo={schoolInfo} onLogoUpdate={url => setSchoolInfo(s => s ? { ...s, logoUrl: url } : null)} />
            </div>
          )}
          {visitedSections.has('corbeille') && (
            <div style={{ display: section === 'corbeille' ? 'contents' : 'none' }}>
              <SectionCorbeille onToast={showToast} />
            </div>
          )}
          {visitedSections.has('sync-offline') && (
            <div style={{ display: section === 'sync-offline' ? 'contents' : 'none' }}>
              <SectionOfflineStatus onToast={showToast} namespace="admin" />
            </div>
          )}
          {Object.entries(PLACEHOLDERS).map(([key, val]) =>
            section === key ? (
              <SectionPlaceholder
                key={key}
                title={t(`page.section_titles.${key}`)}
                icon={val.icon}
                description={val.desc}
                onToast={showToast}
              />
            ) : null
          )}
        </main>
      </div>

      <AdminToast toasts={toasts} onRemove={removeToast} />
      <AssistantWidget section={section} />
      <HighlightController />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
      <ClotureAnneeModal
        isOpen={clotureModalOpen}
        onClose={() => setClotureModalOpen(false)}
        onToast={showToast}
        onSuccess={() => {
          showToast("Transition d'année effectuée avec succès", "success")
          window.location.reload()
        }}
      />
      <AdminBottomNav current={section} onChange={setSection} onOpenMenu={() => setMobileNavOpen(true)} />
    </div>
  )
}
