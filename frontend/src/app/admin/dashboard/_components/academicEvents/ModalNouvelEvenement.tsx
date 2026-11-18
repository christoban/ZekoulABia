'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Sparkles, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import EvenementBaseAndTargetSteps from './EvenementBaseAndTargetSteps'
import EvenementConcoursAndSummarySteps from './EvenementConcoursAndSummarySteps'
import type { ClassOption, EventCategory, ModalNouvelEvenementProps, SubjectItem } from './types'

export default function ModalNouvelEvenement({
  isOpen,
  initialType,
  onClose,
  onSuccess,
  onToast,
}: ModalNouvelEvenementProps) {
  const t = useT('admin')

  const [currentStep, setCurrentStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [classes, setClasses] = useState<ClassOption[]>([])
  const [niveaux, setNiveaux] = useState<string[]>([])

  const [type, setType] = useState<string>(initialType || 'CONCOURS_ENTREE')
  const [category, setCategory] = useState<EventCategory>('FIXED_DATE')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const [level, setLevel] = useState('6e')
  const [targetClassId, setTargetClassId] = useState('')
  const [availableSeats, setAvailableSeats] = useState<number>(120)
  const [admissionThreshold, setAdmissionThreshold] = useState<number>(10)

  const [openDate, setOpenDate] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [officialExamExpectedDate, setOfficialExamExpectedDate] = useState('')

  const [subjects, setSubjects] = useState<SubjectItem[]>([
    { name: 'Français', coefficient: 2, maxScore: 20, eliminatoryScore: null },
    { name: 'Mathématiques', coefficient: 2, maxScore: 20, eliminatoryScore: null },
    { name: 'Culture Générale', coefficient: 1, maxScore: 20, eliminatoryScore: null },
  ])

  const [concoursFees, setConcoursFees] = useState(5000)
  const [requireCepForAdmission, setRequireCepForAdmission] = useState(true)
  const [docsChecklist] = useState<string[]>([
    'Acte de naissance',
    'Bulletins CM2 / Class 6',
    "Photos d'identité 4x4",
    'Certificat médical',
  ])

  const [targetRoles, setTargetRoles] = useState<string[]>(['ADMIN', 'STAFF'])

  const generateDefaultTitle = (selectedType: string) => {
    const currentYear = new Date().getFullYear()
    const anneeScolaire = `${currentYear}-${currentYear + 1}`
    if (selectedType === 'CONCOURS_ENTREE') setTitle(`Concours d'entrée en 6e — ${anneeScolaire}`)
    else if (selectedType === 'CHOIX_LV2') setTitle(`Campagne de choix LV2 4e — ${anneeScolaire}`)
    else if (selectedType === 'RENTREE_6E_5E') setTitle(`Rentrée scolaire 6e/5e — ${anneeScolaire}`)
    else if (selectedType === 'MIGRATION_BILINGUE') setTitle(`Migration section bilingue — ${anneeScolaire}`)
    else if (selectedType === 'CLOTURE_ANNEE') setTitle(`Clôture de l'année scolaire — ${anneeScolaire}`)
    else setTitle(`Événement académique — ${anneeScolaire}`)
  }

  useEffect(() => {
    if (!isOpen) return
    const selType = initialType || 'CONCOURS_ENTREE'
    setType(selType)
    generateDefaultTitle(selType)
    setTargetRoles(selType === 'CONCOURS_ENTREE' ? ['ADMIN', 'STAFF'] : ['ADMIN', 'TEACHER', 'PARENT'])
    setCurrentStep(1)
  }, [isOpen, initialType])

  useEffect(() => {
    if (!isOpen) return
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          setClasses(d.data)
          const distinctLevels = Array.from(new Set((d.data as Array<{ level?: string | null }>).map(c => c.level).filter(Boolean))) as string[]
          setNiveaux(distinctLevels)
        }
      })
      .catch(() => {})
  }, [isOpen])

  const handleTypeChange = (newType: string) => {
    setType(newType)
    generateDefaultTitle(newType)
    if (newType === 'CONCOURS_ENTREE') setTargetRoles(['ADMIN', 'STAFF'])
  }

  const toggleRole = (r: string) => {
    setTargetRoles(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]))
  }

  const isConcours = type === 'CONCOURS_ENTREE'
  const totalSteps = isConcours ? 7 : 4

  const nextStep = () => {
    if (currentStep === 1 && !title.trim()) {
      onToast(t('academicEvents.toastTitleRequired'), 'warning')
      return
    }
    if (isConcours && currentStep === 3 && category === 'FIXED_DATE' && (!openDate || !closeDate)) {
      onToast(t('academicEvents.toastDatesRequired'), 'warning')
      return
    }
    if (!isConcours && currentStep === 2 && category === 'FIXED_DATE' && (!openDate || !closeDate)) {
      onToast(t('academicEvents.toastDatesRequired'), 'warning')
      return
    }
    setCurrentStep(s => Math.min(s + 1, totalSteps))
  }

  const prevStep = () => setCurrentStep(s => Math.max(s - 1, 1))

  const addSubject = () => {
    setSubjects(prev => [...prev, { name: `Matière ${prev.length + 1}`, coefficient: 1, maxScore: 20, eliminatoryScore: null }])
  }

  const removeSubject = (index: number) => {
    setSubjects(prev => prev.filter((_, i) => i !== index))
  }

  const updateSubject = (index: number, patch: Partial<SubjectItem>) => {
    setSubjects(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const submitCreate = async () => {
    if (!title.trim()) {
      onToast(t('academicEvents.toastTitleRequired'), 'warning')
      return
    }
    if (category === 'FIXED_DATE' && (!openDate || !closeDate)) {
      onToast(t('academicEvents.toastDatesRequired'), 'warning')
      return
    }
    if (targetRoles.length === 0) {
      onToast('Veuillez sélectionner au moins un rôle à notifier', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        type,
        category,
        title,
        description: description || undefined,
        targetRoles,
        level: isConcours ? (level || '6e') : (type === 'CHOIX_LV2' ? level : undefined),
        openDate: openDate || undefined,
        closeDate: closeDate || undefined,
      }

      if (isConcours) {
        payload.concoursConfig = {
          admissionThreshold: Number(admissionThreshold) || 10,
          availableSeats: Number(availableSeats) || 120,
          requireCepForAdmission,
          officialExamExpectedDate: officialExamExpectedDate || undefined,
          targetClassId: targetClassId || undefined,
          subjects: subjects.map(s => ({
            name: s.name,
            coefficient: Number(s.coefficient) || 1,
            maxScore: Number(s.maxScore) || 20,
            eliminatoryScore: s.eliminatoryScore !== null ? Number(s.eliminatoryScore) : null,
          })),
        }
      }

      const res = await fetchApi('/api/v2/academic-events', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.message || "Erreur lors de la création de l'événement")
      }

      onToast(t('academicEvents.toastCreated'), 'success')
      onSuccess()
      onClose()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-[620px] max-w-[95vw] max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border)] shadow-2xl"
        style={{ background: 'var(--surface)', color: 'var(--text)' }}
      >
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm md:text-base font-bold" style={{ fontFamily: 'var(--font-spectral),Spectral,serif' }}>
                {t('academicEvents.newEvent')}
              </h2>
              <p className="text-[11px] text-[var(--text3)]">
                {t('academicEvents.wizard.step', { current: currentStep, total: totalSteps })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--text3)] hover:bg-[var(--bg2)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-3 pb-1 border-b border-[var(--border)] bg-[var(--bg)]/40">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
            {Array.from({ length: totalSteps }).map((_, i) => {
              const stepNum = i + 1
              const isActive = stepNum === currentStep
              const isPast = stepNum < currentStep
              return (
                <div
                  key={stepNum}
                  className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-xs'
                      : isPast
                        ? 'bg-purple-500/20 text-purple-700'
                        : 'text-[var(--text3)] bg-[var(--bg2)]'
                  }`}
                >
                  <span>{stepNum}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 text-xs md:text-sm">
          <EvenementBaseAndTargetSteps
            currentStep={currentStep}
            isConcours={isConcours}
            type={type}
            onTypeChange={handleTypeChange}
            category={category}
            setCategory={setCategory}
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            level={level}
            setLevel={setLevel}
            niveaux={niveaux}
            targetClassId={targetClassId}
            setTargetClassId={setTargetClassId}
            classes={classes}
            availableSeats={availableSeats}
            setAvailableSeats={setAvailableSeats}
            admissionThreshold={admissionThreshold}
            setAdmissionThreshold={setAdmissionThreshold}
            openDate={openDate}
            setOpenDate={setOpenDate}
            closeDate={closeDate}
            setCloseDate={setCloseDate}
            officialExamExpectedDate={officialExamExpectedDate}
            setOfficialExamExpectedDate={setOfficialExamExpectedDate}
          />
          <EvenementConcoursAndSummarySteps
            currentStep={currentStep}
            isConcours={isConcours}
            type={type}
            category={category}
            title={title}
            availableSeats={availableSeats}
            admissionThreshold={admissionThreshold}
            subjects={subjects}
            onAddSubject={addSubject}
            onRemoveSubject={removeSubject}
            onUpdateSubject={updateSubject}
            concoursFees={concoursFees}
            setConcoursFees={setConcoursFees}
            requireCepForAdmission={requireCepForAdmission}
            setRequireCepForAdmission={setRequireCepForAdmission}
            docsChecklist={docsChecklist}
            targetRoles={targetRoles}
            onToggleRole={toggleRole}
          />
        </div>

        <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="px-3 py-1.5 rounded-lg border border-[var(--border2)] text-xs font-bold text-[var(--text2)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 hover:bg-[var(--bg2)]"
          >
            <ChevronLeft size={14} /> {t('academicEvents.wizard.back')}
          </button>

          {currentStep < totalSteps ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
            >
              {t('academicEvents.wizard.next')} <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submitCreate}
              disabled={submitting}
              className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} /> {t('academicEvents.wizard.launchNow')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
