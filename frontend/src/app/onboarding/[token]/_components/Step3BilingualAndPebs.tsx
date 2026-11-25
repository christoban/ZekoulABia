'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useT } from '@/lib/i18n'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { isPebsEnEligible, isPebsFrEligible } from '@/lib/onboarding/templateGates'
import { FILIERES_EN_ARTS, FILIERES_EN_SCIENCES, NIVEAUX_2E_CYCLE_EN, NIVEAUX_EN_FULL } from '../_helpers/constants'
import type { EnGradingSystem, FormData } from '../_helpers/types'
import { CheckboxGroup, Field } from './OnboardingPrimitives'

interface Props {
  template: TemplateCatalogEntry
  form: FormData
  setForm: Dispatch<SetStateAction<FormData>>
  enGradingSystem: EnGradingSystem
  setEnGradingSystem: (v: EnGradingSystem) => void
  hasPEBSFrancophone: boolean
  setHasPEBSFrancophone: (v: boolean) => void
  hasPEBSAnglophone: boolean
  setHasPEBSAnglophone: (v: boolean) => void
  bilingualEnLevels: string[]
  setBilingualEnLevels: (v: string[]) => void
  bilingualEnFilieres: string[]
  setBilingualEnFilieres: (v: string[]) => void
}

export default function Step3BilingualAndPebs({
  template,
  form,
  setForm,
  enGradingSystem,
  setEnGradingSystem,
  hasPEBSFrancophone,
  setHasPEBSFrancophone,
  hasPEBSAnglophone,
  setHasPEBSAnglophone,
  bilingualEnLevels,
  setBilingualEnLevels,
  bilingualEnFilieres,
  setBilingualEnFilieres,
}: Props) {
  const t = useT('onboarding')

  return (
    <>
      {/* PSB / PEBS */}
      {!template.isComplexe && template.code && isPebsFrEligible(template.code) && (
        <Field label={t('phase1.step3.secondCycle.pebsFR')}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: true, l: t('phase1.step3.secondCycle.pebsYes') },
              { v: false, l: t('phase1.step3.secondCycle.pebsNo') },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setHasPEBSFrancophone(opt.v)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  border: `2px solid ${hasPEBSFrancophone === opt.v ? 'var(--primary)' : 'var(--border2)'}`,
                  borderRadius: 10,
                  background: hasPEBSFrancophone === opt.v ? 'rgba(180,83,42,0.07)' : 'white',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  color: hasPEBSFrancophone === opt.v ? 'var(--green2)' : 'var(--text2)',
                }}
              >
                {opt.l}
              </button>
            ))}
          </div>
          {hasPEBSFrancophone && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontWeight: 600 }}>{t('phase1.step3.secondCycle.pebsFRHint')}</div>}
        </Field>
      )}
      {!template.isComplexe && template.code && isPebsEnEligible(template.code) && (
        <Field label={t('phase1.step3.secondCycle.pebsEN')}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: true, l: t('phase1.step3.secondCycle.pebsYesEN') },
              { v: false, l: t('phase1.step3.secondCycle.pebsNoEN') },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                type="button"
                onClick={() => setHasPEBSAnglophone(opt.v)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  border: `2px solid ${hasPEBSAnglophone === opt.v ? 'var(--primary)' : 'var(--border2)'}`,
                  borderRadius: 10,
                  background: hasPEBSAnglophone === opt.v ? 'rgba(180,83,42,0.07)' : 'white',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  color: hasPEBSAnglophone === opt.v ? 'var(--green2)' : 'var(--text2)',
                }}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* LYCEE_BILINGUE — Section Anglophone */}
      {template.code === 'LYCEE_BILINGUE' && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', padding: '8px 0', borderBottom: '2px solid var(--blue)', marginBottom: 14 }}>
            {t('phase1.step3.secondCycle.bilingualSection')}
          </div>
          <Field label={t('phase1.step3.bilingual.levels')}>
            <CheckboxGroup options={NIVEAUX_EN_FULL.map((v) => ({ value: v, label: v }))} values={bilingualEnLevels} onChange={setBilingualEnLevels} />
          </Field>
          {bilingualEnLevels.length > 0 && (
            <Field label={t('phase1.step3.bilingual.streams')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.bilingual.arts')}</div>
                  <CheckboxGroup options={FILIERES_EN_ARTS.map((v) => ({ value: v, label: v }))} values={bilingualEnFilieres} onChange={setBilingualEnFilieres} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.bilingual.sciences')}</div>
                  <CheckboxGroup options={FILIERES_EN_SCIENCES.map((v) => ({ value: v, label: v }))} values={bilingualEnFilieres} onChange={setBilingualEnFilieres} />
                </div>
              </div>
            </Field>
          )}
          <Field label={t('phase1.step3.bilingual.grading')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'OVER_20', label: t('phase1.step3.bilingual.marks20') },
                { value: 'OVER_100', label: t('phase1.step3.bilingual.marks100') },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEnGradingSystem(opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    border: `2px solid ${enGradingSystem === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    background: enGradingSystem === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    color: enGradingSystem === opt.value ? 'var(--green2)' : 'var(--text2)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* GTC_GTHS_EN — 2e cycle */}
      {template.code === 'GTC_GTHS_EN' && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', padding: '8px 0', borderBottom: '2px solid var(--blue)', marginBottom: 14 }}>
            {t('phase1.step3.secondCycle.sectionTitleEN')}
          </div>
          <Field label={t('phase1.step3.secondCycle.q10EN')}>
            <CheckboxGroup options={NIVEAUX_2E_CYCLE_EN.map((v) => ({ value: v, label: v }))} values={form.niveaux2eCycle} onChange={(v) => setForm((f) => ({ ...f, niveaux2eCycle: v }))} />
          </Field>
        </div>
      )}
    </>
  )
}
