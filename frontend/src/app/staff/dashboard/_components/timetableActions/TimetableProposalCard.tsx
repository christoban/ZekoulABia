'use client'

import { X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  DAY_NAMES,
  iconButton,
  sessionRow,
  type Assignment,
  type Proposal,
  type Room,
} from './timetableActionsTypes'

interface Props {
  proposal: Proposal
  assignments: Assignment[]
  rooms: Room[]
  onClose: () => void
}

export default function TimetableProposalCard({ proposal, assignments, rooms, onClose }: Props) {
  const t = useT('staff')

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--purple)', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.proposalTitle')}</strong>
        <button style={iconButton} onClick={onClose} aria-label={t('timetable.planning.close')}><X size={15} /></button>
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 11.5, marginTop: 4 }}>
        {t('timetable.planning.proposalMeta', { count: proposal.seances.length + (proposal.seancesGroupes?.length ?? 0) + (proposal.tempsLibres?.length ?? 0), score: proposal.scoreObjectif })}
      </div>
      {proposal.raisonInfaisabilite && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 7 }}>{proposal.raisonInfaisabilite}</div>}
      {proposal.problemes && proposal.problemes.length > 0 && (
        <div style={{ marginTop: 9 }}>
          <strong style={{ color: 'var(--text2)', fontSize: 12 }}>{t('timetable.planning.problemsTitle')}</strong>
          <ul style={{ margin: '5px 0 0 18px', padding: 0, color: 'var(--red)', fontSize: 12 }}>
            {proposal.problemes.map(probleme => <li key={probleme}>{probleme}</li>)}
          </ul>
        </div>
      )}
      {proposal.suggestions && proposal.suggestions.length > 0 && (
        <div style={{ marginTop: 9 }}>
          <strong style={{ color: 'var(--text2)', fontSize: 12 }}>{t('timetable.planning.suggestionsTitle')}</strong>
          <ul style={{ margin: '5px 0 0 18px', padding: 0, color: 'var(--amber)', fontSize: 12 }}>
            {proposal.suggestions.map(suggestion => <li key={suggestion}>{suggestion}</li>)}
          </ul>
        </div>
      )}
      {proposal.avertissements && proposal.avertissements.length > 0 && (
        <div style={{ marginTop: 9 }}>
          <strong style={{ color: 'var(--amber)', fontSize: 12 }}>{t('timetable.planning.warningsTitle')}</strong>
          <ul style={{ margin: '5px 0 0 18px', padding: 0, color: 'var(--amber)', fontSize: 12 }}>
            {proposal.avertissements.map(avertissement => <li key={avertissement}>{avertissement}</li>)}
          </ul>
        </div>
      )}
      {proposal.explicatifs && proposal.explicatifs.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 130, overflowY: 'auto' }}>
          <strong style={{ color: 'var(--text2)', fontSize: 12 }}>{t('timetable.planning.explanationsTitle')}</strong>
          <ul style={{ margin: '5px 0 0 18px', padding: 0, color: 'var(--text3)', fontSize: 11.5 }}>
            {proposal.explicatifs.map(explication => <li key={explication}>{explication}</li>)}
          </ul>
        </div>
      )}

      {(proposal.seances.length > 0 || (proposal.seancesGroupes?.length ?? 0) > 0 || (proposal.tempsLibres?.length ?? 0) > 0) && (
        <div style={{ display: 'grid', gap: 5, marginTop: 10, maxHeight: 220, overflowY: 'auto' }}>
          {proposal.seances.map((session, index) => (
            <div key={`${session.subjectId}-${session.teacherId}-${session.dayOfWeek}-${session.startTime}-${index}`} style={sessionRow}>
              <span>{DAY_NAMES[session.dayOfWeek] ?? session.dayOfWeek} · {session.startTime}–{session.endTime}</span>
              <span>{assignments.find(a => a.subjectId === session.subjectId)?.subjectName ?? session.subjectId} · {rooms.find(r => r.id === session.roomId)?.name ?? session.roomId}</span>
            </div>
          ))}
          {proposal.seancesGroupes?.map((session, index) => (
            <div key={`${session.groupId}-${session.dayOfWeek}-${session.startTime}-${index}`} style={sessionRow}>
              <span>{DAY_NAMES[session.dayOfWeek] ?? session.dayOfWeek} · {session.startTime}–{session.endTime}</span>
              <span>{assignments.find(a => a.subjectId === session.subjectId)?.subjectName ?? session.subjectId} · {session.groupName} ({session.participantsCount}) · {rooms.find(r => r.id === session.roomId)?.name ?? session.roomId}</span>
            </div>
          ))}
          {proposal.tempsLibres?.map((session, index) => (
            <div key={`${session.dayOfWeek}-${session.startTime}-${index}`} style={{ ...sessionRow, background: 'var(--blue-light)' }}>
              <span>{DAY_NAMES[session.dayOfWeek] ?? session.dayOfWeek} · {session.startTime}–{session.endTime}</span>
              <span>{t('timetable.freeTime')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
