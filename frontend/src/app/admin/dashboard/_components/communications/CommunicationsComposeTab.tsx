'use client'

import { Eye, Upload, AlertTriangle, Paperclip } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  CANAL_ICON,
  CANAL_LABEL,
  PAYMENT_OPTIONS,
  ROLE_OPTIONS,
  VARIABLES,
  type ClassItem,
  type PreviewData,
} from './types'

interface CommunicationsComposeTabProps {
  channel: 'SMS' | 'EMAIL' | 'BOTH'
  role: string
  classId: string
  level: string
  paymentStatus: string
  message: string
  classes: ClassItem[]
  levels: string[]
  preview: PreviewData | null
  previewing: boolean
  sending: boolean
  onChangeChannel: (c: 'SMS' | 'EMAIL' | 'BOTH') => void
  onChangeRole: (v: string) => void
  onChangeClassId: (v: string) => void
  onChangeLevel: (v: string) => void
  onChangePaymentStatus: (v: string) => void
  onChangeMessage: (v: string) => void
  onInsertVariable: (v: string) => void
  onPreview: () => void
  onSend: () => void
}

export default function CommunicationsComposeTab({
  channel,
  role,
  classId,
  level,
  paymentStatus,
  message,
  classes,
  levels,
  preview,
  previewing,
  sending,
  onChangeChannel,
  onChangeRole,
  onChangeClassId,
  onChangeLevel,
  onChangePaymentStatus,
  onChangeMessage,
  onInsertVariable,
  onPreview,
  onSend,
}: CommunicationsComposeTabProps) {
  const t = useT('admin')

  return (
    <div className="grid grid-cols-1 md:[grid-template-columns:1fr_340px] gap-[16px] md:gap-[24px]">
      {/* Left — form */}
      <div className="rounded-[16px] md:rounded-[14px] p-[16px] md:p-[28px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-[0_1px_4px_rgba(0,0,0,0.06)]" style={{ background: 'var(--surface)' }}>
        <h3 className="text-[12.5px] md:text-[15px]" style={{ margin: '0 0 12px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase' }}>1. Canal d'envoi</h3>
        <div className="gap-[8px] md:gap-[10px] mb-[18px] md:mb-[28px]" style={{ display: 'flex' }}>
          {(['SMS', 'EMAIL', 'BOTH'] as const).map((c) => {
            const Icon = CANAL_ICON[c]
            return (
              <button key={c} onClick={() => onChangeChannel(c)}
                className="rounded-[10px] py-[10px] px-0 text-[12.5px] md:text-[13px]"
                style={{
                  flex: 1, border: channel === c ? '1.5px solid var(--blue)' : '1.5px solid var(--border)',
                  background: channel === c ? 'var(--blue-light)' : 'white', color: channel === c ? 'var(--blue)' : 'var(--text3)',
                  fontWeight: 800, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <Icon size={14} /> {CANAL_LABEL[c]}
              </button>
            )
          })}
        </div>

        <h3 className="text-[12.5px] md:text-[15px]" style={{ margin: '0 0 16px', fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase' }}>{t('communications.target_section')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] md:gap-[14px] mb-[22px] md:mb-[28px]">
          <div>
            <label className="text-[11px] md:text-[12px]" style={{ fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{t('communications.role_label')}</label>
            <select value={role} onChange={(e) => onChangeRole(e.target.value)}
              className="text-[13px] md:text-[13px] px-[11px] py-[8px] md:px-[12px] md:py-[9px]"
              style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(`communications.role_options.${o.labelKey}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] md:text-[12px]" style={{ fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{t('communications.class_label')}</label>
            <select value={classId} onChange={(e) => onChangeClassId(e.target.value)}
              className="text-[13px] md:text-[13px] px-[11px] py-[8px] md:px-[12px] md:py-[9px]"
              style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
              <option value="">{t('communications.all_classes')}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] md:text-[12px]" style={{ fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{t('communications.level_label')}</label>
            <select value={level} onChange={(e) => onChangeLevel(e.target.value)}
              className="text-[13px] md:text-[13px] px-[11px] py-[8px] md:px-[12px] md:py-[9px]"
              style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
              <option value="">{t('communications.all_levels')}</option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] md:text-[12px]" style={{ fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 5 }}>{t('communications.payment_label')}</label>
            <select value={paymentStatus} onChange={(e) => onChangePaymentStatus(e.target.value)}
              className="text-[13px] md:text-[13px] px-[11px] py-[8px] md:px-[12px] md:py-[9px]"
              style={{ width: '100%', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)' }}>
              {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(`communications.payment_options.${o.labelKey}`)}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-wrap gap-y-[8px]" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="text-[12.5px] md:text-[15px]" style={{ margin: 0, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase' }}>{t('communications.message_section')}</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {VARIABLES.map((v) => (
              <button key={v} onClick={() => onInsertVariable(v)}
                className="text-[10px] md:text-[11px]"
                style={{
                  padding: '3px 10px', borderRadius: 6, border: '1px solid var(--purple-light)', background: 'var(--purple-light)',
                  color: 'var(--purple)', fontWeight: 700, cursor: 'pointer',
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={message}
          onChange={(e) => onChangeMessage(e.target.value)}
          placeholder={t('communications.message_placeholder')}
          rows={6}
          className="text-[12.5px] md:text-[13px]"
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
            resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6,
            boxSizing: 'border-box',
          }}
        />
        <div className="text-[10.5px] md:text-[11px]" style={{ marginTop: 6, color: 'var(--text3)', textAlign: 'right' }}>
          {t('communications.char_count').replace('{count}', String(message.length))}
          {message.length > 160 && channel !== 'EMAIL' && (
            <span style={{ color: 'var(--amber)', marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} /> {t('communications.sms_count').replace('{count}', String(Math.ceil(message.length / 160)))}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={onPreview} disabled={previewing}
            className="text-[13px] md:text-[14px]"
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10, border: '2px solid var(--blue)',
              background: 'var(--surface)', color: 'var(--blue)', fontWeight: 700, cursor: 'pointer',
              opacity: previewing ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            {previewing ? t('communications.btn_preview_loading') : <><Eye size={15} /> {t('communications.btn_preview')}</>}
          </button>
          <button onClick={onSend} disabled={sending || !preview}
            className="text-[13px] md:text-[14px]"
            style={{
              flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
              background: !preview || sending ? 'var(--text3)' : 'var(--blue)',
              color: 'white', fontWeight: 700, cursor: !preview || sending ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            {sending ? t('communications.btn_send_loading') : <><Upload size={15} /> {t('communications.btn_send').replace('{channel}', channel)}</>}
          </button>
        </div>
      </div>

      {/* Right — preview card */}
      <div>
        {/* Aperçu destinataires */}
        <div className="rounded-[14px] p-[16px] md:p-[22px]" style={{ background: 'var(--surface)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <h4 className="text-[13px] md:text-[14px]" style={{ margin: '0 0 14px', fontWeight: 700, color: 'var(--text2)' }}>{t('communications.preview_title')}</h4>
          {!preview ? (
            <div className="text-[12.5px] md:text-[13px]" style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)' }}>
              {t('communications.preview_empty_line1')}<br />{t('communications.preview_empty_line2')}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: t('communications.preview_total'), value: preview.total, color: 'var(--text)' },
                  { label: t('communications.preview_with_phone'), value: preview.withPhone, color: 'var(--blue)' },
                  { label: t('communications.preview_with_email'), value: preview.withEmail, color: 'var(--green)' },
                ].map((item) => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                    <span className="text-[12.5px] md:text-[13px]" style={{ color: 'var(--text3)' }}>{item.label}</span>
                    <span className="text-[16px] md:text-[18px]" style={{ fontWeight: 800, color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
              {preview.total === 0 && (
                <div className="text-[11.5px] md:text-[12px]" style={{ marginTop: 12, padding: '10px 14px', background: 'var(--amber-light)', borderRadius: 8, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} /> {t('communications.preview_no_recipients')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Aide variables */}
        <div style={{ background: 'var(--blue-light)', borderRadius: 14, padding: 18, border: '1px solid var(--blue-light)' }}>
          <h4 className="text-[12.5px] md:text-[13px]" style={{ margin: '0 0 10px', fontWeight: 700, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 6 }}><Paperclip size={14} /> {t('communications.variables_title')}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { var: '{nom_eleve}', desc: t('communications.var_student_name') },
              { var: '{classe}', desc: t('communications.var_class') },
              { var: '{solde}', desc: t('communications.var_balance') },
            ].map((v) => (
              <div key={v.var} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <code className="text-[10.5px] md:text-[11px]" style={{ background: 'var(--blue-light)', padding: '2px 6px', borderRadius: 4, color: 'var(--blue)', whiteSpace: 'nowrap' }}>{v.var}</code>
                <span className="text-[11.5px] md:text-[12px]" style={{ color: 'var(--blue)', paddingTop: 1 }}>{v.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
