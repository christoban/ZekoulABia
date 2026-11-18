'use client'

import { useT } from '@/lib/i18n'
import { templateDisplayName } from '@/lib/onboarding/templateSelection'
import type { useOnboardingWizard } from '../_helpers/useOnboardingWizard'
import { Alert, SubmitBtn } from './OnboardingPrimitives'
import Step3FirstCycle from './Step3FirstCycle'
import Step3SecondCycle from './Step3SecondCycle'
import Step3Technical from './Step3Technical'
import Step3Primary from './Step3Primary'
import Step3Preview from './Step3Preview'

export type WizardState = ReturnType<typeof useOnboardingWizard>

export default function OnboardingStep3({ w }: { w: WizardState }) {
  const t = useT('onboarding')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <button
        type="button"
        onClick={() => {
          w.setStep(2)
          w.setStepError('')
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}
      >
        {t('phase1.step3.back')}
      </button>

      {/* Q4 — Template détecté */}
      {w.template && !w.template.isComplexe && (
        <div style={{ padding: '14px 16px', background: 'rgba(5,150,105,0.06)', border: '1.5px solid rgba(142,42,58,0.2)', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.templateDetected.title')}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green2)' }}>{templateDisplayName(w.template, w.currentLang === 'en' ? 'en' : 'fr')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t('phase1.step3.templateDetected.hint')}</div>
        </div>
      )}

      {w.template?.isComplexe && (
        <div style={{ padding: '16px 18px', background: 'var(--amber-light)', border: '1.5px solid rgba(217,119,6,0.25)', borderRadius: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--amber)', marginBottom: 6 }}>{t('phase1.step3.complexe.title')}</div>
          <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600, lineHeight: 1.6 }}>{t('phase1.step3.complexe.msgAvailable')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8, fontWeight: 600 }}>{t('phase1.step3.complexe.hintAvailable')}</div>
        </div>
      )}

      {!w.template && <Alert msg={t('phase1.step3.noTemplate')} type="error" />}

      {w.template && (
        <>
          <Step3FirstCycle
            template={w.template}
            form={w.form}
            setForm={w.setForm}
            set={w.set}
            setNiveauCount={w.setNiveauCount}
            conventionOptions={w.conventionOptions}
            customLv2={w.customLv2}
            setCustomLv2={w.setCustomLv2}
          />

          <Step3SecondCycle
            template={w.template}
            form={w.form}
            setForm={w.setForm}
            set={w.set}
            customFiliere={w.customFiliere}
            setCustomFiliere={w.setCustomFiliere}
            customA4={w.customA4}
            setCustomA4={w.setCustomA4}
            enStreamStartLevel={w.enStreamStartLevel}
            setEnStreamStartLevel={w.setEnStreamStartLevel}
            enGradingSystem={w.enGradingSystem}
            setEnGradingSystem={w.setEnGradingSystem}
            hasPEBSFrancophone={w.hasPEBSFrancophone}
            setHasPEBSFrancophone={w.setHasPEBSFrancophone}
            hasPEBSAnglophone={w.hasPEBSAnglophone}
            setHasPEBSAnglophone={w.setHasPEBSAnglophone}
            bilingualEnLevels={w.bilingualEnLevels}
            setBilingualEnLevels={w.setBilingualEnLevels}
            bilingualEnFilieres={w.bilingualEnFilieres}
            setBilingualEnFilieres={w.setBilingualEnFilieres}
          />

          <Step3Technical
            template={w.template}
            offers={w.offers}
            form={w.form}
            setForm={w.setForm}
            sousTypeTechnique={w.sousTypeTechnique}
            setSousTypeTechnique={w.setSousTypeTechnique}
            cetifMode={w.cetifMode}
            setCetifMode={w.setCetifMode}
            sarMetiers={w.sarMetiers}
            setSarMetiers={w.setSarMetiers}
            customSarMetier={w.customSarMetier}
            setCustomSarMetier={w.setCustomSarMetier}
            cfmFilieres={w.cfmFilieres}
            setCfmFilieres={w.setCfmFilieres}
            customCfmFiliere={w.customCfmFiliere}
            setCustomCfmFiliere={w.setCustomCfmFiliere}
            customTech={w.customTech}
            setCustomTech={w.setCustomTech}
          />

          <Step3Primary
            template={w.template}
            form={w.form}
            setForm={w.setForm}
            setNiveauPrimaireCount={w.setNiveauPrimaireCount}
            maternelleSections={w.maternelleSections}
            setMaternelleSections={w.setMaternelleSections}
            nurseryLevels={w.nurseryLevels}
            setNurseryLevels={w.setNurseryLevels}
            evalSystemPrimaire={w.evalSystemPrimaire}
            setEvalSystemPrimaire={w.setEvalSystemPrimaire}
            appelFrequency={w.appelFrequency}
            setAppelFrequency={w.setAppelFrequency}
            bilingualEnLevels={w.bilingualEnLevels}
            setBilingualEnLevels={w.setBilingualEnLevels}
            bulletinFrequency={w.bulletinFrequency}
            setBulletinFrequency={w.setBulletinFrequency}
          />

          <Step3Preview
            template={w.template}
            currentLang={w.currentLang}
            previewLoading={w.previewLoading}
            previewData={w.previewData}
          />
        </>
      )}

      <SubmitBtn onClick={w.goNext} disabled={!w.template} loadingText={t('phase1.loading.processing')}>
        {t('phase1.step3.button')}
      </SubmitBtn>
    </div>
  )
}
