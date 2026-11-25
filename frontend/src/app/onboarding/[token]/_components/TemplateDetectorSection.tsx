'use client'

import { useT } from '@/lib/i18n'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { templateDisplayName } from '@/lib/onboarding/templateSelection'
import type { FormData } from '../_helpers/types'
import { Field } from './OnboardingPrimitives'

interface Props {
  form: FormData
  template: TemplateCatalogEntry | null
  templateCatalog: TemplateCatalogEntry[]
  filteredTemplates: TemplateCatalogEntry[]
  selectedTemplateCode: string | null
  setSelectedTemplateCode: (code: string | null) => void
  effectiveCode: string | null
  suggestedCode: string | null
  currentLang: string
}

export default function TemplateDetectorSection({
  form,
  template,
  templateCatalog,
  filteredTemplates,
  selectedTemplateCode,
  setSelectedTemplateCode,
  effectiveCode,
  suggestedCode,
  currentLang,
}: Props) {
  const t = useT('onboarding')

  return (
    <>
      {/* Template détecté */}
      {template && (
        <div style={{ padding: '12px 14px', background: 'rgba(5,150,105,0.06)', border: '1.5px solid rgba(142,42,58,0.2)', borderRadius: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step1.templateDetected.title')}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green2)' }}>{templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr')}</div>

          {form.subsystem === 'FRANCOPHONE' && form.educationType === 'GENERAL' && form.ownership === 'PUBLIC' && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(5,150,105,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{t('phase1.step1.templateDetected.cesOrLycee')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { code: 'LYCEE_FR', label: t('phase1.step1.templateDetected.lycee'), desc: t('phase1.step1.templateDetected.lyceeDesc') },
                  { code: 'CES_FR', label: t('phase1.step1.templateDetected.ces'), desc: t('phase1.step1.templateDetected.cesDesc') },
                ].map((opt) => {
                  const active = (selectedTemplateCode ?? template?.code) === opt.code
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setSelectedTemplateCode(opt.code)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        border: `2px solid ${active ? 'var(--primary)' : 'var(--border2)'}`,
                        borderRadius: 10,
                        background: active ? 'rgba(180,83,42,0.07)' : 'white',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        fontWeight: 700,
                        color: active ? 'var(--green2)' : 'var(--text2)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span>{opt.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {form.subsystem === 'ANGLOPHONE' && form.educationType === 'GENERAL' && form.ownership === 'PUBLIC' && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(5,150,105,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{t('phase1.step1.templateDetected.ghsOrGss')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { code: 'GHS_EN', label: t('phase1.step1.templateDetected.ghs'), desc: t('phase1.step1.templateDetected.ghsDesc') },
                  { code: 'GSS_EN', label: t('phase1.step1.templateDetected.gss'), desc: t('phase1.step1.templateDetected.gssDesc') },
                ].map((opt) => {
                  const active = (selectedTemplateCode ?? template?.code) === opt.code
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setSelectedTemplateCode(opt.code)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        border: `2px solid ${active ? 'var(--primary)' : 'var(--border2)'}`,
                        borderRadius: 10,
                        background: active ? 'rgba(180,83,42,0.07)' : 'white',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        fontWeight: 700,
                        color: active ? 'var(--green2)' : 'var(--text2)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span>{opt.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Catalogue template — sélection explicite (source backend) */}
      {templateCatalog.length > 0 && (
        <Field label={t('phase1.step1.modelSelect.label')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {filteredTemplates.map((tmpl) => {
              const active = effectiveCode === tmpl.code
              return (
                <button
                  key={tmpl.code}
                  type="button"
                  onClick={() => setSelectedTemplateCode(tmpl.code)}
                  style={{
                    padding: '8px 10px',
                    border: `2px solid ${active ? 'var(--primary)' : 'var(--border2)'}`,
                    borderRadius: 10,
                    background: active ? 'rgba(180,83,42,0.07)' : 'white',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 700,
                    color: active ? 'var(--green2)' : 'var(--text2)',
                    textAlign: 'left',
                  }}
                >
                  <div>{templateDisplayName(tmpl, currentLang === 'en' ? 'en' : 'fr')}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>
                    {tmpl.code} · {tmpl.subsystem} · {tmpl.educationType}
                  </div>
                </button>
              )
            })}
          </div>
          {filteredTemplates.length === 0 && <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', marginTop: 6 }}>{t('phase1.step1.modelSelect.empty')}</div>}
          {selectedTemplateCode === null && suggestedCode && templateCatalog.some((entry) => entry.code === suggestedCode) && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>
              {t('phase1.step1.modelSelect.suggestion')} : <strong>{templateDisplayName(templateCatalog.find((entry) => entry.code === suggestedCode)!, currentLang === 'en' ? 'en' : 'fr')}</strong>
              <button
                type="button"
                onClick={() => setSelectedTemplateCode(suggestedCode)}
                style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--primary)', background: 'var(--primary)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
              >
                {t('phase1.step1.modelSelect.useSuggestion')}
              </button>
            </div>
          )}
        </Field>
      )}
    </>
  )
}
