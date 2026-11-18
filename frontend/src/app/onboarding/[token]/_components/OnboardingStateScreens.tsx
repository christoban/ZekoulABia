'use client'

import { CheckCircle2, Lock, AlarmClock, PartyPopper } from 'lucide-react'
import { useT } from '@/lib/i18n'

export function OnboardingLoadingScreen() {
  const t = useT('onboarding')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '60px 0', animation: 'edu-fadeUp 0.4s ease both' }}>
      <div style={{ width: 52, height: 52, border: '4px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite' }} />
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text2)' }}>{t('phase1.loading.verifyingInvite')}</div>
    </div>
  )
}

export function OnboardingInvalidScreen({ loadState, errorMsg }: { loadState: 'invalid' | 'expired' | 'used'; errorMsg: string }) {
  const t = useT('onboarding')
  const info = {
    invalid: { icon: Lock, title: t('phase1.invite.invalid.title'), color: 'var(--red)', bg: 'var(--red-light)', border: 'rgba(220,38,38,0.2)' },
    expired: { icon: AlarmClock, title: t('phase1.invite.expired.title'), color: 'var(--amber)', bg: 'var(--amber-light)', border: 'rgba(217,119,6,0.2)' },
    used: { icon: CheckCircle2, title: t('phase1.invite.used.title'), color: 'var(--green)', bg: 'var(--green-light)', border: 'rgba(142,42,58,0.2)' },
  }[loadState]
  const InfoIcon = info.icon

  return (
    <div style={{ animation: 'edu-fadeUp 0.4s ease both', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', color: info.color, marginBottom: 20 }}>
        <InfoIcon size={64} strokeWidth={2} />
      </div>
      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{info.title}</div>
      <div style={{ padding: '16px 20px', background: info.bg, border: `1.5px solid ${info.border}`, borderRadius: 12, marginBottom: 24, fontSize: 15, fontWeight: 600, color: info.color, lineHeight: 1.6 }}>
        {errorMsg}
      </div>
      <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7 }}>
        {t('phase1.invite.helpText')} <strong>{t('phase1.invite.helpEmail')}</strong>
      </p>
    </div>
  )
}

export function OnboardingDoneScreen({
  schoolName,
  adminEmail,
  createdStats,
}: {
  schoolName: string
  adminEmail: string
  createdStats: { classCount?: number; subjectCount?: number; academicYear?: string } | null
}) {
  const t = useT('onboarding')

  return (
    <div style={{ animation: 'edu-fadeUp 0.4s ease both', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 16 }}>
        <PartyPopper size={72} strokeWidth={2} />
      </div>
      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 30, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
        {t('phase1.done.title')}
      </div>
      <div style={{ padding: '16px 20px', background: 'var(--green-light)', border: '1.5px solid rgba(142,42,58,0.2)', borderRadius: 12, marginBottom: 20, fontSize: 15, fontWeight: 600, color: 'var(--green)', lineHeight: 1.8, display: 'flex', alignItems: 'flex-start', gap: 6, textAlign: 'left' }}>
        <CheckCircle2 size={17} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          <strong>{schoolName}</strong> {t('phase1.done.pendingMsg')}
          <br />
          {t('phase1.done.emailNotice')} <strong>{adminEmail}</strong> {t('phase1.done.emailDelay')}
        </span>
      </div>

      {createdStats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          {createdStats.academicYear && (
            <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--card-bg, #f3f4f6)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              📅 {t('phase1.done.statsYear')} : <strong>{createdStats.academicYear}</strong>
            </div>
          )}
          {typeof createdStats.classCount === 'number' && (
            <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--card-bg, #f3f4f6)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              🏫 <strong>{createdStats.classCount}</strong> {t('phase1.done.statsClasses')}
            </div>
          )}
          {typeof createdStats.subjectCount === 'number' && (
            <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--card-bg, #f3f4f6)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              📚 <strong>{createdStats.subjectCount}</strong> {t('phase1.done.statsSubjects')}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 28 }}>{t('phase1.done.loginHint')}</p>

      <div>
        <a
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px 32px',
            background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
            color: 'white',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 16,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(142,42,58,0.25)',
          }}
        >
          {t('phase1.done.loginCta')} →
        </a>
      </div>
    </div>
  )
}
