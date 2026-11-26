'use client'

import type { StaffSection } from './_types'
import StaffSidebar from './_components/StaffSidebar'
import StaffTopbar from './_components/StaffTopbar'
import StaffBottomNav from './_components/StaffBottomNav'
import StaffToast from './_components/StaffToast'
import { logoutUser } from '@/lib/userAuth'
import SectionStaffDashboard from './_components/SectionStaffDashboard'
import SectionCouncil from './_components/SectionCouncil'
import SectionBulletinValidation from './_components/SectionBulletinValidation'
import SectionAttendanceStaff from './_components/SectionAttendanceStaff'
import SectionGrilleHoraire from './_components/SectionGrilleHoraire'
import SectionAffectations from './_components/SectionAffectations'
import SectionTimetableStaff from './_components/SectionTimetableStaff'
import SectionFinanceStaff from './_components/SectionFinanceStaff'
import SectionAPEEStaff from './_components/SectionAPEEStaff'
import SectionCautions from './_components/SectionCautions'
import SectionDiscipline from './_components/SectionDiscipline'
import SectionLibrary from './_components/SectionLibrary'
import SectionOrientation from './_components/SectionOrientation'
import SectionDepartementsStaff from './_components/SectionDepartementsStaff'
import SectionPedagogieStaff from './_components/SectionPedagogieStaff'
import SectionSuiviElevesStaff from './_components/SectionSuiviElevesStaff'
import SectionAnonymatStaff from './_components/SectionAnonymatStaff'
import APEEAlertBanner from './_components/APEEAlertBanner'
import SectionMonProfilRH from '@/features/rh/SectionMonProfilRH'
import NotificationCenter from '@/components/NotificationCenter'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import AssistantWidget from '../../admin/dashboard/_components/AssistantWidget'
import SectionOfflineStatus from '@/components/SectionOfflineStatus'
import Babillard from '@/features/communication/Babillard'
import CarnetLiaisonView from '@/features/carnet-liaison/CarnetLiaisonView'
import Messagerie from '@/features/messagerie'
import SectionModerationMessagerie from './_components/SectionModerationMessagerie'
import SectionClassesStaff from './_components/SectionClassesStaff'
import SectionElevesAffectationsStaff from './_components/SectionElevesAffectationsStaff'
import SectionImportElevesStaff from './_components/SectionImportElevesStaff'
import SectionInscriptionsStaff from './_components/SectionInscriptionsStaff'
import SectionConcoursStaff from './_components/SectionConcoursStaff'
import SectionConfigurationStaff from './_components/SectionConfigurationStaff'
import SectionRapportsStaff from './_components/SectionRapportsStaff'
import SectionElevesFamillesStaff from './_components/SectionElevesFamillesStaff'
import SectionTransfertsStaff from './_components/SectionTransfertsStaff'
import ModeTestBanner from '@/components/ModeTestBanner'
import { useT } from '@/lib/i18n'
import { useStaffDashboardShell } from './_pageParts/useStaffDashboardShell'

// Références conservées pour l'audit statique des sections Staff
void [SectionBulletinValidation, SectionGrilleHoraire, SectionAffectations, SectionCautions]

const STAFF_ASSISTANT_SUGGESTIONS = [
  'Enregistre un avertissement écrit à Paul pour bavardage',
  "Quel est le solde de l'APEE ?",
  'Quels livres sont disponibles sur la géographie ?',
]

export default function StaffDashboard() {
  const tnav = useT('navigation')
  const {
    section,
    setSection,
    visitedSections,
    mobileNavOpen,
    setMobileNavOpen,
    toasts,
    showToast,
    removeToast,
    sessionUser,
    allowedSections,
    schoolName,
    logoUrl,
    changePwdOpen,
    setChangePwdOpen,
    hasActiveEntranceExam,
    navTo,
    can,
  } = useStaffDashboardShell()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>

      <StaffSidebar
        current={section}
        onChange={navTo}
        allowedSections={allowedSections}
        sessionUser={sessionUser}
        schoolName={schoolName}
        logoUrl={logoUrl}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        hasActiveEntranceExam={hasActiveEntranceExam}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <StaffTopbar
          section={section}
          onChangePassword={() => setChangePwdOpen(true)}
          onNav={s => navTo(s as StaffSection)}
          onMenuClick={() => setMobileNavOpen(true)}
          sessionUser={sessionUser}
          onLogout={logoutUser}
        />
        <ModeTestBanner />
        <EventCenterWidget />
        <APEEAlertBanner visible={can('apee')} onNav={s => navTo(s as StaffSection)} />

        <main className="pb-[calc(68px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

          <div style={{ display: section === 'dashboard' ? 'contents' : 'none' }}>
            <SectionStaffDashboard
              sessionUser={sessionUser}
              allowedSections={allowedSections}
              onNav={navTo}
              onToast={showToast}
            />
          </div>

          {visitedSections.has('inscriptions') && can('inscriptions') && (
            <div style={{ display: section === 'inscriptions' ? 'contents' : 'none' }}>
              <SectionInscriptionsStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('concours') && can('concours') && (
            <div style={{ display: section === 'concours' ? 'contents' : 'none' }}>
              <SectionConcoursStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('eleves-familles') && can('eleves-familles') && (
            <div style={{ display: section === 'eleves-familles' ? 'contents' : 'none' }}>
              <SectionElevesFamillesStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('transferts') && can('transferts') && (
            <div style={{ display: section === 'transferts' ? 'contents' : 'none' }}>
              <SectionTransfertsStaff sessionUser={sessionUser} onToast={showToast} />
            </div>
          )}

          {visitedSections.has('council') && can('council') && (
            <div style={{ display: section === 'council' ? 'contents' : 'none' }}>
              <SectionCouncil onToast={showToast} />
            </div>
          )}

          {visitedSections.has('anonymat') && can('anonymat') && (
            <div style={{ display: section === 'anonymat' ? 'contents' : 'none' }}>
              <SectionAnonymatStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('attendance') && can('attendance') && (
            <div style={{ display: section === 'attendance' ? 'contents' : 'none' }}>
              <SectionAttendanceStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('eleves-affectations') && can('eleves-affectations') && (
            <div style={{ display: section === 'eleves-affectations' ? 'contents' : 'none' }}>
              <SectionElevesAffectationsStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('timetable') && can('timetable') && (
            <div style={{ display: section === 'timetable' ? 'contents' : 'none' }}>
              <SectionTimetableStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('finance') && can('finance') && (
            <div style={{ display: section === 'finance' ? 'contents' : 'none' }}>
              <SectionFinanceStaff onToast={showToast} sessionUser={sessionUser} />
            </div>
          )}

          {visitedSections.has('apee') && can('apee') && (
            <div style={{ display: section === 'apee' ? 'contents' : 'none' }}>
              <SectionAPEEStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('discipline') && can('discipline') && (
            <div style={{ display: section === 'discipline' ? 'contents' : 'none' }}>
              <SectionDiscipline onToast={showToast} />
            </div>
          )}

          {visitedSections.has('library') && can('library') && (
            <div style={{ display: section === 'library' ? 'contents' : 'none' }}>
              <SectionLibrary onToast={showToast} />
            </div>
          )}

          {visitedSections.has('orientation') && can('orientation') && (
            <div style={{ display: section === 'orientation' ? 'contents' : 'none' }}>
              <SectionOrientation onToast={showToast} />
            </div>
          )}

          {visitedSections.has('departements') && can('departements') && (
            <div style={{ display: section === 'departements' ? 'contents' : 'none' }}>
              <SectionDepartementsStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('pedagogie') && can('pedagogie') && (
            <div style={{ display: section === 'pedagogie' ? 'contents' : 'none' }}>
              <SectionPedagogieStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('suivi-eleves') && can('suivi-eleves') && (
            <div style={{ display: section === 'suivi-eleves' ? 'contents' : 'none' }}>
              <SectionSuiviElevesStaff sessionUser={sessionUser} onToast={showToast} />
            </div>
          )}

          {visitedSections.has('configuration') && (
            <div style={{ display: (section === 'configuration' || ['import-eleves', 'classes', 'grille-horaire', 'affectations', 'cautions'].includes(section)) ? 'contents' : 'none' }}>
              <SectionConfigurationStaff
                onToast={showToast}
                allowedSections={allowedSections}
                initialTab={['import-eleves', 'classes', 'grille-horaire', 'affectations', 'cautions'].includes(section) ? section : undefined}
              />
            </div>
          )}

          {visitedSections.has('rapports') && can('rapports') && (
            <div style={{ display: section === 'rapports' ? 'contents' : 'none' }}>
              <SectionRapportsStaff />
            </div>
          )}

          {visitedSections.has('mon-profil-rh') && (
            <div style={{ display: section === 'mon-profil-rh' ? 'contents' : 'none' }}>
              <SectionMonProfilRH onToast={showToast} />
            </div>
          )}
          {visitedSections.has('notifications') && (
            <div style={{ display: section === 'notifications' ? 'contents' : 'none' }}>
              <NotificationCenter onNav={s => setSection(s as StaffSection)} />
            </div>
          )}
          {visitedSections.has('sync-offline') && (
            <div style={{ display: section === 'sync-offline' ? 'contents' : 'none' }}>
              <SectionOfflineStatus onToast={showToast} namespace="staff" />
            </div>
          )}
          {visitedSections.has('babillard') && (
            <div style={{ display: section === 'babillard' ? 'contents' : 'none' }}>
              <Babillard role={sessionUser?.role ?? 'STAFF'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} currentUserId={sessionUser?.userId} />
            </div>
          )}
          {visitedSections.has('carnet-liaison') && (
            <div style={{ display: section === 'carnet-liaison' ? 'contents' : 'none' }}>
              <CarnetLiaisonView role="STAFF" onToast={showToast} />
            </div>
          )}
          {visitedSections.has('messagerie') && (
            <div style={{ display: section === 'messagerie' ? 'contents' : 'none' }}>
              <Messagerie />
            </div>
          )}
          {visitedSections.has('moderation-messagerie') && (
            <div style={{ display: section === 'moderation-messagerie' ? 'contents' : 'none' }}>
              <SectionModerationMessagerie onToast={showToast} />
            </div>
          )}

        </main>
      </div>

      <StaffToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
      <AssistantWidget section={section} rolePrefix="staff" suggestions={STAFF_ASSISTANT_SUGGESTIONS} />
      <StaffBottomNav current={section} onChange={navTo} allowedSections={allowedSections} onOpenMenu={() => setMobileNavOpen(true)} hasActiveEntranceExam={hasActiveEntranceExam} />
    </div>
  )
}
