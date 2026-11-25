'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import type {
  CheckpointConfig,
  CheckpointConfigFormState,
  CheckpointTypeValue,
  EleveAOrienter,
  FicheDetail,
  OrientationView,
} from './orientationTypes'

interface UseOrientationCheckpointsParams {
  view: OrientationView
  selectedFiche: FicheDetail | null
  openFiche: (id: string) => Promise<void>
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  t: (key: string, params?: Record<string, string | number>) => string
}

export function useOrientationCheckpoints({
  view,
  selectedFiche,
  openFiche,
  onToast,
  t,
}: UseOrientationCheckpointsParams) {
  const [checkpointType, setCheckpointType] = useState<CheckpointTypeValue>('FIN_TROISIEME')
  const [checkpointConfig, setCheckpointConfig] = useState<CheckpointConfig | null>(null)
  const [loadingCheckpointConfig, setLoadingCheckpointConfig] = useState(false)
  const [elevesAOrienter, setElevesAOrienter] = useState<EleveAOrienter[]>([])
  const [loadingEleves, setLoadingEleves] = useState(false)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [configForm, setConfigForm] = useState<CheckpointConfigFormState>({
    psychotechnicalTestRequired: false,
    windowStartMonth: 3, windowStartDay: 1, windowEndMonth: 5, windowEndDay: 31,
    responseDeadlineDays: 15, loading: false, error: '',
  })
  const [validerCheckpointOpen, setValiderCheckpointOpen] = useState(false)
  const [validerCheckpointPiste, setValiderCheckpointPiste] = useState('')
  const [validatingCheckpoint, setValidatingCheckpoint] = useState(false)
  const [proposingCheckpoint, setProposingCheckpoint] = useState(false)

  const fetchCheckpointConfig = useCallback(async (type: string) => {
    setLoadingCheckpointConfig(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/checkpoints/${type}/config`, { credentials: 'include' })
      const d = await res.json()
      if (res.ok) {
        setCheckpointConfig(d.data)
        if (d.data) {
          setConfigForm(f => ({
            ...f,
            psychotechnicalTestRequired: d.data.psychotechnicalTestRequired,
            windowStartMonth: d.data.windowStartMonth, windowStartDay: d.data.windowStartDay,
            windowEndMonth: d.data.windowEndMonth, windowEndDay: d.data.windowEndDay,
            responseDeadlineDays: d.data.responseDeadlineDays,
          }))
        }
      }
    } catch { /* silencieux */ }
    finally { setLoadingCheckpointConfig(false) }
  }, [])

  const fetchElevesAOrienter = useCallback(async (type: string) => {
    setLoadingEleves(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/eleves-a-orienter?checkpointType=${type}`, { credentials: 'include' })
      const d = await res.json()
      if (res.ok) setElevesAOrienter(d.data || [])
    } catch { /* silencieux */ }
    finally { setLoadingEleves(false) }
  }, [])

  useEffect(() => {
    if (view !== 'checkpoints') return
    fetchCheckpointConfig(checkpointType)
    fetchElevesAOrienter(checkpointType)
  }, [view, checkpointType, fetchCheckpointConfig, fetchElevesAOrienter])

  const genererPourEleve = async (studentId: string) => {
    setGeneratingFor(studentId)
    try {
      const res = await fetchApi(`/api/v2/orientation/checkpoints/${checkpointType}/generer`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.checkpointGenerated'), 'success')
      fetchElevesAOrienter(checkpointType)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setGeneratingFor(null) }
  }

  const submitConfigCheckpoint = async () => {
    setConfigForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/checkpoints/${checkpointType}/config`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psychotechnicalTestRequired: configForm.psychotechnicalTestRequired,
          windowStartMonth: configForm.windowStartMonth, windowStartDay: configForm.windowStartDay,
          windowEndMonth: configForm.windowEndMonth, windowEndDay: configForm.windowEndDay,
          responseDeadlineDays: configForm.responseDeadlineDays,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.checkpointConfigSaved'), 'success')
      setConfigOpen(false)
      setCheckpointConfig(d.data)
    } catch (err) {
      setConfigForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
      return
    }
    setConfigForm(f => ({ ...f, loading: false }))
  }

  const ouvrirValidationCheckpoint = () => {
    if (!selectedFiche?.recommandation?.suggestedTracks) return
    setValiderCheckpointPiste(selectedFiche.recommandation.suggestedTracks[0]?.track ?? '')
    setValiderCheckpointOpen(true)
  }

  const submitValiderCheckpoint = async () => {
    if (!selectedFiche?.recommandation || !validerCheckpointPiste) return
    setValidatingCheckpoint(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/recommandations/${selectedFiche.recommandation.id}/valider-conseiller`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serieRecommandee: validerCheckpointPiste }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.checkpointValidated'), 'success')
      setValiderCheckpointOpen(false)
      openFiche(selectedFiche.id)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setValidatingCheckpoint(false) }
  }

  const proposerAuxEleve = async () => {
    if (!selectedFiche?.recommandation) return
    setProposingCheckpoint(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/recommandations/${selectedFiche.recommandation.id}/proposer-eleve`, {
        method: 'PATCH', credentials: 'include',
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.checkpointProposed'), 'success')
      openFiche(selectedFiche.id)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setProposingCheckpoint(false) }
  }

  return {
    checkpointType, setCheckpointType,
    checkpointConfig, loadingCheckpointConfig,
    elevesAOrienter, loadingEleves, generatingFor,
    configOpen, setConfigOpen, configForm, setConfigForm,
    validerCheckpointOpen, setValiderCheckpointOpen,
    validerCheckpointPiste, setValiderCheckpointPiste,
    validatingCheckpoint, proposingCheckpoint,
    genererPourEleve, submitConfigCheckpoint,
    ouvrirValidationCheckpoint, submitValiderCheckpoint, proposerAuxEleve,
  }
}
