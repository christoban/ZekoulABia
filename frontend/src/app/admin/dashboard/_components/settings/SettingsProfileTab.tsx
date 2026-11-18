'use client'

import type React from 'react'
import { useRef } from 'react'
import { School } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  btnPrim,
  btnPrimCls,
  btnSec,
  btnSecCls,
  cardHeader,
  cardHeaderCls,
  cardTitle,
  fieldInput,
  fieldInputCls,
  fieldLabel,
  fieldLabelCls,
  type SchoolInfo,
} from './types'

interface SettingsProfileTabProps {
  schoolInfo?: SchoolInfo | null
  schoolName: string
  setSchoolName: (v: string) => void
  schoolCity: string
  setSchoolCity: (v: string) => void
  schoolPhone: string
  setSchoolPhone: (v: string) => void
  schoolEmail: string
  setSchoolEmail: (v: string) => void
  minesecSchoolCode: string
  setMinesecSchoolCode: (v: string) => void
  logoPreview: string | null
  logoLoading: boolean
  onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onLogoDelete: () => void
  onProfileSave: () => void
  subdomainInput: string
  setSubdomainInput: (v: string) => void
  subdomainAvail: 'checking' | 'available' | 'taken' | null
  setSubdomainAvail: (v: 'checking' | 'available' | 'taken' | null) => void
  subdomainSaving: boolean
  subdomainChanged: boolean
  subdomainValid: boolean
  onSubdomainSave: () => void
}

export default function SettingsProfileTab(props: SettingsProfileTabProps) {
  const t = useT('admin')
  const logoInputRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Logo */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.profile.logo_section')}</span>
        </div>
        <div className="px-3.5 py-3.5 md:px-5 md:py-4 gap-3.5 md:gap-5" style={{ display: 'flex', alignItems: 'center' }}>
          <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={props.onLogoChange} />
          <div
            onClick={() => !props.logoLoading && logoInputRef.current?.click()}
            className="w-[56px] h-[56px] md:w-[72px] md:h-[72px]"
            style={{
              borderRadius: 12,
              border: `2px dashed ${props.logoPreview ? 'var(--primary)' : 'var(--border2)'}`,
              background: props.logoPreview ? 'transparent' : 'var(--bg2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: props.logoLoading ? 'wait' : 'pointer',
              overflow: 'hidden',
              flexShrink: 0,
              transition: 'all 0.15s',
              position: 'relative',
            }}
          >
            {props.logoLoading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <div style={{ width: 20, height: 20, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            )}
            {props.logoPreview ? <img src={props.logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <School size={24} strokeWidth={1.5} className="md:hidden" />}
            {!props.logoPreview && <School size={30} strokeWidth={1.5} className="hidden md:block" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="text-[13px] md:text-[14.5px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {props.logoPreview ? t('settings.profile.current_logo') : t('settings.profile.no_logo')}
            </div>
            <div className="text-xs md:text-[13px]" style={{ color: 'var(--text3)', marginBottom: 8, lineHeight: 1.5 }}>
              {t('settings.profile.logo_desc')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className={btnSecCls} style={btnSec} onClick={() => logoInputRef.current?.click()} disabled={props.logoLoading}>
                {props.logoPreview ? t('settings.profile.btn_change') : t('settings.profile.btn_upload')}
              </button>
              {props.logoPreview && (
                <button className={btnSecCls} style={{ ...btnSec, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)' }} disabled={props.logoLoading} onClick={props.onLogoDelete}>
                  {t('settings.profile.btn_delete')}
                </button>
              )}
            </div>
            <div className="text-[10.5px] md:text-[11.5px]" style={{ color: 'var(--text3)', marginTop: 5 }}>{t('settings.profile.logo_hint')}</div>
          </div>
        </div>
      </div>

      {/* Identité */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.profile.identity_section')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 px-3.5 py-3.5 md:px-5 md:py-4 gap-2.5 md:gap-3.5">
          {[
            { label: t('settings.profile.name_label'), val: props.schoolName, set: props.setSchoolName, type: 'text' },
            { label: t('settings.profile.city_label'), val: props.schoolCity, set: props.setSchoolCity, type: 'text' },
            { label: t('settings.profile.phone_label'), val: props.schoolPhone, set: props.setSchoolPhone, type: 'tel' },
          ].map((f, i) => (
            <div key={i}>
              <div className={fieldLabelCls} style={fieldLabel}>{f.label}</div>
              <input
                type={f.type}
                value={f.val}
                onChange={e => f.set(e.target.value)}
                className={fieldInputCls}
                style={fieldInput}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
              />
            </div>
          ))}
          <div style={{ gridColumn: '1 / -1' }}>
            <div className={fieldLabelCls} style={fieldLabel}>{t('settings.profile.email_label')}</div>
            <input
              type="email"
              value={props.schoolEmail}
              onChange={e => props.setSchoolEmail(e.target.value)}
              className={fieldInputCls}
              style={fieldInput}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div className={fieldLabelCls} style={fieldLabel}>{t('settings.profile.minesec_code_label')}</div>
            <input
              value={props.minesecSchoolCode}
              onChange={e => props.setMinesecSchoolCode(e.target.value)}
              className={fieldInputCls}
              style={fieldInput}
              placeholder={t('settings.profile.minesec_code_placeholder')}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
            />
            <div className="text-[10.5px] md:text-[11.5px]" style={{ color: 'var(--text3)', marginTop: 5 }}>{t('settings.profile.minesec_code_hint')}</div>
          </div>
        </div>
        <div className="px-3.5 py-2.5 md:px-5 md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex' }} onClick={props.onProfileSave}>
            {t('settings.profile.btn_save')}
          </button>
        </div>
      </div>

      {/* Sous-domaine */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.profile.subdomain_section')}</span>
        </div>
        <div className="px-3.5 py-3.5 md:px-5 md:py-4">
          {props.schoolInfo?.subdomain && (
            <div className="text-xs md:text-[13.5px]" style={{ color: 'var(--text2)', marginBottom: 12, fontWeight: 500 }}>
              {t('settings.profile.subdomain_desc')}{' '}
              <strong style={{ color: 'var(--green)' }}>https://{props.schoolInfo.subdomain}.zekoulabia.cm</strong>
            </div>
          )}

          <div className="text-xs md:text-[13px] px-3 py-2 md:px-3.5 md:py-2.5" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, marginBottom: 14, color: 'var(--amber)', lineHeight: 1.5 }}>
            {t('settings.profile.subdomain_warning')}
          </div>

          <div className={fieldLabelCls} style={fieldLabel}>{t('settings.profile.subdomain_label')}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <span className="text-xs md:text-[13px]" style={{ color: 'var(--text3)', whiteSpace: 'nowrap', fontWeight: 600 }}>https://</span>
            <input
              value={props.subdomainInput}
              onChange={e => { props.setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); props.setSubdomainAvail(null) }}
              className={fieldInputCls}
              style={{ ...fieldInput, flex: 1, minWidth: 100 }}
              placeholder={t('settings.profile.subdomain_placeholder')}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
            />
            <span className="text-xs md:text-[13px]" style={{ color: 'var(--text3)', whiteSpace: 'nowrap', fontWeight: 600 }}>.zekoulabia.cm</span>
          </div>

          <div className="text-[11px] md:text-xs" style={{ marginBottom: 4, fontWeight: 600, minHeight: 18 }}>
            {props.subdomainAvail === 'checking' && <span style={{ color: 'var(--text3)' }}>{t('settings.profile.checking')}</span>}
            {props.subdomainAvail === 'available' && <span style={{ color: 'var(--green)' }}>{t('settings.profile.available')}</span>}
            {props.subdomainAvail === 'taken' && <span style={{ color: 'var(--red)' }}>{t('settings.profile.taken')}</span>}
            {!props.subdomainAvail && props.subdomainInput.trim() && props.subdomainInput.trim().length < 3 && (
              <span style={{ color: 'var(--amber)' }}>{t('settings.profile.too_short')}</span>
            )}
          </div>
          <div className="text-[10.5px] md:text-[11.5px]" style={{ color: 'var(--text3)' }}>{t('settings.profile.hint')}</div>
        </div>
        <div className="pl-3.5 py-2.5 pr-[84px] md:pl-5 md:py-3 md:pr-[150px]" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className={`${btnPrimCls} w-full md:w-auto justify-center`}
            style={{ ...btnPrim, display: 'flex', opacity: props.subdomainSaving || !props.subdomainChanged || !props.subdomainValid || props.subdomainAvail === 'taken' || props.subdomainAvail === 'checking' ? 0.5 : 1 }}
            disabled={props.subdomainSaving || !props.subdomainChanged || !props.subdomainValid || props.subdomainAvail === 'taken' || props.subdomainAvail === 'checking'}
            onClick={props.onSubdomainSave}
          >
            {props.subdomainSaving ? t('settings.profile.updating') : t('settings.profile.btn_update')}
          </button>
        </div>
      </div>
    </div>
  )
}
