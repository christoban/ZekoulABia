'use client'

import type React from 'react'
import { Save } from 'lucide-react'
import { type Language, useT } from '@/lib/i18n'
import {
  btnPrim,
  btnPrimCls,
  cardHeader,
  cardHeaderCls,
  cardTitle,
  fieldInput,
  fieldInputCls,
  fieldLabel,
  fieldLabelCls,
  fieldSelect,
  fieldSelectCls,
  type PedSettings,
} from './types'

interface SettingsPedagogyTabProps {
  pedSettings: PedSettings | null
  setPedSettings: React.Dispatch<React.SetStateAction<PedSettings | null>>
  pedLoading: boolean
  pedSaving: boolean
  onSave: () => void
}

export function SettingsPedagogyTab({ pedSettings, setPedSettings, pedLoading, pedSaving, onSave }: SettingsPedagogyTabProps) {
  const t = useT('admin')

  return (
    <>
      {pedLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
        </div>
      )}
      {!pedLoading && pedSettings && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}>
              <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.pedagogy.academic_rules')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 px-3.5 py-3 md:px-5 md:py-3.5 gap-2.5 md:gap-3.5">
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.pass_mark')}</div>
                <input type="number" min="0" max="20" step="0.5" className={fieldInputCls} style={fieldInput} value={pedSettings.passMark} onChange={e => setPedSettings(s => s ? { ...s, passMark: parseFloat(e.target.value) || 0 } : s)} />
              </div>
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.council_pass_mark')}</div>
                <input type="number" min="0" max="20" step="0.5" className={fieldInputCls} style={fieldInput} value={pedSettings.councilPassMark} onChange={e => setPedSettings(s => s ? { ...s, councilPassMark: parseFloat(e.target.value) || 0 } : s)} />
              </div>
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.grades_per_term')}</div>
                <div className="text-xs md:text-[13px] px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', color: 'var(--text3)', fontWeight: 600 }}>{pedSettings.gradesPerTerm}</div>
              </div>
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.terms_per_year')}</div>
                <div className="text-xs md:text-[13px] px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', color: 'var(--text3)', fontWeight: 600 }}>{pedSettings.termsPerYear}</div>
              </div>
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.calendar_type')}</div>
                <select className={fieldSelectCls} style={fieldSelect} value={pedSettings.academicCalendarType} onChange={e => setPedSettings(s => s ? { ...s, academicCalendarType: e.target.value } : s)}>
                  <option value="trimester">{t('settings.pedagogy.calendar_options.trimester')}</option>
                  <option value="semester">{t('settings.pedagogy.calendar_options.semester')}</option>
                </select>
              </div>
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.language_mode')}</div>
                <select className={fieldSelectCls} style={fieldSelect} value={pedSettings.schoolLanguageMode} onChange={e => setPedSettings(s => s ? { ...s, schoolLanguageMode: e.target.value } : s)}>
                  <option value="francophone">{t('settings.pedagogy.language_options.francophone')}</option>
                  <option value="anglophone">{t('settings.pedagogy.language_options.anglophone')}</option>
                  <option value="bilingual">{t('settings.pedagogy.language_options.bilingual')}</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}>
              <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.pedagogy.attendance_section')}</span>
            </div>
            <div className="px-3.5 py-3 md:px-5 md:py-3.5" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.max_absences')}</div>
                <input type="number" min="0" className={fieldInputCls} style={{ ...fieldInput, maxWidth: 180 }} value={pedSettings.maxAbsences} onChange={e => setPedSettings(s => s ? { ...s, maxAbsences: parseInt(e.target.value) || 0 } : s)} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{ width: 44, height: 24, borderRadius: 12, background: pedSettings.attendanceLateAsAbsence ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                  onClick={() => setPedSettings(s => s ? { ...s, attendanceLateAsAbsence: !s.attendanceLateAsAbsence } : s)}
                >
                  <div style={{ position: 'absolute', top: 2, left: pedSettings.attendanceLateAsAbsence ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                </div>
                <div>
                  <div className="text-[12.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('settings.pedagogy.late_label')}</div>
                  <div className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>{t('settings.pedagogy.late_sub')}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}>
              <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.pedagogy.contributions_section')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 px-3.5 py-3 md:px-5 md:py-3.5 gap-2.5 md:gap-3.5">
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.max_first_cycle')}</div>
                <input type="number" min="0" className={fieldInputCls} style={fieldInput} value={pedSettings.legalMaxContributionFirstCycle} onChange={e => setPedSettings(s => s ? { ...s, legalMaxContributionFirstCycle: parseInt(e.target.value) || 0 } : s)} />
              </div>
              <div>
                <div className={fieldLabelCls} style={fieldLabel}>{t('settings.pedagogy.max_second_cycle')}</div>
                <input type="number" min="0" className={fieldInputCls} style={fieldInput} value={pedSettings.legalMaxContributionSecondCycle} onChange={e => setPedSettings(s => s ? { ...s, legalMaxContributionSecondCycle: parseInt(e.target.value) || 0 } : s)} />
              </div>
            </div>
            <div className="px-3.5 pb-3 md:px-5 md:pb-3.5" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{ width: 44, height: 24, borderRadius: 12, background: pedSettings.bulletinBlockOnUnpaidFees ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                onClick={() => setPedSettings(s => s ? { ...s, bulletinBlockOnUnpaidFees: !s.bulletinBlockOnUnpaidFees } : s)}
              >
                <div style={{ position: 'absolute', top: 2, left: pedSettings.bulletinBlockOnUnpaidFees ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
              </div>
              <div>
                <div className="text-[12.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('settings.pedagogy.block_bulletin_label')}</div>
                <div className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>{t('settings.pedagogy.block_bulletin_sub')}</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div className={cardHeaderCls} style={cardHeader}>
              <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.pedagogy.features_section')}</span>
            </div>
            <div className="px-3.5 py-2.5 md:px-5 md:py-3" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { key: 'smsEnabled' as const, label: t('settings.pedagogy.sms_label'), sub: t('settings.pedagogy.sms_sub') },
                { key: 'offlineModeEnabled' as const, label: t('settings.pedagogy.offline_label'), sub: t('settings.pedagogy.offline_sub') },
                { key: 'aiAlertsEnabled' as const, label: t('settings.pedagogy.ai_label'), sub: t('settings.pedagogy.ai_sub') },
                { key: 'messageModeration' as const, label: t('settings.pedagogy.moderation_label'), sub: t('settings.pedagogy.moderation_sub') },
              ].map(({ key, label, sub }) => {
                const on = pedSettings[key]
                return (
                  <div
                    key={key}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bg)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}
                  >
                    <div>
                      <div className="text-[12.5px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{label}</div>
                      <div className="text-[11px] md:text-xs" style={{ color: 'var(--text3)', marginTop: 2 }}>{sub}</div>
                    </div>
                    <div
                      style={{ width: 44, height: 24, borderRadius: 12, background: on ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                      onClick={() => setPedSettings(s => s ? { ...s, [key]: !on } : s)}
                    >
                      <div style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex', opacity: pedSaving ? 0.7 : 1 }} disabled={pedSaving} onClick={onSave}>
              {pedSaving ? t('settings.pedagogy.saving') : t('settings.pedagogy.btn_save')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

interface SettingsPreferencesTabProps {
  dashboardLanguage: Language
  setDashboardLanguage: (lang: Language) => void
  preferencesSaving: boolean
  onSave: () => void
}

export function SettingsPreferencesTab({ dashboardLanguage, setDashboardLanguage, preferencesSaving, onSave }: SettingsPreferencesTabProps) {
  const t = useT('admin')

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div className={cardHeaderCls} style={cardHeader}>
        <span className="text-[13px] md:text-[15px]" style={cardTitle}>{t('settings.preferences.title')}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 px-3.5 py-3 md:px-5 md:py-3.5 gap-2.5 md:gap-3.5">
        <div>
          <div className={fieldLabelCls} style={fieldLabel}>{t('settings.preferences.language_label')}</div>
          <select className={fieldSelectCls} style={fieldSelect} value={dashboardLanguage} onChange={e => setDashboardLanguage(e.target.value as Language)}>
            <option value="fr">{t('settings.preferences.language_options.0')}</option>
            <option value="en">{t('settings.preferences.language_options.1')}</option>
          </select>
        </div>
      </div>
      <div className="px-3.5 py-2.5 md:px-5 md:py-3" style={{ borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
        <button className={`${btnPrimCls} w-full md:w-auto justify-center`} style={{ ...btnPrim, display: 'flex', alignItems: 'center', gap: 6, opacity: preferencesSaving ? 0.7 : 1 }} disabled={preferencesSaving} onClick={onSave}>
          <Save size={14} strokeWidth={2} /> {t('settings.preferences.btn_save')}
        </button>
      </div>
    </div>
  )
}
