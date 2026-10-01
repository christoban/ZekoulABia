'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User,
  Shield,
  Smartphone,
  Mail,
  Save,
  KeyRound,
  Users,
  Bell,
  Palette,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useTheme } from 'next-themes'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import PushNotificationToggle from '@/components/PushNotificationToggle'
import LanguageSwitch from '@/components/LanguageSwitch'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import type { Toast, UserInfo } from '../_types'

interface Props {
  user?: UserInfo | null
  onToast?: (msg: string, type?: Toast['type']) => void
  onChangePassword?: () => void
}

interface ChildItem {
  studentId: string
  prenom: string
  nom: string
  matricule?: string | null
  classeNom?: string | null
}

export default function SectionParentSettings({ user: initialUser, onToast, onChangePassword }: Props) {
  const t = useT('parent')
  const tc = useT('common')
  const { theme, setTheme, resolvedTheme } = useTheme()

  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Charger les données fraîches du profil
  const loadProfile = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/users/me', { credentials: 'include' })
      const d = await res.json()
      if (d.success && d.data) {
        setFirstName(d.data.firstName || '')
        setLastName(d.data.lastName || '')
        setEmail(d.data.email || '')
        setPhone(d.data.phone || '')
      }
    } catch {
      // Fallback sur initialUser si hors-ligne ou erreur
      if (initialUser) {
        setFirstName(initialUser.firstName || '')
        setLastName(initialUser.lastName || '')
        setEmail(initialUser.email || '')
      }
    }
  }, [initialUser])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Liste des enfants rattachés (avec cache offline-first)
  const childrenCacheKey = initialUser?.id ? `parent:children:${initialUser.id}` : 'parent:children:settings'
  const fetchChildrenFn = useCallback(async (): Promise<ChildItem[]> => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' })
    const d = await res.json()
    if (!d.success) return []
    return (d.data || []).map((c: any) => ({
      studentId: c.studentId,
      prenom: c.prenom,
      nom: c.nom,
      matricule: c.matricule,
      classeNom: c.classeNom,
    }))
  }, [])

  const { data: cachedChildren } = useCachedFetch<ChildItem[]>(childrenCacheKey, fetchChildrenFn)
  const children = cachedChildren ?? []

  // Sauvegarde des coordonnées (téléphone, nom, prénom)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!initialUser?.id) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      const res = await fetchApi(`/api/v2/users/${initialUser.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || tc('errors.generic_error'))

      setSaveSuccess(true)
      onToast?.(t('settings.saveSuccess'), 'success')

      // Mettre à jour l'événement local pour la topbar et la sidebar
      window.dispatchEvent(
        new CustomEvent('zekoulabia:user-updated', {
          detail: { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() },
        })
      )

      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : tc('errors.generic_error')
      setSaveError(msg)
      onToast?.(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4 sm:space-y-6 max-w-4xl mx-auto" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête */}
      <div>
        <div style={sTitle}>{t('settings.title')}</div>
        <div style={sSub}>{t('settings.subtitle')}</div>
      </div>

      {/* ── 1. Coordonnées & Mobile Money ── */}
      <div style={sCard}>
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
          <div style={sIconBox}>
            <User size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <div style={sCardTitle}>{t('settings.profileTitle')}</div>
            <div style={sCardSub}>{t('settings.phoneHint')}</div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="pt-4 space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label style={sLabel}>{tc('fields.firstName')}</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                style={sInput}
                required
              />
            </div>
            <div>
              <label style={sLabel}>{tc('fields.lastName')}</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                style={sInput}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label style={sLabel}>{t('settings.emailLabel')}</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  disabled
                  style={{ ...sInput, background: 'var(--bg2)', cursor: 'not-allowed', color: 'var(--text3)' }}
                />
                <span className="text-[10px] text-[var(--text3)] mt-1 block">Modifiable uniquement par l&apos;administration</span>
              </div>
            </div>

            <div>
              <label style={sLabel}>{t('settings.phoneLabel')}</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t('settings.phonePlaceholder')}
                  style={sInput}
                />
              </div>
            </div>
          </div>

          {saveError && (
            <div style={sAlertError}>
              <AlertCircle size={15} />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div style={sAlertSuccess}>
              <CheckCircle2 size={15} />
              <span>{t('settings.saveSuccess')}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-lg text-xs font-bold text-white flex items-center gap-2 cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? tc('status.saving') : t('settings.saveButton')}
            </button>
          </div>
        </form>
      </div>

      {/* ── 2. Sécurité & Mot de passe ── */}
      <div style={sCard}>
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
          <div style={sIconBox}>
            <Shield size={18} style={{ color: 'var(--blue)' }} />
          </div>
          <div>
            <div style={sCardTitle}>{t('settings.securityTitle')}</div>
            <div style={sCardSub}>{t('settings.securityDesc')}</div>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-[var(--text)]">Mot de passe du compte</div>
            <div className="text-[11.5px] text-[var(--text3)] mt-0.5">
              Il est recommandé de renouveler régulièrement votre mot de passe pour garantir la confidentialité des données scolaires.
            </div>
          </div>
          <button
            type="button"
            onClick={() => (onChangePassword ? onChangePassword() : setPwdModalOpen(true))}
            className="h-10 px-4 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            <KeyRound size={14} style={{ color: 'var(--primary)' }} />
            {t('settings.changePassword')}
          </button>
        </div>
      </div>

      {/* ── 3. Préférences d'affichage & Notifications ── */}
      <div style={sCard}>
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
          <div style={sIconBox}>
            <Palette size={18} style={{ color: 'var(--purple)' }} />
          </div>
          <div>
            <div style={sCardTitle}>{t('settings.preferencesTitle')}</div>
            <div style={sCardSub}>Personnalisez votre confort visuel et vos canaux d&apos;alerte</div>
          </div>
        </div>

        <div className="pt-4 space-y-4">
          {/* Thème clair / sombre */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
            <div>
              <div className="text-xs font-bold text-[var(--text)]">{t('settings.theme')}</div>
              <div className="text-[11.5px] text-[var(--text3)] mt-0.5">Basculez entre le mode clair et le mode sombre</div>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-lg border border-[var(--border)] bg-[var(--bg2)]">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className="h-8 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                style={{
                  background: resolvedTheme === 'light' ? 'var(--surface)' : 'transparent',
                  color: resolvedTheme === 'light' ? 'var(--text)' : 'var(--text3)',
                  boxShadow: resolvedTheme === 'light' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Sun size={13} /> Clair
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className="h-8 px-3 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                style={{
                  background: resolvedTheme === 'dark' ? 'var(--surface)' : 'transparent',
                  color: resolvedTheme === 'dark' ? 'var(--text)' : 'var(--text3)',
                  boxShadow: resolvedTheme === 'dark' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <Moon size={13} /> Sombre
              </button>
            </div>
          </div>

          {/* Langue d'affichage */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
            <div>
              <div className="text-xs font-bold text-[var(--text)]">{t('settings.language')}</div>
              <div className="text-[11.5px] text-[var(--text3)] mt-0.5">Choisissez la langue de l&apos;interface</div>
            </div>
            <LanguageSwitch compact />
          </div>

          {/* Notifications Push */}
          <div>
            <PushNotificationToggle />
          </div>

          {/* Alerte SMS prioritaires */}
          <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-start gap-3">
            <Smartphone size={18} style={{ color: 'var(--green)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <div className="text-xs font-bold text-[var(--text)]">{t('settings.smsAlerts')}</div>
              <div className="text-[11px] text-[var(--text3)] mt-0.5 leading-relaxed">{t('settings.smsDesc')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Enfants rattachés ── */}
      <div style={sCard}>
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
          <div style={sIconBox}>
            <Users size={18} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <div style={sCardTitle}>{t('settings.childrenTitle')}</div>
            <div style={sCardSub}>{t('settings.childrenDesc')}</div>
          </div>
        </div>

        <div className="pt-4">
          {children.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text3)]">{t('settings.noChildren')}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {children.map(child => (
                <div
                  key={child.studentId}
                  className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text)] truncate">
                      {child.prenom} {child.nom}
                    </div>
                    <div className="text-[11px] text-[var(--text3)] mt-0.5">
                      {t('settings.classLabel')} {child.classeNom || '—'}
                      {child.matricule ? ` · ${child.matricule}` : ''}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--green-light)] text-[var(--green)] shrink-0">
                    Inscrit
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal changement mot de passe autonome si non délégué */}
      {pwdModalOpen && (
        <ChangePasswordModal
          onClose={() => setPwdModalOpen(false)}
          onToast={(msg, typ) => onToast?.(msg, typ === 'error' ? 'error' : typ === 'info' ? 'info' : 'success')}
        />
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const sCard: React.CSSProperties = { background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }
const sCardTitle: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }
const sCardSub: React.CSSProperties = { fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }
const sIconBox: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const sLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }
const sInput: React.CSSProperties = { width: '100%', height: 38, padding: '0 11px', borderRadius: 8, fontSize: 12.5, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const sAlertError: React.CSSProperties = { background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '7px 12px', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }
const sAlertSuccess: React.CSSProperties = { background: 'var(--green-light)', color: 'var(--green)', borderRadius: 8, padding: '7px 12px', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }
