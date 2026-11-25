'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { JOURS_GRILLE, heureFin, nombrePeriodes, validateGrilleHoraire } from '../timetableGridConfig'
import { OnboardingBubble, OnboardingNav } from './OnboardingPrimitives'
import { FEES_KEYS, ONBOARDING_STYLES as S, type GrilleHoraireOnboarding, type OnboardingState } from './onboardingData'

interface Props {
  stepKey: string
  state: OnboardingState
  patch: (p: Partial<OnboardingState>) => void
  toggleIn: (key: keyof OnboardingState, value: string) => void
  setGrid: (gridPatch: Partial<GrilleHoraireOnboarding>) => void
  toggleGridDay: (jour: GrilleHoraireOnboarding['joursActifs'][number]) => void
  canBack: boolean
  goBack: () => void
  goNext: () => void
}

export function OnboardingOperationsSteps({
  stepKey,
  state,
  patch,
  toggleIn,
  setGrid,
  toggleGridDay,
  canBack,
  goBack,
  goNext,
}: Props) {
  const t = useT('onboarding')
  const feesOptions = useMemo(() => FEES_KEYS.map((f) => ({ value: f.value, label: t(f.key) })), [t])
  const navProps = { canBack, onBack: goBack, onNext: goNext }

  switch (stepKey) {
    case 'calYear':
      return (
        <>
          <OnboardingBubble>{t('phase2.calendar.title')}</OnboardingBubble>
          <div style={S.label}>{t('phase2.calendar.start')}</div>
          <input type="date" style={S.input} value={state.academicYearStart ?? ''} onChange={(e) => patch({ academicYearStart: e.target.value })} />
          <div style={S.label}>{t('phase2.calendar.end')}</div>
          <input type="date" style={S.input} value={state.academicYearEnd ?? ''} onChange={(e) => patch({ academicYearEnd: e.target.value })} />
          <OnboardingNav {...navProps} canNext={!!state.academicYearStart} />
        </>
      )

    case 'grid': {
      const gridError = validateGrilleHoraire(state.gridConfig)
      return (
        <>
          <OnboardingBubble>{t('phase2.timetableGrid.title')}</OnboardingBubble>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>{t('phase2.timetableGrid.subtitle')}</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <label>
              <div style={S.label}>{t('phase2.timetableGrid.startTime')}</div>
              <input type="time" style={S.input} value={state.gridConfig.heureDebut} onChange={(e) => setGrid({ heureDebut: e.target.value })} />
            </label>
            <label>
              <div style={S.label}>{t('phase2.timetableGrid.periodDuration')}</div>
              <input type="number" min={30} max={120} style={S.input} value={state.gridConfig.dureePeriode} onChange={(e) => setGrid({ dureePeriode: Number(e.target.value) })} />
            </label>
          </div>

          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: '8px 0 4px' }}>{t('phase2.timetableGrid.morning')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <label>
              <div style={S.label}>{t('phase2.timetableGrid.periodsBeforeSmall')}</div>
              <input type="number" min={0} max={6} style={S.input} value={state.gridConfig.periodesAvantP1} onChange={(e) => setGrid({ periodesAvantP1: Number(e.target.value) })} />
            </label>
            <label>
              <div style={S.label}>{t('phase2.timetableGrid.smallBreakDuration')}</div>
              <input type="number" min={0} max={60} style={S.input} value={state.gridConfig.dureePetitePause} onChange={(e) => setGrid({ dureePetitePause: Number(e.target.value) })} />
            </label>
          </div>

          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: '8px 0 4px' }}>{t('phase2.timetableGrid.middle')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <label>
              <div style={S.label}>{t('phase2.timetableGrid.periodsBeforeBig')}</div>
              <input type="number" min={0} max={6} style={S.input} value={state.gridConfig.periodesAvantP2} onChange={(e) => setGrid({ periodesAvantP2: Number(e.target.value) })} />
            </label>
            <label>
              <div style={S.label}>{t('phase2.timetableGrid.bigBreakDuration')}</div>
              <input type="number" min={0} max={90} style={S.input} value={state.gridConfig.dureeGrandePause} onChange={(e) => setGrid({ dureeGrandePause: Number(e.target.value) })} />
            </label>
          </div>

          <label style={{ display: 'block', marginTop: 10 }}>
            <div style={S.label}>{t('phase2.timetableGrid.periodsAfterBig')}</div>
            <input type="number" min={0} max={6} style={{ ...S.input, maxWidth: 170 }} value={state.gridConfig.periodesApresP2} onChange={(e) => setGrid({ periodesApresP2: Number(e.target.value) })} />
          </label>

          <div style={S.label}>{t('phase2.timetableGrid.activeDays')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {JOURS_GRILLE.map((jour) => (
              <button
                key={jour}
                type="button"
                style={{ ...S.opt(state.gridConfig.joursActifs.includes(jour)), width: 'auto', marginBottom: 0, padding: '9px 12px' }}
                onClick={() => toggleGridDay(jour)}
              >
                {t(`phase2.timetableGrid.days.${jour}`)}
              </button>
            ))}
          </div>

          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '11px 13px', fontSize: 13, color: 'var(--text2)' }}>
            {t('phase2.timetableGrid.summary', {
              periods: nombrePeriodes(state.gridConfig),
              days: state.gridConfig.joursActifs.length,
              end: heureFin(state.gridConfig),
            })}
          </div>
          {gridError && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--red)', marginTop: 8 }}>
              {t(`phase2.timetableGrid.validation.${gridError}`)}
            </div>
          )}
          <OnboardingNav {...navProps} canNext={!gridError} />
        </>
      )
    }

    case 'periods':
      return (
        <>
          <OnboardingBubble>{t('phase2.periods.title')}</OnboardingBubble>
          <button style={S.opt(state.periodsCount === 3)} onClick={() => patch({ periodsCount: 3 })}><span style={{ flex: 1 }}>{t('phase2.periods.trimesters')}</span></button>
          <button style={S.opt(state.periodsCount === 2)} onClick={() => patch({ periodsCount: 2 })}><span style={{ flex: 1 }}>{t('phase2.periods.semesters')}</span></button>
          <OnboardingNav {...navProps} />
        </>
      )

    case 'sequences':
      return (
        <>
          <OnboardingBubble>{t('phase2.sequences.title', { period: state.periodsCount === 2 ? t('phase2.sequences.semestre') : t('phase2.sequences.trimestre') })}</OnboardingBubble>
          {[2, 3].map((n) => (
            <button key={n} style={S.opt(state.sequencesPerPeriod === n)} onClick={() => patch({ sequencesPerPeriod: n })}>
              <span style={{ flex: 1 }}>{t('phase2.sequences.count', { n })}</span>
            </button>
          ))}
          <OnboardingNav {...navProps} />
        </>
      )

    case 'fees':
      return (
        <>
          <OnboardingBubble>{t('phase2.fees.title')}</OnboardingBubble>
          {feesOptions.map((o) => (
            <button key={o.value} style={S.opt(state.feesTypes.includes(o.value))} onClick={() => toggleIn('feesTypes', o.value)}>
              <span style={{ flex: 1 }}>{o.label}</span>
              {state.feesTypes.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}
          <OnboardingNav {...navProps} canNext={state.feesTypes.length > 0} />
        </>
      )

    case 'tranches':
      return (
        <>
          <OnboardingBubble>{t('phase2.tranches.title')}</OnboardingBubble>
          {[{ n: 1, key: 'phase2.tranches.oneTime' }, { n: 2, key: 'phase2.tranches.two' }, { n: 3, key: 'phase2.tranches.three' }].map((o) => (
            <button key={o.n} style={S.opt(state.paymentTranches === o.n)} onClick={() => patch({ paymentTranches: o.n })}><span style={{ flex: 1 }}>{t(o.key)}</span></button>
          ))}
          <OnboardingNav {...navProps} />
        </>
      )

    case 'services':
      return (
        <>
          <OnboardingBubble>{t('phase2.services.title')}</OnboardingBubble>
          {([
            ['hasCanteen', 'phase2.services.canteen'],
            ['hasTransport', 'phase2.services.transport'],
            ['hasLibrary', 'phase2.services.library'],
            ['hasBoarding', 'phase2.services.boarding'],
          ] as const).map(([key, tKey]) => (
            <button key={key} style={S.opt(!!state[key])} onClick={() => patch({ [key]: !state[key] } as Partial<OnboardingState>)}>
              <span style={{ flex: 1 }}>{t(tKey)}</span>
              {state[key] && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
            </button>
          ))}
          <OnboardingNav {...navProps} />
        </>
      )

    case 'direction':
      return (
        <>
          <OnboardingBubble>{t('phase2.direction.title')}</OnboardingBubble>
          <div style={S.label}>{t('phase2.direction.proviseur')}</div>
          <input style={S.input} value={state.directionRoles.proviseur ?? ''} onChange={(e) => patch({ directionRoles: { ...state.directionRoles, proviseur: e.target.value } })} placeholder={t('phase2.direction.placeholder')} />
          <div style={S.label}>{t('phase2.direction.censeur')}</div>
          <input style={S.input} value={state.directionRoles.censeur ?? ''} onChange={(e) => patch({ directionRoles: { ...state.directionRoles, censeur: e.target.value } })} placeholder={t('phase2.direction.placeholder')} />
          <div style={S.label}>{t('phase2.direction.surveillantGeneral')}</div>
          <input style={S.input} value={state.directionRoles.surveillantGeneral ?? ''} onChange={(e) => patch({ directionRoles: { ...state.directionRoles, surveillantGeneral: e.target.value } })} placeholder={t('phase2.direction.placeholder')} />
          <div style={S.label}>{t('phase2.direction.intendant')}</div>
          <input style={S.input} value={state.directionRoles.intendant ?? ''} onChange={(e) => patch({ directionRoles: { ...state.directionRoles, intendant: e.target.value } })} placeholder={t('phase2.direction.placeholder')} />
          <OnboardingNav {...navProps} />
        </>
      )

    case 'admissions':
      return (
        <>
          <OnboardingBubble>{t('phase2.admissions.title')}</OnboardingBubble>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>{t('phase2.admissions.subtitle')}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <input type="checkbox" checked={state.directAdmissionWithoutExam !== false} onChange={(e) => patch({ directAdmissionWithoutExam: e.target.checked })} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('phase2.admissions.directAdmission')}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('phase2.admissions.directAdmissionDesc')}</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <input type="checkbox" checked={state.selfServiceEnabled !== false} onChange={(e) => patch({ selfServiceEnabled: e.target.checked })} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('phase2.admissions.selfService')}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('phase2.admissions.selfServiceDesc')}</div>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <input type="checkbox" checked={state.adminGereInscriptions !== false} onChange={(e) => patch({ adminGereInscriptions: e.target.checked })} style={{ marginTop: 3 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('phase2.admissions.adminValidation')}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('phase2.admissions.adminValidationDesc')}</div>
              </div>
            </label>
          </div>

          <div style={S.label}>{t('phase2.admissions.capacityBuffer')}</div>
          <select style={{ ...S.input, marginBottom: 14 }} value={state.capacityBufferPercent ?? 0} onChange={(e) => patch({ capacityBufferPercent: Number(e.target.value) })}>
            <option value={0}>0% (Capacité stricte)</option>
            <option value={5}>+5% de surcapacité tolérée</option>
            <option value={10}>+10% de surcapacité tolérée</option>
            <option value={15}>+15% de surcapacité tolérée</option>
          </select>

          <OnboardingNav {...navProps} nextLabel={t('phase2.nav.recap')} />
        </>
      )

    default:
      return null
  }
}
