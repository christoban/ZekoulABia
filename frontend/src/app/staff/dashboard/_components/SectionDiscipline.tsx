'use client'
import { Gavel } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import {
  EMPTY_CONVOKE_FORM,
  EMPTY_FORM,
  EMPTY_TENIR_FORM,
  btnPrim,
  sSub,
  sTitle,
  tabActiveSt,
  tabSt,
} from './discipline/disciplineTypes'
import { useDisciplineData } from './discipline/useDisciplineData'
import DisciplineSanctionsView from './discipline/DisciplineSanctionsView'
import DisciplineCouncilView from './discipline/DisciplineCouncilView'
import { ConvokeCouncilModal, SanctionModal, TenirCouncilModal } from './discipline/DisciplineModals'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionDiscipline({ onToast }: Props) {
  const t = useT('discipline')
  const { isOnline, addToQueue } = useSyncQueue()
  const d = useDisciplineData({ isOnline, addToQueue, onToast, t })
  const needsDates = d.form.type === 'TEMP_EXCLUSION' || d.form.type === 'PERMANENT_EXCLUSION'

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div style={sTitle}>{t('title')}</div>
          <div style={sSub}>
            {d.view === 'sanctions'
              ? (d.loading ? t('loading') : t('count_summary', { count: d.records.length, byStatus: d.statusFilter ? ` par statut ${d.statusFilter}` : '' }))
              : t('council.subtitle')}
          </div>
        </div>
        {d.view === 'sanctions' ? (
          <button style={{ ...btnPrim, minHeight: 38 }} onClick={() => d.setForm(f => ({ ...f, open: true }))}>{t('actions.new_sanction')}</button>
        ) : (
          <button style={{ ...btnPrim, minHeight: 38 }} onClick={() => d.setConvokeForm(f => ({ ...f, open: true }))}>
            <Gavel size={14} strokeWidth={2} style={{ marginRight: 5, verticalAlign: -2 }} />{t('council.actions.convoke')}
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button style={{ ...(d.view === 'sanctions' ? tabActiveSt : tabSt), minHeight: 38 }} onClick={() => d.setView('sanctions')}>{t('tabs.sanctions')}</button>
        <button style={{ ...(d.view === 'council' ? tabActiveSt : tabSt), minHeight: 38 }} onClick={() => d.setView('council')}>{t('tabs.council')}</button>
      </div>

      {d.view === 'sanctions' && (
        <DisciplineSanctionsView
          isOnline={isOnline}
          typeFilter={d.typeFilter}
          setTypeFilter={d.setTypeFilter}
          statusFilter={d.statusFilter}
          setStatusFilter={d.setStatusFilter}
          loading={d.loading}
          error={d.error}
          records={d.records}
          liftingId={d.liftingId}
          onFetchRecords={d.fetchRecords}
          onLiftSanction={d.liftSanction}
        />
      )}

      {d.view === 'council' && (
        <DisciplineCouncilView
          councilLoading={d.councilLoading}
          councilSessions={d.councilSessions}
          onOpenHold={(sessionId) => d.setTenirForm(f => ({ ...f, open: true, sessionId }))}
          onDownloadPV={d.downloadPV}
        />
      )}

      {d.form.open && (
        <SanctionModal
          form={d.form}
          setForm={d.setForm}
          needsDates={needsDates}
          onSearchStudents={d.searchStudents}
          onSubmit={d.submitSanction}
          onClose={() => d.setForm(EMPTY_FORM)}
        />
      )}

      {d.convokeForm.open && (
        <ConvokeCouncilModal
          form={d.convokeForm}
          setForm={d.setConvokeForm}
          onSearchStudents={d.searchConvokeStudents}
          onSubmit={d.submitConvoke}
          onClose={() => d.setConvokeForm(EMPTY_CONVOKE_FORM)}
        />
      )}

      {d.tenirForm.open && (
        <TenirCouncilModal
          form={d.tenirForm}
          setForm={d.setTenirForm}
          onSubmit={d.submitTenir}
          onClose={() => d.setTenirForm(EMPTY_TENIR_FORM)}
        />
      )}
    </div>
  )
}
