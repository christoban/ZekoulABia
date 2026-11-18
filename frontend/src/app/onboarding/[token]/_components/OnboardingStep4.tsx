'use client'

import { useT } from '@/lib/i18n'
import { templateDisplayName } from '@/lib/onboarding/templateSelection'
import {
  hasMaternelleData,
  hasPrimaireData,
  hasPremierCycleData,
  hasDeuxiemeCycleData,
  hasTechniqueData,
} from '@/lib/onboarding/templateGates'
import type { WizardState } from './OnboardingStep3'
import { Alert, SubmitBtn } from './OnboardingPrimitives'

export default function OnboardingStep4({ w }: { w: WizardState }) {
  const t = useT('onboarding')
  const { form, template, currentLang, subsystemOptions, ownershipOptions, conventionOptions } = w

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <button
        type="button"
        onClick={() => {
          w.setStep(3)
          w.setSubmitError('')
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}
      >
        {t('phase1.step4.back')}
      </button>

      {/* Établissement summary */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{t('phase1.step4.establishmentSection')}</div>
        {form.logoBase64 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 0', borderBottom: '1px solid var(--bg2)' }}>
            <img src={form.logoBase64} alt="Logo" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1.5px solid var(--border)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{t('phase1.step1.logo.uploaded')}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
          {[
            { labelKey: 'phase1.step4.fields.name', val: form.nom },
            { labelKey: 'phase1.step4.fields.subdomain', val: `zekoulabia.cm/${form.subdomain}` },
            { labelKey: 'phase1.step4.fields.template', val: template ? templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr') : '—' },
            { labelKey: 'phase1.step4.fields.subsystem', val: subsystemOptions.find((o) => o.value === form.subsystem)?.label ?? form.subsystem },
            { labelKey: 'phase1.step4.fields.education', val: form.educationType ? t(`phase1.step1.educationType.options.${form.educationType}.label`) : '—' },
            { labelKey: 'phase1.step4.fields.ownership', val: ownershipOptions.find((o) => o.value === form.ownership)?.label ?? form.ownership },
            { labelKey: 'phase1.step4.fields.city', val: form.ville || '—' },
            { labelKey: 'phase1.step4.fields.region', val: form.region || '—' },
          ].map(({ labelKey, val }) => (
            <div key={labelKey}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t(labelKey)}</div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, wordBreak: 'break-all' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin summary */}
      <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{t('phase1.step4.adminSection')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
          {[
            { labelKey: 'phase1.step4.fields.firstName', val: form.adminPrenom },
            { labelKey: 'phase1.step4.fields.lastName', val: form.adminNom },
            { labelKey: 'phase1.step4.fields.email', val: form.adminEmail },
            { labelKey: 'phase1.step4.fields.password', val: t('phase1.step4.fields.passwordMasked') },
          ].map(({ labelKey, val }) => (
            <div key={labelKey}>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t(labelKey)}</div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, wordBreak: 'break-all' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Structure summary */}
      {template && (
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            {t('phase1.step4.configSection')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.template')}</div>
              <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr')}</div>
            </div>
            {hasMaternelleData({ maternelleSections: w.maternelleSections, nurseryLevels: w.nurseryLevels }) && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.maternelle')}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{[...w.maternelleSections, ...w.nurseryLevels].join(' · ')}</div>
              </div>
            )}
            {hasPrimaireData(form) && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.primary')}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                  {form.niveauxPrimaire.join(' · ')} ({Object.values(form.classesParNiveauPrimaire).reduce((total, count) => total + count, 0)} {t('phase1.step3.preview.totalClasses')})
                </div>
              </div>
            )}
            {hasPremierCycleData(form) && (
              <>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.firstCycle')}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                    {form.niveaux1erCycle.join(' · ')} ({Object.values(form.classesParNiveau).reduce((a, b) => a + b, 0) || 0} {t('phase1.step3.preview.totalClasses')})
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.convention')}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                    {conventionOptions.find((o) => o.value === form.conventionNommage)?.label ?? form.conventionNommage}
                  </div>
                </div>
                {form.lv2Debut !== 'NON_APPLICABLE' && form.lv2Disponibles.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.lv2')}</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                      {form.lv2Disponibles.join(' · ')} ({t('phase1.step4.fields.fromLevel')} {form.lv2Debut})
                    </div>
                  </div>
                )}
              </>
            )}
            {hasDeuxiemeCycleData(form) && (
              <>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.secondCycle')}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{form.niveaux2eCycle.join(' · ')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.filieres')}</div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{form.filieres.length > 0 ? form.filieres.join(' · ') : '—'}</div>
                </div>
                {form.a4Languages.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.a4Languages')}</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{form.a4Languages.join(' · ')}</div>
                  </div>
                )}
              </>
            )}
            {hasTechniqueData({ filieresTechniques: form.filieresTechniques, sarMetiers: w.sarMetiers, cfmFilieres: w.cfmFilieres }) && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.techFilieres')}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{[...form.filieresTechniques, ...w.sarMetiers, ...w.cfmFilieres].join(' · ')}</div>
              </div>
            )}
            {(w.enStreamStartLevel || w.enGradingSystem || w.bilingualEnLevels.length > 0 || w.bilingualEnFilieres.length > 0) && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.streamsEn')}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                  {[w.enStreamStartLevel, w.enGradingSystem, ...w.bilingualEnLevels, ...w.bilingualEnFilieres].filter((value) => value.length > 0).join(' · ')}
                </div>
              </div>
            )}
            {(w.hasPEBSFrancophone || w.hasPEBSAnglophone) && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>
                  {t('phase1.step4.fields.pebsFr')} / {t('phase1.step4.fields.pebsEn')}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                  {[w.hasPEBSFrancophone ? t('phase1.step4.fields.pebsFr') : '', w.hasPEBSAnglophone ? t('phase1.step4.fields.pebsEn') : ''].filter((value) => value.length > 0).join(' · ')}
                </div>
              </div>
            )}
            {w.previewData && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.totalClasses')}</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{w.previewData.totalClasses}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <Alert msg={t('phase1.step4.info')} type="info" />

      {w.submitError && (
        <div ref={w.errorRef}>
          <Alert msg={w.submitError} type="error" />
        </div>
      )}

      <SubmitBtn loading={w.submitLoading} onClick={w.handleSubmit} loadingText={t('phase1.loading.processing')}>
        {t('phase1.buttons.step4Submit')}
      </SubmitBtn>
    </div>
  )
}
