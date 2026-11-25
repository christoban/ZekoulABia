'use client'

import { Bot, Check, FlaskConical, RefreshCw, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  actionButton,
  secondaryButton,
  type Assignment,
  type TimetableLike,
} from './timetableActions/timetableActionsTypes'
import { useTimetableStaffActions } from './timetableActions/useTimetableStaffActions'
import TimetableProposalCard from './timetableActions/TimetableProposalCard'
import TimetableWhatIfPanel from './timetableActions/TimetableWhatIfPanel'
import TimetableExtrasCards from './timetableActions/TimetableExtrasCards'

interface Props {
  classId: string
  academicYearId?: string
  timetable: TimetableLike | null
  assignments: Assignment[]
  gridConfigured: boolean
  onRefresh: () => void
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionTimetableStaffActions(props: Props) {
  const { assignments, gridConfigured, timetable } = props
  const t = useT('staff')
  const state = useTimetableStaffActions(props)

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Sparkles size={16} color="var(--purple)" />
          <strong style={{ color: 'var(--text)', fontSize: 14 }}>{t('timetable.planning.title')}</strong>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button style={actionButton} onClick={state.handlePropose} disabled={!state.canPropose || state.busy !== null}>
            {state.busy === 'propose' ? <RefreshCw size={14} className="animate-spin" /> : <Bot size={14} />}
            {t('timetable.planning.propose')}
          </button>
          <button style={secondaryButton} onClick={() => state.setWhatIfOpen(value => !value)} disabled={!state.canSimulate}>
            <FlaskConical size={14} /> {t('timetable.planning.whatIf')}
          </button>
          {state.proposal && (state.proposal.seances.length > 0 || (state.proposal.seancesGroupes?.length ?? 0) > 0 || (state.proposal.tempsLibres?.length ?? 0) > 0) && (
            <button style={actionButton} onClick={state.handleApply} disabled={!state.canEdit || state.busy !== null}>
              <Check size={14} /> {state.busy === 'apply' ? t('timetable.planning.applying') : t('timetable.planning.apply')}
            </button>
          )}
        </div>
        {!state.canPropose && (
          <div style={{ marginTop: 9, color: 'var(--amber)', fontSize: 12 }}>
            {t('timetable.planning.prerequisites', {
              grid: gridConfigured ? '✓' : '⚠',
              rooms: state.activeRooms.length > 0 ? '✓' : '⚠',
              assignments: state.assignedCount > 0 ? '✓' : '⚠',
            })}
          </div>
        )}
      </div>

      {state.proposal && (
        <TimetableProposalCard
          proposal={state.proposal}
          assignments={assignments}
          rooms={state.rooms}
          onClose={() => state.setProposal(null)}
        />
      )}

      {state.whatIfOpen && (
        <TimetableWhatIfPanel
          activeRooms={state.activeRooms}
          unavailableRooms={state.unavailableRooms}
          toggleRoom={state.toggleRoom}
          teacherUnavailableId={state.teacherUnavailableId}
          setTeacherUnavailableId={state.setTeacherUnavailableId}
          assignedTeachers={state.assignedTeachers}
          teacherDay={state.teacherDay}
          setTeacherDay={state.setTeacherDay}
          teacherStart={state.teacherStart}
          setTeacherStart={state.setTeacherStart}
          teacherEnd={state.teacherEnd}
          setTeacherEnd={state.setTeacherEnd}
          assignments={assignments}
          hoursToRemove={state.hoursToRemove}
          setHoursToRemove={state.setHoursToRemove}
          busy={state.busy}
          simulation={state.simulation}
          onSimulate={state.handleWhatIf}
          onClose={() => state.setWhatIfOpen(false)}
        />
      )}

      <TimetableExtrasCards
        canAdjust={state.canAdjust}
        canEdit={state.canEdit}
        busy={state.busy}
        adjustInstruction={state.adjustInstruction}
        setAdjustInstruction={state.setAdjustInstruction}
        adjustResult={state.adjustResult}
        onAdjust={state.handleAdjust}
        roomId={state.roomId}
        setRoomId={state.setRoomId}
        activeRooms={state.activeRooms}
        academicYearId={props.academicYearId}
        onSaveRoom={state.saveRoomAssignment}
        groupSets={state.groupSets}
        groupSetId={state.groupSetId}
        setGroupSetId={state.setGroupSetId}
        groupDay={state.groupDay}
        setGroupDay={state.setGroupDay}
        groupStart={state.groupStart}
        setGroupStart={state.setGroupStart}
        groupEnd={state.groupEnd}
        setGroupEnd={state.setGroupEnd}
        selectedGroupSet={state.selectedGroupSet}
        timetable={timetable}
        onGenerateGroups={state.generateGroupSessions}
      />
    </div>
  )
}
