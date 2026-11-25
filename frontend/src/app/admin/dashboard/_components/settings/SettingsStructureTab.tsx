'use client'

import type React from 'react'
import { CheckCircle2, Info } from 'lucide-react'
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
  type BackupInfo,
  type StructConfigShape,
} from './types'

interface SettingsStructureTabProps {
  backupInfo: BackupInfo | null
  backupLoading: boolean
  logRetentionDays: number
  setLogRetentionDays: (v: number) => void
  logRetentionLoading: boolean
  logRetentionSaving: boolean
  exportLoading: boolean
  onLogRetentionSave: () => void
  onRgpdExport: () => void
  structConfig: StructConfigShape | null
  structEdit: Record<string, number>
  setStructEdit: React.Dispatch<React.SetStateAction<Record<string, number>>>
  structSaving: boolean
  structResult: string[] | null
  onStructSave: () => void
}

export default function SettingsStructureTab(props: SettingsStructureTabProps) {
  const t = useT('admin')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Backup */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.structure.backup_title')}</span>
        </div>
        {props.backupLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
            <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
          </div>
        )}
        {!props.backupLoading && !props.backupInfo && (
          <div className="px-3.5 py-3 md:px-5 md:py-3.5 text-xs md:text-[13.5px]" style={{ color: 'var(--text3)' }}>{t('settings.structure.no_backup')}</div>
        )}
        {!props.backupLoading && props.backupInfo && (
          <div className="grid grid-cols-1 md:grid-cols-2 px-3.5 py-3 md:px-5 md:py-3.5 gap-2.5 md:gap-3.5">
            <div>
              <div className={fieldLabelCls} style={fieldLabel}>{t('settings.structure.date_label')}</div>
              <div className="text-xs md:text-[13px] px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', color: 'var(--text)', fontWeight: 600 }}>
                {props.backupInfo.lastBackupAt ? new Date(props.backupInfo.lastBackupAt).toLocaleString('fr-FR') : '—'}
              </div>
            </div>
            <div>
              <div className={fieldLabelCls} style={fieldLabel}>{t('settings.structure.file_label')}</div>
              <div className="text-xs md:text-[13px] px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', color: 'var(--text)', fontWeight: 600, wordBreak: 'break-word' }}>
                {props.backupInfo.lastBackupFile ?? '—'}
              </div>
            </div>
            <div className="text-[11px] md:text-xs" style={{ gridColumn: '1 / -1', color: 'var(--text3)' }}>
              {props.backupInfo.latestFileExists ? t('settings.structure.backup_file_available') : t('settings.structure.backup_file_missing')}
            </div>
          </div>
        )}
      </div>

      {/* RGPD */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className={cardHeaderCls} style={cardHeader}>
          <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.structure.rgpd_title')}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 px-3.5 py-3 md:px-5 md:py-3.5 gap-2.5 md:gap-3.5">
          <div>
            <div className={fieldLabelCls} style={fieldLabel}>{t('settings.structure.log_retention')}</div>
            {props.logRetentionLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}>
                <div style={{ width: 22, height: 22, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            ) : (
              <input
                type="number"
                min={1}
                max={3650}
                value={props.logRetentionDays}
                onChange={e => props.setLogRetentionDays(Math.max(1, parseInt(e.target.value || '90', 10) || 90))}
                className={fieldInputCls}
                style={fieldInput}
              />
            )}
            <div className="text-[10.5px] md:text-[11.5px]" style={{ marginTop: 5, color: 'var(--text3)' }}>{t('settings.structure.log_retention_hint')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div className={fieldLabelCls} style={fieldLabel}>{t('settings.structure.export_label')}</div>
              <div className="text-xs md:text-[13px]" style={{ color: 'var(--text3)', lineHeight: 1.5 }}>{t('settings.structure.export_desc')}</div>
            </div>
            <button className={btnSecCls} style={btnSec} onClick={props.onRgpdExport} disabled={props.exportLoading}>
              {props.exportLoading ? t('settings.structure.exporting') : t('settings.structure.btn_export')}
            </button>
          </div>
        </div>
        <div className="px-3.5 py-2.5 md:px-5 md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex' }} onClick={props.onLogRetentionSave} disabled={props.logRetentionSaving || props.logRetentionLoading}>
            {props.logRetentionSaving ? t('settings.structure.saving_retention') : t('settings.structure.btn_save_retention')}
          </button>
        </div>
      </div>

      <div className="px-3 py-2 md:px-3.5 md:py-2.5 text-xs md:text-[13px]" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, color: 'var(--amber)', fontWeight: 600 }}>
        {t('settings.structure.structure_warning')}
      </div>

      {!props.structConfig && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
        </div>
      )}

      {props.structConfig && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div className={cardHeaderCls} style={cardHeader}>
            <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.structure.classes_per_level')}</span>
          </div>
          <div className="px-3.5 py-3 md:px-5 md:py-3.5" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...props.structConfig.niveaux1erCycle, ...props.structConfig.niveauxPrimaire].length === 0 && (
              <div className="text-xs md:text-[13.5px]" style={{ color: 'var(--text3)' }}>{t('settings.structure.no_levels')}</div>
            )}
            {[...props.structConfig.niveaux1erCycle, ...props.structConfig.niveauxPrimaire].map(niveau => (
              <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="text-xs md:text-[14px]" style={{ minWidth: 50, fontWeight: 800, color: 'var(--text)' }}>{niveau}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => props.setStructEdit(e => ({ ...e, [niveau]: Math.max(1, (e[niveau] ?? props.structConfig!.classesParNiveau[niveau] ?? props.structConfig!.classesParNiveauPrimaire[niveau] ?? 1) - 1) }))}
                    className="w-[28px] h-[28px] md:w-[30px] md:h-[30px] text-[14px] md:text-[16px]"
                    style={{ borderRadius: 6, border: '1.5px solid var(--border2)', background: 'var(--surface)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontFamily: 'inherit' }}
                  >
                    −
                  </button>
                  <span className="text-[14px] md:text-[16px]" style={{ minWidth: 28, textAlign: 'center', fontWeight: 800, color: 'var(--green)' }}>
                    {props.structEdit[niveau] ?? props.structConfig!.classesParNiveau[niveau] ?? props.structConfig!.classesParNiveauPrimaire[niveau] ?? 1}
                  </span>
                  <button
                    onClick={() => props.setStructEdit(e => ({ ...e, [niveau]: Math.min(26, (e[niveau] ?? props.structConfig!.classesParNiveau[niveau] ?? props.structConfig!.classesParNiveauPrimaire[niveau] ?? 1) + 1) }))}
                    className="w-[28px] h-[28px] md:w-[30px] md:h-[30px] text-[14px] md:text-[16px]"
                    style={{ borderRadius: 6, border: '1.5px solid var(--border2)', background: 'var(--surface)', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontFamily: 'inherit' }}
                  >
                    +
                  </button>
                </div>
                <span className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                  {(() => {
                    const current = props.structConfig!.classesParNiveau[niveau] ?? props.structConfig!.classesParNiveauPrimaire[niveau] ?? 1
                    const next = props.structEdit[niveau] ?? current
                    const diff = next - current
                    if (diff > 0) return t('settings.structure.classes_to_create').replace('{count}', String(diff))
                    if (diff < 0) return t('settings.structure.reduction_ignored')
                    return t('settings.structure.current_classes').replace('{count}', String(current))
                  })()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {props.structResult !== null && props.structResult.length > 0 && (
        <div className="px-3 py-2 md:px-3.5 md:py-2.5" style={{ background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 8 }}>
          <div className="text-xs md:text-[13.5px]" style={{ fontWeight: 800, color: 'var(--green2)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <CheckCircle2 size={14} strokeWidth={2} /> {t('settings.structure.classes_created_title')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {props.structResult.map(n => (
              <span key={n} className="text-xs md:text-[13px]" style={{ padding: '3px 10px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--green)', fontWeight: 700, color: 'var(--green2)' }}>{n}</span>
            ))}
          </div>
        </div>
      )}
      {props.structResult !== null && props.structResult.length === 0 && (
        <div className="text-xs md:text-[13px] px-3 py-2 md:px-3.5 md:py-2.5" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={14} strokeWidth={2} /> {t('settings.structure.no_new_classes')}
        </div>
      )}

      {props.structConfig && (
        <button
          className={`${btnPrimCls} w-full md:w-auto justify-center md:self-start`}
          onClick={props.onStructSave}
          disabled={props.structSaving}
          style={{ ...btnPrim, display: 'flex', opacity: props.structSaving ? 0.7 : 1, cursor: props.structSaving ? 'wait' : 'pointer' }}
        >
          {props.structSaving ? t('settings.structure.applying') : t('settings.structure.btn_apply')}
        </button>
      )}
    </div>
  )
}
