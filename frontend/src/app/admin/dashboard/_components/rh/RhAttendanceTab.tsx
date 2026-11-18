'use client'

import type React from 'react'
import { useT } from '@/lib/i18n'
import SectionStaffAttendanceAVerifier from '../SectionStaffAttendanceAVerifier'
import SectionStaffAttendanceSettings from '../SectionStaffAttendanceSettings'
import {
  rhChipStyle,
  rhInputStyle,
  rhLabelStyle,
  type AttendanceRowState,
  type EmployeeItem,
  type OnToast,
} from './types'

interface RhAttendanceTabProps {
  onToast: OnToast
  employees: EmployeeItem[]
  attendanceDate: string
  setAttendanceDate: (date: string) => void
  attendanceRows: Record<string, AttendanceRowState>
  setAttendanceRows: React.Dispatch<React.SetStateAction<Record<string, AttendanceRowState>>>
  attendanceSaved: boolean
  onSaveAttendance: () => void
}

const ATTENDANCE_STATUS_CONFIG = {
  PRESENT: { label: 'Présent', activeBg: 'rgba(22,163,74,0.15)', activeColor: 'var(--green)' },
  ABSENT: { label: 'Absent', activeBg: 'rgba(239,68,68,0.15)', activeColor: 'var(--red)' },
  RETARD: { label: 'Retard', activeBg: 'rgba(234,179,8,0.15)', activeColor: '#b45309' },
} as const

export default function RhAttendanceTab({
  onToast,
  employees,
  attendanceDate,
  setAttendanceDate,
  attendanceRows,
  setAttendanceRows,
  attendanceSaved,
  onSaveAttendance,
}: RhAttendanceTabProps) {
  const t = useT('admin')

  const markAllPresent = () => {
    setAttendanceRows(prev => {
      const next = { ...prev }
      for (const emp of employees) {
        next[emp.id] = { ...(next[emp.id] ?? { note: '' }), statut: 'PRESENT' }
      }
      return next
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="text-[13px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.dailyAttendance')}</div>
          <button className="min-h-[38px] px-3.5" style={{ ...rhChipStyle('var(--blue-light)', 'var(--blue)'), border: 'none', cursor: 'pointer' }} onClick={onSaveAttendance}>{t('rh.saveAttendance')}</button>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={rhLabelStyle}>{t('rh.date')}</div>
            <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} style={{ ...rhInputStyle, width: 160 }} />
          </div>
          <div style={{ color: attendanceSaved ? 'var(--green)' : 'var(--text3)', fontWeight: 700, fontSize: 12 }}>{attendanceSaved ? t('rh.attendanceSavedLabel') : t('rh.noRecentRecord')}</div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="px-[12px] py-[8px] md:px-[16px] md:py-[10px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="text-[13px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.statusByEmployee')}</div>
          {employees.length > 0 && (
            <button
              type="button"
              onClick={markAllPresent}
              style={{ ...rhChipStyle('rgba(22,163,74,0.1)', 'var(--green)'), border: 'none', cursor: 'pointer', fontSize: 10.5 }}
            >
              Tous Présents
            </button>
          )}
        </div>
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {employees.map(emp => {
            const currentStatut = attendanceRows[emp.id]?.statut ?? 'PRESENT'
            return (
              <div key={emp.id} className="grid grid-cols-1 sm:[grid-template-columns:1fr_auto_1.1fr] gap-2 items-center" style={{ border: '1px solid var(--bg2)', borderRadius: 8, padding: '6px 10px', background: 'var(--bg)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>{emp.fullName}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }}>{emp.role}</div>
                </div>
                <div className="inline-flex items-center p-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] gap-0.5" style={{ flexShrink: 0 }}>
                  {(['PRESENT', 'ABSENT', 'RETARD'] as const).map(st => {
                    const isSelected = currentStatut === st
                    const config = ATTENDANCE_STATUS_CONFIG[st]
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setAttendanceRows(prev => ({ ...prev, [emp.id]: { ...(prev[emp.id] ?? { note: '' }), statut: st } }))}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: isSelected ? 800 : 500,
                          background: isSelected ? config.activeBg : 'transparent',
                          color: isSelected ? config.activeColor : 'var(--text3)',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {config.label}
                      </button>
                    )
                  })}
                </div>
                <input
                  value={attendanceRows[emp.id]?.note ?? ''}
                  onChange={e => setAttendanceRows(prev => ({ ...prev, [emp.id]: { ...(prev[emp.id] ?? { statut: 'PRESENT' }), note: e.target.value } }))}
                  placeholder={t('rh.optionalNote')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 11.5,
                    outline: 'none',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                />
              </div>
            )
          })}
          {employees.length === 0 && <div style={{ padding: 18, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('rh.loadStaffFirst')}</div>}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="text-[13px] md:text-[14px] px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.aVerifier')}</div>
        <div style={{ padding: 12 }}>
          <SectionStaffAttendanceAVerifier onToast={onToast} />
        </div>
      </div>

      <SectionStaffAttendanceSettings onToast={onToast} />
    </div>
  )
}
