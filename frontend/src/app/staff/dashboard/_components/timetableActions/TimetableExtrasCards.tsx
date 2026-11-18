'use client'

import { Bot } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  actionButton,
  DAY_NAMES,
  inputStyle,
  secondaryButton,
  type BusyAction,
  type GroupSet,
  type Room,
  type TimetableLike,
} from './timetableActionsTypes'

interface Props {
  canAdjust: boolean
  canEdit: boolean
  busy: BusyAction
  adjustInstruction: string
  setAdjustInstruction: (v: string) => void
  adjustResult: { applied: string[]; errors: string[]; message: string } | null
  onAdjust: () => void
  roomId: string
  setRoomId: (v: string) => void
  activeRooms: Room[]
  academicYearId?: string
  onSaveRoom: () => void
  groupSets: GroupSet[]
  groupSetId: string
  setGroupSetId: (v: string) => void
  groupDay: string
  setGroupDay: (v: string) => void
  groupStart: string
  setGroupStart: (v: string) => void
  groupEnd: string
  setGroupEnd: (v: string) => void
  selectedGroupSet: GroupSet | undefined
  timetable: TimetableLike | null
  onGenerateGroups: () => void
}

export default function TimetableExtrasCards({
  canAdjust,
  canEdit,
  busy,
  adjustInstruction,
  setAdjustInstruction,
  adjustResult,
  onAdjust,
  roomId,
  setRoomId,
  activeRooms,
  academicYearId,
  onSaveRoom,
  groupSets,
  groupSetId,
  setGroupSetId,
  groupDay,
  setGroupDay,
  groupStart,
  setGroupStart,
  groupEnd,
  setGroupEnd,
  selectedGroupSet,
  timetable,
  onGenerateGroups,
}: Props) {
  const t = useT('staff')

  return (
    <>
      {canAdjust && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
            <Bot size={15} color="var(--purple)" />
            <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.adjustTitle')}</strong>
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 11.5, marginBottom: 8 }}>{t('timetable.planning.adjustHint')}</div>
          <textarea
            value={adjustInstruction}
            onChange={event => setAdjustInstruction(event.target.value)}
            placeholder={t('timetable.planning.adjustPlaceholder')}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <button style={{ ...actionButton, marginTop: 8 }} onClick={onAdjust} disabled={busy !== null || !adjustInstruction.trim()}>
            {busy === 'adjust' ? t('timetable.planning.adjusting') : t('timetable.planning.adjust')}
          </button>
          {adjustResult && (
            <div style={{ marginTop: 8, color: adjustResult.errors.length > 0 ? 'var(--red)' : 'var(--green)', fontSize: 12 }}>
              {adjustResult.message}
            </div>
          )}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
        <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.roomTitle')}</strong>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <select value={roomId} onChange={event => setRoomId(event.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 170 }}>
            <option value="">{t('timetable.planning.roomPlaceholder')}</option>
            {activeRooms.map(room => <option key={room.id} value={room.id}>{room.name} · {room.capacity}</option>)}
          </select>
          <button style={secondaryButton} onClick={onSaveRoom} disabled={!canEdit || !roomId || !academicYearId || busy !== null}>
            {t('timetable.planning.saveRoom')}
          </button>
        </div>
      </div>

      {groupSets.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
          <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.groupTitle')}</strong>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <select value={groupSetId} onChange={event => setGroupSetId(event.target.value)} style={inputStyle}>
              <option value="">{t('timetable.planning.groupPlaceholder')}</option>
              {groupSets.map(groupSet => <option key={groupSet.id} value={groupSet.id}>{groupSet.name}</option>)}
            </select>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
              <select value={groupDay} onChange={event => setGroupDay(event.target.value)} style={{ ...inputStyle, width: 130 }}>
                {DAY_NAMES.map((day, index) => <option key={day} value={index}>{day}</option>)}
              </select>
              <input type="time" value={groupStart} onChange={event => setGroupStart(event.target.value)} style={{ ...inputStyle, width: 120 }} />
              <input type="time" value={groupEnd} onChange={event => setGroupEnd(event.target.value)} style={{ ...inputStyle, width: 120 }} />
              <button style={secondaryButton} onClick={onGenerateGroups} disabled={!canEdit || !timetable?.id || !selectedGroupSet || busy !== null}>
                {t('timetable.planning.generateGroups')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
