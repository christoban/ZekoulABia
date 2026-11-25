'use client'

import { useT } from '@/lib/i18n'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fmtRhDate, rhChipStyle, rhLabelStyle, type EmployeeDetail, type EmployeeItem } from './types'

interface RhPersonnelTabProps {
  employees: EmployeeItem[]
  selectedEmployeeId: string | null
  selectedDetail: EmployeeDetail | null
  loadingEmployees: boolean
  loadingDetail: boolean
  refreshingBalance: boolean
  onSelectEmployee: (employeeId: string) => void
  onExportMinesec: () => void
  onSaveFile: (employeeId: string, payload: Record<string, unknown>) => Promise<void>
  onAddCareerEvent: (employeeId: string) => void
  onDownloadPdf: (employeeId: string, kind: 'attestation' | 'certificat') => void
  onRefreshBalance: (employeeId: string) => void
}

export default function RhPersonnelTab({
  employees,
  selectedEmployeeId,
  selectedDetail,
  loadingEmployees,
  loadingDetail,
  refreshingBalance,
  onSelectEmployee,
  onExportMinesec,
  onSaveFile,
  onAddCareerEvent,
  onDownloadPdf,
  onRefreshBalance,
}: RhPersonnelTabProps) {
  const t = useT('admin')

  return (
    <div className="grid grid-cols-1 md:[grid-template-columns:320px_1fr] gap-3 md:gap-3.5">
      {/* Colonne Liste du Personnel */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div className="text-[13px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.staffList')}</div>
          <button
            title={t('rh.exportMinesecHint')}
            style={{ ...rhChipStyle('var(--green-light)', 'var(--green)'), border: 'none', cursor: 'pointer' }}
            onClick={onExportMinesec}
          >
            {t('rh.exportMinesec')}
          </button>
        </div>
        {loadingEmployees ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>{t('rh.loading')}</div>
        ) : (
          <div className="flex flex-col max-h-[250px] md:max-h-[640px] overflow-y-auto">
            {employees.map(emp => {
              const active = selectedEmployeeId === emp.id
              return (
                <button
                  key={emp.id}
                  onClick={() => onSelectEmployee(emp.id)}
                  className="px-[11px] py-[9px] md:px-[14px] md:py-[10px]"
                  style={{
                    textAlign: 'left',
                    border: 'none',
                    background: active ? 'var(--bg2)' : 'var(--surface)',
                    borderBottom: '1px solid var(--bg2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div className="w-8 h-8 md:hidden text-[11px]" style={{ borderRadius: 9, background: emp.role === 'TEACHER' ? 'var(--blue)' : 'var(--orange)', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(emp.firstName[0] ?? '').toUpperCase()}{(emp.lastName[0] ?? '').toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div className="text-[12.5px] md:text-[13.5px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{emp.fullName}</div>
                      <div style={{ marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={rhChipStyle(emp.role === 'TEACHER' ? 'var(--blue-light)' : 'var(--orange-light)', emp.role === 'TEACHER' ? 'var(--blue)' : 'var(--orange)')}>
                          {emp.role === 'TEACHER' ? t('rh.roleTeacher') : t('rh.roleStaff')}
                        </span>
                        {emp.staffProfile?.title && <span style={rhChipStyle('var(--purple-light)', 'var(--purple)')}>{emp.staffProfile.title}</span>}
                      </div>
                    </div>
                    <div className="hidden sm:block" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{emp.email ?? '—'}</div>
                  </div>
                </button>
              )
            })}
            {employees.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('rh.noEmployees')}</div>}
          </div>
        )}
      </div>

      {/* Colonne Fiche & Historique de l'employé */}
      <div className="flex flex-col gap-3 md:gap-3.5">
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="text-[13px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.employeeCard')}</div>
            <button style={{ ...rhChipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: 'pointer' }} onClick={() => selectedEmployeeId && onSelectEmployee(selectedEmployeeId)}>{t('rh.refresh')}</button>
          </div>
          {loadingDetail || !selectedDetail ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('rh.selectEmployee')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 p-[12px] md:p-[16px]" style={{ gap: 10 }}>
              <div>
                <div style={rhLabelStyle}>{t('rh.fullName')}</div>
                <div className="text-[13px] md:text-[14.5px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{selectedDetail.employee.fullName}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.role')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedDetail.employee.role}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.email')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedDetail.employee.email ?? '—'}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.phone')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedDetail.employee.phone ?? '—'}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.hireDate')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtRhDate(selectedDetail.file?.dateEmbauche ?? null)}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.cnps')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedDetail.file?.numeroCNPS ?? '—'}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.contractType')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedDetail.file?.typeContrat ?? '—'}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.echelon')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedDetail.file?.echelonActuel ?? '—'}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.gender')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedDetail.file?.gender === 'F' ? t('rh.genderF') : selectedDetail.file?.gender === 'M' ? t('rh.genderM') : '—'}</div>
              </div>
              <div>
                <div style={rhLabelStyle}>{t('rh.documentsCount')}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedDetail.file?.documentsUrls?.length ?? 0}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={rhLabelStyle}>{t('rh.selfServiceStatus')}</div>
                {selectedDetail.file?.selfServiceCompletedAt ? (
                  <span style={{ ...rhChipStyle('rgba(22,163,74,0.12)', 'var(--green)'), fontSize: 11.5, fontWeight: 700 }}>
                    <CheckCircle2 size={12} strokeWidth={2} /> {t('rh.selfServiceCompletedOn', { date: new Date(selectedDetail.file.selfServiceCompletedAt).toLocaleDateString() })}
                  </span>
                ) : (
                  <span style={{ ...rhChipStyle('rgba(234,179,8,0.12)', '#b45309'), fontSize: 11.5, fontWeight: 700 }}>
                    <AlertTriangle size={12} strokeWidth={2} /> {t('rh.selfServiceNotCompleted')}
                  </span>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                <button style={{ ...rhChipStyle('var(--blue-light)', 'var(--blue)'), border: 'none', cursor: 'pointer' }} onClick={() => onSaveFile(selectedDetail.employee.id, (selectedDetail.file ?? {}) as Record<string, unknown>)}>{t('rh.saveFile')}</button>
                <button style={{ ...rhChipStyle('var(--blue-light)', 'var(--blue)'), border: 'none', cursor: 'pointer' }} onClick={() => onAddCareerEvent(selectedDetail.employee.id)}>{t('rh.addCareer')}</button>
                <button style={{ ...rhChipStyle('var(--purple-light)', 'var(--purple)'), border: 'none', cursor: 'pointer' }} onClick={() => onDownloadPdf(selectedDetail.employee.id, 'attestation')}>{t('rh.attestation')}</button>
                <button style={{ ...rhChipStyle('var(--amber-light)', 'var(--amber)'), border: 'none', cursor: 'pointer' }} onClick={() => onDownloadPdf(selectedDetail.employee.id, 'certificat')}>{t('rh.certificat')}</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className="text-[13px] md:text-[14px] px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.historyTitle')}</div>
          {!selectedDetail ? (
            <div style={{ padding: 20, color: 'var(--text3)', fontSize: 12 }}>{t('rh.selectForHistory')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 p-[12px] md:p-[16px]" style={{ gap: 12 }}>
              <div>
                <div style={{ ...rhLabelStyle, marginBottom: 6 }}>{t('rh.careerEvents')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedDetail.careerEvents.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t('rh.noEvents')}</div>}
                  {selectedDetail.careerEvents.map(ev => (
                    <div key={ev.id} style={{ border: '1px solid var(--bg2)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg)' }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>{ev.type}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>{fmtRhDate(ev.date)}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{ev.observation ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ ...rhLabelStyle, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{t('rh.leaveBalance')}</span>
                  <button
                    type="button"
                    disabled={refreshingBalance}
                    onClick={() => onRefreshBalance(selectedDetail.employee.id)}
                    style={{ ...rhChipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: 'pointer', fontSize: 10.5, padding: '2px 7px' }}
                  >
                    {refreshingBalance ? '…' : t('rh.refresh')}
                  </button>
                </div>
                <div style={{ border: '1px solid var(--bg2)', borderRadius: 8, padding: '9px 11px', background: 'var(--bg)', marginBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{selectedDetail.leaveBalance.current ? t('rh.daysRemaining', { n: selectedDetail.leaveBalance.current.soldeRestant }) : '—'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('rh.year', { y: selectedDetail.leaveBalance.current?.annee ?? new Date().getFullYear() })}</div>
                  {selectedDetail.leaveBalance.balances.length > 1 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {selectedDetail.leaveBalance.balances.map(b => (
                        <span key={b.annee} style={{ fontSize: 10.5, padding: '2px 6px', borderRadius: 6, background: 'var(--bg2)', color: 'var(--text2)' }}>
                          {b.annee}: {b.soldeRestant}/{b.soldeInitial}j
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ ...rhLabelStyle, marginBottom: 6 }}>{t('rh.leaveRequests')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selectedDetail.leaveRequests.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t('rh.noRequests')}</div>}
                  {selectedDetail.leaveRequests.map(req => (
                    <div key={req.id} style={{ border: '1px solid var(--bg2)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text)' }}>{req.type}</div>
                        <span style={rhChipStyle(req.statut === 'APPROVED' ? 'var(--green-light)' : req.statut === 'REJECTED' ? 'var(--red-light)' : 'var(--amber-light)', req.statut === 'APPROVED' ? 'var(--green)' : req.statut === 'REJECTED' ? 'var(--red)' : 'var(--amber)')}>{req.statut}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>{fmtRhDate(req.dateDebut)} → {fmtRhDate(req.dateFin)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
