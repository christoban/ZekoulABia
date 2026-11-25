'use client'

import { useState } from 'react'
import { ClipboardList, IdCard, KeyRound, Loader2, Upload } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import type { UserItem } from './types'
import { sErr, sIn, sInCls, sLb, sLbCls } from './UserSharedPrimitives'

interface UserDocModalProps {
  user: UserItem
  onClose: () => void
}

export function UserDocModal({ user, onClose }: UserDocModalProps) {
  const t = useT('admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const userName = `${user.firstName} ${user.lastName}`
  const status = user.studentStatus ?? 'ACTIVE'

  const generateDoc = async (type: 'certificat' | 'carte' | 'lettre-transfert') => {
    setLoading(true)
    setError('')
    try {
      const url = type === 'lettre-transfert'
        ? `/api/v2/students/${user.id}/${type}?motif=Demande de transfert`
        : `/api/v2/students/${user.id}/${type}`
      const res = await fetchApi(url, { credentials: 'include' })
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { message?: string }
        setLoading(false)
        setError(d.message ?? t('users.doc_modal.toast_error'))
        return
      }
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      window.open(objUrl, '_blank')
      onClose()
    } catch (e: unknown) {
      setLoading(false)
      setError(e instanceof Error ? e.message : t('users.i18n_ext.toast.networkError'))
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="p-4 md:p-5" style={{ background: 'var(--surface)', borderRadius: 14, width: 420, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="text-[15px] font-bold font-spectral" style={{ color: 'var(--text)', marginBottom: 2 }}>{t('users.doc_modal.title')}</div>
        <div className="text-[11.5px] font-medium" style={{ color: 'var(--text2)', marginBottom: 14 }}>{userName}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { icon: ClipboardList, label: t('users.doc_modal.certificat'), sub: t('users.i18n_ext.certificatSub'), type: 'certificat' as const, disabled: false },
            { icon: IdCard, label: t('users.doc_modal.carte'), sub: t('users.i18n_ext.carteSub'), type: 'carte' as const, disabled: false },
            { icon: Upload, label: t('users.doc_modal.lettre_transfert'), sub: t('users.i18n_ext.lettreTransfertSub'), type: 'lettre-transfert' as const, disabled: !['TRANSFERRED', 'LEFT', 'GRADUATED'].includes(status) },
          ].map(item => {
            const ItemIcon = item.icon
            return (
              <button
                key={item.type}
                disabled={item.disabled || loading}
                onClick={() => generateDoc(item.type)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${item.disabled ? 'var(--bg2)' : 'var(--border2)'}`, background: item.disabled ? 'var(--bg)' : 'white', cursor: item.disabled || loading ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: 'inherit', opacity: item.disabled ? 0.45 : 1, transition: 'all 0.12s' }}
                onMouseEnter={e => { if (!item.disabled && !loading) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', background: 'var(--green-light)' }) }}
                onMouseLeave={e => { if (!item.disabled) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', background: 'var(--surface)' }) }}
              >
                <ItemIcon size={22} strokeWidth={1.5} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{item.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>{item.sub}</div>
                </div>
              </button>
            )
          })}
        </div>
        {loading && (
          <div style={{ marginTop: 12, textAlign: 'center', color: 'var(--green)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Loader2 size={13} strokeWidth={2} className="animate-spin" /> {t('users.doc_modal.loading')}
          </div>
        )}
        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--red-light)', border: '1px solid var(--red-light)', borderRadius: 8, color: 'var(--red)', fontSize: 12.5 }}>{error}</div>
        )}
        <button
          style={{ marginTop: 16, width: '100%', padding: '8.5px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={onClose}
        >
          {t('users.i18n_ext.actions.close')}
        </button>
      </div>
    </div>
  )
}

interface UserReauthModalProps {
  userId: string
  onClose: () => void
  onDeleted: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export function UserReauthModal({ userId, onClose, onDeleted, onToast }: UserReauthModalProps) {
  const t = useT('admin')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleReauthEtSupprimer = async () => {
    if (!password.trim()) {
      setError(t('users.reauth.password_required'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const reauthRes = await fetchApi('/api/v2/users/auth/reauth', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code }),
      })
      const reauthData = await reauthRes.json()
      if (!reauthRes.ok || !reauthData.success) {
        setError(reauthData.message || t('users.reauth.error'))
        return
      }

      const res = await fetchApi(`/api/v2/users/${userId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || t('users.reauth.error'))
        return
      }

      onToast(t('users.i18n_ext.toast.userDeleted'), 'success')
      onDeleted()
      onClose()
    } catch {
      setError(t('users.reauth.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div onClick={() => !loading && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, width: '92%', maxWidth: 400, borderRadius: 16 }}>
        <div className="px-5 py-5 md:px-7 md:py-6" style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <KeyRound size={17} color="var(--text)" />
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t('users.reauth.title')}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 0, marginBottom: 14 }}>{t('users.reauth.subtitle')}</p>

          <label className={sLbCls} style={sLb}>{t('users.reauth.password_label')}</label>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={sInCls}
            style={sIn}
            onKeyDown={e => e.key === 'Enter' && handleReauthEtSupprimer()}
          />

          <label className={sLbCls} style={sLb}>{t('users.reauth.code_label')}</label>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value)}
            className={sInCls}
            style={sIn}
            placeholder={t('users.reauth.code_placeholder')}
            onKeyDown={e => e.key === 'Enter' && handleReauthEtSupprimer()}
          />

          {error && <div style={sErr}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              style={{ flex: 1, padding: '7.5px 12px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={onClose}
              disabled={loading}
            >
              {t('users.i18n_ext.actions.cancel')}
            </button>
            <button
              style={{ flex: 1, padding: '7.5px 12px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: '#dc2626', color: 'white', border: 'none', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={handleReauthEtSupprimer}
              disabled={loading}
            >
              {loading ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : t('users.reauth.btn_confirm')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
