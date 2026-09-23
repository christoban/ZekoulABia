'use client'
import { useState, useEffect, useCallback } from 'react'
import { Compass, Clock } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

type SuggestedTrack = { track: string; score: number; justification: string }

interface Recommandation {
  id: string; status: string; suggestedTracks: SuggestedTrack[] | null
  responseDeadline: string | null; finalTrack: string | null
}

const CHECKPOINTS = ['FIN_TROISIEME', 'FIN_SECONDE_C'] as const

export default function OrientationCheckpointBanner({ onToast }: Props) {
  const t = useT('student')
  const [loading, setLoading] = useState(true)
  const [proposition, setProposition] = useState<{ checkpointType: string; reco: Recommandation } | null>(null)
  const [selectedTrack, setSelectedTrack] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Formulaire d'aspiration (optionnel, disponible en tout temps)
  const [aspirationOpen, setAspirationOpen] = useState(false)
  const [aspirationCheckpoint, setAspirationCheckpoint] = useState<'FIN_TROISIEME' | 'FIN_SECONDE_C'>('FIN_TROISIEME')
  const [desiredTrack, setDesiredTrack] = useState('')
  const [careerInterest, setCareerInterest] = useState('')
  const [savingAspiration, setSavingAspiration] = useState(false)
  const [aspirationSaved, setAspirationSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      for (const cp of CHECKPOINTS) {
        const res = await fetchApi(`/api/v2/orientation/ma-recommandation/${cp}`, { credentials: 'include' })
        const json = await res.json()
        if (json.success && json.data?.status === 'PROPOSEE_A_L_ELEVE') {
          setProposition({ checkpointType: cp, reco: json.data })
          setSelectedTrack(json.data.suggestedTracks?.[0]?.track ?? '')
          setLoading(false)
          return
        }
      }
      setProposition(null)
    } catch { /* silencieux — pas de proposition active par défaut */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleChoisir = async () => {
    if (!proposition || !selectedTrack) return
    setSubmitting(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/recommandations/${proposition.reco.id}/choisir-piste`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ track: selectedTrack }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('orientationCheckpoint.toast_choice_saved'), 'success')
        await load()
      } else {
        onToast(json.message || t('orientationCheckpoint.toast_error'), 'error')
      }
    } catch {
      onToast(t('orientationCheckpoint.toast_error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveAspiration = async () => {
    setSavingAspiration(true)
    try {
      const res = await fetchApi('/api/v2/orientation/aspirations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ checkpointType: aspirationCheckpoint, desiredTrack: desiredTrack || undefined, careerInterest: careerInterest || undefined }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('orientationCheckpoint.toast_aspiration_saved'), 'success')
        setAspirationSaved(true)
      } else {
        onToast(json.message || t('orientationCheckpoint.toast_error'), 'error')
      }
    } catch {
      onToast(t('orientationCheckpoint.toast_error'), 'error')
    } finally {
      setSavingAspiration(false)
    }
  }

  if (loading) return null

  if (proposition) {
    const deadline = proposition.reco.responseDeadline ? new Date(proposition.reco.responseDeadline) : null
    return (
      <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Compass size={16} strokeWidth={2} />
          <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{t('orientationCheckpoint.banner_title')}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 10 }}>
          {t('orientationCheckpoint.banner_subtitle')}
          {deadline && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, color: 'var(--amber)' }}>
              <Clock size={13} strokeWidth={2} /> {deadline.toLocaleDateString()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {(proposition.reco.suggestedTracks ?? []).map(st => (
            <button key={st.track} onClick={() => setSelectedTrack(st.track)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, textAlign: 'left',
                padding: '8px 12px', borderRadius: 8, minWidth: 130, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${selectedTrack === st.track ? 'var(--amber)' : 'var(--border)'}`,
                 background: selectedTrack === st.track ? 'var(--amber-light)' : 'var(--surface)',

              }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)' }}>{st.track}</span>
              <span style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.4 }}>{st.justification}</span>
            </button>
          ))}
        </div>
        <button onClick={handleChoisir} disabled={!selectedTrack || submitting}
          style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--amber)', color: 'white', fontWeight: 800, fontSize: 12, cursor: selectedTrack && !submitting ? 'pointer' : 'not-allowed', opacity: selectedTrack && !submitting ? 1 : 0.6 }}>
          {submitting ? t('orientationCheckpoint.submitting') : t('orientationCheckpoint.confirm_choice')}
        </button>
      </div>
    )
  }

  // Pas de proposition en attente — formulaire d'aspiration optionnel
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
      <button onClick={() => setAspirationOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left' }}>
        <Compass size={16} strokeWidth={2} color="var(--text3)" />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('orientationCheckpoint.aspiration_prompt')}</span>
      </button>
      {aspirationOpen && (
        <div style={{ marginTop: 10 }}>
          {aspirationSaved ? (
            <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>{t('orientationCheckpoint.aspiration_confirmed')}</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <select value={aspirationCheckpoint} onChange={e => setAspirationCheckpoint(e.target.value as any)}
                  style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>
                  <option value="FIN_TROISIEME">{t('orientationCheckpoint.checkpoint_3e')}</option>
                  <option value="FIN_SECONDE_C">{t('orientationCheckpoint.checkpoint_2ndeC')}</option>
                </select>
                <input value={desiredTrack} onChange={e => setDesiredTrack(e.target.value)} placeholder={t('orientationCheckpoint.desired_track_placeholder')}
                  style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, minWidth: 140 }} />
              </div>
              <input value={careerInterest} onChange={e => setCareerInterest(e.target.value)} placeholder={t('orientationCheckpoint.career_interest_placeholder')}
                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, marginBottom: 10 }} />
              <button onClick={handleSaveAspiration} disabled={savingAspiration}
                style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--green)', color: 'white', fontWeight: 700, fontSize: 12, cursor: savingAspiration ? 'wait' : 'pointer' }}>
                {savingAspiration ? t('orientationCheckpoint.submitting') : t('orientationCheckpoint.save_aspiration')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
