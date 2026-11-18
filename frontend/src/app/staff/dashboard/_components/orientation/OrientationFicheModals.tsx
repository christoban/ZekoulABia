'use client'
import type React from 'react'
import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { OrientationModalOverlay } from './OrientationPrimitives'
import {
  type EditEntretienFormState,
  type EntretienFormState,
  MOTIF_OPTIONS,
  type NewFicheFormState,
  PREOCCUPATION_OPTIONS,
  RISK_OPTIONS,
  type StudentResult,
  type SuiviFormState,
  TYPE_ENTRETIEN_OPTIONS,
  TYPE_TEST_OPTIONS,
  type TestFormState,
  btnPrim,
  btnSec,
  sError,
  sInput,
  sLabel,
  sModalTitle,
} from './orientationTypes'

export function ModalNouvelleFiche({
  form,
  setForm,
  onSearchStudents,
  onSubmit,
  onClose,
}: {
  form: NewFicheFormState
  setForm: React.Dispatch<React.SetStateAction<NewFicheFormState>>
  onSearchStudents: (q: string, setter: (r: StudentResult[]) => void) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <OrientationModalOverlay onClose={onClose}>
      <div style={sModalTitle}>{t('orientation.newFicheModalTitle')}</div>
      <div style={sLabel}>{t('orientation.tableHeaderStudent')} *</div>
      <input
        style={sInput}
        placeholder={t('orientation.studentSearchPlaceholder')}
        value={form.studentSearch}
        onChange={e => {
          setForm(f => ({ ...f, studentSearch: e.target.value, selectedStudent: null }))
          onSearchStudents(e.target.value, r => setForm(f => ({ ...f, studentResults: r })))
        }}
      />
      {form.selectedStudent && (
        <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} strokeWidth={2} /> {form.selectedStudent.firstName} {form.selectedStudent.lastName}
        </div>
      )}
      {form.studentResults.length > 0 && !form.selectedStudent && (
        <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          {form.studentResults.map(s => (
            <div key={s.id} onClick={() => setForm(f => ({ ...f, selectedStudent: s, studentSearch: `${s.firstName} ${s.lastName}`, studentResults: [] }))}
              style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
              {s.firstName} {s.lastName}
            </div>
          ))}
        </div>
      )}
      <div style={sLabel}>{t('orientation.mainConcernLabel')}</div>
      <select style={sInput} value={form.mainConcern} onChange={e => setForm(f => ({ ...f, mainConcern: e.target.value }))}>
        <option value="">{t('orientation.mainConcernPlaceholder')}</option>
        {PREOCCUPATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
      </select>
      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec, flex: 1 }} onClick={onClose}>{t('orientation.cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={onSubmit} disabled={form.loading}>
          {form.loading ? t('orientation.creatingFiche') : t('orientation.createFiche')}
        </button>
      </div>
    </OrientationModalOverlay>
  )
}

export function ModalEntretien({
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  form: EntretienFormState
  setForm: React.Dispatch<React.SetStateAction<EntretienFormState>>
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <OrientationModalOverlay onClose={onClose}>
      <div style={sModalTitle}>{t('orientation.planInterviewModalTitle')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={sLabel}>{t('orientation.dateTimeLabel')}</div>
          <input style={sInput} type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <div style={sLabel}>{t('orientation.typeLabel')}</div>
          <select style={sInput} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {TYPE_ENTRETIEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
          </select>
        </div>
      </div>
      <div style={sLabel}>{t('orientation.motifLabel')}</div>
      <select style={sInput} value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}>
        {MOTIF_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
      </select>
      <div style={sLabel}>{t('orientation.notesLabel').replace(':', '')}</div>
      <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('orientation.notesPlaceholder')} />
      <div style={sLabel}>{t('orientation.recommendationsLabel').replace(':', '')}</div>
      <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} placeholder={t('orientation.recommendationsPlaceholder')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={sLabel}>{t('orientation.followUpDateLabel')}</div>
          <input style={sInput} type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 28 }}>
          <input type="checkbox" id="pn" checked={form.parentNotified} onChange={e => setForm(f => ({ ...f, parentNotified: e.target.checked }))} />
          <label htmlFor="pn" style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{t('orientation.parentNotifiedCheckbox')}</label>
        </div>
      </div>
      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec, flex: 1 }} onClick={onClose}>{t('orientation.cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={onSubmit} disabled={form.loading}>
          {form.loading ? t('orientation.savingInterview') : t('orientation.saveInterview')}
        </button>
      </div>
    </OrientationModalOverlay>
  )
}

export function ModalTest({
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  form: TestFormState
  setForm: React.Dispatch<React.SetStateAction<TestFormState>>
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <OrientationModalOverlay onClose={onClose}>
      <div style={sModalTitle}>{t('orientation.addTestModalTitle')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={sLabel}>{t('orientation.testTypeLabel')}</div>
          <select style={sInput} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {TYPE_TEST_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
          </select>
        </div>
        <div>
          <div style={sLabel}>{t('orientation.testDateLabel')}</div>
          <input style={sInput} type="date" value={form.datePassage} onChange={e => setForm(f => ({ ...f, datePassage: e.target.value }))} />
        </div>
      </div>
      <div style={sLabel}>{t('orientation.testResultsLabel')}</div>
      <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={form.resultats} onChange={e => setForm(f => ({ ...f, resultats: e.target.value }))} placeholder={t('orientation.testResultsPlaceholder')} />
      <div style={sLabel}>{t('orientation.testInterpretationLabel')}</div>
      <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={form.interpretation} onChange={e => setForm(f => ({ ...f, interpretation: e.target.value }))} placeholder={t('orientation.testInterpretationPlaceholder')} />
      <div style={sLabel}>{t('orientation.testScoreLabel')}</div>
      <input style={sInput} type="number" min="0" max="100" value={form.scoreGlobal} onChange={e => setForm(f => ({ ...f, scoreGlobal: e.target.value }))} placeholder={t('orientation.testScorePlaceholder')} />

      {form.type === 'PSYCHOTECHNIQUE' && (
        <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
          <div style={sLabel}>{t('orientation.checkpointColumn')}</div>
          <select style={sInput} value={form.checkpointType} onChange={e => setForm(f => ({ ...f, checkpointType: e.target.value }))}>
            <option value="">{t('orientation.checkpointNoneOption')}</option>
            <option value="FIN_TROISIEME">{t('orientation.checkpointFinTroisieme')}</option>
            <option value="FIN_SECONDE_C">{t('orientation.checkpointFinSecondeC')}</option>
          </select>
          {form.checkpointType && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <div style={sLabel}>{t('orientation.aptitudeScientific')}</div>
                <input style={sInput} type="number" min="0" max="100" value={form.scientificAptitude} onChange={e => setForm(f => ({ ...f, scientificAptitude: e.target.value }))} />
              </div>
              <div>
                <div style={sLabel}>{t('orientation.aptitudeLiterary')}</div>
                <input style={sInput} type="number" min="0" max="100" value={form.literaryAptitude} onChange={e => setForm(f => ({ ...f, literaryAptitude: e.target.value }))} />
              </div>
              <div>
                <div style={sLabel}>{t('orientation.aptitudeTechnical')}</div>
                <input style={sInput} type="number" min="0" max="100" value={form.technicalAptitude} onChange={e => setForm(f => ({ ...f, technicalAptitude: e.target.value }))} />
              </div>
            </div>
          )}
        </div>
      )}
      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec, flex: 1 }} onClick={onClose}>{t('orientation.cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={onSubmit} disabled={form.loading}>
          {form.loading ? t('orientation.savingTest') : t('orientation.addTestButton')}
        </button>
      </div>
    </OrientationModalOverlay>
  )
}

export function ModalSuivi({
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  form: SuiviFormState
  setForm: React.Dispatch<React.SetStateAction<SuiviFormState>>
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <OrientationModalOverlay onClose={onClose}>
      <div style={sModalTitle}>{t('orientation.addFollowUpModalTitle')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={sLabel}>{t('orientation.riskLevelLabel')}</div>
          <select style={sInput} value={form.riskLevel} onChange={e => setForm(f => ({ ...f, riskLevel: e.target.value }))}>
            {RISK_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
          </select>
        </div>
        <div>
          <div style={sLabel}>{t('orientation.mainConcernLabelFM')}</div>
          <select style={sInput} value={form.mainConcern} onChange={e => setForm(f => ({ ...f, mainConcern: e.target.value }))}>
            {PREOCCUPATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
          </select>
        </div>
      </div>
      <div style={sLabel}>{t('orientation.interventionsLabelFM')}</div>
      <textarea style={{ ...sInput, minHeight: 70, resize: 'vertical' }} value={form.interventions} onChange={e => setForm(f => ({ ...f, interventions: e.target.value }))} placeholder={t('orientation.interventionsPlaceholder')} />
      <div style={sLabel}>{t('orientation.notesLabel').replace(':', '')}</div>
      <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('orientation.notesPlaceholderFU')} />
      <div style={sLabel}>{t('orientation.nextAppointmentLabel')}</div>
      <input style={sInput} type="date" value={form.prochainRdv} onChange={e => setForm(f => ({ ...f, prochainRdv: e.target.value }))} />
      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec, flex: 1 }} onClick={onClose}>{t('orientation.cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={onSubmit} disabled={form.loading}>
          {form.loading ? t('orientation.savingFollowUp') : t('orientation.saveFollowUp')}
        </button>
      </div>
    </OrientationModalOverlay>
  )
}

export function ModalModifierEntretien({
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  form: EditEntretienFormState
  setForm: React.Dispatch<React.SetStateAction<EditEntretienFormState>>
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <OrientationModalOverlay onClose={onClose}>
      <div style={sModalTitle}>{t('orientation.editInterviewModalTitle')}</div>
      <div style={sLabel}>{t('orientation.notesLabel').replace(':', '')}</div>
      <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('orientation.notesEditPlaceholder')} />
      <div style={sLabel}>{t('orientation.recommendationsLabel').replace(':', '')}</div>
      <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={form.recommendations} onChange={e => setForm(f => ({ ...f, recommendations: e.target.value }))} placeholder={t('orientation.recommendationsEditPlaceholder')} />
      <div style={sLabel}>{t('orientation.nextActionsLabel')}</div>
      <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={form.nextActions} onChange={e => setForm(f => ({ ...f, nextActions: e.target.value }))} placeholder={t('orientation.nextActionsEditPlaceholder')} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={sLabel}>{t('orientation.statusLabelFollowUp')}</div>
          <select style={sInput} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="PLANIFIE">{t('orientation.interviewStatusPlanned')}</option>
            <option value="REALISE">{t('orientation.interviewStatusRealised')}</option>
            <option value="ANNULE">{t('orientation.interviewStatusCancelled')}</option>
          </select>
        </div>
        <div>
          <div style={sLabel}>{t('orientation.followUpDateLabel')}</div>
          <input style={sInput} type="date" value={form.followUpDate} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <input type="checkbox" id="pn-edit" checked={form.parentNotified} onChange={e => setForm(f => ({ ...f, parentNotified: e.target.checked }))} />
        <label htmlFor="pn-edit" style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{t('orientation.parentNotifiedCheckbox')}</label>
      </div>
      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <button style={{ ...btnSec, flex: 1 }} onClick={onClose}>{t('orientation.cancelEdit')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={onSubmit} disabled={form.loading}>
          {form.loading ? t('orientation.savingEdit') : t('orientation.saveEdit')}
        </button>
      </div>
    </OrientationModalOverlay>
  )
}
