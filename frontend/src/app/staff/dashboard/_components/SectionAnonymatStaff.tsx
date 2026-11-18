'use client'

import { RefreshCw } from 'lucide-react'
import { useAnonymatData } from './anonymat/useAnonymatData'
import AnonymatCreateForm from './anonymat/AnonymatCreateForm'
import AnonymatSessionsTable from './anonymat/AnonymatSessionsTable'
import AnonymatDetailPanel from './anonymat/AnonymatDetailPanel'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function SectionAnonymatStaff({ onToast }: Props) {
  const state = useAnonymatData(onToast)

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 className="text-lg md:text-xl font-bold text-[var(--text)]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif' }}>
            Anonymat / Compositions
          </h1>
          <p className="text-[var(--text3)] text-xs md:text-[12.5px] mt-0.5">Gestion des sessions d&apos;évaluation anonymisées</p>
        </div>
        <button
          onClick={state.loadSessions}
          disabled={state.loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-xs font-semibold hover:bg-[var(--bg2)] transition-colors"
        >
          <RefreshCw size={13} className={state.loading ? 'animate-spin' : ''} />
          Rafraîchir
        </button>
      </div>

      <AnonymatCreateForm
        scopeId={state.scopeId}
        setScopeId={state.setScopeId}
        subjectId={state.subjectId}
        setSubjectId={state.setSubjectId}
        classId={state.classId}
        setClassId={state.setClassId}
        scheduledDate={state.scheduledDate}
        setScheduledDate={state.setScheduledDate}
        academicSequenceId={state.academicSequenceId}
        setAcademicSequenceId={state.setAcademicSequenceId}
        isAnonymized={state.isAnonymized}
        setIsAnonymized={state.setIsAnonymized}
        correctionMode={state.correctionMode}
        setCorrectionMode={state.setCorrectionMode}
        subjects={state.subjects}
        classes={state.classes}
        sequences={state.sequences}
        creating={state.creating}
        onCreate={state.createSession}
      />

      <AnonymatSessionsTable
        sessions={state.sessions}
        loading={state.loading}
        selected={state.selected}
        busyAction={state.designating || state.assigning || state.reconciling}
        generatingId={state.generating}
        onSelect={state.setSelected}
        onGenerateCodes={state.generateCodes}
        onOpenTeam={(session) => { state.setSelected(session); state.setTeamEmails('') }}
        onOpenCorrection={(session) => { state.setSelected(session); state.setCrossAssignments([]) }}
        onReconcile={state.reconcile}
      />

      {state.selected && (
        <AnonymatDetailPanel
          selected={state.selected}
          teamProgress={state.teamProgress}
          teamEmails={state.teamEmails}
          setTeamEmails={state.setTeamEmails}
          designating={state.designating}
          onDesignateTeam={state.designateTeam}
          crossAssignments={state.crossAssignments}
          setCrossAssignments={state.setCrossAssignments}
          teachers={state.teachers}
          assigning={state.assigning}
          onAssignCorrection={state.assignCorrection}
          reconciling={state.reconciling}
          onReconcile={state.reconcile}
          onClose={() => state.setSelected(null)}
        />
      )}
    </div>
  )
}
