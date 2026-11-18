'use client'
import { useState, useCallback, useEffect } from 'react'
import { BookOpen, Plus, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import DeptNewProgrammeForm from './DeptNewProgrammeForm'
import DeptProgrammeCard from './DeptProgrammeCard'
import type { Programme, DeptSubjectOption, EditingChapitreState, TranslateFn } from './types'

interface Props {
  departementId: string
  deptSubjects: DeptSubjectOption[]
  allowedSubjectIds: Set<string>
  allowedSubjectNames: Set<string>
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  tcommon: TranslateFn
}

export default function DeptProgrammesTab({
  departementId,
  deptSubjects,
  allowedSubjectIds,
  allowedSubjectNames,
  showToast,
  tcommon,
}: Props) {
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [progLoading, setProgLoading] = useState(false)
  const [expandedProg, setExpandedProg] = useState<string | null>(null)
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([])
  const [showNewProgForm, setShowNewProgForm] = useState(false)

  const [formTitre, setFormTitre] = useState('')
  const [formSubjectId, setFormSubjectId] = useState(deptSubjects[0]?.id || '')
  const [formClassId, setFormClassId] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [savingProg, setSavingProg] = useState(false)

  const [addingChapFor, setAddingChapFor] = useState<string | null>(null)
  const [chapTitre, setChapTitre] = useState('')
  const [chapHeures, setChapHeures] = useState(2)
  const [chapSeq, setChapSeq] = useState('')
  const [savingChap, setSavingChap] = useState(false)

  const [editingChap, setEditingChap] = useState<EditingChapitreState | null>(null)
  const [savingEditChap, setSavingEditChap] = useState(false)

  const loadProgrammes = useCallback(async () => {
    setProgLoading(true)
    const cacheKey = `teacher:dept-programmes:${departementId}`
    try {
      if (navigator.onLine) {
        const res = await fetchApi('/api/v2/pedagogie/programmes', { credentials: 'include' }).then(r => r.json())
        if (res.success && Array.isArray(res.data)) {
          const all: Programme[] = res.data
          const filtered = all.filter(p => allowedSubjectIds.has(p.subject?.id) || allowedSubjectNames.has((p.subject?.name || '').toLowerCase().trim()))
          setProgrammes(filtered)
          await putCachedData(cacheKey, filtered).catch(() => {})
        }
      } else {
        const cached = await getCachedData<Programme[]>(cacheKey)
        if (cached?.data) setProgrammes(cached.data)
      }
    } catch {
      const cached = await getCachedData<Programme[]>(cacheKey)
      if (cached?.data) {
        setProgrammes(cached.data)
      } else {
        showToast('Erreur lors du chargement des programmes', 'error')
      }
    } finally {
      setProgLoading(false)
    }
  }, [departementId, allowedSubjectIds, allowedSubjectNames, showToast])

  useEffect(() => {
    loadProgrammes()
    if (navigator.onLine) {
      fetchApi('/api/v2/classes', { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (d.success && Array.isArray(d.data)) setClassesList(d.data) })
        .catch(() => {})
    } else {
      getCachedData<{ id: string; name: string }[]>('teacher:classes').then(cached => {
        if (cached?.data) setClassesList(cached.data)
      }).catch(() => {})
    }
  }, [loadProgrammes])

  useEffect(() => {
    if (deptSubjects.length > 0 && !formSubjectId) {
      setFormSubjectId(deptSubjects[0].id)
    }
  }, [deptSubjects, formSubjectId])

  const handleCreateProgramme = async () => {
    if (!formTitre.trim() || !formSubjectId) {
      showToast('Titre et matière requis', 'warning')
      return
    }
    setSavingProg(true)
    try {
      const payload = {
        titre: formTitre.trim(),
        subjectId: formSubjectId,
        classId: formClassId || undefined,
        level: formLevel || undefined,
      }
      const res = await fetchApi('/api/v2/pedagogie/programmes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        showToast('Programme créé avec succès', 'success')
        setFormTitre('')
        setFormLevel('')
        setFormClassId('')
        setShowNewProgForm(false)
        await loadProgrammes()
        if (res.data?.id) setExpandedProg(res.data.id)
      } else {
        showToast(res.message || 'Erreur lors de la création', 'error')
      }
    } catch {
      showToast('Erreur réseau lors de la création du programme', 'error')
    } finally {
      setSavingProg(false)
    }
  }

  const handleDeleteProgramme = async (id: string, titre: string) => {
    if (!(await confirmAction(`Supprimer le programme « ${titre} » et tous ses chapitres ?`))) return
    try {
      const res = await fetchApi(`/api/v2/pedagogie/programmes/${id}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json())
      if (res.success) {
        showToast('Programme supprimé', 'success')
        await loadProgrammes()
      } else {
        showToast(res.message || 'Erreur lors de la suppression', 'error')
      }
    } catch {
      showToast('Erreur réseau', 'error')
    }
  }

  const handleAddChapitre = async (programmeId: string) => {
    if (!chapTitre.trim()) {
      showToast('Titre du chapitre requis', 'warning')
      return
    }
    setSavingChap(true)
    try {
      const payload = {
        titre: chapTitre.trim(),
        volumeHeuresPrevu: chapHeures,
        sequenceCibleFin: chapSeq ? parseInt(chapSeq, 10) : undefined,
      }
      const res = await fetchApi(`/api/v2/pedagogie/programmes/${programmeId}/chapitres`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        showToast('Chapitre ajouté', 'success')
        setChapTitre('')
        setChapHeures(2)
        setChapSeq('')
        setAddingChapFor(null)
        await loadProgrammes()
      } else {
        showToast(res.message || "Erreur lors de l'ajout", 'error')
      }
    } catch {
      showToast('Erreur réseau', 'error')
    } finally {
      setSavingChap(false)
    }
  }

  const handleUpdateChapitre = async () => {
    if (!editingChap || !editingChap.titre.trim()) return
    setSavingEditChap(true)
    try {
      const payload = {
        titre: editingChap.titre.trim(),
        volumeHeuresPrevu: editingChap.volumeHeuresPrevu,
        sequenceCibleFin: editingChap.sequenceCibleFin ?? null,
      }
      const res = await fetchApi(`/api/v2/pedagogie/chapitres/${editingChap.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())

      if (res.success) {
        showToast('Chapitre mis à jour', 'success')
        setEditingChap(null)
        await loadProgrammes()
      } else {
        showToast(res.message || 'Erreur lors de la mise à jour', 'error')
      }
    } catch {
      showToast('Erreur réseau', 'error')
    } finally {
      setSavingEditChap(false)
    }
  }

  const handleDeleteChapitre = async (chapitreId: string, titre: string) => {
    if (!(await confirmAction(`Supprimer le chapitre « ${titre} » ?`))) return
    try {
      const res = await fetchApi(`/api/v2/pedagogie/chapitres/${chapitreId}`, { method: 'DELETE', credentials: 'include' }).then(r => r.json())
      if (res.success) {
        showToast('Chapitre supprimé', 'success')
        await loadProgrammes()
      } else {
        showToast(res.message || 'Erreur lors de la suppression', 'error')
      }
    } catch {
      showToast('Erreur réseau', 'error')
    }
  }

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            Programmes pédagogiques de la discipline
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
            Définissez les programmes officiels et structurez les chapitres pour les matières de votre département.
          </div>
        </div>
        <button
          onClick={() => setShowNewProgForm(p => !p)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white border-none cursor-pointer inline-flex items-center gap-1.5 transition-all"
          style={{ background: showNewProgForm ? 'var(--text3)' : 'var(--sidebar)' }}
        >
          {showNewProgForm ? <X size={13} /> : <Plus size={13} />}
          <span>{showNewProgForm ? 'Fermer' : 'Nouveau programme'}</span>
        </button>
      </div>

      {showNewProgForm && (
        <DeptNewProgrammeForm
          formTitre={formTitre}
          formSubjectId={formSubjectId}
          formLevel={formLevel}
          formClassId={formClassId}
          savingProg={savingProg}
          deptSubjects={deptSubjects}
          classesList={classesList}
          onTitreChange={setFormTitre}
          onSubjectChange={setFormSubjectId}
          onLevelChange={setFormLevel}
          onClassChange={setFormClassId}
          onSubmit={handleCreateProgramme}
        />
      )}

      {progLoading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
          {tcommon('status.loading')}
        </div>
      ) : programmes.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><BookOpen size={28} strokeWidth={1.5} color="var(--text3)" /></div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>Aucun programme pour ce département</div>
          <div style={{ fontSize: 11.5, color: 'var(--border2)', marginTop: 4 }}>
            Cliquez sur « Nouveau programme » ci-dessus pour initialiser le syllabus de votre discipline.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {programmes.map(p => (
            <DeptProgrammeCard
              key={p.id}
              programme={p}
              isExpanded={expandedProg === p.id}
              isAddingChap={addingChapFor === p.id}
              chapTitre={chapTitre}
              chapHeures={chapHeures}
              chapSeq={chapSeq}
              savingChap={savingChap}
              editingChap={editingChap}
              savingEditChap={savingEditChap}
              onToggleExpand={() => setExpandedProg(expandedProg === p.id ? null : p.id)}
              onStartAddChap={() => {
                setAddingChapFor(p.id)
                setExpandedProg(p.id)
              }}
              onCancelAddChap={() => setAddingChapFor(null)}
              onChapTitreChange={setChapTitre}
              onChapHeuresChange={setChapHeures}
              onChapSeqChange={setChapSeq}
              onAddChapitre={() => handleAddChapitre(p.id)}
              onDeleteProgramme={() => handleDeleteProgramme(p.id, p.titre)}
              onStartEditChap={setEditingChap}
              onChangeEditingChap={setEditingChap}
              onUpdateChapitre={handleUpdateChapitre}
              onCancelEditChap={() => setEditingChap(null)}
              onDeleteChapitre={handleDeleteChapitre}
            />
          ))}
        </div>
      )}
    </div>
  )
}
