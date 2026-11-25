'use client'
import { Compass, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { OrientationBadge } from './OrientationPrimitives'
import {
  CHECKPOINT_STATUS_LABEL_KEY,
  CHECKPOINT_STATUS_STYLE,
  type CheckpointConfig,
  type CheckpointTypeValue,
  type EleveAOrienter,
  btnSec,
  sSelect,
  sSub,
  sTitle,
} from './orientationTypes'

interface Props {
  onBack: () => void
  checkpointType: CheckpointTypeValue
  onCheckpointTypeChange: (type: CheckpointTypeValue) => void
  onOpenConfig: () => void
  loadingCheckpointConfig: boolean
  checkpointConfig: CheckpointConfig | null
  loadingEleves: boolean
  elevesAOrienter: EleveAOrienter[]
  generatingFor: string | null
  onGenerateForStudent: (studentId: string) => void
}

export default function OrientationCheckpointsView({
  onBack,
  checkpointType,
  onCheckpointTypeChange,
  onOpenConfig,
  loadingCheckpointConfig,
  checkpointConfig,
  loadingEleves,
  elevesAOrienter,
  generatingFor,
  onGenerateForStudent,
}: Props) {
  const t = useT('staff')

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ ...btnSec, padding: '5px 11px', fontSize: 12 }}>{t('orientation.backToDashboard')}</button>
        <div>
          <div style={sTitle}>{t('orientation.checkpointsTitle')}</div>
          <div style={sSub}>{t('orientation.checkpointsSubtitle')}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={checkpointType} onChange={e => onCheckpointTypeChange(e.target.value as CheckpointTypeValue)} style={sSelect}>
          <option value="FIN_TROISIEME">{t('orientation.checkpointFinTroisieme')}</option>
          <option value="FIN_SECONDE_C">{t('orientation.checkpointFinSecondeC')}</option>
        </select>
        <button style={btnSec} onClick={onOpenConfig} disabled={loadingCheckpointConfig}>
          {t('orientation.checkpointConfigButton')}
        </button>
        {checkpointConfig && (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            {t('orientation.checkpointWindowLabel')} {String(checkpointConfig.windowStartDay).padStart(2, '0')}/{String(checkpointConfig.windowStartMonth).padStart(2, '0')} → {String(checkpointConfig.windowEndDay).padStart(2, '0')}/{String(checkpointConfig.windowEndMonth).padStart(2, '0')}
            {checkpointConfig.psychotechnicalTestRequired ? ` · ${t('orientation.checkpointTestRequiredLabel')}` : ''}
          </span>
        )}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{t('orientation.checkpointEligibleStudents')}</span>
        </div>
        {loadingEleves ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('orientation.loadingFiches')}</div>
        ) : elevesAOrienter.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Compass size={32} strokeWidth={1.75} /></div>
            <div style={{ fontSize: 13.5 }}>{t('orientation.checkpointNoEligibleStudents')}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {[t('orientation.tableHeaderStudent'), t('orientation.tableHeaderClass'), t('orientation.checkpointStatusColumn'), t('orientation.tableHeaderActions')].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {elevesAOrienter.map(e => (
                  <tr key={e.studentId} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{e.firstName} {e.lastName}</td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>{e.className}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {e.hasRecommendation
                        ? <OrientationBadge value={e.recommendationStatus ?? ''} map={CHECKPOINT_STATUS_STYLE} labelMap={CHECKPOINT_STATUS_LABEL_KEY} />
                        : <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('orientation.checkpointNotCalculated')}</span>}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      {!e.hasRecommendation && (
                        <button onClick={() => onGenerateForStudent(e.studentId)} disabled={generatingFor === e.studentId} style={{ ...btnSec, fontSize: 11.5, padding: '4px 10px' }}>
                          {generatingFor === e.studentId ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : t('orientation.checkpointGenerate')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
