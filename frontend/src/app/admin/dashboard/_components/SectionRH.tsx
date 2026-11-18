'use client'

import type React from 'react'
import { motion } from 'framer-motion'
import { useT } from '@/lib/i18n'
import { Users, Palmtree, CheckCircle2, FileText } from 'lucide-react'
import type { OnToast, RhTab } from './rh/types'
import { useRhData } from './rh/useRhData'
import RhPersonnelTab from './rh/RhPersonnelTab'
import RhLeavesTab from './rh/RhLeavesTab'
import RhAttendanceTab from './rh/RhAttendanceTab'
import RhDocumentsTab from './rh/RhDocumentsTab'

const TABS: Array<{ key: RhTab; icon: React.ReactNode }> = [
  { key: 'personnel', icon: <Users size={14} /> },
  { key: 'conges', icon: <Palmtree size={14} /> },
  { key: 'pointage', icon: <CheckCircle2 size={14} /> },
  { key: 'documents', icon: <FileText size={14} /> },
]

export default function SectionRH({ onToast }: { onToast: OnToast }) {
  const t = useT('admin')
  const rh = useRhData(onToast)

  const tabButton = (key: RhTab, label: string, icon: React.ReactNode) => (
    <button
      key={key}
      onClick={() => rh.setTab(key)}
      className="text-[11.5px] md:text-[12.5px] px-[10px] md:px-[14px] py-[6px] md:py-[7px] rounded-[8px]"
      style={{
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: 700,
        background: rh.tab === key ? 'var(--sidebar)' : 'var(--bg2)',
        color: rh.tab === key ? 'white' : 'var(--text2)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {icon} {label}
    </button>
  )

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--sidebar)]" />
          <h2 className="text-base md:text-lg font-bold text-[var(--text)]">{t('rh.title')}</h2>
        </div>
      </div>

      {/* Bannière de cadrage du rôle Direction */}
      <div className="p-3 md:p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 mt-0.5">
            <Users size={14} />
          </div>
          <div>
            <p className="font-bold text-[11.5px] md:text-xs">Supervision RH & Validation des Congés/Pointages</p>
            <p className="text-[10.5px] md:text-[11px] text-[var(--text2)]">La gestion courante du pointage est portée par la Vie Scolaire / RH. L'Administrateur valide les congés, supervise les fiches de carrière et arbitre la paie.</p>
          </div>
        </div>
      </div>

      {/* Onglets — mobile : puces défilables avec indicateur glissant */}
      <div className="relative md:hidden mb-[12px] -mr-4">
        <div className="flex gap-[5px] overflow-x-auto pr-8 py-[2px]" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tb => {
            const active = rh.tab === tb.key
            return (
              <button
                key={tb.key}
                onClick={() => rh.setTab(tb.key)}
                className="relative flex-shrink-0 rounded-[8px] px-3 py-2 min-h-[38px] whitespace-nowrap border-0"
                style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                {active && (
                  <motion.div
                    layoutId="rh-tab-pill"
                    className="absolute inset-0 rounded-[8px]"
                    style={{ background: 'var(--sidebar)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>
                  {tb.icon} {t(`rh.tabs.${tb.key}`)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-[4px] w-7" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
      </div>

      <div className="hidden md:flex gap-2 flex-wrap mb-3.5">
        {TABS.map(tb => tabButton(tb.key, t(`rh.tabs.${tb.key}`), tb.icon))}
      </div>

      {rh.tab === 'personnel' && (
        <RhPersonnelTab
          employees={rh.employees}
          selectedEmployeeId={rh.selectedEmployeeId}
          selectedDetail={rh.selectedDetail}
          loadingEmployees={rh.loadingEmployees}
          loadingDetail={rh.loadingDetail}
          refreshingBalance={rh.refreshingBalance}
          onSelectEmployee={rh.loadDetail}
          onExportMinesec={rh.exportListeNominale}
          onSaveFile={rh.saveEmployeeFile}
          onAddCareerEvent={rh.addCareerEvent}
          onDownloadPdf={rh.downloadEmployeePdf}
          onRefreshBalance={rh.refreshLeaveBalance}
        />
      )}

      {rh.tab === 'conges' && (
        <RhLeavesTab
          leaveRequests={rh.leaveRequests}
          loadingLeaves={rh.loadingLeaves}
          onRefresh={rh.loadLeaves}
          onApproveLeave={rh.handleApproveLeave}
        />
      )}

      {rh.tab === 'pointage' && (
        <RhAttendanceTab
          onToast={onToast}
          employees={rh.employees}
          attendanceDate={rh.attendanceDate}
          setAttendanceDate={rh.setAttendanceDate}
          attendanceRows={rh.attendanceRows}
          setAttendanceRows={rh.setAttendanceRows}
          attendanceSaved={rh.attendanceSaved}
          onSaveAttendance={rh.saveAttendance}
        />
      )}

      {rh.tab === 'documents' && (
        <RhDocumentsTab
          employees={rh.employees}
          currentEmployee={rh.currentEmployee}
          selectedDetail={rh.selectedDetail}
          docEmployeeId={rh.docEmployeeId}
          setDocEmployeeId={rh.setDocEmployeeId}
          docType={rh.docType}
          setDocType={rh.setDocType}
          docForm={rh.docForm}
          setDocForm={rh.setDocForm}
          onGenerateDoc={rh.generateDoc}
        />
      )}
    </div>
  )
}
