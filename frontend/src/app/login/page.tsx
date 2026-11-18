'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2, User } from 'lucide-react'
import LanguageSwitch from '@/components/LanguageSwitch'
import ThemeToggle from '@/components/ThemeToggle'
import { getDashboardLanguageKey, isLanguage, useT } from '@/lib/i18n'
import { resetNotificationSocket } from '@/lib/notificationSocket'
import { ROLE_CONFIG, type LoginData, type LoginStep, type SuccessInfo } from './_helpers/loginConfig'
import { useSessionCheck } from './_helpers/useSessionCheck'
import { useOtpMfaFlow } from './_helpers/useOtpMfaFlow'
import { useCredentialsAuth } from './_helpers/useLoginController'
import UnlockSessionForm from './_components/UnlockSessionForm'
import SuspendedSchoolCard from './_components/SuspendedSchoolCard'
import CredentialsStep from './_components/CredentialsStep'
import AccountChoiceStep from './_components/AccountChoiceStep'
import OtpVerificationStep from './_components/OtpVerificationStep'
import TotpStep from './_components/TotpStep'
import MfaSetupStep from './_components/MfaSetupStep'
import LoginModals from './_components/LoginModals'

export default function LoginPage() {
  const t = useT('common')
  const [step, setStep] = useState<LoginStep>('credentials')
  const [success, setSuccess] = useState<SuccessInfo | null>(null)
  const [progress, setProgress] = useState(false)

  useEffect(() => {
    if (success) {
      const tm = setTimeout(() => setProgress(true), 100)
      const r = setTimeout(() => window.location.assign(success.dest), 2200)
      return () => {
        clearTimeout(tm)
        clearTimeout(r)
      }
    }
  }, [success])

  const completeLogin = useCallback((data: LoginData) => {
    const { role, nomComplet, userId, permissions, mustChangePassword, redirectTo } = data
    const config = ROLE_CONFIG[role] ?? { icon: User, badge: role, color: 'var(--text-muted)', bg: 'var(--bg2)', dest: '/' }
    const dest = mustChangePassword ? '/change-password' : redirectTo ?? config.dest
    const firstName = nomComplet?.split(' ')[0] ?? 'Bienvenue'

    resetNotificationSocket()

    localStorage.setItem(
      'zekoulabia_user',
      JSON.stringify({
        userId,
        role,
        nomComplet,
        firstName,
        permissions: permissions ?? [],
        mustChangePassword: mustChangePassword ?? false,
        lastActiveAt: Date.now(),
      })
    )
    const selectedLanguage = localStorage.getItem('zekoulabia_lang_override')
    const dashboardLanguageKey = getDashboardLanguageKey(userId)
    if (!localStorage.getItem(dashboardLanguageKey) && isLanguage(selectedLanguage)) {
      localStorage.setItem(dashboardLanguageKey, selectedLanguage)
    }

    setSuccess({ ...config, dest, firstName })
  }, [])

  const session = useSessionCheck(() => setStep('credentials'))
  const otpMfa = useOtpMfaFlow({ onSuccessLogin: completeLogin, onGoToStep: setStep })
  const auth = useCredentialsAuth({
    checkingSession: session.checkingSession,
    onSuccessLogin: completeLogin,
    onOtpRequired: otpMfa.beginOtpStep,
    onGoToStep: setStep,
  })

  if (session.checkingSession) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          fontFamily: 'var(--font-nunito), Nunito, sans-serif',
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 12,
            background: 'linear-gradient(135deg,var(--primary),var(--accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(180,83,42,0.25)',
            marginBottom: 18,
          }}
        >
          <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
        </div>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: 12 }} />
        <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
          Vérification de la session...
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        position: 'relative',
        overflowX: 'hidden',
        paddingTop: 80,
        paddingBottom: 40,
        fontFamily: 'var(--font-nunito), Nunito, sans-serif',
      }}
    >
      {/* Motif géométrique discret */}
      <div className="login-bg" />

      {/* Bande multicolore camerounaise */}
      <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />

      {/* En-tête commun */}
      <header
        style={{
          position: 'absolute',
          top: 5,
          left: 0,
          right: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg,var(--primary),var(--accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(180,83,42,0.22)',
              overflow: 'hidden',
            }}
          >
            <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              ZekoulABia
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('login.tagline')}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
          <LanguageSwitch compact />
        </div>
      </header>

      {/* Carte de formulaire principale */}
      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 440,
          width: 'calc(100% - 32px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '32px 28px',
          boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)',
        }}
      >
        {session.inactiveUser ? (
          <UnlockSessionForm
            inactiveUser={session.inactiveUser}
            unlockPassword={session.unlockPassword}
            onChangePassword={(val) => {
              session.setUnlockPassword(val)
              session.setUnlockAlert(null)
            }}
            showUnlockPwd={session.showUnlockPwd}
            onToggleShowPwd={() => session.setShowUnlockPwd((s) => !s)}
            unlockLoading={session.unlockLoading}
            unlockAlert={session.unlockAlert}
            onSubmit={session.handleUnlockSession}
            onCancel={session.cancelUnlockSession}
          />
        ) : auth.suspended ? (
          <SuspendedSchoolCard
            schoolName={auth.suspended.schoolName}
            onBack={() => auth.setSuspended(null)}
          />
        ) : step === 'credentials' ? (
          <CredentialsStep
            emailRef={auth.emailRef}
            email={auth.email}
            onChangeEmail={(val) => {
              auth.setEmail(val)
              auth.setAlert(null)
            }}
            password={auth.password}
            onChangePassword={(val) => {
              auth.setPassword(val)
              auth.setAlert(null)
            }}
            showPwd={auth.showPwd}
            onToggleShowPwd={() => auth.setShowPwd((s) => !s)}
            loading={auth.loading}
            alert={auth.alert}
            modeTestBandeau={session.modeTestBandeau}
            onSubmit={auth.submitCredentials}
            onOpenForgot={auth.openForgotModal}
          />
        ) : step === 'choose_account' ? (
          <AccountChoiceStep
            accountChoices={auth.accountChoices}
            loading={auth.loading}
            onBack={() => {
              setStep('credentials')
              auth.resetAccountChoices()
            }}
            onSelectAccount={auth.submitAccountChoice}
          />
        ) : step === 'email_otp' ? (
          <OtpVerificationStep
            otp={otpMfa.otp}
            otpChannel={otpMfa.otpChannel}
            email={auth.email}
            emailMasked={otpMfa.emailMasked}
            phoneMasked={otpMfa.phoneMasked}
            hasPhone={otpMfa.hasPhone}
            switchingChannel={otpMfa.switchingChannel}
            otpTimerSecs={otpMfa.otpTimerSecs}
            otpResendEnabled={otpMfa.otpResendEnabled}
            otpLoading={otpMfa.otpLoading}
            otpAlert={otpMfa.otpAlert}
            otpRefs={otpMfa.otpRefs}
            onBack={() => {
              setStep('credentials')
              otpMfa.clearOtpTimer()
            }}
            onOtpInput={otpMfa.handleOtpInput}
            onOtpKey={otpMfa.handleOtpKey}
            onResend={otpMfa.resendOtp}
            onSubmit={() => otpMfa.submitOtp()}
            onSwitchToSms={otpMfa.switchToSms}
            onSwitchToEmail={otpMfa.switchToEmail}
          />
        ) : step === 'totp' ? (
          <TotpStep
            totpCode={otpMfa.totpCode}
            onChangeTotpCode={(val) => {
              otpMfa.setTotpCode(val)
              otpMfa.setTotpAlert(null)
            }}
            isRecovery={otpMfa.isRecovery}
            onToggleRecovery={() => {
              otpMfa.setIsRecovery((r) => !r)
              otpMfa.setTotpAlert(null)
            }}
            recoveryCode={otpMfa.recoveryCode}
            onChangeRecoveryCode={(val) => {
              otpMfa.setRecoveryCode(val)
              otpMfa.setTotpAlert(null)
            }}
            totpLoading={otpMfa.totpLoading}
            totpAlert={otpMfa.totpAlert}
            onBack={() => setStep('email_otp')}
            onSubmit={otpMfa.submitTotp}
          />
        ) : (
          <MfaSetupStep
            qrDataUri={otpMfa.qrDataUri}
            manualKey={otpMfa.manualKey}
            setupTotpCode={otpMfa.setupTotpCode}
            onChangeSetupTotpCode={(val) => {
              otpMfa.setSetupTotpCode(val)
              otpMfa.setSetupAlert(null)
            }}
            setupLoading={otpMfa.setupLoading}
            setupAlert={otpMfa.setupAlert}
            recoveryCodes={otpMfa.recoveryCodes}
            recoveryAck={otpMfa.recoveryAck}
            onChangeRecoveryAck={otpMfa.setRecoveryAck}
            pendingLoginData={otpMfa.pendingLoginData}
            onSubmitSetup={otpMfa.submitMfaSetup}
            onCompleteLogin={completeLogin}
          />
        )}
      </motion.main>

      {/* Footer Copyright */}
      <footer style={{ position: 'relative', zIndex: 1, marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
        {t('login.copyright', { year: String(new Date().getFullYear()) })}
      </footer>

      <LoginModals
        success={success}
        progress={progress}
        forgotOpen={auth.forgotOpen}
        forgotEmail={auth.forgotEmail}
        onChangeForgotEmail={auth.setForgotEmail}
        forgotLoading={auth.forgotLoading}
        forgotDone={auth.forgotDone}
        forgotError={auth.forgotError}
        onCloseForgot={() => auth.setForgotOpen(false)}
        onSubmitForgot={auth.handleForgotSubmit}
      />
    </div>
  )
}
