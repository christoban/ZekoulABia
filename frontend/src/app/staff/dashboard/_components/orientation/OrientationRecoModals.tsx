'use client'
import type React from 'react'
import { useT } from '@/lib/i18n'
import { OrientationModalOverlay } from './OrientationPrimitives'
import {
  CHECKPOINT_TYPE_LABEL_KEY,
  type CheckpointConfigFormState,
  type CheckpointTypeValue,
  RECO_SERIES,
  type RecoFormState,
  type SuggestedTrack,
  btnPrim,
  btnSec,
  sError,
  sInput,
  sLabel,
  sModalTitle,
} from './orientationTypes'

export function ModalReco({
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  form: RecoFormState
  setForm: React.Dispatch<React.SetStateAction<RecoFormState>>
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <OrientationModalOverlay onClose={onClose}>
      <div style={sModalTitle}>{t('orientation.recommendationTitle')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={sLabel}>{t('orientation.currentSeries')}</div>
          <select style={sInput} value={form.serieActuelle} onChange={e => setForm(f => ({ ...f, serieActuelle: e.target.value }))}>
            <option value="">{t('orientation.recoSeriesPlaceholder')}</option>
            {RECO_SERIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={sLabel}>{t('orientation.recommendedSeries')}</div>
          <select style={sInput} value={form.serieRecommandee} onChange={e => setForm(f => ({ ...f, serieRecommandee: e.target.value }))}>
            <option value="">{t('orientation.recoSeriesPlaceholder')}</option>
            {RECO_SERIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={sLabel}>{t('orientation.justificationLabel').replace(':', '')}</div>
      <textarea style={{ ...sInput, minHeight: 100, resize: 'vertical' }} value={form.justification} onChange={e => setForm(f => ({ ...f, justification: e.target.value }))} placeholder={t('orientation.recoJustificationPlaceholder')} />
      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec, flex: 1 }} onClick={onClose}>{t('orientation.cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={onSubmit} disabled={form.loading}>
          {form.loading ? t('orientation.recoSaving') : t('orientation.recoSave')}
        </button>
      </div>
    </OrientationModalOverlay>
  )
}

export function ModalConfigCheckpoint({
  checkpointType,
  form,
  setForm,
  onSubmit,
  onClose,
}: {
  checkpointType: CheckpointTypeValue
  form: CheckpointConfigFormState
  setForm: React.Dispatch<React.SetStateAction<CheckpointConfigFormState>>
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <OrientationModalOverlay onClose={onClose}>
      <div style={sModalTitle}>{t('orientation.checkpointConfigModalTitle')} — {t(`orientation.${CHECKPOINT_TYPE_LABEL_KEY[checkpointType]}`)}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <input type="checkbox" id="cp-test" checked={form.psychotechnicalTestRequired}
          onChange={e => setForm(f => ({ ...f, psychotechnicalTestRequired: e.target.checked }))} />
        <label htmlFor="cp-test" style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{t('orientation.checkpointTestRequiredCheckbox')}</label>
      </div>

      <div style={sLabel}>{t('orientation.checkpointWindowStartLabel')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <input style={sInput} type="number" min={1} max={12} value={form.windowStartMonth}
          onChange={e => setForm(f => ({ ...f, windowStartMonth: Number(e.target.value) }))} placeholder={t('orientation.checkpointMonthPlaceholder')} />
        <input style={sInput} type="number" min={1} max={31} value={form.windowStartDay}
          onChange={e => setForm(f => ({ ...f, windowStartDay: Number(e.target.value) }))} placeholder={t('orientation.checkpointDayPlaceholder')} />
      </div>
      <div style={sLabel}>{t('orientation.checkpointWindowEndLabel')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <input style={sInput} type="number" min={1} max={12} value={form.windowEndMonth}
          onChange={e => setForm(f => ({ ...f, windowEndMonth: Number(e.target.value) }))} placeholder={t('orientation.checkpointMonthPlaceholder')} />
        <input style={sInput} type="number" min={1} max={31} value={form.windowEndDay}
          onChange={e => setForm(f => ({ ...f, windowEndDay: Number(e.target.value) }))} placeholder={t('orientation.checkpointDayPlaceholder')} />
      </div>
      <div style={sLabel}>{t('orientation.checkpointDeadlineDaysLabel')}</div>
      <input style={sInput} type="number" min={1} max={90} value={form.responseDeadlineDays}
        onChange={e => setForm(f => ({ ...f, responseDeadlineDays: Number(e.target.value) }))} />

      {form.error && <div style={sError}>{form.error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec, flex: 1 }} onClick={onClose}>{t('orientation.cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={onSubmit} disabled={form.loading}>
          {form.loading ? t('orientation.checkpointConfigSaving') : t('orientation.checkpointConfigSave')}
        </button>
      </div>
    </OrientationModalOverlay>
  )
}

export function ModalValiderCheckpoint({
  tracks,
  selectedPiste,
  onSelectPiste,
  validating,
  onSubmit,
  onClose,
}: {
  tracks: SuggestedTrack[]
  selectedPiste: string
  onSelectPiste: (piste: string) => void
  validating: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  const t = useT('staff')
  return (
    <OrientationModalOverlay onClose={onClose}>
      <div style={sModalTitle}>{t('orientation.checkpointValidateModalTitle')}</div>
      <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.6 }}>{t('orientation.checkpointValidateModalHint')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {tracks.map(st => (
          <label key={st.track} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            border: `2px solid ${selectedPiste === st.track ? 'var(--green)' : 'var(--border)'}`,
            borderRadius: 10, cursor: 'pointer', background: selectedPiste === st.track ? 'var(--green-light)' : 'transparent',
          }}>
            <input type="radio" name="piste-checkpoint" checked={selectedPiste === st.track} onChange={() => onSelectPiste(st.track)} />
            <span style={{ fontWeight: 800, fontSize: 16 }}>{st.track}</span>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>({st.score}/100)</span>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={{ ...btnSec, flex: 1 }} onClick={onClose}>{t('orientation.cancel')}</button>
        <button style={{ ...btnPrim, flex: 1, opacity: validating ? 0.7 : 1 }} onClick={onSubmit} disabled={validating || !selectedPiste}>
          {validating ? t('orientation.checkpointConfigSaving') : t('orientation.checkpointValidateConfirm')}
        </button>
      </div>
    </OrientationModalOverlay>
  )
}
