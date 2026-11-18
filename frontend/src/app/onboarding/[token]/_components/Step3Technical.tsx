'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useT } from '@/lib/i18n'
import type { OfferFlag } from '@/lib/onboarding/phase1Profile'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { showTechniqueBlocks } from '@/lib/onboarding/templateGates'
import {
  CETIF_FILIERES_OPTIONS,
  CFM_FILIERES_OPTIONS,
  FILIERES_TECHNIQUES_OFF,
  FILIERES_TECHNIQUES_TER,
  SAR_METIERS_OPTIONS,
} from '../_helpers/constants'
import type { FormData, TechnicalSubtype } from '../_helpers/types'
import { CheckboxGroup, Field, INPUT } from './OnboardingPrimitives'

interface Props {
  template: TemplateCatalogEntry
  offers: OfferFlag[]
  form: FormData
  setForm: Dispatch<SetStateAction<FormData>>
  sousTypeTechnique: TechnicalSubtype
  setSousTypeTechnique: (v: TechnicalSubtype) => void
  cetifMode: boolean
  setCetifMode: (v: boolean) => void
  sarMetiers: string[]
  setSarMetiers: Dispatch<SetStateAction<string[]>>
  customSarMetier: string
  setCustomSarMetier: (v: string) => void
  cfmFilieres: string[]
  setCfmFilieres: Dispatch<SetStateAction<string[]>>
  customCfmFiliere: string
  setCustomCfmFiliere: (v: string) => void
  customTech: string
  setCustomTech: (v: string) => void
}

export default function Step3Technical({
  template,
  offers,
  form,
  setForm,
  sousTypeTechnique,
  setSousTypeTechnique,
  cetifMode,
  setCetifMode,
  sarMetiers,
  setSarMetiers,
  customSarMetier,
  setCustomSarMetier,
  cfmFilieres,
  setCfmFilieres,
  customCfmFiliere,
  setCustomCfmFiliere,
  customTech,
  setCustomTech,
}: Props) {
  const t = useT('onboarding')

  if (!showTechniqueBlocks(template, offers)) return null

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', padding: '8px 0', borderBottom: '2px solid var(--amber)', marginBottom: 14 }}>
        {t('phase1.step3.technical.sectionTitle')}
      </div>

      {template.isComplexe && offers.includes('TECHNICAL') && (
        <Field label={t('phase1.step3.technical.q14Tech')}>
          <CheckboxGroup
            options={FILIERES_TECHNIQUES_OFF.map((v) => ({ value: v, label: v }))}
            values={form.filieresTechniques}
            onChange={(v) => setForm((f) => ({ ...f, filieresTechniques: v }))}
          />
        </Field>
      )}

      {template.isComplexe && offers.includes('PROFESSIONAL') && (
        <div>
          <Field label={t('phase1.step3.technical.sarMetiers')}>
            <CheckboxGroup options={SAR_METIERS_OPTIONS.map((v) => ({ value: v, label: t('phase1.sarMetiers.' + v) }))} values={sarMetiers} onChange={setSarMetiers} />
          </Field>
          <Field label={t('phase1.step3.technical.cfmFilieres')}>
            <CheckboxGroup options={CFM_FILIERES_OPTIONS.map((v) => ({ value: v, label: t('phase1.cfmFilieres.' + v) }))} values={cfmFilieres} onChange={setCfmFilieres} />
          </Field>
        </div>
      )}

      {/* Admission (Q_ADMISSION) */}
      <Field label={t('phase1.step3.technical.admissionType')}>
        <div style={{ display: 'flex', gap: 8 }}>
          {([
            { value: 'MIXTE', label: t('phase1.step3.technical.admissionMixte') },
            { value: 'FILLES', label: t('phase1.step3.technical.admissionFilles') },
            { value: 'GARCONS', label: t('phase1.step3.technical.admissionGarcons') },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, admissionType: opt.value }))}
              style={{
                flex: 1,
                padding: '10px 6px',
                border: `2px solid ${form.admissionType === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                borderRadius: 10,
                background: form.admissionType === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                color: form.admissionType === opt.value ? 'var(--green2)' : 'var(--text2)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      {/* SAR_SM */}
      {template.code === 'SAR_SM' && (
        <div>
          <div style={{ padding: '10px 14px', background: 'var(--amber-light)', border: '1.5px solid var(--amber-light)', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>
            {t('phase1.step3.technical.sarNotice')}
          </div>
          <Field label={t('phase1.step3.technical.sarMetiers')}>
            <CheckboxGroup options={SAR_METIERS_OPTIONS.map((v) => ({ value: v, label: t('phase1.sarMetiers.' + v) }))} values={sarMetiers} onChange={setSarMetiers} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{t('phase1.step3.technical.autres')}</span>
              <input
                className="edu-field"
                value={customSarMetier}
                style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 220 }}
                onChange={(e) => setCustomSarMetier(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customSarMetier.trim() && !sarMetiers.includes(customSarMetier.trim())) {
                    setSarMetiers((m) => [...m, customSarMetier.trim()])
                    setCustomSarMetier('')
                  }
                }}
                placeholder={t('phase1.step3.technical.placeholder')}
              />
              <button
                type="button"
                onClick={() => {
                  if (customSarMetier.trim() && !sarMetiers.includes(customSarMetier.trim())) {
                    setSarMetiers((m) => [...m, customSarMetier.trim()])
                    setCustomSarMetier('')
                  }
                }}
                style={{ padding: '7px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t('phase1.step3.technical.add')}
              </button>
            </div>
          </Field>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{t('phase1.step3.technical.sarHint')}</div>
        </div>
      )}

      {/* CFM */}
      {template.code === 'CFM' && (
        <div>
          <Field label={t('phase1.step3.technical.cfmFilieres')}>
            <CheckboxGroup options={CFM_FILIERES_OPTIONS.map((v) => ({ value: v, label: t('phase1.cfmFilieres.' + v) }))} values={cfmFilieres} onChange={setCfmFilieres} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{t('phase1.step3.technical.autres')}</span>
              <input
                className="edu-field"
                value={customCfmFiliere}
                style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 220 }}
                onChange={(e) => setCustomCfmFiliere(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customCfmFiliere.trim() && !cfmFilieres.includes(customCfmFiliere.trim())) {
                    setCfmFilieres((m) => [...m, customCfmFiliere.trim()])
                    setCustomCfmFiliere('')
                  }
                }}
                placeholder={t('phase1.step3.technical.placeholder')}
              />
              <button
                type="button"
                onClick={() => {
                  if (customCfmFiliere.trim() && !cfmFilieres.includes(customCfmFiliere.trim())) {
                    setCfmFilieres((m) => [...m, customCfmFiliere.trim()])
                    setCustomCfmFiliere('')
                  }
                }}
                style={{ padding: '7px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {t('phase1.step3.technical.add')}
              </button>
            </div>
          </Field>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{t('phase1.step3.technical.cfmHint')}</div>
        </div>
      )}

      {/* LYCEE_TECHNIQUE_FR */}
      {template.code === 'LYCEE_TECHNIQUE_FR' && (
        <div>
          <Field label={t('phase1.step3.technical.lyceeTechType')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'IND', label: t('phase1.step3.technical.industriel'), desc: t('phase1.step3.technical.industrielDesc') },
                { value: 'STT', label: t('phase1.step3.technical.tertiaire'), desc: t('phase1.step3.technical.tertiaireDesc') },
                { value: 'MIXTE', label: t('phase1.step3.technical.mixte'), desc: t('phase1.step3.technical.mixteDesc') },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSousTypeTechnique(opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    border: `2px solid ${sousTypeTechnique === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    background: sousTypeTechnique === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    color: sousTypeTechnique === opt.value ? 'var(--green2)' : 'var(--text2)',
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
          {sousTypeTechnique && (
            <Field label={t('phase1.step3.technical.q14')}>
              <CheckboxGroup
                options={(
                  sousTypeTechnique === 'IND'
                    ? FILIERES_TECHNIQUES_OFF.filter((f) => f.startsWith('F'))
                    : sousTypeTechnique === 'STT'
                      ? FILIERES_TECHNIQUES_OFF.filter((f) => f.startsWith('G'))
                      : FILIERES_TECHNIQUES_OFF
                ).map((v) => ({ value: v, label: v }))}
                values={form.filieresTechniques}
                onChange={(v) => setForm((f) => ({ ...f, filieresTechniques: v }))}
              />
            </Field>
          )}
        </div>
      )}

      {/* GTC_EN / GTC_GTHS_EN */}
      {(template.code === 'GTC_EN' || template.code === 'GTC_GTHS_EN') && (
        <div>
          <Field label={t('phase1.step3.technical.gtcType')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { value: 'IND', label: t('phase1.step3.technical.industrielEn'), desc: t('phase1.step3.technical.industrielEnDesc') },
                { value: 'STT', label: t('phase1.step3.technical.tertiaireEn'), desc: t('phase1.step3.technical.tertiaireEnDesc') },
                { value: 'MIXTE', label: t('phase1.step3.technical.mixte'), desc: t('phase1.step3.technical.mixteEnDesc') },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSousTypeTechnique(opt.value)}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    border: `2px solid ${sousTypeTechnique === opt.value ? 'var(--primary)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    background: sousTypeTechnique === opt.value ? 'rgba(180,83,42,0.07)' : 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    color: sousTypeTechnique === opt.value ? 'var(--green2)' : 'var(--text2)',
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
          {sousTypeTechnique && (
            <Field label={t('phase1.step3.technical.q14')}>
              <CheckboxGroup
                options={sousTypeTechnique === 'MIXTE' ? [{ value: 'STT', label: 'STT' }, { value: 'IND', label: 'IND' }] : [{ value: sousTypeTechnique, label: sousTypeTechnique }]}
                values={form.filieresTechniques}
                onChange={(v) => setForm((f) => ({ ...f, filieresTechniques: v }))}
              />
            </Field>
          )}
        </div>
      )}

      {/* CETIC */}
      {template.code === 'CETIC' && (
        <div>
          <Field label={t('phase1.step3.technical.ceticType')}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { val: false, label: t('phase1.step3.technical.ceticGeneral'), desc: t('phase1.step3.technical.ceticGeneralDesc') },
                { val: true, label: t('phase1.step3.technical.ceticCETIF'), desc: t('phase1.step3.technical.ceticCETIFDesc') },
              ].map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setCetifMode(opt.val)
                    setForm((f) => ({ ...f, admissionType: opt.val ? 'FILLES' : 'MIXTE' }))
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 6px',
                    border: `2px solid ${cetifMode === opt.val ? 'var(--primary)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    background: cetifMode === opt.val ? 'rgba(180,83,42,0.07)' : 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    color: cetifMode === opt.val ? 'var(--green2)' : 'var(--text2)',
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
          {cetifMode ? (
            <Field label={t('phase1.step3.technical.ceticFilieres')}>
              <CheckboxGroup options={CETIF_FILIERES_OPTIONS.map((v) => ({ value: v, label: t('phase1.ceticFilieres.' + v) }))} values={form.filieresTechniques} onChange={(v) => setForm((f) => ({ ...f, filieresTechniques: v }))} />
            </Field>
          ) : (
            <Field label={t('phase1.step3.technical.q14Tech')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.technical.optionsOfficielles')}</div>
                  <CheckboxGroup options={FILIERES_TECHNIQUES_OFF.map((v) => ({ value: v, label: v }))} values={form.filieresTechniques} onChange={(v) => setForm((f) => ({ ...f, filieresTechniques: v }))} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.technical.optionsTerrain')}</div>
                  <CheckboxGroup options={FILIERES_TECHNIQUES_TER.map((v) => ({ value: v, label: v }))} values={form.filieresTechniques} onChange={(v) => setForm((f) => ({ ...f, filieresTechniques: v }))} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.technical.autres')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      className="edu-field"
                      value={customTech}
                      style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 250 }}
                      onChange={(e) => setCustomTech(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customTech.trim() && !form.filieresTechniques.includes(customTech.trim())) {
                          setForm((f) => ({ ...f, filieresTechniques: [...f.filieresTechniques, customTech.trim()] }))
                          setCustomTech('')
                        }
                      }}
                      placeholder={t('phase1.step3.technical.placeholder')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customTech.trim() && !form.filieresTechniques.includes(customTech.trim())) {
                          setForm((f) => ({ ...f, filieresTechniques: [...f.filieresTechniques, customTech.trim()] }))
                          setCustomTech('')
                        }
                      }}
                      style={{ padding: '7px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {t('phase1.step3.technical.add')}
                    </button>
                  </div>
                </div>
              </div>
            </Field>
          )}
        </div>
      )}
    </div>
  )
}
