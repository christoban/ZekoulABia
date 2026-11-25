'use client'

import { Mail } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { handleInputBlur, handleInputFocus, type SuccessInfo } from '../_helpers/loginConfig'

interface Props {
  success: SuccessInfo | null
  progress: boolean
  forgotOpen: boolean
  forgotEmail: string
  onChangeForgotEmail: (val: string) => void
  forgotLoading: boolean
  forgotDone: boolean
  forgotError: string
  onCloseForgot: () => void
  onSubmitForgot: () => void
}

export default function LoginModals({
  success,
  progress,
  forgotOpen,
  forgotEmail,
  onChangeForgotEmail,
  forgotLoading,
  forgotDone,
  forgotError,
  onCloseForgot,
  onSubmitForgot,
}: Props) {
  const t = useT('common')

  return (
    <>
      {/* ══ MODAL SUCCÈS (vert strictement réservé au statut positif) ══ */}
      {success && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              textAlign: 'center',
              maxWidth: 320,
              width: '88%',
              padding: '24px 20px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
              animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >
            <span style={{ color: success.color, marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              <success.icon size={36} strokeWidth={2} />
            </span>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {t('login.success_greeting', { name: success.firstName })}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4, marginBottom: 8 }}>
              {t('messages.welcome')}
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 800,
                margin: '8px 0 14px',
                background: success.bg,
                color: success.color,
              }}
            >
              <success.icon size={14} strokeWidth={2} /> {success.badge}
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden', height: 4, marginBottom: 12 }}>
              <div
                style={{
                  height: '100%',
                  background: 'var(--success)',
                  width: progress ? '100%' : '0%',
                  transition: 'width 2s linear',
                  borderRadius: 6,
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 12 }}>
              {t('login.success_redirecting')}
            </div>
            <button
              onClick={() => window.location.assign(success.dest)}
              style={{
                width: '100%',
                minHeight: 44,
                padding: 10,
                background: 'var(--success)',
                color: 'white',
                fontSize: 13,
                fontWeight: 800,
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('login.success_goto')}
            </button>
          </div>
        </div>
      )}

      {/* ══ MODAL MOT DE PASSE OUBLIÉ ══ */}
      {forgotOpen && (
        <div
          onClick={() => !forgotLoading && onCloseForgot()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: 24,
              width: 400,
              maxWidth: '100%',
              boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
              animation: 'popIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >
            {forgotDone ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--success)', marginBottom: 12 }}>
                  <Mail size={38} strokeWidth={2} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{t('login.forgot_success_title')}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 18 }}>
                  {t('login.forgot_success_msg')}
                </div>
                <button
                  onClick={onCloseForgot}
                  style={{
                    width: '100%',
                    minHeight: 44,
                    padding: '10px 22px',
                    borderRadius: 10,
                    background: 'var(--primary)',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 800,
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--primary)')}
                >
                  {t('login.forgot_back')}
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {t('login.forgot_title')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 18, lineHeight: 1.45 }}>
                  {t('login.forgot_subtitle')}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    {t('login.forgot_email_label')}
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => onChangeForgotEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSubmitForgot()
                    }}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder={t('login.forgot_email_placeholder')}
                    autoFocus
                    style={{
                      width: '100%',
                      minHeight: 48,
                      padding: '12px 14px',
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border)',
                      borderRadius: 10,
                      color: 'var(--text)',
                      fontSize: 16,
                      fontFamily: 'inherit',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {forgotError && (
                  <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                    {forgotError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={onCloseForgot}
                    disabled={forgotLoading}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: '10px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 700,
                      background: 'var(--surface)',
                      color: 'var(--text2)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t('login.forgot_cancel')}
                  </button>
                  <button
                    onClick={onSubmitForgot}
                    disabled={forgotLoading}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: '10px',
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 800,
                      background: forgotLoading ? 'var(--text3)' : 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      cursor: forgotLoading ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => !forgotLoading && (e.currentTarget.style.background = 'var(--primary-hover)')}
                    onMouseLeave={(e) => !forgotLoading && (e.currentTarget.style.background = 'var(--primary)')}
                  >
                    {forgotLoading ? t('login.forgot_sending') : t('login.forgot_send')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
