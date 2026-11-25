'use client'
import { WifiOff, Save, RefreshCw } from 'lucide-react'
import type { UserInfo } from '../_types'
import { useT } from '@/lib/i18n'
import { useTeacherGrades } from './grades/useTeacherGrades'
import GradesFilterBar from './grades/GradesFilterBar'
import GradesEntryList from './grades/GradesEntryList'
import RejectedGradesPanel from './grades/RejectedGradesPanel'
import { sTitle, sSub, type TeacherGradeRow } from './grades/types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

export default function SectionTeacherGrades({ onToast, user: _user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const state = useTeacherGrades({ onToast, t })

  const handleCorrectGrade = (g: TeacherGradeRow) => {
    state.setSelectedClass(g.classId || '')
    state.setSelectedSubject(g.subjectId || '')
    state.setSelectedSequence(g.sequenceId || '')
    state.loadGrades()
  }

  if (state.loading && !state.grades.length) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{state.error}</div>
          <button onClick={state.loadGrades}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={13} strokeWidth={2} />{t('grades_section.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <div style={sTitle}>{t('grades_section.title')}</div>
          <div style={sSub}>{t('grades_section.subtitle')}</div>
        </div>
      </div>

      {!state.isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 8, padding: '8px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={15} strokeWidth={2} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)' }}>{t('grades_section.offline_banner')}</span>
        </div>
      )}

      {/* Prompt restauration brouillon */}
      {state.showDraftPrompt && state.localDraft && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><Save size={18} strokeWidth={2} /></span>
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber)' }}>{t('grades_section.draft_prompt_title')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 1 }}>{t('grades_section.draft_prompt_desc')}</div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                if (state.localDraft) {
                  state.setNotes(state.localDraft.notes)
                  state.setObservations(state.localDraft.observations)
                }
                state.setShowDraftPrompt(false)
              }}
              className="flex-1 sm:flex-initial h-9 px-3 rounded-lg text-xs font-bold"
              style={{ background: 'var(--amber)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t('grades_section.draft_prompt_restore')}
            </button>
            <button
              onClick={() => state.setShowDraftPrompt(false)}
              className="flex-1 sm:flex-initial h-9 px-3 rounded-lg text-xs font-bold"
              style={{ background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t('grades_section.draft_prompt_ignore')}
            </button>
          </div>
        </div>
      )}

      {state.grades.length > 0 && (
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
          <div className="flex flex-col sm:flex-row sm:justify-between text-xs font-bold text-[var(--text2)] gap-1 mb-1.5">
            <span>{state.classes.find((c) => c.id === state.selectedClass)?.name || ''} — {state.subjects.find((s) => s.id === state.selectedSubject)?.name || ''}</span>
            <span style={{ color: 'var(--green)' }}>{t('grades_section.progress_text').replace('{validated}', String(state.validatedCount)).replace('{total}', String(state.grades.length)).replace('{pct}', String(state.grades.length ? Math.round(state.validatedCount / state.grades.length * 100) : 0))}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border2)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${state.grades.length ? Math.round(state.validatedCount / state.grades.length * 100) : 0}%`, background: 'var(--green)', borderRadius: 6, transition: 'width 1s' }} />
          </div>
        </div>
      )}

      {/* Filtres + table */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 14 }}>
        <GradesFilterBar
          classes={state.classes}
          subjects={state.subjects}
          sequences={state.sequences}
          selectedClass={state.selectedClass}
          selectedSubject={state.selectedSubject}
          selectedSequence={state.selectedSequence}
          loading={state.loading}
          importing={state.importing}
          rosterLabel={state.rosterLabel}
          importResult={state.importResult}
          onSelectClass={state.setSelectedClass}
          onSelectSubject={state.setSelectedSubject}
          onSelectSequence={state.setSelectedSequence}
          onLoadGrades={state.loadGrades}
          onDownloadTemplate={state.downloadTemplate}
          onImportExcel={state.importFromExcel}
          onDismissImportResult={() => state.setImportResult(null)}
          t={t}
        />

        {state.grades.length > 0 && (
          <GradesEntryList
            grades={state.grades}
            notes={state.notes}
            observations={state.observations}
            rosterLabel={state.rosterLabel}
            saving={state.saving}
            isOnline={state.isOnline}
            draftCount={state.draftCount}
            rejectedCount={state.rejectedCount}
            modifiableCount={state.modifiableCount}
            onNoteChange={(sid, val) => state.setNotes(prev => ({ ...prev, [sid]: val }))}
            onObservationChange={(sid, val) => state.setObservations(prev => ({ ...prev, [sid]: val }))}
            onSaveDraft={state.saveDraft}
            onSubmitGrades={state.submitGrades}
            t={t}
          />
        )}
      </div>

      <RejectedGradesPanel
        rejectedGrades={state.rejectedGrades}
        onCorrectGrade={handleCorrectGrade}
        t={t}
      />
    </div>
  )
}
