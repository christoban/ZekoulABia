'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Loader2, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'
import type { Department, SectionSubjectsProps, SubjectItem, SubjectsView } from './subjects/types'
import { btnPrim } from './subjects/subjectsUi'
import { useSubjectsData } from './subjects/useSubjectsData'
import SubjectsCatalogueView from './subjects/SubjectsCatalogueView'
import SubjectsByClassView from './subjects/SubjectsByClassView'
import SubjectsDepartmentsView from './subjects/SubjectsDepartmentsView'
import SubjectsByTeacherView from './subjects/SubjectsByTeacherView'
import {
  SubjectAssignTeacherModal,
  SubjectClassAddModal,
  SubjectCoeffModal,
  SubjectCreateModal,
  SubjectEditModal,
} from './subjects/SubjectModals'
import { DeptCreateModal, DeptEditModal } from './subjects/DepartmentModals'

const VIEWS: SubjectsView[] = ['catalogue', 'par-classe', 'departements', 'par-enseignant']

export default function SectionSubjects({ onToast, onNav }: SectionSubjectsProps) {
  const t = useT('admin')
  const [view, setView] = useState<SubjectsView>('catalogue')
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SubjectItem | null>(null)
  const [assignTarget, setAssignTarget] = useState<SubjectItem | null>(null)
  const [coeffTarget, setCoeffTarget] = useState<SubjectItem | null>(null)
  const [addSubjectOpen, setAddSubjectOpen] = useState(false)
  const [deptCreateOpen, setDeptCreateOpen] = useState(false)
  const [deptEditTarget, setDeptEditTarget] = useState<Department | null>(null)

  const data = useSubjectsData({ view, onToast })
  const selectedClassName = data.classList.find(c => c.id === data.selectedClass)?.name
  const classSubjectIds = new Set(data.classSubjects.map(s => s.subjectId))

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5 space-y-4 max-w-7xl mx-auto pb-12 font-nunito">
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="pb-1.5 border-b border-[var(--border)]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="text-[15px] md:text-[17px] font-bold font-spectral" style={{ color: 'var(--text)' }}>
            {t('subjects.title')}
          </h1>
          <p className="text-[11px] md:text-[12px] font-medium mt-0.5" style={{ color: 'var(--text3)' }}>
            {data.loading ? '…' : t('subjects.count').replace('{count}', String(data.subjects.length))}
          </p>
        </div>

        <div className="flex md:hidden items-center gap-[6px] flex-shrink-0">
          <button
            onClick={data.handleSync}
            disabled={data.syncing}
            title={t('subjects.sync_title')}
            style={{ width: 36, height: 36, borderRadius: 9, border: 'none', background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)', opacity: data.syncing ? 0.7 : 1 }}
          >
            {data.syncing ? <Loader2 size={16} strokeWidth={2} className="animate-spin" /> : <RefreshCw size={16} strokeWidth={2} />}
          </button>
          {view === 'catalogue' && (
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-[6px] rounded-lg px-[13px] py-[8px] text-[13px] whitespace-nowrap border-0"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}
            >
              {t('subjects.btn_create')}
            </button>
          )}
          {view === 'departements' && (
            <button
              onClick={() => setDeptCreateOpen(true)}
              className="inline-flex items-center gap-[6px] rounded-lg px-[13px] py-[8px] text-[13px] whitespace-nowrap border-0"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}
            >
              {t('subjects.btn_create_dept')}
            </button>
          )}
        </div>

        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'var(--bg2)', borderRadius: 10, padding: 3.5, gap: 2 }}>
            {VIEWS.map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 13.5,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: view === v ? 'var(--surface)' : 'transparent',
                  color: view === v ? 'var(--text)' : 'var(--text3)',
                  boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t(`subjects.view_toggles.${v === 'par-classe' ? 'par_classe' : v === 'par-enseignant' ? 'par_enseignant' : v}`)}
              </button>
            ))}
          </div>
          <button
            style={{ ...btnPrim, opacity: data.syncing ? 0.7 : 1, fontSize: 13.5, padding: '8px 15px' }}
            onClick={data.handleSync}
            disabled={data.syncing}
            title={t('subjects.sync_title')}
          >
            {data.syncing ? t('subjects.syncing') : t('subjects.btn_sync')}
          </button>
          {view === 'catalogue' && <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('subjects.btn_create')}</button>}
          {view === 'departements' && <button style={btnPrim} onClick={() => setDeptCreateOpen(true)}>{t('subjects.btn_create_dept')}</button>}
        </div>
      </div>

      <DelegationSupervisionBanner actorTitle="Animateur Pédagogique" domainLabel="Matières & Coefficients" onNav={onNav} />

      <div className="mb-4 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-sm text-[var(--text)] flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/15 text-indigo-600 flex-shrink-0">
            <BookOpen size={18} />
          </div>
          <div>
            <p className="font-bold text-sm">Matrice de Conformité Ministérielle & Coefficients</p>
            <p className="text-xs text-[var(--text2)]">
              Le découpage disciplinaire est préparé par les Animateurs Pédagogiques (AP). L&apos;Administrateur supervise la conformité des volumes horaires et l&apos;équilibre des coefficients entre séries.
            </p>
          </div>
        </div>
      </div>

      <div className="relative md:hidden mb-[14px] -mr-4">
        <div className="flex gap-[6px] overflow-x-auto" style={{ padding: '2px 32px 4px 0', scrollbarWidth: 'none' }}>
          {VIEWS.map(v => {
            const active = view === v
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className="relative flex-shrink-0 rounded-full px-[15px] py-[9.5px] whitespace-nowrap border-0"
                style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {active && (
                  <motion.div
                    layoutId="subjects-view-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--sidebar)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 text-[13px]" style={{ fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>
                  {t(`subjects.view_toggles.${v === 'par-classe' ? 'par_classe' : v === 'par-enseignant' ? 'par_enseignant' : v}`)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-[4px] w-7" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
      </div>

      {view === 'par-classe' && (
        <SubjectsByClassView
          classList={data.classList}
          selectedClass={data.selectedClass}
          selectedClassName={selectedClassName}
          classSubjects={data.classSubjects}
          loadingCV={data.loadingCV}
          classViewError={data.classViewError}
          deletingSubjId={data.deletingSubjId}
          onSelectClass={data.handleSelectClass}
          onOpenAddSubject={() => setAddSubjectOpen(true)}
          onDeleteSubject={data.handleDeleteSubject}
          onUpdateCoefficient={data.handleUpdateCoefficient}
        />
      )}

      {view === 'catalogue' && (
        <SubjectsCatalogueView
          subjects={data.subjects}
          loading={data.loading}
          error={data.error}
          deletingId={data.deletingId}
          onRetry={data.fetchSubjects}
          onOpenAssign={setAssignTarget}
          onOpenEdit={setEditTarget}
          onOpenCoeff={setCoeffTarget}
          onDelete={data.handleDelete}
        />
      )}

      {view === 'departements' && (
        <SubjectsDepartmentsView
          subjects={data.subjects}
          allDepartments={data.allDepartments}
          deptLoading={data.deptLoading}
          deptError={data.deptError}
          onRetry={data.fetchDepartments}
          onOpenCreateDept={() => setDeptCreateOpen(true)}
          onOpenEditDept={setDeptEditTarget}
          onMoveSubject={data.moveSubjectToDept}
        />
      )}

      {view === 'par-enseignant' && (
        <SubjectsByTeacherView
          subjects={data.subjects}
          teachers={data.teacherViewTeachers}
          loading={data.teacherViewLoading}
          onRefresh={data.fetchTeacherView}
          onToast={onToast}
        />
      )}

      {createOpen && (
        <SubjectCreateModal onClose={() => setCreateOpen(false)} onCreated={data.fetchSubjects} onToast={onToast} />
      )}
      {editTarget && (
        <SubjectEditModal subject={editTarget} onClose={() => setEditTarget(null)} onUpdated={data.fetchSubjects} onToast={onToast} />
      )}
      {coeffTarget && (
        <SubjectCoeffModal subject={coeffTarget} onClose={() => setCoeffTarget(null)} onToast={onToast} />
      )}
      {addSubjectOpen && (
        <SubjectClassAddModal
          selectedClass={data.selectedClass}
          selectedClassName={selectedClassName}
          subjects={data.subjects}
          classSubjectIds={classSubjectIds}
          onClose={() => setAddSubjectOpen(false)}
          onAdded={() => data.handleSelectClass(data.selectedClass)}
          onToast={onToast}
        />
      )}
      {assignTarget && (
        <SubjectAssignTeacherModal
          subject={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={data.fetchSubjects}
          onToast={onToast}
        />
      )}
      {deptCreateOpen && (
        <DeptCreateModal onClose={() => setDeptCreateOpen(false)} onCreated={data.fetchDepartments} />
      )}
      {deptEditTarget && (
        <DeptEditModal
          dept={deptEditTarget}
          allTeachers={data.allTeachers}
          onClose={() => setDeptEditTarget(null)}
          onUpdated={data.fetchDepartments}
          onToast={onToast}
        />
      )}
    </div>
  )
}
