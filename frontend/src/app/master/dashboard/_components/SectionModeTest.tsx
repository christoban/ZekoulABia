'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShieldAlert, RefreshCw, Lock } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  fetchSuppressedOutboundMessages,
  type MasterUserDto,
  type PlatformSettingsDto,
  type SuppressedOutboundMessageDto,
} from '../_api'
import type { Toast } from '../_types'

interface Props {
  user: MasterUserDto | null
  onToast: (msg: string, type?: Toast['type']) => void
}

export default function SectionModeTest({ user, onToast }: Props) {
  const t = useT('admin')
  const [modeTest, setModeTest] = useState<PlatformSettingsDto | null>(null)
  const [modeTestLoading, setModeTestLoading] = useState(true)
  const [modeTestSaving, setModeTestSaving] = useState(false)
  const [confirmingDisable, setConfirmingDisable] = useState(false)
  const [messagesSupprimes, setMessagesSupprimes] = useState<SuppressedOutboundMessageDto[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  const canRead = user?.role === 'super_admin' || user?.role === 'platform_admin'
  const isSuperAdmin = user?.role === 'super_admin'

  const chargerTout = useCallback(async () => {
    if (!canRead) {
      setModeTestLoading(false)
      return
    }
    setModeTestLoading(true)
    try {
      const settings = await fetchPlatformSettings()
      setModeTest(settings)
    } catch {
      setModeTest(null)
    } finally {
      setModeTestLoading(false)
    }

    if (isSuperAdmin) {
      setMessagesLoading(true)
      try {
        const msgs = await fetchSuppressedOutboundMessages(100)
        setMessagesSupprimes(msgs)
      } catch {
        setMessagesSupprimes([])
      } finally {
        setMessagesLoading(false)
      }
    }
  }, [canRead, isSuperAdmin])

  useEffect(() => {
    if (!user) return
    void chargerTout()
  }, [user, chargerTout])

  const basculerModeTest = async (value: boolean) => {
    if (!isSuperAdmin) return
    setConfirmingDisable(false)
    setModeTestSaving(true)
    try {
      const updated = await updatePlatformSettings(value)
      setModeTest(updated)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('zekoulabia:mode-test-changed', {
            detail: { outboundMessagingEnabled: updated.outboundMessagingEnabled },
          }),
        )
      }
      onToast(t('dashboard.mode_test.toggled'), 'success')
      const msgs = await fetchSuppressedOutboundMessages(100)
      setMessagesSupprimes(msgs)
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('dashboard.mode_test.toggle_error'), 'error')
    } finally {
      setModeTestSaving(false)
    }
  }

  return (
    <div style={{ padding: '16px 16px 40px 16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {t('dashboard.mode_test.title')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
            Contrôle global des envois sortants (emails &amp; SMS) pour les comptes d&apos;établissement
          </div>
        </div>
        {canRead && (
          <button
            type="button"
            onClick={() => void chargerTout()}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text2)',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={13} strokeWidth={2} />
            Rafraîchir
          </button>
        )}
      </div>

      {!user ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', fontSize: 13, color: 'var(--text3)' }}>
          {t('dashboard.mode_test.loading')}
        </div>
      ) : !canRead ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', fontSize: 13, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={16} />
          Accès réservé aux rôles super_admin et platform_admin.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Mode test - réglage plateforme outboundMessagingEnabled */}
          <div
            style={{
              background: modeTest && !modeTest.outboundMessagingEnabled ? 'var(--red-light)' : 'var(--surface)',
              border: `1px solid ${modeTest && !modeTest.outboundMessagingEnabled ? 'rgba(220,38,38,0.25)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldAlert size={20} style={{ color: modeTest && !modeTest.outboundMessagingEnabled ? 'var(--red)' : 'var(--green)' }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{t('dashboard.mode_test.title')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                    {modeTestLoading || !modeTest
                      ? t('dashboard.mode_test.loading')
                      : modeTest.outboundMessagingEnabled
                        ? t('dashboard.mode_test.status_active')
                        : t('dashboard.mode_test.status_disabled')}
                  </div>
                </div>
              </div>

              {isSuperAdmin ? (
                confirmingDisable && modeTest?.outboundMessagingEnabled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>
                      Confirmer la coupure des emails/SMS ?
                    </span>
                    <button
                      type="button"
                      onClick={() => void basculerModeTest(false)}
                      disabled={modeTestSaving}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: 'none',
                        background: 'var(--red)',
                        color: 'white',
                        fontWeight: 800,
                        fontSize: 12,
                        cursor: modeTestSaving ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      {modeTestSaving ? t('dashboard.mode_test.saving') : 'Confirmer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDisable(false)}
                      disabled={modeTestSaving}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text2)',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(modeTest?.outboundMessagingEnabled)}
                    onClick={() => {
                      if (!modeTest) return
                      if (modeTest.outboundMessagingEnabled) {
                        setConfirmingDisable(true)
                      } else {
                        void basculerModeTest(true)
                      }
                    }}
                    disabled={modeTestSaving || modeTestLoading || !modeTest}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 9,
                      border: 'none',
                      background: modeTest && !modeTest.outboundMessagingEnabled ? 'linear-gradient(135deg,var(--primary),var(--primary-hover))' : 'var(--bg2)',
                      color: modeTest && !modeTest.outboundMessagingEnabled ? 'white' : 'var(--text2)',
                      fontWeight: 800,
                      fontSize: 12.5,
                      cursor: modeTestSaving || modeTestLoading || !modeTest ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: modeTestSaving || modeTestLoading || !modeTest ? 0.6 : 1,
                    }}
                  >
                    {modeTestSaving
                      ? t('dashboard.mode_test.saving')
                      : modeTest && !modeTest.outboundMessagingEnabled
                        ? t('dashboard.mode_test.toggle_on')
                        : t('dashboard.mode_test.toggle_off')}
                  </button>
                )
              ) : (
                <div
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text3)',
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Lock size={13} />
                  Lecture seule (super_admin requis)
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{t('dashboard.mode_test.desc')}</div>
          </div>

          {/* Messages supprimés (mode test) */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>
              {t('dashboard.mode_test.messages_title')}
            </div>
            {!isSuperAdmin ? (
              <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={13} />
                Consultation réservée au super_admin.
              </div>
            ) : messagesLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('dashboard.mode_test.loading')}</div>
            ) : messagesSupprimes.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('dashboard.mode_test.messages_empty')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {messagesSupprimes.map(m => (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 12,
                      padding: '8px 10px',
                      background: 'var(--bg2)',
                      borderRadius: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{m.eventType}</span>
                    <span style={{ color: 'var(--text3)' }}>{m.channel} - {m.recipientMasked}</span>
                    <span style={{ color: 'var(--text3)' }}>{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
