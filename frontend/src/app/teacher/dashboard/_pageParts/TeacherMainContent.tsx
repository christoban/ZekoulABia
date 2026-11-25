'use client'

import SectionTeacherDashboard from '../_components/SectionTeacherDashboard'
import SectionTeacherClasses from '../_components/SectionTeacherClasses'
import SectionTeacherAttendance from '../_components/SectionTeacherAttendance'
import SectionTeacherGrades from '../_components/SectionTeacherGrades'
import SectionTeacherBulletins from '../_components/SectionTeacherBulletins'
import SectionTeacherTimetable from '../_components/SectionTeacherTimetable'
import SectionProfesseurPrincipal from '../_components/SectionProfesseurPrincipal'
import SectionAppreciationsPP from '../_components/SectionAppreciationsPP'
import SectionDepartementAP from '../_components/SectionDepartementAP'
import SectionCahierDeTexte from '../_components/SectionCahierDeTexte'
import SectionTeacherAtRisk from '../_components/SectionTeacherAtRisk'
import SectionMesActionsSuivi from '../_components/SectionMesActionsSuivi'
import SectionTeacherCorrectionAnonyme from '../_components/SectionTeacherCorrectionAnonyme'
import SectionMonProfilRH from '@/features/rh/SectionMonProfilRH'
import NotificationCenter from '@/components/NotificationCenter'
import Babillard from '@/features/communication/Babillard'
import CarnetLiaisonView from '@/features/carnet-liaison/CarnetLiaisonView'
import Messagerie from '@/features/messagerie'
import SectionOfflineStatus from '@/components/SectionOfflineStatus'
import type { TeacherSection, Toast, UserInfo } from '../_types'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

interface Props {
  section: TeacherSection
  visitedSections: Set<TeacherSection>
  user: UserInfo | null
  selectedPPClassId: string
  selectedAPDeptId: string
  onSelectSection: (section: TeacherSection) => void
  onSelectPPClass: (id: string) => void
  onSelectAPDept: (id: string) => void
  showToast: (msg: string, type?: Toast['type']) => void
  tnav: TranslateFn
  tcommon: TranslateFn
}

export default function TeacherMainContent({
  section,
  visitedSections,
  user,
  selectedPPClassId,
  selectedAPDeptId,
  onSelectSection,
  onSelectPPClass,
  onSelectAPDept,
  showToast,
  tnav,
  tcommon,
}: Props) {
  const sProps = { onToast: showToast, user }
  const ppList = user?.classesProfessorPrincipal ?? []
  const activePPClass = ppList.find(c => c.id === selectedPPClassId) || ppList[0]
  const deptList = user?.headedDepartments ?? []
  const activeAPDept = deptList.find(d => d.id === selectedAPDeptId) || deptList[0]

  return (
    <main className="pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ display: section === 'dashboard' ? 'contents' : 'none' }}>
        <SectionTeacherDashboard onNav={s => onSelectSection(s as TeacherSection)} {...sProps} />
      </div>
      {visitedSections.has('classes') && (
        <div style={{ display: section === 'classes' ? 'contents' : 'none' }}>
          <SectionTeacherClasses onNav={s => onSelectSection(s as TeacherSection)} {...sProps} />
        </div>
      )}
      {visitedSections.has('attendance') && (
        <div style={{ display: section === 'attendance' ? 'contents' : 'none' }}>
          <SectionTeacherAttendance {...sProps} />
        </div>
      )}
      {visitedSections.has('grades') && (
        <div style={{ display: section === 'grades' ? 'contents' : 'none' }}>
          <SectionTeacherGrades {...sProps} />
        </div>
      )}
      {visitedSections.has('bulletins') && (
        <div style={{ display: section === 'bulletins' ? 'contents' : 'none' }}>
          <SectionTeacherBulletins onNav={s => onSelectSection(s as TeacherSection)} onToast={showToast} />
        </div>
      )}
      {visitedSections.has('timetable') && (
        <div style={{ display: section === 'timetable' ? 'contents' : 'none' }}>
          <SectionTeacherTimetable {...sProps} />
        </div>
      )}
      {visitedSections.has('sync') && (
        <div style={{ display: section === 'sync' ? 'contents' : 'none' }}>
          <SectionOfflineStatus onToast={showToast} namespace="teacher" />
        </div>
      )}
      {visitedSections.has('pp-classe') && (
        <div style={{ display: section === 'pp-classe' ? 'contents' : 'none' }}>
          {activePPClass ? (
            <SectionProfesseurPrincipal
              user={user!}
              classeId={activePPClass.id}
              classeNom={activePPClass.name}
              classesList={ppList}
              onSelectClasse={onSelectPPClass}
            />
          ) : null}
        </div>
      )}
      {visitedSections.has('pp-appreciations') && (
        <div style={{ display: section === 'pp-appreciations' ? 'contents' : 'none' }}>
          {activePPClass ? (
            <SectionAppreciationsPP
              user={user!}
              classeId={activePPClass.id}
              classeNom={activePPClass.name}
              classesList={ppList}
              onSelectClasse={onSelectPPClass}
            />
          ) : null}
        </div>
      )}
      {visitedSections.has('ap-departement') && (
        <div style={{ display: section === 'ap-departement' ? 'contents' : 'none' }}>
          {activeAPDept ? (
            <SectionDepartementAP
              user={user!}
              departementId={activeAPDept.id}
              departementNom={activeAPDept.name}
              departmentsList={deptList}
              onSelectDept={onSelectAPDept}
              onToast={showToast}
            />
          ) : null}
        </div>
      )}
      {visitedSections.has('cahier-de-texte') && (
        <div style={{ display: section === 'cahier-de-texte' ? 'contents' : 'none' }}>
          <SectionCahierDeTexte user={user} onToast={showToast} />
        </div>
      )}
      {visitedSections.has('at-risk') && user && (
        <div style={{ display: section === 'at-risk' ? 'contents' : 'none' }}>
          <SectionTeacherAtRisk currentUserId={user.id} onToast={showToast} />
        </div>
      )}
      {visitedSections.has('mon-suivi') && (
        <div style={{ display: section === 'mon-suivi' ? 'contents' : 'none' }}>
          <SectionMesActionsSuivi onToast={showToast} />
        </div>
      )}
      {visitedSections.has('correction-anonyme') && (
        <div style={{ display: section === 'correction-anonyme' ? 'contents' : 'none' }}>
          <SectionTeacherCorrectionAnonyme onToast={showToast} />
        </div>
      )}
      {visitedSections.has('mon-profil-rh') && (
        <div style={{ display: section === 'mon-profil-rh' ? 'contents' : 'none' }}>
          <SectionMonProfilRH onToast={showToast} />
        </div>
      )}
      {visitedSections.has('notifications') && (
        <div style={{ display: section === 'notifications' ? 'contents' : 'none' }}>
          <NotificationCenter onNav={s => onSelectSection(s as TeacherSection)} />
        </div>
      )}
      {visitedSections.has('babillard') && (
        <div style={{ display: section === 'babillard' ? 'contents' : 'none' }}>
          <Babillard role={user?.role ?? 'TEACHER'} title={tnav('sidebar.babillard')} subtitle={tcommon('brand.roleTeacher')} currentUserId={user?.id} />
        </div>
      )}
      {visitedSections.has('carnet-liaison') && (
        <div style={{ display: section === 'carnet-liaison' ? 'contents' : 'none' }}>
          <CarnetLiaisonView role="TEACHER" onToast={showToast} />
        </div>
      )}
      {visitedSections.has('messagerie') && (
        <div style={{ display: section === 'messagerie' ? 'contents' : 'none' }}>
          <Messagerie />
        </div>
      )}
    </main>
  )
}
