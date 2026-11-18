'use client'

import { useT } from '@/lib/i18n'
import { STEPPER_LABELS } from './_helpers/constants'
import { useOnboardingWizard } from './_helpers/useOnboardingWizard'
import { Alert } from './_components/OnboardingPrimitives'
import { OnboardingDoneScreen, OnboardingInvalidScreen, OnboardingLoadingScreen } from './_components/OnboardingStateScreens'
import OnboardingStep1 from './_components/OnboardingStep1'
import OnboardingStep2 from './_components/OnboardingStep2'
import OnboardingStep3 from './_components/OnboardingStep3'
import OnboardingStep4 from './_components/OnboardingStep4'

export default function OnboardingPage() {
  const t = useT('onboarding')
  const w = useOnboardingWizard()

  const Stepper = (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
          {t('phase1.stepper.step')} {w.step} / {STEPPER_LABELS.length}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>
          {t(STEPPER_LABELS.find((s) => s.n === w.step)?.key ?? '')}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(w.step / STEPPER_LABELS.length) * 100}%`, background: 'linear-gradient(90deg,var(--primary),var(--primary-hover))', borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )

  let content: React.ReactNode
  if (w.loadState === 'loading') {
    content = <OnboardingLoadingScreen />
  } else if (w.loadState === 'invalid' || w.loadState === 'expired' || w.loadState === 'used') {
    content = <OnboardingInvalidScreen loadState={w.loadState} errorMsg={w.errorMsg} />
  } else if (w.done) {
    content = <OnboardingDoneScreen schoolName={w.form.nom} adminEmail={w.form.adminEmail} createdStats={w.createdStats} />
  } else {
    content = (
      <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {w.step === 1 ? t('phase1.step1.title') : w.step === 2 ? t('phase1.step2.title') : w.step === 3 ? t('phase1.step3.title') : t('phase1.step4.title')}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text2)', fontWeight: 500 }}>
            {w.step === 1 ? t('phase1.step1.subtitle') : w.step === 2 ? t('phase1.step2.subtitle') : w.step === 3 ? t('phase1.step3.subtitle') : t('phase1.step4.subtitle')}
          </div>
        </div>

        {w.step <= 4 && Stepper}
        {w.stepError && <Alert msg={w.stepError} type="error" />}

        {w.step === 1 && (
          <OnboardingStep1
            form={w.form}
            set={w.set}
            setWithTemplateReset={w.setWithTemplateReset}
            slRef={w.slRef}
            logoInputRef={w.logoInputRef}
            subsystemOptions={w.subsystemOptions}
            ownershipOptions={w.ownershipOptions}
            structure={w.structure}
            setStructure={w.setStructure}
            levelFamily={w.levelFamily}
            setLevelFamily={w.setLevelFamily}
            offers={w.offers}
            setOffers={w.setOffers}
            secondarySpan={w.secondarySpan}
            setSecondarySpan={w.setSecondarySpan}
            template={w.template}
            templateCatalog={w.templateCatalog}
            filteredTemplates={w.filteredTemplates}
            selectedTemplateCode={w.selectedTemplateCode}
            setSelectedTemplateCode={w.setSelectedTemplateCode}
            effectiveCode={w.effectiveCode}
            suggestedCode={w.suggestedCode}
            currentLang={w.currentLang}
            handleLogoUpload={w.handleLogoUpload}
            onNext={w.goNext}
          />
        )}

        {w.step === 2 && (
          <OnboardingStep2
            form={w.form}
            set={w.set}
            showPwd={w.showPwd}
            setShowPwd={w.setShowPwd}
            showConfirm={w.showConfirm}
            setShowConfirm={w.setShowConfirm}
            onBack={() => {
              w.setStep(1)
              w.setStepError('')
            }}
            onNext={w.goNext}
          />
        )}

        {w.step === 3 && <OnboardingStep3 w={w} />}
        {w.step === 4 && <OnboardingStep4 w={w} />}
      </div>
    )
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .edu-step:not(:last-child)::after {
          content: '';
          position: absolute; top: 13px; left: calc(50% + 12px);
          width: calc(100% - 24px); height: 2px;
          background: var(--border2); transition: background 0.4s;
        }
        .edu-step.s-done:not(:last-child)::after,
        .edu-step.s-active:not(:last-child)::after { background: var(--primary); }
        .edu-field:focus { border-color: var(--primary) !important; background: #f0ece6 !important; box-shadow: 0 0 0 3px rgba(142,42,58,0.08); }
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        @keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes edu-fadeDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        .edu-mobile-lang { display: none; }
        @media (max-width: 768px) {
          .edu-left-panel { display: none !important; }
          .edu-mobile-lang { display: flex !important; }
        }
      `}</style>

      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', background: 'var(--bg)', position: 'relative', overflowX: 'hidden', paddingTop: 80, paddingBottom: 40, fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
        <div className="login-bg" />
        <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />

        <header style={{ position: 'absolute', top: 5, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,var(--primary),var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(180,83,42,0.22)', overflow: 'hidden' }}>
              <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
            </div>
            <div>
              <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>ZekoulABia</span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{t('phase1.leftPanel.brandTagline')}</span>
            </div>
          </div>

          <div role="group" aria-label="Language / Langue" style={{ display: 'flex', gap: 4 }}>
            {(['fr', 'en'] as const).map((l) => {
              const active = w.currentLang === l
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => {
                    if (!active) w.changeLanguage(l)
                  }}
                  aria-pressed={active}
                  style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`, cursor: active ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, background: active ? 'var(--primary)' : 'var(--surface)', color: active ? 'white' : 'var(--text2)', transition: 'all 0.15s' }}
                >
                  {l === 'fr' ? 'FR' : 'EN'}
                </button>
              )
            })}
          </div>
        </header>

        <main style={{ position: 'relative', zIndex: 1, maxWidth: 680, width: 'calc(100% - 32px)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px', boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)' }}>
          {content}
        </main>
      </div>
    </>
  )
}
