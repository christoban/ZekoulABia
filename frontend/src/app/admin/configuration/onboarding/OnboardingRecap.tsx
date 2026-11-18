'use client'

import type React from 'react'
import { BookOpen, Calendar, Clock3, Landmark, Languages, UserPlus, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { heureFin, nombrePeriodes } from '../timetableGridConfig'
import {
  ANGLO_STREAM_KEYS,
  CYCLE_KEYS,
  FEES_KEYS,
  LV2_LANG_KEYS,
  ONBOARDING_STYLES as S,
  TEMPLATE_LABELS,
  type OnboardingState,
} from './onboardingData'

function RecapBlock({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', marginBottom: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={13} /> {title}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

export function OnboardingRecap({
  state,
  template,
  onConfirm,
  onBack,
}: {
  state: OnboardingState
  template: string
  onConfirm: () => void
  onBack: () => void
}) {
  const t = useT('onboarding')
  const lv2LabelMap: Record<string, string> = {}
  LV2_LANG_KEYS.forEach((l) => { lv2LabelMap[l.value] = t(l.key) })

  const lv2Summary = state.lv2Active && state.lv2Languages.length
    ? state.lv2Languages.map((l) => lv2LabelMap[l] ?? l).join(', ')
    : t('phase2.recap.lv2Inactive')

  const hasPerClassOrg = state.lv2Organisation.some((r) => r.className)
  const perClassLines = hasPerClassOrg
    ? state.lv2Organisation
        .filter((r) => r.className)
        .sort((a, b) => (a.className ?? '').localeCompare(b.className ?? ''))
        .map((r) => {
          if (r.organisation === 'UNIFORME' && r.langue) return `${r.className} → ${lv2LabelMap[r.langue] ?? r.langue}`
          if (r.organisation === 'MIXTE' && r.langues?.length) return `${r.className} → ${r.langues.map((l) => lv2LabelMap[l] ?? l).join(' / ')}`
          return `${r.className} → ?`
        })
    : []

  const services = [
    state.hasCanteen && t('phase2.services.canteen'),
    state.hasTransport && t('phase2.services.transport'),
    state.hasLibrary && t('phase2.services.library'),
    state.hasBoarding && t('phase2.services.boarding'),
  ].filter(Boolean).join(', ') || t('phase2.recap.servicesNone')

  const roles = [
    state.directionRoles.proviseur && `${t('phase2.recap.proviseur')}: ${state.directionRoles.proviseur}`,
    state.directionRoles.censeur && `${t('phase2.recap.censeur')}: ${state.directionRoles.censeur}`,
  ].filter(Boolean).join(' · ') || t('phase2.recap.directionNone')

  const gridSummary = t('phase2.timetableGrid.summary', {
    periods: nombrePeriodes(state.gridConfig),
    days: state.gridConfig.joursActifs.length,
    end: heureFin(state.gridConfig),
  })

  return (
    <>
      <div style={S.bubble} dangerouslySetInnerHTML={{ __html: t('phase2.recap.bubble', { schoolName: state.schoolName ?? '' }) }} />

      <RecapBlock icon={BookOpen} title={t('phase2.recap.structure')}>
        {t('phase2.recap.template')}&nbsp;: <strong>{TEMPLATE_LABELS[template] ?? template}</strong><br />
        {t('phase2.recap.cycles')}&nbsp;: {state.cycles.length ? state.cycles.map((c) => {
          const match = CYCLE_KEYS.find((o) => o.value === c)
          return match ? t(match.key).split(' (')[0] ?? t(match.key) : c
        }).join(', ') : '—'}<br />
        {state.series.length > 0 && <>{t('phase2.recap.seriesFr')}&nbsp;: {state.series.join(', ')}<br /></>}
        {state.anglophoneStreams.length > 0 && (
          <>{t('phase2.recap.streamsEn')}&nbsp;: {state.anglophoneStreams.map((s) => {
            const match = ANGLO_STREAM_KEYS.find((o) => o.value === s)
            return match ? t(match.key) : s
          }).join(', ')}
            {state.anglophoneCombinations.length > 0 && ` — ${t('phase2.recap.combinaisons')} ${state.anglophoneCombinations.join(', ')}`}<br /></>
        )}
        {state.technicalFilieres.length > 0 && <>{t('phase2.recap.filieres')}&nbsp;: {state.technicalFilieres.join(', ')}<br /></>}
        {t('phase2.recap.autoClasses')}
      </RecapBlock>

      <RecapBlock icon={Languages} title={t('phase2.recap.langues')}>
        {t('phase2.recap.lv2')}&nbsp;: {lv2Summary}
        {perClassLines.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {perClassLines.map((line) => (
              <div key={line} style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 8 }}>{line}</div>
            ))}
          </div>
        )}
      </RecapBlock>

      {(state.hasPEBSFrancophone || state.hasPEBSAnglophone) && (
        <RecapBlock icon={Landmark} title={t('phase2.recap.pebs')}>
          {state.hasPEBSFrancophone && <div>{t('phase2.recap.pebsFR')}</div>}
          {state.hasPEBSAnglophone && <div>{t('phase2.recap.pebsEN')}</div>}
          {state.pebsOrganisation && state.pebsOrganisation.length > 0 ? (
            <div style={{ marginTop: 6 }}>
              {[...state.pebsOrganisation]
                .sort((a, b) => a.className.localeCompare(b.className))
                .map((r) => (
                  <div key={r.className} style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 8 }}>
                    {r.className} → {t(r.statut === 'PEBS_PUR' ? 'phase2.recap.pebsPur' : r.statut === 'MIXTE' ? 'phase2.recap.pebsMixte' : 'phase2.recap.pebsNon')}
                  </div>
                ))}
              {state.pebsOrganisation.some((r) => r.statut === 'MIXTE') && (
                <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6, fontStyle: 'italic' }}>
                  {t('phase2.recap.pebsMixteNote')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{t('phase2.recap.pebsDefault')}</div>
          )}
        </RecapBlock>
      )}

      <RecapBlock icon={Calendar} title={t('phase2.recap.calendrier')}>
        {t('phase2.recap.debut')}&nbsp;: {state.academicYearStart || '—'}<br />
        {state.periodsCount === 2 ? t('phase2.periods.semesters') : t('phase2.periods.trimesters')} × {state.sequencesPerPeriod} {t('phase2.recap.sequences')}
      </RecapBlock>

      <RecapBlock icon={Clock3} title={t('phase2.recap.timetableGrid')}>{gridSummary}</RecapBlock>

      <RecapBlock icon={Wallet} title={t('phase2.recap.finances')}>
        {t('phase2.recap.fees')}&nbsp;: {state.feesTypes.length ? state.feesTypes.map((f) => {
          const match = FEES_KEYS.find((o) => o.value === f)
          return match ? t(match.key) : f
        }).join(', ') : '—'}<br />
        {state.paymentTranches} {t('phase2.recap.tranches')} · {t('phase2.recap.services')}&nbsp;: {services}
      </RecapBlock>

      <RecapBlock icon={Users} title={t('phase2.recap.direction')}>{roles}</RecapBlock>

      <RecapBlock icon={UserPlus} title={t('phase2.recap.admissions')}>
        {state.directAdmissionWithoutExam ? t('phase2.recap.directAdmissionYes') : t('phase2.recap.directAdmissionNo')}<br />
        {state.adminGereInscriptions ? t('phase2.recap.adminValidationYes') : t('phase2.recap.adminValidationNo')}<br />
        {t('phase2.admissions.capacityBuffer')}&nbsp;: +{state.capacityBufferPercent ?? 0}%
      </RecapBlock>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={S.secondary} onClick={onBack}>{t('phase2.recap.modify')}</button>
        <button style={{ ...S.primary, flex: 1 }} onClick={onConfirm}>{t('phase2.recap.confirm')}</button>
      </div>
    </>
  )
}
