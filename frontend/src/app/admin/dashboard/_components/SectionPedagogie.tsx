'use client'

import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { Circle, TrendingUp, BookOpen, WifiOff, BarChart3 } from 'lucide-react'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import type { AdminSection } from '../_types'
import PedagogieAlertesTab from './pedagogie/PedagogieAlertesTab'
import PedagogieProgressionTab from './pedagogie/PedagogieProgressionTab'
import PedagogieProgrammesTab from './pedagogie/PedagogieProgrammesTab'
import PedagogieRapportAvancementTab from './pedagogie/PedagogieRapportAvancementTab'
import InitProgrammesClasseModal from './pedagogie/InitProgrammesClasseModal'
import InitProgrammesEcoleModal from './pedagogie/InitProgrammesEcoleModal'
import SyncProgrammesNationauxModal, { type DeriveProgrammeSummary } from './pedagogie/SyncProgrammesNationauxModal'
import type { Alerte, Classe, OnToast, Programme, ProgressionData, Subject, Tab } from './pedagogie/types'

interface Props {
  onToast: OnToast
  onNav?: (section: AdminSection) => void
}

export default function SectionPedagogie({ onToast, onNav }: Props) {
  const t = useT('admin')
  const [tab, setTab] = useState<Tab>('alertes')
  const { isOnline, addToQueue } = useSyncQueue()

  // Data
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [loading, setLoading] = useState(false)

  // Prog form
  const [formTitre, setFormTitre] = useState('')
  const [formSubjectId, setFormSubjectId] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedProg, setExpandedProg] = useState<string | null>(null)

  // Chapitre form
  const [chapTitre, setChapTitre] = useState('')
  const [chapHeures, setChapHeures] = useState(2)
  const [chapSeq, setChapSeq] = useState('')
  const [addingChapFor, setAddingChapFor] = useState<string | null>(null)

  // Progression
  const [progClassId, setProgClassId] = useState('')
  const [progSubjectId, setProgSubjectId] = useState('')
  const [progressionData, setProgressionData] = useState<ProgressionData | null>(null)
  const [loadingProg, setLoadingProg] = useState(false)
  const [materialisationEnabled, setMaterialisationEnabled] = useState(false)
  const [initModalOpen, setInitModalOpen] = useState(false)
  const [initEcoleModalOpen, setInitEcoleModalOpen] = useState(false)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [derives, setDerives] = useState<DeriveProgrammeSummary[]>([])

  useEffect(() => {
    // 1. Lire d'abord le cache local Dexie
    getCachedData<Subject[]>('admin:subjects').then(c => {
      if (c?.data && Array.isArray(c.data)) setSubjects(c.data)
    }).catch(() => {})

    getCachedData<Classe[]>('admin:classes').then(async c => {
      let list = c?.data
      if (!list || !Array.isArray(list) || list.length === 0) {
        const fallback = await getCachedData<Classe[]>('staff:classes').catch(() => null)
        list = fallback?.data
      }
      if (list && Array.isArray(list)) setClasses(list)
    }).catch(() => {})

    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    Promise.all([
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/pedagogie/materialisation/status', { credentials: 'include' })
        .then(r => r.json())
        .catch(() => ({ success: false })),
    ]).then(([subs, cls, matStatus]) => {
      if (subs.success && Array.isArray(subs.data)) {
        setSubjects(subs.data)
        putCachedData('admin:subjects', subs.data).catch(() => {})
      }
      if (cls.success && Array.isArray(cls.data)) {
        setClasses(cls.data)
        putCachedData('admin:classes', cls.data).catch(() => {})
      }
      if (matStatus?.success && matStatus.data?.enabled === true) {
        setMaterialisationEnabled(true)
        fetchApi('/api/v2/pedagogie/programmes/derives', { credentials: 'include' })
          .then(r => r.json())
          .then(d => {
            if (d.success && Array.isArray(d.data?.derives)) {
              setDerives(d.data.derives as DeriveProgrammeSummary[])
            }
          })
          .catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const loadProgrammes = async () => {
    const cached = await getCachedData<Programme[]>('admin:pedagogie:programmes').catch(() => null)
    if (cached?.data && Array.isArray(cached.data)) {
      setProgrammes(cached.data)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    setLoading(true)
    fetchApi('/api/v2/pedagogie/programmes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setProgrammes(d.data)
          putCachedData('admin:pedagogie:programmes', d.data).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadAlertes = async () => {
    const cached = await getCachedData<Alerte[]>('admin:pedagogie:alertes').catch(() => null)
    if (cached?.data && Array.isArray(cached.data)) {
      setAlertes(cached.data)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    setLoading(true)
    fetchApi('/api/v2/pedagogie/alertes-retard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setAlertes(d.data)
          putCachedData('admin:pedagogie:alertes', d.data).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (tab === 'programmes') loadProgrammes()
    if (tab === 'alertes') loadAlertes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleCreateProgramme = async () => {
    if (!formTitre.trim() || !formSubjectId) { onToast('Titre et matière requis', 'error'); return }

    const payload = { titre: formTitre.trim(), subjectId: formSubjectId, classId: formClassId || undefined, level: formLevel || undefined }

    if (!isOnline) {
      await addToQueue({ type: 'PEDAGOGY_PROGRAM', endpoint: '/api/v2/pedagogie/programmes', method: 'POST', payload })
      onToast('Programme mis en file d\'attente — synchronisation à la reconnexion', 'success')
      setFormTitre(''); setFormSubjectId(''); setFormClassId(''); setFormLevel('')
      return
    }

    setSaving(true)
    try {
      const r = await fetchApi('/api/v2/pedagogie/programmes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (d.success) {
        onToast('Programme créé', 'success')
        setFormTitre(''); setFormSubjectId(''); setFormClassId(''); setFormLevel('')
        loadProgrammes()
      } else onToast(d.message ?? 'Erreur', 'error')
    } catch { onToast('Erreur réseau', 'error') }
    finally { setSaving(false) }
  }

  const handleDeleteProgramme = async (id: string) => {
    if (!(await confirmAction('Supprimer ce programme et tous ses chapitres ?'))) return
    const r = await fetchApi(`/api/v2/pedagogie/programmes/${id}`, { method: 'DELETE', credentials: 'include' })
    const d = await r.json()
    if (d.success) { onToast('Programme supprimé', 'success'); loadProgrammes() }
    else onToast(d.message ?? 'Erreur', 'error')
  }

  const handleAddChapitre = async (programmeId: string) => {
    if (!chapTitre.trim()) { onToast('Titre du chapitre requis', 'error'); return }

    const payload = { titre: chapTitre.trim(), volumeHeuresPrevu: chapHeures, sequenceCibleFin: chapSeq ? parseInt(chapSeq) : undefined }

    if (!isOnline) {
      await addToQueue({ type: 'PEDAGOGY_PROGRAM', endpoint: `/api/v2/pedagogie/programmes/${programmeId}/chapitres`, method: 'POST', payload })
      onToast('Chapitre mis en file d\'attente — synchronisation à la reconnexion', 'success')
      setChapTitre(''); setChapHeures(2); setChapSeq(''); setAddingChapFor(null)
      return
    }

    const r = await fetchApi(`/api/v2/pedagogie/programmes/${programmeId}/chapitres`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    if (d.success) {
      onToast('Chapitre ajouté', 'success')
      setChapTitre(''); setChapHeures(2); setChapSeq(''); setAddingChapFor(null)
      loadProgrammes()
    } else onToast(d.message ?? 'Erreur', 'error')
  }

  const handleDeleteChapitre = async (id: string) => {
    const r = await fetchApi(`/api/v2/pedagogie/chapitres/${id}`, { method: 'DELETE', credentials: 'include' })
    const d = await r.json()
    if (d.success) { onToast('Chapitre supprimé', 'success'); loadProgrammes() }
    else onToast(d.message ?? 'Erreur', 'error')
  }

  const loadProgression = async () => {
    if (!progClassId || !progSubjectId) return
    const cacheKey = `admin:pedagogie:progression:${progClassId}:${progSubjectId}`
    const cached = await getCachedData<ProgressionData>(cacheKey).catch(() => null)
    if (cached?.data) {
      setProgressionData(cached.data)
      setLoadingProg(false)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoadingProg(false)
      return
    }

    setLoadingProg(true)
    fetchApi(`/api/v2/pedagogie/progression?classId=${progClassId}&subjectId=${progSubjectId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProgressionData(d.data)
          putCachedData(cacheKey, d.data).catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProg(false))
  }

  const tabBtn = (tabKey: Tab, label: React.ReactNode) => (
    <button onClick={() => setTab(tabKey)}
      className="flex-1 md:flex-none text-xs md:text-sm px-3 md:px-4 py-2 md:py-1.5 rounded-lg"
      style={{ fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === tabKey ? 'var(--sidebar)' : 'var(--bg2)', color: tab === tabKey ? 'white' : 'var(--text2)', transition: 'all 0.15s' }}>
      {label}
    </button>
  )

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5 space-y-4 max-w-7xl mx-auto pb-12 font-nunito">
      <div className="pb-1.5 border-b border-[var(--border)]">
        <h1 className="text-[15px] md:text-[17px] font-bold font-spectral" style={{ color: 'var(--text)' }}>
          {t('pedagogie.title')}
        </h1>
        <p className="text-[11px] md:text-[12px] font-medium mt-0.5" style={{ color: 'var(--text3)' }}>
          Programmes, cahiers de texte et suivi des progressions
        </p>
      </div>

      <DelegationSupervisionBanner actorTitle="Animateur Pédagogique" domainLabel="Suivi Pédagogique & Avancement des Programmes" onNav={onNav} />

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>Mode hors-ligne — les nouveaux programmes/chapitres seront synchronisés à la reconnexion</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabBtn('alertes', <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Circle size={8} fill="var(--red)" stroke="none" /> Alertes retard</span>)}
        {tabBtn('progression', <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={14} strokeWidth={2} /> Progression</span>)}
        {tabBtn('programmes', <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><BookOpen size={14} strokeWidth={2} /> Programmes</span>)}
        {materialisationEnabled && tabBtn('rapports', <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><BarChart3 size={14} strokeWidth={2} /> Synthèse</span>)}
      </div>

      {tab === 'alertes' && (
        <PedagogieAlertesTab
          loading={loading}
          alertes={alertes}
          onRefresh={loadAlertes}
          onToast={onToast}
          onOpenProgramme={(programmeId) => { setTab('programmes'); setExpandedProg(programmeId) }}
        />
      )}

      {tab === 'progression' && (
        <PedagogieProgressionTab
          classes={classes}
          subjects={subjects}
          progClassId={progClassId}
          progSubjectId={progSubjectId}
          progressionData={progressionData}
          loadingProg={loadingProg}
          onChangeClass={setProgClassId}
          onChangeSubject={setProgSubjectId}
          onLoadProgression={loadProgression}
        />
      )}

      {tab === 'programmes' && (
        <PedagogieProgrammesTab
          programmes={programmes}
          subjects={subjects}
          classes={classes}
          loading={loading}
          saving={saving}
          materialisationEnabled={materialisationEnabled}
          derivesCount={derives.length}
          onOpenInitModal={() => setInitModalOpen(true)}
          onOpenInitEcoleModal={() => setInitEcoleModalOpen(true)}
          onOpenSyncModal={() => setSyncModalOpen(true)}
          formTitre={formTitre}
          formSubjectId={formSubjectId}
          formClassId={formClassId}
          formLevel={formLevel}
          expandedProg={expandedProg}
          addingChapFor={addingChapFor}
          chapTitre={chapTitre}
          chapHeures={chapHeures}
          chapSeq={chapSeq}
          onChangeFormTitre={setFormTitre}
          onChangeFormSubjectId={setFormSubjectId}
          onChangeFormClassId={setFormClassId}
          onChangeFormLevel={setFormLevel}
          onToggleExpandProg={(id) => setExpandedProg(expandedProg === id ? null : id)}
          onSetAddingChapFor={setAddingChapFor}
          onChangeChapTitre={setChapTitre}
          onChangeChapHeures={setChapHeures}
          onChangeChapSeq={setChapSeq}
          onCreateProgramme={handleCreateProgramme}
          onDeleteProgramme={handleDeleteProgramme}
          onAddChapitre={handleAddChapitre}
          onDeleteChapitre={handleDeleteChapitre}
        />
      )}

      {tab === 'rapports' && materialisationEnabled && (
        <PedagogieRapportAvancementTab onToast={onToast} />
      )}

      <InitProgrammesClasseModal
        open={initModalOpen}
        classes={classes}
        initialClassId={formClassId || progClassId || undefined}
        onClose={() => setInitModalOpen(false)}
        onApplied={loadProgrammes}
        onToast={onToast}
      />

      <InitProgrammesEcoleModal
        open={initEcoleModalOpen}
        onClose={() => setInitEcoleModalOpen(false)}
        onApplied={() => {
          loadProgrammes()
          fetchApi('/api/v2/pedagogie/programmes/derives', { credentials: 'include' })
            .then(r => r.json())
            .then(d => { if (d.success && Array.isArray(d.data?.derives)) setDerives(d.data.derives as DeriveProgrammeSummary[]) })
            .catch(() => {})
        }}
        onToast={onToast}
      />

      <SyncProgrammesNationauxModal
        open={syncModalOpen}
        derives={derives}
        onClose={() => setSyncModalOpen(false)}
        onSynced={() => {
          loadProgrammes()
          fetchApi('/api/v2/pedagogie/programmes/derives', { credentials: 'include' })
            .then(r => r.json())
            .then(d => { if (d.success && Array.isArray(d.data?.derives)) setDerives(d.data.derives as DeriveProgrammeSummary[]) })
            .catch(() => {})
        }}
        onToast={onToast}
      />
    </div>
  )
}
