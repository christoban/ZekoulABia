'use client'
import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import type {
  EditEntretienFormState,
  EditEntretienOrig,
  Entretien,
  EntretienFormState,
  FicheDetail,
  RecoFormState,
  SuiviFormState,
  TestFormState,
} from './orientationTypes'

interface SyncQueuePayload {
  type: 'ORIENTATION_RECORD'
  endpoint: string
  method: 'POST'
  payload: Record<string, unknown>
}

interface UseOrientationFicheActionsParams {
  selectedFiche: FicheDetail | null
  isOnline: boolean
  addToQueue: (item: SyncQueuePayload) => Promise<unknown>
  openFiche: (id: string) => Promise<void>
  fetchStats: () => Promise<void>
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const INITIAL_ENTRETIEN: EntretienFormState = {
  date: '', type: 'INDIVIDUEL', motif: 'ORIENTATION_GENERALE',
  notes: '', recommendations: '', nextActions: '',
  parentNotified: false, followUpDate: '', loading: false, error: '',
}

const INITIAL_TEST: TestFormState = {
  type: 'COGNITIF', datePassage: '', resultats: '', interpretation: '', scoreGlobal: '',
  checkpointType: '', scientificAptitude: '', literaryAptitude: '', technicalAptitude: '',
  loading: false, error: '',
}

const INITIAL_SUIVI: SuiviFormState = {
  riskLevel: 'MOYEN', mainConcern: 'SCOLAIRE',
  interventions: '', prochainRdv: '', notes: '', loading: false, error: '',
}

const INITIAL_RECO: RecoFormState = {
  serieActuelle: '', serieRecommandee: '', justification: '', loading: false, error: '',
}

export function useOrientationFicheActions({
  selectedFiche,
  isOnline,
  addToQueue,
  openFiche,
  fetchStats,
  onToast,
  t,
}: UseOrientationFicheActionsParams) {
  const [entretienOpen, setEntretienOpen] = useState(false)
  const [entretienForm, setEntretienForm] = useState<EntretienFormState>(INITIAL_ENTRETIEN)
  const [testOpen, setTestOpen] = useState(false)
  const [testForm, setTestForm] = useState<TestFormState>(INITIAL_TEST)
  const [suiviOpen, setSuiviOpen] = useState(false)
  const [suiviForm, setSuiviForm] = useState<SuiviFormState>(INITIAL_SUIVI)
  const [validatingReco, setValidatingReco] = useState(false)
  const [canEditEnt, setCanEditEnt] = useState(false)
  const [editEntOpen, setEditEntOpen] = useState(false)
  const [editEnt, setEditEnt] = useState<EditEntretienFormState>({
    entretienId: '', notes: '', recommendations: '', nextActions: '',
    parentNotified: false, followUpDate: '', status: '', loading: false, error: '',
  })
  const [editOrig, setEditOrig] = useState<EditEntretienOrig>({
    notes: '', recommendations: '', nextActions: '',
    parentNotified: false, followUpDate: '', status: '',
  })
  const [recoOpen, setRecoOpen] = useState(false)
  const [recoForm, setRecoForm] = useState<RecoFormState>(INITIAL_RECO)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const u = JSON.parse(raw) as { role?: string; permissions?: string[] }
        setCanEditEnt(u.role === 'ADMIN' || (u.permissions ?? []).includes('MANAGE_ORIENTATION'))
      }
    } catch { /* ignore */ }
  }, [])

  const submitEntretien = async () => {
    if (!entretienForm.date) {
      setEntretienForm(f => ({ ...f, error: t('orientation.dateRequired') })); return
    }
    if (!selectedFiche) return

    const entretienPayload = {
      date: entretienForm.date,
      type: entretienForm.type,
      motif: entretienForm.motif,
      notes: entretienForm.notes || undefined,
      recommendations: entretienForm.recommendations || undefined,
      nextActions: entretienForm.nextActions || undefined,
      parentNotified: entretienForm.parentNotified,
      followUpDate: entretienForm.followUpDate || undefined,
    }

    if (!isOnline) {
      await addToQueue({ type: 'ORIENTATION_RECORD', endpoint: `/api/v2/orientation/fiches/${selectedFiche.id}/entretiens`, method: 'POST', payload: entretienPayload })
      onToast(`${t('orientation.interviewScheduled')} (${t('offlineQueued')})`, 'success')
      setEntretienOpen(false)
      setEntretienForm(INITIAL_ENTRETIEN)
      return
    }

    setEntretienForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${selectedFiche.id}/entretiens`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entretienPayload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.interviewScheduled'), 'success')
      setEntretienOpen(false)
      setEntretienForm(INITIAL_ENTRETIEN)
      openFiche(selectedFiche.id)
    } catch (err) {
      setEntretienForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const marquerRealise = async (entretienId: string) => {
    try {
      const res = await fetchApi(`/api/v2/orientation/entretiens/${entretienId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REALISE' }),
      })
      if (!res.ok) throw new Error()
      onToast(t('orientation.interviewMarkedRealised'), 'success')
      if (selectedFiche) openFiche(selectedFiche.id)
    } catch { onToast('Erreur', 'error') }
  }

  const submitTest = async () => {
    if (!testForm.datePassage || !testForm.resultats) {
      setTestForm(f => ({ ...f, error: t('orientation.dateAndResultsRequired') })); return
    }
    if (!selectedFiche) return

    const isPsychotechnique = testForm.type === 'PSYCHOTECHNIQUE' && testForm.checkpointType
    const testPayload = {
      type: testForm.type,
      datePassage: testForm.datePassage,
      resultats: testForm.resultats,
      interpretation: testForm.interpretation || undefined,
      scoreGlobal: testForm.scoreGlobal ? parseInt(testForm.scoreGlobal) : undefined,
      ...(isPsychotechnique ? {
        checkpointType: testForm.checkpointType,
        scientificAptitude: testForm.scientificAptitude ? parseInt(testForm.scientificAptitude) : undefined,
        literaryAptitude: testForm.literaryAptitude ? parseInt(testForm.literaryAptitude) : undefined,
        technicalAptitude: testForm.technicalAptitude ? parseInt(testForm.technicalAptitude) : undefined,
      } : {}),
    }

    if (!isOnline) {
      await addToQueue({ type: 'ORIENTATION_RECORD', endpoint: `/api/v2/orientation/fiches/${selectedFiche.id}/tests`, method: 'POST', payload: testPayload })
      onToast(`${t('orientation.testAdded')} (${t('offlineQueued')})`, 'success')
      setTestOpen(false)
      setTestForm(INITIAL_TEST)
      return
    }

    setTestForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${selectedFiche.id}/tests`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.testAdded'), 'success')
      setTestOpen(false)
      setTestForm(INITIAL_TEST)
      openFiche(selectedFiche.id)
    } catch (err) {
      setTestForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const submitSuivi = async () => {
    if (!selectedFiche) return
    const suiviPayload = {
      riskLevel: suiviForm.riskLevel,
      mainConcern: suiviForm.mainConcern,
      interventions: suiviForm.interventions || undefined,
      prochainRdv: suiviForm.prochainRdv || undefined,
      notes: suiviForm.notes || undefined,
    }

    if (!isOnline) {
      await addToQueue({ type: 'ORIENTATION_RECORD', endpoint: `/api/v2/orientation/fiches/${selectedFiche.id}/suivis`, method: 'POST', payload: suiviPayload })
      onToast(`${t('orientation.followUpSaved')} (${t('offlineQueued')})`, 'success')
      setSuiviOpen(false)
      setSuiviForm(INITIAL_SUIVI)
      return
    }

    setSuiviForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${selectedFiche.id}/suivis`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suiviPayload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.followUpSaved'), 'success')
      setSuiviOpen(false)
      setSuiviForm(INITIAL_SUIVI)
      openFiche(selectedFiche.id); fetchStats()
    } catch (err) {
      setSuiviForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const submitReco = async () => {
    if (!recoForm.serieActuelle || !recoForm.serieRecommandee || !recoForm.justification) {
      setRecoForm(f => ({ ...f, error: t('orientation.allFieldsRequired') })); return
    }
    if (!selectedFiche) return

    const recoPayload = {
      serieActuelle: recoForm.serieActuelle,
      serieRecommandee: recoForm.serieRecommandee,
      justification: recoForm.justification,
    }

    if (!isOnline) {
      await addToQueue({ type: 'ORIENTATION_RECORD', endpoint: `/api/v2/orientation/fiches/${selectedFiche.id}/recommandation-serie`, method: 'POST', payload: recoPayload })
      onToast(`${t('orientation.recoSaved')} (${t('offlineQueued')})`, 'success')
      setRecoOpen(false)
      setRecoForm(INITIAL_RECO)
      return
    }

    setRecoForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${selectedFiche.id}/recommandation-serie`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recoPayload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.recoSaved'), 'success')
      setRecoOpen(false)
      setRecoForm(INITIAL_RECO)
      openFiche(selectedFiche.id)
    } catch (err) {
      setRecoForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const validerRecommandation = async () => {
    if (!selectedFiche?.recommandation) return
    setValidatingReco(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/recommandations/${selectedFiche.recommandation.id}/valider`, {
        method: 'PATCH', credentials: 'include',
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('orientation.recoValidated'), 'success')
      openFiche(selectedFiche.id)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally { setValidatingReco(false) }
  }

  const openEditEntretien = (e: Entretien) => {
    const orig: EditEntretienOrig = {
      notes: e.notes ?? '',
      recommendations: e.recommendations ?? '',
      nextActions: e.nextActions ?? '',
      parentNotified: e.parentNotified,
      followUpDate: e.followUpDate ? new Date(e.followUpDate).toISOString().slice(0, 10) : '',
      status: e.status,
    }
    setEditOrig(orig)
    setEditEnt({ entretienId: e.id, ...orig, loading: false, error: '' })
    setEditEntOpen(true)
  }

  const submitModifierEntretien = async () => {
    const body: Record<string, unknown> = {}
    if (editEnt.notes !== editOrig.notes) body.notes = editEnt.notes || null
    if (editEnt.recommendations !== editOrig.recommendations) body.recommendations = editEnt.recommendations || null
    if (editEnt.nextActions !== editOrig.nextActions) body.nextActions = editEnt.nextActions || null
    if (editEnt.parentNotified !== editOrig.parentNotified) body.parentNotified = editEnt.parentNotified
    if (editEnt.followUpDate !== editOrig.followUpDate) body.followUpDate = editEnt.followUpDate || null
    if (editEnt.status !== editOrig.status) body.status = editEnt.status
    if (Object.keys(body).length === 0) { setEditEntOpen(false); return }
    setEditEnt(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/entretiens/${editEnt.entretienId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) {
        if (res.status === 403) { onToast(t('orientation.insufficientPermission'), 'error'); setEditEntOpen(false); return }
        setEditEnt(f => ({ ...f, error: d.message || 'Erreur', loading: false })); return
      }
      onToast(t('orientation.interviewModified'), 'success')
      setEditEntOpen(false)
      if (selectedFiche) openFiche(selectedFiche.id)
    } catch (err) {
      setEditEnt(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  return {
    entretienOpen, setEntretienOpen, entretienForm, setEntretienForm,
    testOpen, setTestOpen, testForm, setTestForm,
    suiviOpen, setSuiviOpen, suiviForm, setSuiviForm,
    validatingReco, canEditEnt,
    editEntOpen, setEditEntOpen, editEnt, setEditEnt,
    recoOpen, setRecoOpen, recoForm, setRecoForm,
    submitEntretien, marquerRealise, submitTest, submitSuivi,
    submitReco, validerRecommandation, openEditEntretien, submitModifierEntretien,
  }
}
