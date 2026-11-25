'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useT } from '@/lib/i18n'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { NIVEAUX_PRIMAIRE_EN, NIVEAUX_PRIMAIRE_FR } from '../_helpers/constants'
import type { AppelFrequency, BulletinFrequency, EvalSystemPrimaire, FormData } from '../_helpers/types'
import { CheckboxGroup, Field, StepperBtns } from './OnboardingPrimitives'

interface Props {
  template: TemplateCatalogEntry
  form: FormData
  setForm: Dispatch<SetStateAction<FormData>>
  setNiveauPrimaireCount: (niveau: string, count: number) => void
  maternelleSections: string[]
  setMaternelleSections: (v: string[]) => void
  nurseryLevels: string[]
  setNurseryLevels: (v: string[]) => void
  evalSystemPrimaire: EvalSystemPrimaire
  setEvalSystemPrimaire: (v: EvalSystemPrimaire) => void
  appelFrequency: AppelFrequency
  setAppelFrequency: (v: AppelFrequency) => void
  bilingualEnLevels: string[]
  setBilingualEnLevels: (v: string[]) => void
  bulletinFrequency: BulletinFrequency
  setBulletinFrequency: (v: BulletinFrequency) => void
}

export default function Step3Primary({
  template,
  form,
  setForm,
  setNiveauPrimaireCount,
  maternelleSections,
  setMaternelleSections,
  nurseryLevels,
  setNurseryLevels,
  evalSystemPrimaire,
  setEvalSystemPrimaire,
  appelFrequency,
  setAppelFrequency,
  bilingualEnLevels,
  setBilingualEnLevels,
  bulletinFrequency,
  setBulletinFrequency,
}: Props) {
  const t = useT('onboarding')

  if (!template.isPrimaire && !template.isComplexe) return null

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', padding: '8px 0', borderBottom: '2px solid #d4a843', marginBottom: 14 }}>
        {t('phase1.step3.primary.sectionTitle')}
      </div>

      {/* MATERNELLE_FR ou COMPLEXE */}
      {(template.code === 'MATERNELLE_FR' || template.isComplexe) && (
        <div>
          <Field label={t('phase1.step3.primary.maternelleSections')}>
            <CheckboxGroup options={['Petite section', 'Moyenne section', 'Grande section'].map((v) => ({ value: v, label: v }))} values={maternelleSections} onChange={setMaternelleSections} />
          </Field>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{t('phase1.step3.primary.maternelleHint')}</div>
        </div>
      )}

      {/* NURSERY_EN */}
      {template.code === 'NURSERY_EN' && (
        <div>
          <Field label={t('phase1.step3.primary.nurseryLevels')}>
            <CheckboxGroup options={['PreNursery', 'Nursery 1', 'Nursery 2'].map((v) => ({ value: v, label: v }))} values={nurseryLevels} onChange={setNurseryLevels} />
          </Field>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{t('phase1.step3.primary.nurseryHint')}</div>
        </div>
      )}

      {/* PRIMARY_BILINGUAL */}
      {template.code === 'PRIMARY_BILINGUAL' && (
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>{t('phase1.step3.primary.frSection')}</div>
          <Field label={t('phase1.step3.primary.levelsFR')}>
            <CheckboxGroup
              options={NIVEAUX_PRIMAIRE_FR.map((v) => ({ value: v, label: v }))}
              values={form.niveauxPrimaire}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  niveauxPrimaire: v,
                  classesParNiveauPrimaire: v.reduce(
                    (acc, lvl) => ({ ...acc, [lvl]: f.classesParNiveauPrimaire[lvl] ?? 2 }),
                    {} as Record<string, number>
                  ),
                }))
              }
            />
          </Field>
          <Field label={t('phase1.step3.primary.evalFR')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'APC_300', label: t('phase1.step3.primary.apc300') },
                { value: 'NOTES_20', label: t('phase1.step3.primary.notes20') },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEvalSystemPrimaire(opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    border: `2px solid ${evalSystemPrimaire === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    background: evalSystemPrimaire === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    color: evalSystemPrimaire === opt.value ? 'var(--green2)' : 'var(--text2)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t('phase1.step3.primary.appelFR')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'TWICE', label: `${t('phase1.step3.primary.twice')} (${t('phase1.step3.primary.twiceDesc')})` },
                { value: 'ONCE', label: t('phase1.step3.primary.once') },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAppelFrequency(opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    border: `2px solid ${appelFrequency === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    background: appelFrequency === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    color: appelFrequency === opt.value ? 'var(--green2)' : 'var(--text2)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <div style={{ borderTop: '1.5px solid var(--border)', margin: '14px 0' }} />
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>{t('phase1.step3.primary.enSection')}</div>
          <Field label={t('phase1.step3.primary.levelsEN')}>
            <CheckboxGroup options={NIVEAUX_PRIMAIRE_EN.map((v) => ({ value: v, label: v }))} values={bilingualEnLevels} onChange={setBilingualEnLevels} />
          </Field>
          <Field label={t('phase1.step3.primary.reportCardFreq')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'MONTHLY', label: t('phase1.step3.primary.monthly') },
                { value: 'TRIMESTRIAL', label: t('phase1.step3.primary.perTerm') },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBulletinFrequency(opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    border: `2px solid ${bulletinFrequency === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    background: bulletinFrequency === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    color: bulletinFrequency === opt.value ? 'var(--green2)' : 'var(--text2)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {/* Standard primaire (PRIMAIRE_FR, PRIMARY_EN) */}
      {template.code !== 'MATERNELLE_FR' && template.code !== 'NURSERY_EN' && template.code !== 'PRIMARY_BILINGUAL' && (
        <div>
          {template.code === 'PRIMAIRE_FR' && (
            <div style={{ marginBottom: 8 }}>
              <Field label={t('phase1.step3.primary.evalSystem')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { value: 'APC_300', label: t('phase1.step3.primary.apc300'), desc: t('phase1.step3.primary.apc300Desc') },
                    { value: 'NOTES_20', label: t('phase1.step3.primary.notes20'), desc: t('phase1.step3.primary.notes20Desc') },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEvalSystemPrimaire(opt.value)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        border: `2px solid ${evalSystemPrimaire === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                        borderRadius: 10,
                        background: evalSystemPrimaire === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        fontWeight: 700,
                        color: evalSystemPrimaire === opt.value ? 'var(--green2)' : 'var(--text2)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span>{opt.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t('phase1.step3.primary.appelFrequency')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { value: 'TWICE', label: t('phase1.step3.primary.twice'), desc: t('phase1.step3.primary.twiceDesc') },
                    { value: 'ONCE', label: t('phase1.step3.primary.once'), desc: '' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAppelFrequency(opt.value)}
                      style={{
                        flex: 1,
                        padding: '10px 8px',
                        border: `2px solid ${appelFrequency === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                        borderRadius: 10,
                        background: appelFrequency === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        fontWeight: 700,
                        color: appelFrequency === opt.value ? 'var(--green2)' : 'var(--text2)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span>{opt.label}</span>
                      {opt.desc && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {template.code === 'PRIMARY_EN' && (
            <Field label={t('phase1.step3.primary.reportCardFreq')}>
              <div style={{ display: 'flex', gap: 8 }}>
                {([
                  { value: 'MONTHLY', label: t('phase1.step3.primary.monthly') },
                  { value: 'TRIMESTRIAL', label: t('phase1.step3.primary.perTerm') },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setBulletinFrequency(opt.value)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      border: `2px solid ${bulletinFrequency === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                      borderRadius: 10,
                      background: bulletinFrequency === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 700,
                      color: bulletinFrequency === opt.value ? 'var(--green2)' : 'var(--text2)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label={t('phase1.step3.primary.q15')}>
            <CheckboxGroup
              options={(form.subsystem === 'ANGLOPHONE' ? NIVEAUX_PRIMAIRE_EN : NIVEAUX_PRIMAIRE_FR).map((v) => ({ value: v, label: v }))}
              values={form.niveauxPrimaire}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  niveauxPrimaire: v,
                  classesParNiveauPrimaire: v.reduce(
                    (acc, lvl) => ({ ...acc, [lvl]: f.classesParNiveauPrimaire[lvl] ?? 2 }),
                    {} as Record<string, number>
                  ),
                }))
              }
            />
          </Field>

          {form.niveauxPrimaire.length > 0 && (
            <Field label={t('phase1.step3.primary.q16')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.niveauxPrimaire.map((niveau) => (
                  <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 60, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{niveau}</div>
                    <StepperBtns value={form.classesParNiveauPrimaire[niveau] ?? 1} onChange={(v) => setNiveauPrimaireCount(niveau, v)} max={4} />
                  </div>
                ))}
              </div>
            </Field>
          )}
        </div>
      )}
    </div>
  )
}
