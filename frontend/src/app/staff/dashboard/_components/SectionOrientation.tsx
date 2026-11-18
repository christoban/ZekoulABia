'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import OrientationDashboardView from './orientation/OrientationDashboardView'
import OrientationFicheView from './orientation/OrientationFicheView'
import OrientationCheckpointsView from './orientation/OrientationCheckpointsView'
import {
  ModalEntretien,
  ModalModifierEntretien,
  ModalNouvelleFiche,
  ModalSuivi,
  ModalTest,
} from './orientation/OrientationFicheModals'
import {
  ModalConfigCheckpoint,
  ModalReco,
  ModalValiderCheckpoint,
} from './orientation/OrientationRecoModals'
import { useOrientationCheckpoints } from './orientation/useOrientationCheckpoints'
import { useOrientationFicheActions } from './orientation/useOrientationFicheActions'
import {
  type AcademicYear,
  type FicheDetail,
  type FicheListItem,
  type NewFicheFormState,
  type OrientationStats,
  type OrientationTab,
  type OrientationView,
  type StudentResult,
} from './orientation/orientationTypes'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const INITIAL_NEW_FICHE: NewFicheFormState = {
  studentSearch: '',
  studentResults: [],
  selectedStudent: null,
  mainConcern: '',
  loading: false,
  error: '',
}

export default function SectionOrientation({ onToast }: Props) {
  const t = useT('staff')
  const { isOnline, addToQueue } = useSyncQueue()
  const [view, setView] = useState<OrientationView>('dashboard')
  const [stats, setStats] = useState<OrientationStats | null>(null)
  const [fiches, setFiches] = useState<FicheListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [riskFilter, setRiskFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('OUVERTE')
  const [years, setYears] = useState<AcademicYear[]>([])
  const [selectedYear, setSelectedYear] = useState('')

  const [selectedFiche, setSelectedFiche] = useState<FicheDetail | null>(null)
  const [loadingFiche, setLoadingFiche] = useState(false)
  const [ficheTab, setFicheTab] = useState<OrientationTab>('entretiens')

  const [newFicheOpen, setNewFicheOpen] = useState(false)
  const [newFicheForm, setNewFicheForm] = useState<NewFicheFormState>(INITIAL_NEW_FICHE)

  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list: AcademicYear[] = ((d.data || []) as Array<{ id: string; label?: string; name?: string }>)
          .map(y => ({ id: y.id, label: y.label || y.name || y.id }))
        setYears(list)
        if (list.length > 0) setSelectedYear(list[0].id)
      })
      .catch(() => {})
  }, [])

  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const params = selectedYear ? `?academicYearId=${selectedYear}` : ''
      const res = await fetchApi(`/api/v2/orientation/stats${params}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      setStats(d.data)
    } catch { /* silencieux */ }
    finally { setLoadingStats(false) }
  }, [selectedYear])

  const fetchFiches = useCallback(async (p = 1) => {
    setLoadingList(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(p) })
      if (riskFilter) params.set('riskLevel', riskFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (selectedYear) params.set('academicYearId', selectedYear)
      const res = await fetchApi(`/api/v2/orientation/fiches?${params}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur serveur')
      setFiches(d.fiches || [])
      setTotal(d.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoadingList(false) }
  }, [riskFilter, statusFilter, selectedYear])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { setPage(1); fetchFiches(1) }, [fetchFiches])

  // Rafraîchissement temps réel quand l'assistant IA ajoute un suivi d'orientation.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'suiviOrientation') {
        fetchStats()
        fetchFiches(page)
      }
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchStats, fetchFiches, page])

  const openFiche = async (id: string) => {
    setLoadingFiche(true)
    setView('fiche')
    setFicheTab('entretiens')
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${id}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setSelectedFiche(d.data)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
      setView('dashboard')
    } finally { setLoadingFiche(false) }
  }

  const searchStudents = async (q: string, setter: (r: StudentResult[]) => void) => {
    if (q.trim().length < 2) { setter([]); return }
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
      const d = await res.json()
      setter(d.data || [])
    } catch { setter([]) }
  }

  const submitNouvelleFiche = async () => {
    if (!newFicheForm.selectedStudent) {
      setNewFicheForm(f => ({ ...f, error: t('orientation.selectStudentError') }))
      return
    }
    if (!selectedYear) {
      setNewFicheForm(f => ({ ...f, error: t('orientation.noYearError') }))
      return
    }
    const ficheStudent = newFicheForm.selectedStudent
    const payload = {
      studentId: ficheStudent.id,
      academicYearId: selectedYear,
      mainConcern: newFicheForm.mainConcern || undefined,
    }

    if (!isOnline) {
      await addToQueue({ type: 'ORIENTATION_RECORD', endpoint: '/api/v2/orientation/fiches', method: 'POST', payload })
      onToast(`${t('orientation.ficheCreated')} ${ficheStudent.firstName} ${ficheStudent.lastName} (${t('offlineQueued')})`, 'success')
      setNewFicheOpen(false)
      setNewFicheForm(INITIAL_NEW_FICHE)
      return
    }

    setNewFicheForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/orientation/fiches', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(`${t('orientation.ficheCreated')} ${ficheStudent.firstName} ${ficheStudent.lastName}`, 'success')
      setNewFicheOpen(false)
      setNewFicheForm(INITIAL_NEW_FICHE)
      fetchFiches(1)
      fetchStats()
    } catch (err) {
      setNewFicheForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const ficheActions = useOrientationFicheActions({
    selectedFiche,
    isOnline,
    addToQueue,
    openFiche,
    fetchStats,
    onToast,
    t,
  })

  const checkpoints = useOrientationCheckpoints({
    view,
    selectedFiche,
    openFiche,
    onToast,
    t,
  })

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ overflowY: 'auto', height: '100%' }}>
      {view === 'dashboard' && (
        <OrientationDashboardView
          isOnline={isOnline}
          years={years}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          riskFilter={riskFilter}
          onRiskFilterChange={setRiskFilter}
          stats={stats}
          loadingStats={loadingStats}
          fiches={fiches}
          total={total}
          page={page}
          loadingList={loadingList}
          error={error}
          onOpenCheckpoints={() => setView('checkpoints')}
          onOpenNewFiche={() => setNewFicheOpen(true)}
          onOpenFiche={openFiche}
          onPageChange={(p) => { setPage(p); fetchFiches(p) }}
        />
      )}

      {view === 'fiche' && (
        <OrientationFicheView
          loadingFiche={loadingFiche}
          selectedFiche={selectedFiche}
          ficheTab={ficheTab}
          onTabChange={setFicheTab}
          onBack={() => setView('dashboard')}
          isOnline={isOnline}
          canEditEnt={ficheActions.canEditEnt}
          validatingReco={ficheActions.validatingReco}
          proposingCheckpoint={checkpoints.proposingCheckpoint}
          onOpenEntretienModal={() => ficheActions.setEntretienOpen(true)}
          onOpenEditEntretien={ficheActions.openEditEntretien}
          onMarquerRealise={ficheActions.marquerRealise}
          onOpenTestModal={() => ficheActions.setTestOpen(true)}
          onOpenRecoModal={() => ficheActions.setRecoOpen(true)}
          onValiderReco={ficheActions.validerRecommandation}
          onOpenValiderCheckpoint={checkpoints.ouvrirValidationCheckpoint}
          onProposerAuxEleve={checkpoints.proposerAuxEleve}
          onOpenSuiviModal={() => ficheActions.setSuiviOpen(true)}
        />
      )}

      {view === 'checkpoints' && (
        <OrientationCheckpointsView
          onBack={() => setView('dashboard')}
          checkpointType={checkpoints.checkpointType}
          onCheckpointTypeChange={checkpoints.setCheckpointType}
          onOpenConfig={() => checkpoints.setConfigOpen(true)}
          loadingCheckpointConfig={checkpoints.loadingCheckpointConfig}
          checkpointConfig={checkpoints.checkpointConfig}
          loadingEleves={checkpoints.loadingEleves}
          elevesAOrienter={checkpoints.elevesAOrienter}
          generatingFor={checkpoints.generatingFor}
          onGenerateForStudent={checkpoints.genererPourEleve}
        />
      )}

      {newFicheOpen && (
        <ModalNouvelleFiche
          form={newFicheForm}
          setForm={setNewFicheForm}
          onSearchStudents={searchStudents}
          onSubmit={submitNouvelleFiche}
          onClose={() => setNewFicheOpen(false)}
        />
      )}
      {ficheActions.entretienOpen && (
        <ModalEntretien
          form={ficheActions.entretienForm}
          setForm={ficheActions.setEntretienForm}
          onSubmit={ficheActions.submitEntretien}
          onClose={() => ficheActions.setEntretienOpen(false)}
        />
      )}
      {ficheActions.editEntOpen && (
        <ModalModifierEntretien
          form={ficheActions.editEnt}
          setForm={ficheActions.setEditEnt}
          onSubmit={ficheActions.submitModifierEntretien}
          onClose={() => ficheActions.setEditEntOpen(false)}
        />
      )}
      {ficheActions.testOpen && (
        <ModalTest
          form={ficheActions.testForm}
          setForm={ficheActions.setTestForm}
          onSubmit={ficheActions.submitTest}
          onClose={() => ficheActions.setTestOpen(false)}
        />
      )}
      {ficheActions.suiviOpen && (
        <ModalSuivi
          form={ficheActions.suiviForm}
          setForm={ficheActions.setSuiviForm}
          onSubmit={ficheActions.submitSuivi}
          onClose={() => ficheActions.setSuiviOpen(false)}
        />
      )}
      {ficheActions.recoOpen && (
        <ModalReco
          form={ficheActions.recoForm}
          setForm={ficheActions.setRecoForm}
          onSubmit={ficheActions.submitReco}
          onClose={() => ficheActions.setRecoOpen(false)}
        />
      )}
      {checkpoints.configOpen && (
        <ModalConfigCheckpoint
          checkpointType={checkpoints.checkpointType}
          form={checkpoints.configForm}
          setForm={checkpoints.setConfigForm}
          onSubmit={checkpoints.submitConfigCheckpoint}
          onClose={() => checkpoints.setConfigOpen(false)}
        />
      )}
      {checkpoints.validerCheckpointOpen && (
        <ModalValiderCheckpoint
          tracks={selectedFiche?.recommandation?.suggestedTracks ?? []}
          selectedPiste={checkpoints.validerCheckpointPiste}
          onSelectPiste={checkpoints.setValiderCheckpointPiste}
          validating={checkpoints.validatingCheckpoint}
          onSubmit={checkpoints.submitValiderCheckpoint}
          onClose={() => checkpoints.setValiderCheckpointOpen(false)}
        />
      )}
    </div>
  )
}
