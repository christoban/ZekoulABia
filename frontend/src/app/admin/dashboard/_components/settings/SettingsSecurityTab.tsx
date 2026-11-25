'use client'

import type React from 'react'
import { Search } from 'lucide-react'
import { useT } from '@/lib/i18n'
import MfaSettings from '@/components/MfaSettings'
import {
  btnSec,
  btnSecCls,
  cardHeader,
  cardHeaderCls,
  cardTitle,
  fieldLabel,
  fieldLabelCls,
  fieldSelect,
  fieldSelectCls,
  fmtDate,
  tdLog,
  tdLogCls,
  thLog,
  thLogCls,
  type AuditLog,
  type SecSettings,
} from './types'

interface SettingsSecurityTabProps {
  secSettings: SecSettings | null
  secLoading: boolean
  secModal: boolean
  setSecModal: (v: boolean) => void
  secEdit: SecSettings
  setSecEdit: React.Dispatch<React.SetStateAction<SecSettings>>
  secSaving: boolean
  onSecSave: () => void
  auditOpen: boolean
  setAuditOpen: (v: boolean) => void
  auditLogs: AuditLog[]
  auditPage: number
  setAuditPage: React.Dispatch<React.SetStateAction<number>>
  auditPages: number
  auditTotal: number
  auditLoad: boolean
  auditActInput: string
  setAuditActInput: (v: string) => void
  setAuditAction: (v: string) => void
  auditFrom: string
  setAuditFrom: (v: string) => void
  auditTo: string
  setAuditTo: (v: string) => void
}

export default function SettingsSecurityTab(props: SettingsSecurityTabProps) {
  const t = useT('admin')

  const SESSION_OPTIONS = [
    { value: 15, label: t('settings.security.session_options.0.label') },
    { value: 30, label: t('settings.security.session_options.1.label') },
    { value: 60, label: t('settings.security.session_options.2.label') },
    { value: 120, label: t('settings.security.session_options.3.label') },
    { value: 240, label: t('settings.security.session_options.4.label') },
    { value: 480, label: t('settings.security.session_options.5.label') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MfaSettings />

      {/* Politique de mot de passe */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.security.password_policy')}</span>
        </div>
        {props.secLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
            <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
          </div>
        )}
        {!props.secLoading && props.secSettings && (
          <div className="px-3.5 py-3 md:px-5 md:py-3.5" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: t('settings.security.min_length'), val: t('settings.security.characters').replace('{count}', String(props.secSettings.passwordMinLength)) },
              { label: t('settings.security.require_upper'), val: props.secSettings.passwordRequireUpper ? t('settings.security.yes') : t('settings.security.no') },
              { label: t('settings.security.require_digit'), val: props.secSettings.passwordRequireDigit ? t('settings.security.yes') : t('settings.security.no') },
              { label: t('settings.security.session_duration'), val: SESSION_OPTIONS.find(o => o.value === props.secSettings!.sessionTimeoutMin)?.label ?? `${props.secSettings.sessionTimeoutMin} min` },
            ].map((f, i, arr) => (
              <div key={i} className="py-2 md:py-2.5" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < arr.length - 1 ? '1px solid var(--bg)' : 'none' }}>
                <div className="text-xs md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{f.label}</div>
                <div className="text-xs md:text-[13px]" style={{ color: 'var(--text2)', fontWeight: 600 }}>{f.val}</div>
              </div>
            ))}
          </div>
        )}
        {!props.secLoading && !props.secSettings && (
          <div className="px-3.5 py-3 md:px-5 md:py-3.5 text-xs md:text-[13.5px]" style={{ color: 'var(--text3)' }}>{t('settings.security.load_error')}</div>
        )}
        <div className="px-3.5 py-2.5 md:px-5 md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className={`${btnSecCls} w-full md:w-auto justify-center`}
            style={{ ...btnSec, display: 'flex' }}
            onClick={() => { if (props.secSettings) props.setSecEdit(props.secSettings); props.setSecModal(true) }}
          >
            {t('settings.security.btn_edit')}
          </button>
        </div>
      </div>

      {/* Journaux d'audit */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.security.audit_logs')}</span>
        </div>
        <div className="px-3.5 py-3 md:px-5 md:py-3.5">
          <div className="text-xs md:text-[13px]" style={{ color: 'var(--text2)', marginBottom: 12, lineHeight: 1.6 }}>
            {t('settings.security.audit_desc')}
          </div>
          {!props.auditOpen && (
            <button
              className={`${btnSecCls} w-full md:w-auto justify-center`}
              style={{ ...btnSec, display: 'flex' }}
              onClick={() => { props.setAuditOpen(true); props.setAuditPage(1) }}
            >
              {t('settings.security.btn_view')}
            </button>
          )}
        </div>

        {props.auditOpen && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--bg2)' }}>
              <input
                placeholder={t('settings.security.filter_placeholder')}
                value={props.auditActInput}
                onChange={e => props.setAuditActInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { props.setAuditAction(props.auditActInput); props.setAuditPage(1) } }}
                style={{ flex: 1, minWidth: 130, padding: '6px 10px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'var(--surface)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
              />
              <input
                type="date"
                value={props.auditFrom}
                onChange={e => { props.setAuditFrom(e.target.value); props.setAuditPage(1) }}
                style={{ padding: '6px 8px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }}
              />
              <input
                type="date"
                value={props.auditTo}
                onChange={e => { props.setAuditTo(e.target.value); props.setAuditPage(1) }}
                style={{ padding: '6px 8px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }}
              />
              <button
                className={btnSecCls}
                style={{ ...btnSec, display: 'inline-flex', alignItems: 'center' }}
                onClick={() => { props.setAuditAction(props.auditActInput); props.setAuditPage(1) }}
              >
                <Search size={13} strokeWidth={2} />
              </button>
              <button className={btnSecCls} style={{ ...btnSec, marginLeft: 'auto' }} onClick={() => props.setAuditOpen(false)}>
                {t('settings.security.btn_close')}
              </button>
            </div>

            <div style={{ padding: '6px 16px', fontSize: 12, color: 'var(--text3)' }}>
              {t('settings.security.entries_count').replace('{count}', String(props.auditTotal))}
            </div>

            {props.auditLoad && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
                <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            )}

            {!props.auditLoad && props.auditLogs.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13.5 }}>{t('settings.security.no_logs')}</div>
            )}

            {!props.auditLoad && props.auditLogs.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th className={thLogCls} style={thLog}>{t('settings.security.table_headers.0')}</th>
                      <th className={thLogCls} style={thLog}>{t('settings.security.table_headers.1')}</th>
                      <th className={thLogCls} style={thLog}>{t('settings.security.table_headers.2')}</th>
                      <th className={thLogCls} style={thLog}>{t('settings.security.table_headers.3')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.auditLogs.map((log, i) => (
                      <tr key={log.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                        <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                        <td className={tdLogCls} style={{ ...tdLog, whiteSpace: 'nowrap' }}>
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : <span style={{ color: 'var(--border2)' }}>—</span>}
                        </td>
                        <td className={tdLogCls} style={tdLog}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{log.action}</span></td>
                        <td className={tdLogCls} style={{ ...tdLog, maxWidth: 280, wordBreak: 'break-word' }}>{log.description ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {t('settings.security.page_info').replace('{current}', String(props.auditPage)).replace('{total}', String(props.auditPages))}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={btnSecCls} style={{ ...btnSec, opacity: props.auditPage <= 1 ? 0.45 : 1 }} disabled={props.auditPage <= 1} onClick={() => props.setAuditPage(p => p - 1)}>
                  {t('settings.security.btn_prev')}
                </button>
                <button className={btnSecCls} style={{ ...btnSec, opacity: props.auditPage >= props.auditPages ? 0.45 : 1 }} disabled={props.auditPage >= props.auditPages} onClick={() => props.setAuditPage(p => p + 1)}>
                  {t('settings.security.btn_next')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Politique de sécurité */}
      {props.secModal && (
        <div onClick={() => !props.secSaving && props.setSecModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-4 py-5 md:px-6 md:py-6" style={{ background: 'var(--surface)', borderRadius: 14, width: 420, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div className="text-[16px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              {t('settings.security.modal.title')}
            </div>

            <div style={{ marginBottom: 12 }}>
              <div className={fieldLabelCls} style={fieldLabel}>{t('settings.security.modal.min_length_label')}</div>
              <select className={fieldSelectCls} style={fieldSelect} value={props.secEdit.passwordMinLength} onChange={e => props.setSecEdit(s => ({ ...s, passwordMinLength: parseInt(e.target.value) }))}>
                {[6, 7, 8, 9, 10, 12, 14, 16].map(v => <option key={v} value={v}>{t('settings.security.characters').replace('{count}', String(v))}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {[
                { key: 'passwordRequireUpper' as const, label: t('settings.security.modal.require_upper_label') },
                { key: 'passwordRequireDigit' as const, label: t('settings.security.modal.require_digit_label') },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{ width: 42, height: 24, borderRadius: 12, background: props.secEdit[key] ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                    onClick={() => props.setSecEdit(s => ({ ...s, [key]: !s[key] }))}
                  >
                    <div style={{ position: 'absolute', top: 2, left: props.secEdit[key] ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </div>
                  <span className="text-xs md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div className={fieldLabelCls} style={fieldLabel}>{t('settings.security.modal.session_label')}</div>
              <select className={fieldSelectCls} style={fieldSelect} value={props.secEdit.sessionTimeoutMin} onChange={e => props.setSecEdit(s => ({ ...s, sessionTimeoutMin: parseInt(e.target.value) }))}>
                {SESSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="text-xs md:text-[13px]" onClick={() => props.setSecModal(false)} disabled={props.secSaving} style={{ flex: 1, padding: '8px 14px', borderRadius: 8, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('settings.security.modal.btn_cancel')}
              </button>
              <button className="text-xs md:text-[13px]" onClick={props.onSecSave} disabled={props.secSaving} style={{ flex: 2, padding: '8px 14px', borderRadius: 8, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: props.secSaving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: props.secSaving ? 0.7 : 1 }}>
                {props.secSaving ? t('settings.security.modal.saving') : t('settings.security.modal.btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
