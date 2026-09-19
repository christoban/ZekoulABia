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
interface AdminBadges { users?: string; classes?: string; grades?: string; finance?: string }
interface SessionUser { id?: string; userId?: string; nomComplet?: string; firstName?: string; role?: string }

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
      })
      .catch(err => { if (err !== 'auth') console.warn('[dashboard] Erreur réseau:', err) })

    fetchApi('/api/v2/dashboard/admin-badges')
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const { users, classes, pendingGrades, pendingInvoices } = d.data as { users: number; classes: number; pendingGrades: number; pendingInvoices: number }
        setBadges({
          users:   users > 0         ? String(users)         : undefined,
          classes: classes > 0       ? String(classes)       : undefined,
          grades:  pendingGrades > 0 ? String(pendingGrades) : undefined,
          finance: pendingInvoices > 0 ? String(pendingInvoices) : undefined,
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

        <main style={{ flex: 1, overflow: 'hidden' }}>
          {section === 'dashboard' && (
            <SectionDashboard
              onNav={s => setSection(s as AdminSection)}
              onInvite={() => showToast(t('page.toast.feature_coming'), 'info')}
              onToast={showToast}
            />
          )}
          {section === 'org-pedagogy' && <SectionOrgPedagogyHub onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'users'     && <SectionUsers     onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'classes'   && <SectionClasses   onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'subjects'  && <SectionSubjects  onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'grades'    && <SectionGrades    onToast={showToast} />}
          {section === 'bulletins' && <SectionBulletins onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'timetable' && <SectionTimetable onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'academic-events' && <SectionAdminAcademicEvents onToast={showToast} />}
          {section === 'finance'       && <SectionFinance       onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'attendance'    && <SectionAdminAttendance onToast={showToast} />}
          {section === 'council'       && <SectionAdminCouncil  onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'bulletin-validation' && <SectionBulletinValidation onToast={showToast} />}
          {section === 'ai'            && <SectionAdminAI       onToast={showToast} />}
          {section === 'statistics'    && <SectionStatistics    onToast={showToast} />}
          {section === 'babillard' && <Babillard role={sessionUser?.role ?? 'ADMIN'} title={t('page.section_titles.babillard')} subtitle={t('page.section_titles.babillard_subtitle')} currentUserId={sessionUser?.userId ?? sessionUser?.id} />}
          {section === 'messagerie' && <Messagerie />}
          {section === 'pedagogie'     && <SectionPedagogie     onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'rh'            && <SectionRH            onToast={showToast} />}
          {section === 'matricules'    && <SectionMatricules    onToast={showToast} />}
          {section === 'school-payments' && <SectionSchoolPayments onToast={showToast} />}
          {section === 'entrance-exams' && <SectionAdminEntranceExams onToast={showToast} />}
          {section === 'eleve-onboarding' && <SectionEleveOnboarding onNav={s => setSection(s as AdminSection)} onToast={showToast} />}
          {section === 'minesec-stats'  && <SectionMinesecStatistics onToast={showToast} />}
          {section === 'minedub-stats'  && <SectionMinedubStatistics onToast={showToast} />}
          {section === 'ministerial-stats' && (schoolInfo?.isPrimaire === true ? <SectionMinedubStatistics onToast={showToast} /> : <SectionMinesecStatistics onToast={showToast} />)}
          {section === 'pebs-exams'    && <SectionAdminPebsExams    onToast={showToast} />}
          {section === 'lv2-choice'    && <SectionAdminLV2Choice    onToast={showToast} />}
          {section === 'group-transfers' && <SectionAdminGroupTransfers onToast={showToast} />}
          {section === 'notifications' && <NotificationCenter />}
          {section === 'settings'      && <SectionSettings      onToast={showToast} schoolInfo={schoolInfo} onLogoUpdate={url => setSchoolInfo(s => s ? { ...s, logoUrl: url } : null)} />}
          {section === 'corbeille'     && <SectionCorbeille     onToast={showToast} />}
          {section === 'sync-offline' && <SectionOfflineStatus onToast={showToast} namespace="admin" />}
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
    </div>
  )
}
