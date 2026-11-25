'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { School } from 'lucide-react'
import { useT } from '@/lib/i18n'
import SectionAdmissions from './SectionAdmissions'
import { sSub, sTitle, type SectionSettingsProps } from './settings/types'
import { useSettingsGeneral } from './settings/useSettingsGeneral'
import { useSettingsLogsAndStructure } from './settings/useSettingsLogsAndStructure'
import SettingsProfileTab from './settings/SettingsProfileTab'
import SettingsNotificationsTab from './settings/SettingsNotificationsTab'
import SettingsSecurityTab from './settings/SettingsSecurityTab'
import { SettingsPedagogyTab, SettingsPreferencesTab } from './settings/SettingsPedagogyAndPrefsTab'
import SettingsActivitiesTab from './settings/SettingsActivitiesTab'
import SettingsEmailsTab from './settings/SettingsEmailsTab'
import SettingsStructureTab from './settings/SettingsStructureTab'

export default function SectionSettings({ onToast, schoolInfo, onLogoUpdate }: SectionSettingsProps) {
  const t = useT('admin')
  const [activeTab, setActiveTab] = useState(0)

  const TABS = [
    t('settings.tabs.0'), t('settings.tabs.1'), t('settings.tabs.2'),
    t('settings.tabs.3'), t('settings.tabs.4'), t('settings.tabs.5'),
    t('settings.tabs.6'), t('settings.tabs.7'), t('settings.tabs.8'),
  ]

  const general = useSettingsGeneral({ activeTab, schoolInfo, onToast, onLogoUpdate })
  const logsStruct = useSettingsLogsAndStructure({ activeTab, schoolInfo, onToast })

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-settings-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="mb-[12px] md:mb-[16px]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="text-[15px] md:text-[17px]" style={sTitle}>{t('settings.title')} — Configuration Établissement</div>
          <div className="text-[11px] md:text-[12px]" style={sSub}>{t('settings.subtitle')}</div>
        </div>
      </div>

      {/* RACI Settings Governance Banner */}
      <div className="mb-3.5 p-2.5 md:p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-[var(--text)] flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-300 flex-shrink-0">
            <School size={15} />
          </div>
          <div>
            <p className="font-bold text-[11.5px] md:text-xs">Paramètres d&apos;Établissement &amp; Rentrée (Admin Exclusif)</p>
            <p className="text-[10.5px] md:text-[11px] text-[var(--text2)]">
              Espace de configuration globale (identité, sous-domaine, règles de sécurité, journaux d&apos;audit et restauration). Accessible ponctuellement depuis le pied de navigation.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs — mobile */}
      <div className="relative md:hidden mb-[12px] -mr-4">
        <div className="flex gap-[5px] overflow-x-auto" style={{ scrollbarWidth: 'none', padding: '2px 32px 4px 0' }}>
          {TABS.map((tab, i) => {
            const active = activeTab === i
            return (
              <button key={i} onClick={() => setActiveTab(i)} className="relative flex-shrink-0 rounded-full px-3 py-1.5 min-h-[38px] whitespace-nowrap border-0" style={{ background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
                {active && (
                  <motion.div layoutId="settings-tab-pill" className="absolute inset-0 rounded-full" style={{ background: 'var(--sidebar)' }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 text-[11px]" style={{ fontWeight: active ? 700 : 500, color: active ? '#fff' : 'var(--text3)' }}>{tab}</span>
              </button>
            )
          })}
        </div>
        <div className="pointer-events-none absolute top-0 right-0 bottom-[4px] w-7" style={{ background: 'linear-gradient(90deg,transparent,var(--bg) 65%)' }} />
      </div>

      {/* Tabs — desktop */}
      <div className="hidden md:flex" style={{ gap: 2, background: 'var(--bg2)', padding: 3, borderRadius: 10, marginBottom: 16, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{ padding: '5px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: activeTab === i ? 'var(--surface)' : 'transparent', color: activeTab === i ? 'var(--text)' : 'var(--text3)', boxShadow: activeTab === i ? '0 1px 3px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.12s' }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 0 && (
        <SettingsProfileTab
          schoolInfo={schoolInfo}
          schoolName={general.schoolName}
          setSchoolName={general.setSchoolName}
          schoolCity={general.schoolCity}
          setSchoolCity={general.setSchoolCity}
          schoolPhone={general.schoolPhone}
          setSchoolPhone={general.setSchoolPhone}
          schoolEmail={general.schoolEmail}
          setSchoolEmail={general.setSchoolEmail}
          minesecSchoolCode={general.minesecSchoolCode}
          setMinesecSchoolCode={general.setMinesecSchoolCode}
          logoPreview={general.logoPreview}
          logoLoading={general.logoLoading}
          onLogoChange={general.handleLogoChange}
          onLogoDelete={general.handleLogoDelete}
          onProfileSave={general.handleProfileSave}
          subdomainInput={general.subdomainInput}
          setSubdomainInput={general.setSubdomainInput}
          subdomainAvail={general.subdomainAvail}
          setSubdomainAvail={general.setSubdomainAvail}
          subdomainSaving={general.subdomainSaving}
          subdomainChanged={general.subdomainChanged}
          subdomainValid={general.subdomainValid}
          onSubdomainSave={general.handleSubdomainSave}
        />
      )}

      {activeTab === 1 && (
        <SettingsNotificationsTab
          notifData={general.notifData}
          notifLoading={general.notifLoading}
          notifSaving={general.notifSaving}
          onToggle={general.handleNotifToggle}
          onRetry={general.retryNotifLoad}
        />
      )}

      {activeTab === 2 && (
        <SettingsSecurityTab
          secSettings={general.secSettings}
          secLoading={general.secLoading}
          secModal={general.secModal}
          setSecModal={general.setSecModal}
          secEdit={general.secEdit}
          setSecEdit={general.setSecEdit}
          secSaving={general.secSaving}
          onSecSave={general.handleSecSave}
          auditOpen={general.auditOpen}
          setAuditOpen={general.setAuditOpen}
          auditLogs={general.auditLogs}
          auditPage={general.auditPage}
          setAuditPage={general.setAuditPage}
          auditPages={general.auditPages}
          auditTotal={general.auditTotal}
          auditLoad={general.auditLoad}
          auditActInput={general.auditActInput}
          setAuditActInput={general.setAuditActInput}
          setAuditAction={general.setAuditAction}
          auditFrom={general.auditFrom}
          setAuditFrom={general.setAuditFrom}
          auditTo={general.auditTo}
          setAuditTo={general.setAuditTo}
        />
      )}

      {activeTab === 3 && (
        <SettingsPedagogyTab
          pedSettings={general.pedSettings}
          setPedSettings={general.setPedSettings}
          pedLoading={general.pedLoading}
          pedSaving={general.pedSaving}
          onSave={general.handlePedSave}
        />
      )}

      {activeTab === 4 && (
        <SettingsPreferencesTab
          dashboardLanguage={general.dashboardLanguage}
          setDashboardLanguage={general.setDashboardLanguage}
          preferencesSaving={general.preferencesSaving}
          onSave={general.handleSavePreferences}
        />
      )}

      {activeTab === 5 && (
        <SettingsActivitiesTab
          timelineData={logsStruct.timelineData}
          timelineLoading={logsStruct.timelineLoading}
          actSearchInput={logsStruct.actSearchInput}
          setActSearchInput={logsStruct.setActSearchInput}
          setActSearch={logsStruct.setActSearch}
          setActPage={logsStruct.setActPage}
          actData={logsStruct.actData}
          actLoading={logsStruct.actLoading}
          aiAuditData={logsStruct.aiAuditData}
          aiAuditLoading={logsStruct.aiAuditLoading}
          aiAuditOutcome={logsStruct.aiAuditOutcome}
          setAiAuditOutcome={logsStruct.setAiAuditOutcome}
        />
      )}

      {activeTab === 6 && (
        <SettingsEmailsTab
          emlSearchInput={logsStruct.emlSearchInput}
          setEmlSearchInput={logsStruct.setEmlSearchInput}
          setEmlSearch={logsStruct.setEmlSearch}
          emlStatus={logsStruct.emlStatus}
          setEmlStatus={logsStruct.setEmlStatus}
          setEmlPage={logsStruct.setEmlPage}
          emlData={logsStruct.emlData}
          emlLoading={logsStruct.emlLoading}
        />
      )}

      {activeTab === 7 && (
        <SettingsStructureTab
          backupInfo={logsStruct.backupInfo}
          backupLoading={logsStruct.backupLoading}
          logRetentionDays={logsStruct.logRetentionDays}
          setLogRetentionDays={logsStruct.setLogRetentionDays}
          logRetentionLoading={logsStruct.logRetentionLoading}
          logRetentionSaving={logsStruct.logRetentionSaving}
          exportLoading={logsStruct.exportLoading}
          onLogRetentionSave={logsStruct.handleLogRetentionSave}
          onRgpdExport={logsStruct.handleRgpdExport}
          structConfig={logsStruct.structConfig}
          structEdit={logsStruct.structEdit}
          setStructEdit={logsStruct.setStructEdit}
          structSaving={logsStruct.structSaving}
          structResult={logsStruct.structResult}
          onStructSave={logsStruct.handleStructSave}
        />
      )}

      {activeTab === 8 && <SectionAdmissions schoolInfo={schoolInfo} />}
    </div>
  )
}
