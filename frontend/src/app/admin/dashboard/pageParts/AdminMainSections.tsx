'use client'

import type React from 'react'
import { useT } from '@/lib/i18n'
import NotificationCenter from '@/components/NotificationCenter'
import SectionOfflineStatus from '@/components/SectionOfflineStatus'
import Babillard from '@/features/communication/Babillard'
import CarnetLiaisonView from '@/features/carnet-liaison/CarnetLiaisonView'
import Messagerie from '@/features/messagerie'
import SectionBulletinValidation from '../../../staff/dashboard/_components/SectionBulletinValidation'
import SectionDashboard from '../_components/SectionDashboard'
import SectionUsers from '../_components/SectionUsers'
import SectionClasses from '../_components/SectionClasses'
import SectionSubjects from '../_components/SectionSubjects'
import SectionGrades from '../_components/SectionGrades'
import SectionBulletins from '../_components/SectionBulletins'
import SectionTimetable from '../_components/SectionTimetable'
import SectionSettings from '../_components/SectionSettings'
import SectionCorbeille from '../_components/SectionCorbeille'
import SectionFinance from '../_components/SectionFinance'
import SectionAdminAttendance from '../_components/SectionAdminAttendance'
import SectionAdminCouncil from '../_components/SectionAdminCouncil'
import SectionAdminAI from '../_components/SectionAdminAI'
import SectionStatistics from '../_components/SectionStatistics'
import SectionPedagogie from '../_components/SectionPedagogie'
import SectionRH from '../_components/SectionRH'
import SectionMatricules from '../_components/SectionMatricules'
import SectionSchoolPayments from '../_components/SectionSchoolPayments'
import SectionAdminLV2Choice from '../_components/SectionAdminLV2Choice'
import SectionAdminEntranceExams from '../_components/SectionAdminEntranceExams'
import SectionAdminAcademicEvents from '../_components/SectionAdminAcademicEvents'
import SectionAdminGroupTransfers from '../_components/SectionAdminGroupTransfers'
import SectionAdminStudentTransfers from '../_components/SectionAdminStudentTransfers'
import SectionEleveOnboarding from '../_components/SectionEleveOnboarding'
import SectionMinesecStatistics from '../_components/SectionMinesecStatistics'
import SectionMinedubStatistics from '../_components/SectionMinedubStatistics'
import SectionAdminPebsExams from '../_components/SectionAdminPebsExams'
import SectionOrgPedagogyHub from '../_components/SectionOrgPedagogyHub'
import type { AdminSection, Toast } from '../_types'
import type { SchoolInfo, SessionUser } from './types'

interface AdminMainSectionsProps {
  section: AdminSection
  visitedSections: Set<AdminSection>
  setSection: React.Dispatch<React.SetStateAction<AdminSection>>
  showToast: (msg: string, type?: Toast['type']) => void
  schoolInfo: SchoolInfo | null
  onLogoUpdate: (url: string) => void
  sessionUser: SessionUser | null
}

export default function AdminMainSections({
  section,
  visitedSections,
  setSection,
  showToast,
  schoolInfo,
  onLogoUpdate,
  sessionUser,
}: AdminMainSectionsProps) {
  const t = useT('admin')

  return (
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
      {visitedSections.has('carnet-liaison') && (
        <div style={{ display: section === 'carnet-liaison' ? 'contents' : 'none' }}>
          <CarnetLiaisonView role="ADMIN" onToast={showToast} />
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
      {visitedSections.has('student-transfers') && (
        <div style={{ display: section === 'student-transfers' ? 'contents' : 'none' }}>
          <SectionAdminStudentTransfers onToast={showToast} />
        </div>
      )}
      {visitedSections.has('notifications') && (
        <div style={{ display: section === 'notifications' ? 'contents' : 'none' }}>
          <NotificationCenter onNav={s => setSection(s as AdminSection)} />
        </div>
      )}
      {visitedSections.has('settings') && (
        <div style={{ display: section === 'settings' ? 'contents' : 'none' }}>
          <SectionSettings onToast={showToast} schoolInfo={schoolInfo} onLogoUpdate={onLogoUpdate} />
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
    </main>
  )
}
