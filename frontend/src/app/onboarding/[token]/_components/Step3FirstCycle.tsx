'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useT } from '@/lib/i18n'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import {
  LV2_OPTIONS,
  NIVEAUX_1ER_CYCLE_CAP,
  NIVEAUX_1ER_CYCLE_EN,
  NIVEAUX_1ER_CYCLE_EN_LOWER,
  NIVEAUX_1ER_CYCLE_FR,
} from '../_helpers/constants'
import type { FormData } from '../_helpers/types'
import { CheckboxGroup, ClassPreview, Field, INPUT, StepperBtns } from './OnboardingPrimitives'

interface Props {
  template: TemplateCatalogEntry
  form: FormData
  setForm: Dispatch<SetStateAction<FormData>>
  set: (k: keyof FormData) => (v: string) => void
  setNiveauCount: (niveau: string, count: number) => void
  conventionOptions: { value: string; key: string; descKey: string; label: string; desc: string }[]
  customLv2: string
  setCustomLv2: (v: string) => void
}

export default function Step3FirstCycle({
  template,
  form,
  setForm,
  set,
  setNiveauCount,
  conventionOptions,
  customLv2,
  setCustomLv2,
}: Props) {
  const t = useT('onboarding')

  if (!template.hasPremierCycle) return null

  return (
    <div style={{ marginTop: 4, marginBottom: 8 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', padding: '8px 0', borderBottom: '2px solid var(--primary)', marginBottom: 14 }}>
        {t('phase1.step3.firstCycle.sectionTitle')}
      </div>

      {/* Q5 — Niveaux */}
      <Field label={t('phase1.step3.firstCycle.q5')}>
        <CheckboxGroup
          options={
            form.subsystem === 'ANGLOPHONE' && form.educationType === 'TECHNICAL'
              ? NIVEAUX_1ER_CYCLE_EN.slice(0, 4).map((v) => ({ value: v, label: v }))
              : form.educationType === 'TECHNICAL'
                ? NIVEAUX_1ER_CYCLE_CAP.map((v) => ({ value: v, label: v }))
                : form.subsystem === 'ANGLOPHONE'
                  ? (template.hasDeuxiemeCycle ? NIVEAUX_1ER_CYCLE_EN_LOWER : NIVEAUX_1ER_CYCLE_EN).map((v) => ({ value: v, label: v }))
                  : NIVEAUX_1ER_CYCLE_FR.map((v) => ({ value: v, label: v }))
          }
          values={form.niveaux1erCycle}
          onChange={(v) =>
            setForm((f) => ({
              ...f,
              niveaux1erCycle: v,
              classesParNiveau: v.reduce(
                (acc, lvl) => ({ ...acc, [lvl]: f.classesParNiveau[lvl] ?? 2 }),
                {} as Record<string, number>
              ),
            }))
          }
        />
      </Field>

      {/* Q6 — Nombre de classes par niveau */}
      {form.niveaux1erCycle.length > 0 && (
        <Field label={t('phase1.step3.firstCycle.q6')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {form.niveaux1erCycle.map((niveau) => (
              <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 50, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{niveau}</div>
                <StepperBtns value={form.classesParNiveau[niveau] ?? 2} onChange={(v) => setNiveauCount(niveau, v)} />
              </div>
            ))}
          </div>
        </Field>
      )}

      {/* Q7 — Convention de nommage */}
      <Field label={t('phase1.step3.firstCycle.q7')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {conventionOptions.map((opt) => {
            const active = form.conventionNommage === opt.value
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  border: `2px solid ${active ? 'var(--primary)' : 'var(--border2)'}`,
                  borderRadius: 10,
                  background: active ? 'rgba(180,83,42,0.07)' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <input type="radio" name="convention" value={opt.value} checked={active} onChange={() => set('conventionNommage')(opt.value)} style={{ accentColor: 'var(--green)' }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--green2)' : 'var(--text)' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</div>
                </div>
              </label>
            )
          })}
        </div>

        {/* Aperçu temps réel */}
        {form.niveaux1erCycle.length > 0 && (
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>{t('phase1.step3.firstCycle.previewLabel')}</div>
            <ClassPreview
              levels={form.niveaux1erCycle.map((l) => ({ level: l, count: form.classesParNiveau[l] ?? 2 }))}
              convention={form.conventionNommage}
              emptyLabel={t('common.emptyClasses')}
            />
          </div>
        )}
      </Field>

      {/* Q8 — LV2 début (si 4e ou 3e présent) */}
      {(form.niveaux1erCycle.includes('4e') || form.niveaux1erCycle.includes('3e')) && (
        <Field label={t('phase1.step3.lv2.q8')}>
          <div style={{ display: 'flex', gap: 8 }}>
            {['4e', '3e', 'NON_APPLICABLE'].map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => set('lv2Debut')(opt)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  border: `2px solid ${form.lv2Debut === opt ? 'var(--primary)' : 'var(--border2)'}`,
                  borderRadius: 10,
                  background: form.lv2Debut === opt ? 'rgba(180,83,42,0.07)' : 'white',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  color: form.lv2Debut === opt ? 'var(--green2)' : 'var(--text2)',
                }}
              >
                {opt === 'NON_APPLICABLE' ? t('phase1.step3.lv2.nonApplicable') : `${t('phase1.step3.lv2.fromLevel')} ${opt}`}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* Q9 — LV2 disponibles */}
      {form.lv2Debut !== 'NON_APPLICABLE' && form.lv2Debut !== '' && (
        <Field label={t('phase1.step3.lv2.q9')}>
          <CheckboxGroup
            options={LV2_OPTIONS.map((v) => ({ value: v, label: t('phase1.lv2Languages.' + v) }))}
            values={form.lv2Disponibles}
            onChange={(v) => setForm((f) => ({ ...f, lv2Disponibles: v }))}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{t('phase1.step3.lv2.other')}</span>
            <input
              className="edu-field"
              value={customLv2}
              style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 180 }}
              onChange={(e) => setCustomLv2(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customLv2.trim() && !form.lv2Disponibles.includes(customLv2.trim())) {
                  setForm((f) => ({ ...f, lv2Disponibles: [...f.lv2Disponibles, customLv2.trim()] }))
                  setCustomLv2('')
                }
              }}
              placeholder={t('phase1.step3.lv2.placeholder')}
            />
            <button
              type="button"
              onClick={() => {
                if (customLv2.trim() && !form.lv2Disponibles.includes(customLv2.trim())) {
                  setForm((f) => ({ ...f, lv2Disponibles: [...f.lv2Disponibles, customLv2.trim()] }))
                  setCustomLv2('')
                }
              }}
              style={{ padding: '7px 12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {t('phase1.step3.lv2.add')}
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontWeight: 600, lineHeight: 1.5 }}>{t('phase1.step3.lv2.hint')}</div>
        </Field>
      )}
    </div>
  )
}
