'use client'
import { ArrowRight, BarChart3, ClipboardList, FlaskConical, GraduationCap, Loader2, WifiOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { OrientationBadge, OrientationEmptyState } from './OrientationPrimitives'
import {
  CHECKPOINT_STATUS_LABEL_KEY,
  CHECKPOINT_STATUS_STYLE,
  CHECKPOINT_TYPE_LABEL_KEY,
  CONFIDENCE_LABEL_KEY,
  CONFIDENCE_STYLE,
  ENTRETIEN_STATUS_LABEL_KEY,
  type Entretien,
  type FicheDetail,
  type OrientationTab,
  RISK_LABEL_KEY,
  RISK_STYLE,
  STATUS_LABEL_KEY,
  STATUS_STYLE,
  btnPrim,
  btnSec,
  fmtOrientationDate,
  sSub,
  sTitle,
} from './orientationTypes'

interface Props {
  loadingFiche: boolean
  selectedFiche: FicheDetail | null
  ficheTab: OrientationTab
  onTabChange: (tab: OrientationTab) => void
  onBack: () => void
  isOnline: boolean
  canEditEnt: boolean
  validatingReco: boolean
  proposingCheckpoint: boolean
  onOpenEntretienModal: () => void
  onOpenEditEntretien: (e: Entretien) => void
  onMarquerRealise: (entretienId: string) => void
  onOpenTestModal: () => void
  onOpenRecoModal: () => void
  onValiderReco: () => void
  onOpenValiderCheckpoint: () => void
  onProposerAuxEleve: () => void
  onOpenSuiviModal: () => void
}

export default function OrientationFicheView({
  loadingFiche,
  selectedFiche,
  ficheTab,
  onTabChange,
  onBack,
  isOnline,
  canEditEnt,
  validatingReco,
  proposingCheckpoint,
  onOpenEntretienModal,
  onOpenEditEntretien,
  onMarquerRealise,
  onOpenTestModal,
  onOpenRecoModal,
  onValiderReco,
  onOpenValiderCheckpoint,
  onProposerAuxEleve,
  onOpenSuiviModal,
}: Props) {
  const t = useT('staff')

  if (loadingFiche || !selectedFiche) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('orientation.loadingFiches')}</div>
  }

  const f = selectedFiche
  const nomEleve = `${f.student.firstName} ${f.student.lastName}`
  const classe = f.student.studentProfile?.class?.name ?? '—'
  const reco = f.recommandation

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ ...btnSec, padding: '5px 11px', fontSize: 12 }}>{t('orientation.backToDashboard')}</button>
        <div>
          <div style={sTitle}>{nomEleve}</div>
          <div style={{ ...sSub, display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
            <span>{classe}</span>
            <OrientationBadge value={f.riskLevel} map={RISK_STYLE} labelMap={RISK_LABEL_KEY} />
            <OrientationBadge value={f.status} map={STATUS_STYLE} labelMap={STATUS_LABEL_KEY} />
          </div>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>Mode hors-ligne — les ajouts seront synchronisés à la reconnexion</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([
          { key: 'entretiens', label: t('orientation.tabInterviews'), count: f.entretiens.length },
          { key: 'tests',      label: t('orientation.tabTests'),      count: f.tests.length },
          { key: 'serie',      label: t('orientation.tabSeries'),     count: reco ? 1 : 0 },
          { key: 'suivis',     label: t('orientation.tabFollowUp'),   count: f.suivis.length },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => onTabChange(tab.key)}
            style={{
              padding: '7px 14px', borderRadius: '8px 8px 0 0', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: ficheTab === tab.key ? 'var(--green)' : 'transparent',
              color: ficheTab === tab.key ? 'white' : 'var(--text3)',
              borderBottom: ficheTab === tab.key ? '2px solid var(--green)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {tab.label} {tab.count > 0 && <span style={{ marginLeft: 5, background: ficheTab === tab.key ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 99, padding: '1px 6px', fontSize: 11 }}>{tab.count}</span>}
          </button>
        ))}
      </div>

      {ficheTab === 'entretiens' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={btnPrim} onClick={onOpenEntretienModal}>{t('orientation.planInterview')}</button>
          </div>
          {f.entretiens.length === 0 ? (
            <OrientationEmptyState icon={<ClipboardList size={30} strokeWidth={1.75} />} text={t('orientation.noInterviews')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {f.entretiens.map(e => (
                <div key={e.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{fmtOrientationDate(e.date)}</span>
                      <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text3)' }}>{e.type.replace('_', ' ')} · {e.motif.replace(/_/g, ' ')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {e.parentNotified && <span style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 600 }}>{t('orientation.parentNotifiedBadge')}</span>}
                      <span style={{
                        background: e.status === 'REALISE' ? 'var(--green-light)' : e.status === 'ANNULE' ? 'var(--red-light)' : 'var(--amber-light)',
                        color: e.status === 'REALISE' ? 'var(--green)' : e.status === 'ANNULE' ? 'var(--red)' : 'var(--amber)',
                        borderRadius: 6, padding: '2px 8px', fontSize: 11.5, fontWeight: 600,
                      }}>{ENTRETIEN_STATUS_LABEL_KEY[e.status] ? t(`orientation.${ENTRETIEN_STATUS_LABEL_KEY[e.status]}`) : e.status}</span>
                      {canEditEnt && (
                        <button onClick={() => onOpenEditEntretien(e)} style={{ ...btnSec, fontSize: 11.5, padding: '3px 8px' }}>{t('orientation.modifyRecommendation')}</button>
                      )}
                      {e.status === 'PLANIFIE' && (
                        <button onClick={() => onMarquerRealise(e.id)} style={{ ...btnSec, fontSize: 11.5, padding: '3px 8px' }}>{t('orientation.markRealised')}</button>
                      )}
                    </div>
                  </div>
                  {e.notes && <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}><strong>{t('orientation.notesLabel')}</strong> {e.notes}</p>}
                  {e.recommendations && <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}><strong>{t('orientation.recommendationsLabel')}</strong> {e.recommendations}</p>}
                  {e.followUpDate && <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t('orientation.nextAppointment')}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ficheTab === 'tests' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={btnPrim} onClick={onOpenTestModal}>{t('orientation.addTest')}</button>
          </div>
          {f.tests.length === 0 ? (
            <OrientationEmptyState icon={<FlaskConical size={30} strokeWidth={1.75} />} text={t('orientation.noTests')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {f.tests.map(test => (
                <div key={test.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{test.type.replace(/_/g, ' ')}</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {test.scoreGlobal != null && (
                        <span style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{test.scoreGlobal}/100</span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>{fmtOrientationDate(test.datePassage)}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}><strong>{t('orientation.resultsLabel')}</strong> {test.resultats}</p>
                  {test.interpretation && <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}><strong>{t('orientation.interpretationLabel')}</strong> {test.interpretation}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {ficheTab === 'serie' && (
        <div>
          {!reco?.checkpointType && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button style={btnPrim} onClick={onOpenRecoModal}>
                {reco ? t('orientation.modifyRecommendation') : t('orientation.createRecommendation')}
              </button>
            </div>
          )}
          {!reco ? (
            <OrientationEmptyState icon={<GraduationCap size={30} strokeWidth={1.75} />} text={t('orientation.noRecommendation')} />
          ) : reco.checkpointType ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ background: 'var(--bg2)', color: 'var(--text2)', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  {t(`orientation.${CHECKPOINT_TYPE_LABEL_KEY[reco.checkpointType] ?? reco.checkpointType}`)}
                </span>
                <OrientationBadge value={reco.status} map={CHECKPOINT_STATUS_STYLE} labelMap={CHECKPOINT_STATUS_LABEL_KEY} />
                {reco.confidenceLevel && (
                  <OrientationBadge value={reco.confidenceLevel} map={CONFIDENCE_STYLE} labelMap={CONFIDENCE_LABEL_KEY} />
                )}
              </div>

              <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700, marginBottom: 8 }}>{t('orientation.checkpointSuggestedTracks')}</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                {(reco.suggestedTracks ?? []).map(st => (
                  <div key={st.track} style={{
                    border: `1px solid ${st.track === reco.serieRecommandee ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 10, padding: '10px 14px', minWidth: 120,
                    background: st.track === reco.serieRecommandee ? 'var(--green-light)' : 'var(--bg)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{st.track}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{st.score}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.4 }}>{st.justification}</div>
                  </div>
                ))}
              </div>

              {reco.finalTrack ? (
                <div style={{ background: 'var(--green-light)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 700, marginBottom: 2 }}>{t('orientation.checkpointFinalTrack')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{reco.finalTrack}</div>
                  {reco.status === 'VALIDEE_PAR_DEFAUT' && (
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{t('orientation.checkpointDefaultNote')}</div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {reco.status === 'CALCULEE' && (
                    <button style={btnPrim} onClick={onOpenValiderCheckpoint}>{t('orientation.checkpointValidate')}</button>
                  )}
                  {reco.status === 'VALIDEE_CONSEILLER' && (
                    <button style={btnPrim} onClick={onProposerAuxEleve} disabled={proposingCheckpoint}>
                      {proposingCheckpoint ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('orientation.checkpointPropose')}
                    </button>
                  )}
                  {reco.status === 'PROPOSEE_A_L_ELEVE' && (
                    <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                      {t('orientation.checkpointWaitingStudent')}
                      {reco.responseDeadline && ` (${fmtOrientationDate(reco.responseDeadline)})`}
                    </span>
                  )}
                </div>
              )}
              <p style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5, marginTop: 12 }}>{reco.justification}</p>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                {reco.adminValidated && `${t('orientation.validatedByAdmin')} · `}
                {reco.parentNotified && `${t('orientation.parentNotifiedBadge')} · `}
                {t('orientation.createdOn')}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700, marginBottom: 2 }}>{t('orientation.currentSeries')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{reco.serieActuelle}</div>
                </div>
                <div style={{ color: 'var(--text3)', alignSelf: 'center', display: 'flex' }}><ArrowRight size={18} strokeWidth={2} /></div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700, marginBottom: 2 }}>{t('orientation.recommendedSeries')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{reco.serieRecommandee}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700, marginBottom: 2 }}>{t('orientation.statusLabel')}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <OrientationBadge value={reco.status} map={{
                      PROPOSEE:        { bg: 'var(--amber-light)', color: 'var(--amber)' },
                      VALIDEE_ADMIN:   { bg: 'var(--green-light)', color: 'var(--green)' },
                      ACCEPTEE_PARENT: { bg: 'var(--green-light)', color: 'var(--green)' },
                      REFUSEE_PARENT:  { bg: 'var(--red-light)', color: 'var(--red)' },
                      TRANSMISE_DRES:  { bg: 'var(--blue-light)', color: 'var(--blue)' },
                    }} labelMap={{
                      PROPOSEE: 'statusProposed',
                      VALIDEE_ADMIN: 'statusValidatedAdmin',
                      ACCEPTEE_PARENT: 'statusAcceptedParent',
                      REFUSEE_PARENT: 'statusRefusedParent',
                      TRANSMISE_DRES: 'statusTransmitedDRES',
                    }} />
                    {reco.status === 'PROPOSEE' && (
                      <button onClick={onValiderReco} disabled={validatingReco}
                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.3)', cursor: validatingReco ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                        {validatingReco ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : t('orientation.validateReco')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}><strong>{t('orientation.justificationLabel')}</strong> {reco.justification}</p>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
                {reco.adminValidated && `${t('orientation.validatedByAdmin')} · `}
                {reco.parentNotified && `${t('orientation.parentNotifiedBadge')} · `}
                {t('orientation.createdOn')}
              </div>
            </div>
          )}
        </div>
      )}

      {ficheTab === 'suivis' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={btnPrim} onClick={onOpenSuiviModal}>{t('orientation.addFollowUp')}</button>
          </div>
          {f.suivis.length === 0 ? (
            <OrientationEmptyState icon={<BarChart3 size={30} strokeWidth={1.75} />} text={t('orientation.noFollowUps')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {f.suivis.map(s => (
                <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{fmtOrientationDate(s.date)}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <OrientationBadge value={s.riskLevel} map={RISK_STYLE} labelMap={RISK_LABEL_KEY} />
                      <span style={{ background: 'var(--bg2)', color: 'var(--text2)', borderRadius: 6, padding: '2px 8px', fontSize: 11.5, fontWeight: 600 }}>
                        {s.mainConcern.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                  {s.interventions && <p style={{ fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.5 }}><strong>{t('orientation.interventionsLabel')}</strong> {s.interventions}</p>}
                  {s.notes && <p style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3, lineHeight: 1.5 }}>{s.notes}</p>}
                  {s.prochainRdv && <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t('orientation.nextAppointment')}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
