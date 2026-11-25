'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useT } from '@/lib/i18n'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import {
  FILIERES_EN_ARTS,
  FILIERES_EN_SCIENCES,
  FILIERES_LITT,
  FILIERES_SCIENT,
  FILIERES_TECH,
  LV2_OPTIONS,
  NIVEAUX_2E_CYCLE_EN,
  NIVEAUX_2E_CYCLE_FR,
} from '../_helpers/constants'
import type { EnGradingSystem, EnStreamStartLevel, FormData } from '../_helpers/types'
import { Alert, CheckboxGroup, Field, INPUT } from './OnboardingPrimitives'
import Step3BilingualAndPebs from './Step3BilingualAndPebs'

interface Props {
  template: TemplateCatalogEntry
  form: FormData
  setForm: Dispatch<SetStateAction<FormData>>
  set: (k: keyof FormData) => (v: string) => void
  customFiliere: string
  setCustomFiliere: (v: string) => void
  customA4: string
  setCustomA4: (v: string) => void
  enStreamStartLevel: EnStreamStartLevel
  setEnStreamStartLevel: (v: EnStreamStartLevel) => void
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

export default function Step3SecondCycle(props: Props) {
  const {
    template,
    form,
    setForm,
    set,
    customFiliere,
    setCustomFiliere,
    customA4,
    setCustomA4,
    enStreamStartLevel,
    setEnStreamStartLevel,
    enGradingSystem,
    setEnGradingSystem,
  } = props
  const t = useT('onboarding')
  const isEnSecondary = ['GHS_EN', 'GSS_EN', 'PRIVE_EN'].includes(template.code ?? '')

  return (
    <>
      {!template.isComplexe && template.code === 'CES_FR' && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <Alert msg={t('phase1.step3.secondCycle.cesNotice')} type="info" />
        </div>
      )}

      {template.hasDeuxiemeCycle && !['CES_FR', 'GTC_GTHS_EN'].includes(template.code ?? '') && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', padding: '8px 0', borderBottom: '2px solid var(--blue)', marginBottom: 14 }}>
            {isEnSecondary ? t('phase1.step3.secondCycle.sectionTitleEN') : t('phase1.step3.secondCycle.sectionTitleFR')}
          </div>

          {template.code === 'GSS_EN' && <Alert msg={t('phase1.step3.secondCycle.gssNotice')} type="info" />}

          {isEnSecondary ? (
            <Field label={t('phase1.step3.secondCycle.q10EN')}>
              <CheckboxGroup
                options={(template.code === 'GSS_EN' ? ['Form 4', 'Form 5'] : ['Form 4', 'Form 5', 'Lower Sixth', 'Upper Sixth']).map((v) => ({ value: v, label: v }))}
                values={form.niveaux2eCycle}
                onChange={(v) => setForm((f) => ({ ...f, niveaux2eCycle: v }))}
              />
            </Field>
          ) : (
            <Field label={t('phase1.step3.secondCycle.q10FR')}>
              <CheckboxGroup
                options={(form.subsystem === 'ANGLOPHONE' ? NIVEAUX_2E_CYCLE_EN : NIVEAUX_2E_CYCLE_FR).map((v) => ({ value: v, label: v }))}
                values={form.niveaux2eCycle}
                onChange={(v) => setForm((f) => ({ ...f, niveaux2eCycle: v }))}
              />
            </Field>
          )}

          {form.niveaux2eCycle.length > 0 &&
            (isEnSecondary ? (
              <div>
                <Field label={t('phase1.step3.secondCycle.q11EN')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.artsEN')}</div>
                      <CheckboxGroup options={FILIERES_EN_ARTS.map((v) => ({ value: v, label: v }))} values={form.filieres} onChange={(v) => setForm((f) => ({ ...f, filieres: v }))} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.sciencesEN')}</div>
                      <CheckboxGroup options={FILIERES_EN_SCIENCES.map((v) => ({ value: v, label: v }))} values={form.filieres} onChange={(v) => setForm((f) => ({ ...f, filieres: v }))} />
                    </div>
                  </div>
                </Field>
                {template.code !== 'GSS_EN' && (
                  <Field label={t('phase1.step3.secondCycle.streamStart')}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {([
                        { value: 'FORM4', label: t('phase1.step3.secondCycle.form4') },
                        { value: 'FORM5', label: t('phase1.step3.secondCycle.form5') },
                        { value: 'SIXTH', label: t('phase1.step3.secondCycle.lowerSixthOnly') },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEnStreamStartLevel(opt.value)}
                          style={{
                            flex: 1,
                            padding: '10px 8px',
                            border: `2px solid ${enStreamStartLevel === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                            borderRadius: 10,
                            background: enStreamStartLevel === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            fontWeight: 700,
                            color: enStreamStartLevel === opt.value ? 'var(--green2)' : 'var(--text2)',
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}
                <Field label={t('phase1.step3.secondCycle.grading')}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      { value: 'OVER_20', label: t('phase1.step3.secondCycle.marks20') },
                      { value: 'OVER_100', label: t('phase1.step3.secondCycle.marks100') },
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
            ) : (
              <Field label={t('phase1.step3.secondCycle.q11FR')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.literarySection')}</div>
                    <CheckboxGroup options={FILIERES_LITT.map((v) => ({ value: v, label: v }))} values={form.filieres} onChange={(v) => setForm((f) => ({ ...f, filieres: v }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.scienceSection')}</div>
                    <CheckboxGroup options={FILIERES_SCIENT.map((v) => ({ value: v, label: v }))} values={form.filieres} onChange={(v) => setForm((f) => ({ ...f, filieres: v }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.technicalSection')}</div>
                    <CheckboxGroup options={FILIERES_TECH.map((v) => ({ value: v, label: v }))} values={form.filieres} onChange={(v) => setForm((f) => ({ ...f, filieres: v }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.otherSection')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        className="edu-field"
                        value={customFiliere}
                        style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 250 }}
                        onChange={(e) => setCustomFiliere(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customFiliere.trim() && !form.filieres.includes(customFiliere.trim())) {
                            setForm((f) => ({ ...f, filieres: [...f.filieres, customFiliere.trim()] }))
                            setCustomFiliere('')
                          }
                        }}
                        placeholder={t('phase1.step3.secondCycle.placeholder')}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customFiliere.trim() && !form.filieres.includes(customFiliere.trim())) {
                            setForm((f) => ({ ...f, filieres: [...f.filieres, customFiliere.trim()] }))
                            setCustomFiliere('')
                          }
                        }}
                        style={{ padding: '7px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {t('phase1.step3.secondCycle.add')}
                      </button>
                    </div>
                  </div>
                </div>
              </Field>
            ))}

          {!isEnSecondary && form.filieres.some((f) => f.startsWith('A4') || f.includes('A4')) && (
            <Field label={t('phase1.step3.secondCycle.q12')}>
              <CheckboxGroup options={LV2_OPTIONS.map((v) => ({ value: v, label: t('phase1.lv2Languages.' + v) }))} values={form.a4Languages} onChange={(v) => setForm((f) => ({ ...f, a4Languages: v }))} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{t('phase1.step3.secondCycle.other')}</span>
                <input
                  className="edu-field"
                  value={customA4}
                  style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 180 }}
                  onChange={(e) => setCustomA4(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customA4.trim() && !form.a4Languages.includes(customA4.trim())) {
                      setForm((f) => ({ ...f, a4Languages: [...f.a4Languages, customA4.trim()] }))
                      setCustomA4('')
                    }
                  }}
                  placeholder={t('phase1.step3.secondCycle.placeholder')}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customA4.trim() && !form.a4Languages.includes(customA4.trim())) {
                      setForm((f) => ({ ...f, a4Languages: [...f.a4Languages, customA4.trim()] }))
                      setCustomA4('')
                    }
                  }}
                  style={{ padding: '7px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {t('phase1.step3.secondCycle.add')}
                </button>
              </div>
            </Field>
          )}

          {!isEnSecondary && form.filieres.length > 0 && (
            <Field label={t('phase1.step3.secondCycle.q13')}>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: '1', label: t('phase1.step3.secondCycle.oneClass') },
                  { value: '2', label: t('phase1.step3.secondCycle.twoClasses') },
                  { value: '3+', label: t('phase1.step3.secondCycle.threePlusClasses') },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set('classesParFiliere')(opt.value)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      border: `2px solid ${form.classesParFiliere === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                      borderRadius: 10,
                      background: form.classesParFiliere === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      fontWeight: 700,
                      color: form.classesParFiliere === opt.value ? 'var(--green2)' : 'var(--text2)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.a4Languages.length > 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontWeight: 600 }}>{t('phase1.step3.secondCycle.a4Hint')}</div>}
            </Field>
          )}
        </div>
      )}

      <Step3BilingualAndPebs
        template={template}
        form={form}
        setForm={setForm}
        enGradingSystem={enGradingSystem}
        setEnGradingSystem={setEnGradingSystem}
        hasPEBSFrancophone={props.hasPEBSFrancophone}
        setHasPEBSFrancophone={props.setHasPEBSFrancophone}
        hasPEBSAnglophone={props.hasPEBSAnglophone}
        setHasPEBSAnglophone={props.setHasPEBSAnglophone}
        bilingualEnLevels={props.bilingualEnLevels}
        setBilingualEnLevels={props.setBilingualEnLevels}
        bilingualEnFilieres={props.bilingualEnFilieres}
        setBilingualEnFilieres={props.setBilingualEnFilieres}
      />
    </>
  )
}
