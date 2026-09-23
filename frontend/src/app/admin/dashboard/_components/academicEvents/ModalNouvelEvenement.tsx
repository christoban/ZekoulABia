'use client'
import { useState, useEffect } from 'react'
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Calendar,
  Layers,
  GraduationCap,
  Users,
  FileText,
  DollarSign,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  isOpen: boolean
  initialType?: string
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface SubjectItem {
  name: string
  coefficient: number
  maxScore: number
  eliminatoryScore: number | null
}

const EVENT_TYPES = [
  'CONCOURS_ENTREE',
  'CHOIX_LV2',
  'RENTREE_6E_5E',
  'MIGRATION_BILINGUE',
  'CLOTURE_ANNEE',
  'AUTRE',
] as const

const ALL_ROLES = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'] as const

export default function ModalNouvelEvenement({
  isOpen,
  initialType,
  onClose,
  onSuccess,
  onToast,
}: Props) {
  const t = useT('admin')

  const [currentStep, setCurrentStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  // Classes & Niveaux de l'école
  const [classes, setClasses] = useState<{ id: string; name: string; level: string }[]>([])
  const [niveaux, setNiveaux] = useState<string[]>([])

  // Étape 1 : Type & Base
  const [type, setType] = useState<string>(initialType || 'CONCOURS_ENTREE')
  const [category, setCategory] = useState<'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW'>('FIXED_DATE')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // Étape 2 : Cibles Concours / LV2
  const [level, setLevel] = useState('6e')
  const [targetClassId, setTargetClassId] = useState('')
  const [availableSeats, setAvailableSeats] = useState<number>(120)
  const [admissionThreshold, setAdmissionThreshold] = useState<number>(10)

  // Étape 3 : Calendrier (datetime-local format: YYYY-MM-DDTHH:mm)
  const [openDate, setOpenDate] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [officialExamExpectedDate, setOfficialExamExpectedDate] = useState('')

  // Étape 4 : Épreuves (pour concours)
  const [subjects, setSubjects] = useState<SubjectItem[]>([
    { name: 'Français', coefficient: 2, maxScore: 20, eliminatoryScore: null },
    { name: 'Mathématiques', coefficient: 2, maxScore: 20, eliminatoryScore: null },
    { name: 'Culture Générale', coefficient: 1, maxScore: 20, eliminatoryScore: null },
  ])

  // Étape 5 : Frais & Pièces (pour concours)
  const [concoursFees, setConcoursFees] = useState(5000)
  const [requireCepForAdmission, setRequireCepForAdmission] = useState(true)
  const [docsChecklist, setDocsChecklist] = useState<string[]>([
    'Acte de naissance',
    'Bulletins CM2 / Class 6',
    'Photos d\'identité 4x4',
    'Certificat médical',
  ])

  // Étape 6 : Notifications
  const [targetRoles, setTargetRoles] = useState<string[]>(['ADMIN', 'STAFF'])

  // Initialisation à l'ouverture
  useEffect(() => {
    if (!isOpen) return
    const selType = initialType || 'CONCOURS_ENTREE'
    setType(selType)
    generateDefaultTitle(selType)
    if (selType === 'CONCOURS_ENTREE') {
      setTargetRoles(['ADMIN', 'STAFF'])
    } else {
      setTargetRoles(['ADMIN', 'TEACHER', 'PARENT'])
    }
    setCurrentStep(1)
  }, [isOpen, initialType])

  // Charger les classes réelles
  useEffect(() => {
    if (!isOpen) return
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setClasses(d.data)
          const distinctLevels = Array.from(new Set(d.data.map((c: any) => c.level).filter(Boolean))) as string[]
          setNiveaux(distinctLevels)
        }
      })
      .catch(() => {})
  }, [isOpen])

  const generateDefaultTitle = (selectedType: string) => {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const anneeScolaire = `${currentYear}-${nextYear}`
    if (selectedType === 'CONCOURS_ENTREE') {
      setTitle(`Concours d'entrée en 6e — ${anneeScolaire}`)
    } else if (selectedType === 'CHOIX_LV2') {
      setTitle(`Campagne de choix LV2 4e — ${anneeScolaire}`)
    } else if (selectedType === 'RENTREE_6E_5E') {
      setTitle(`Rentrée scolaire 6e/5e — ${anneeScolaire}`)
    } else if (selectedType === 'MIGRATION_BILINGUE') {
      setTitle(`Migration section bilingue — ${anneeScolaire}`)
    } else if (selectedType === 'CLOTURE_ANNEE') {
      setTitle(`Clôture de l'année scolaire — ${anneeScolaire}`)
    } else {
      setTitle(`Événement académique — ${anneeScolaire}`)
    }
  }

  const handleTypeChange = (newType: string) => {
    setType(newType)
    generateDefaultTitle(newType)
    if (newType === 'CONCOURS_ENTREE') {
      setTargetRoles(['ADMIN', 'STAFF'])
    }
  }

  const toggleRole = (r: string) => {
    setTargetRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    )
  }

  // Navigation dans les étapes
  const isConcours = type === 'CONCOURS_ENTREE'
  const totalSteps = isConcours ? 7 : 4

  const nextStep = () => {
    if (currentStep === 1) {
      if (!title.trim()) {
        onToast(t('academicEvents.toastTitleRequired'), 'warning')
        return
      }
    }
    if (isConcours) {
      if (currentStep === 3) {
        if (category === 'FIXED_DATE' && (!openDate || !closeDate)) {
          onToast(t('academicEvents.toastDatesRequired'), 'warning')
          return
        }
      }
    } else {
      // Non-concours
      if (currentStep === 2) {
        // Calendrier
        if (category === 'FIXED_DATE' && (!openDate || !closeDate)) {
          onToast(t('academicEvents.toastDatesRequired'), 'warning')
          return
        }
      }
    }
    setCurrentStep((s) => Math.min(s + 1, totalSteps))
  }

  const prevStep = () => {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }

  const addSubject = () => {
    setSubjects((prev) => [
      ...prev,
      { name: `Matière ${prev.length + 1}`, coefficient: 1, maxScore: 20, eliminatoryScore: null },
    ])
  }

  const removeSubject = (index: number) => {
    setSubjects((prev) => prev.filter((_, i) => i !== index))
  }

  const updateSubject = (index: number, patch: Partial<SubjectItem>) => {
    setSubjects((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    )
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
      const payload: Record<string, any> = {
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
          subjects: subjects.map((s) => ({
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
        throw new Error(data.message || 'Erreur lors de la création de l\'événement')
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
        onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-w-[95vw] max-h-[90vh] flex flex-col rounded-2xl border border-[var(--border)] shadow-2xl"
        style={{ background: 'var(--surface)', color: 'var(--text)' }}
      >
        {/* Header */}
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
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text3)] hover:bg-[var(--bg2)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stepper Bar */}
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs md:text-sm">
          {/* Étape 1 : Type & Titre */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.formType')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EVENT_TYPES.map((ty) => (
                    <button
                      key={ty}
                      type="button"
                      onClick={() => handleTypeChange(ty)}
                      className={`text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                        type === ty
                          ? 'border-purple-600 bg-purple-500/10 text-purple-700 font-bold'
                          : 'border-[var(--border)] hover:bg-[var(--bg2)] text-[var(--text)]'
                      }`}
                    >
                      <span className="text-xs">{t(`academicEvents.type.${ty}`)}</span>
                      {ty === 'CONCOURS_ENTREE' && (
                        <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-purple-600 text-white font-bold">
                          Standard
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.formTitle')} *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('academicEvents.formTitlePlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.formCategory')}
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                >
                  <option value="FIXED_DATE">{t('academicEvents.category.FIXED_DATE')}</option>
                  <option value="MANUAL_TRIGGER">{t('academicEvents.category.MANUAL_TRIGGER')}</option>
                  <option value="SLIDING_WINDOW">{t('academicEvents.category.SLIDING_WINDOW')}</option>
                </select>
                <p className="text-[10.5px] text-[var(--text3)] mt-1">
                  {t(`academicEvents.categoryHint.${category}`)}
                </p>
              </div>

              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.formDescription')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* Étape 2 : Cibles Concours (si CONCOURS_ENTREE) */}
          {isConcours && currentStep === 2 && (
            <div className="flex flex-col gap-3.5">
              <div className="p-3 rounded-xl border border-purple-500/20 bg-purple-500/5 text-xs text-[var(--text)]">
                <p className="font-bold text-xs text-purple-700 mb-0.5">Configuration des cibles du concours</p>
                <p className="text-[11px] text-[var(--text2)]">
                  Le concours s'adresse principalement aux élèves entrant en 6e. Les admis rejoindront la voie concours sans validation supplémentaire de la direction.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                    {t('academicEvents.wizard.targetLevel')}
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                  >
                    <option value="6e">6e (Par défaut)</option>
                    {niveaux.filter((n) => n !== '6e').map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                    {t('academicEvents.wizard.targetClass')}
                  </label>
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                  >
                    <option value="">{t('academicEvents.wizard.selectClassPlaceholder')}</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.level})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                    {t('academicEvents.wizard.availableSeats')}
                  </label>
                  <input
                    type="number"
                    value={availableSeats}
                    onChange={(e) => setAvailableSeats(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                    placeholder="120"
                  />
                </div>

                <div>
                  <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                    {t('academicEvents.wizard.admissionThreshold')}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={admissionThreshold}
                    onChange={(e) => setAdmissionThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                    placeholder="10.0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Étape 3 : Calendrier */}
          {((isConcours && currentStep === 3) || (!isConcours && currentStep === 2)) && (
            <div className="flex flex-col gap-3.5">
              <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-[var(--text)]">
                <p className="font-bold text-xs text-blue-700 mb-0.5">Calendrier avec heures précises</p>
                <p className="text-[11px] text-[var(--text2)]">
                  Définissez les dates et heures de début et de fin. La session liée synchronisera sa période d'inscription.
                </p>
              </div>

              {category !== 'MANUAL_TRIGGER' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                      {t('academicEvents.formOpenDate')} *
                    </label>
                    <input
                      type="datetime-local"
                      value={openDate}
                      onChange={(e) => setOpenDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                      {t('academicEvents.formCloseDate')} *
                    </label>
                    <input
                      type="datetime-local"
                      value={closeDate}
                      onChange={(e) => setCloseDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                    />
                  </div>
                </div>
              )}

              {isConcours && (
                <div>
                  <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                    {t('academicEvents.wizard.officialExamDate')}
                  </label>
                  <input
                    type="date"
                    value={officialExamExpectedDate}
                    onChange={(e) => setOfficialExamExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                  />
                  <p className="text-[10.5px] text-[var(--text3)] mt-1">
                    Date estimée de proclamation des résultats nationaux pour rappel de vérification.
                  </p>
                </div>
              )}

              {!isConcours && type === 'CHOIX_LV2' && (
                <div>
                  <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                    {t('academicEvents.formLevel')} *
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                  >
                    <option value="">{t('academicEvents.formLevelPlaceholder')}</option>
                    {niveaux.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Étape 4 : Épreuves (si CONCOURS_ENTREE) */}
          {isConcours && currentStep === 4 && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-[var(--text)]">
                    {t('academicEvents.wizard.subjectsTitle')}
                  </p>
                  <p className="text-[11px] text-[var(--text3)]">
                    Matières soumises à notation avec coefficients et barèmes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSubject}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-purple-700"
                >
                  <Plus size={13} /> {t('academicEvents.wizard.addSubject')}
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {subjects.map((sub, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg)]/50 flex flex-wrap items-center gap-2"
                  >
                    <div className="flex-1 min-w-[130px]">
                      <input
                        value={sub.name}
                        onChange={(e) => updateSubject(idx, { name: e.target.value })}
                        className="w-full px-2 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-xs font-bold text-[var(--text)] outline-none"
                        placeholder="Matière"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[var(--text3)]">Coef.</span>
                      <input
                        type="number"
                        min="1"
                        value={sub.coefficient}
                        onChange={(e) => updateSubject(idx, { coefficient: Number(e.target.value) || 1 })}
                        className="w-12 px-1.5 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-xs text-center text-[var(--text)] outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[var(--text3)]">Max</span>
                      <input
                        type="number"
                        min="1"
                        value={sub.maxScore}
                        onChange={(e) => updateSubject(idx, { maxScore: Number(e.target.value) || 20 })}
                        className="w-12 px-1.5 py-1 rounded-md border border-[var(--border2)] bg-[var(--bg2)] text-xs text-center text-[var(--text)] outline-none"
                      />
                    </div>
                    {subjects.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSubject(idx)}
                        className="p-1 text-red-500 hover:bg-red-500/10 rounded-md"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Étape 5 : Frais & Pièces (si CONCOURS_ENTREE) */}
          {isConcours && currentStep === 5 && (
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.wizard.concoursFees')}
                </label>
                <input
                  type="number"
                  value={concoursFees}
                  onChange={(e) => setConcoursFees(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] text-xs text-[var(--text)] outline-none"
                  placeholder="5000"
                />
              </div>

              <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--bg2)]/60">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireCepForAdmission}
                    onChange={(e) => setRequireCepForAdmission(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-xs text-[var(--text)] block">
                      {t('academicEvents.wizard.requireCep')}
                    </span>
                    <span className="text-[10.5px] text-[var(--text3)] block mt-0.5">
                      {t('academicEvents.wizard.requireCepHint')}
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.wizard.requiredDocs')}
                </label>
                <div className="flex flex-col gap-1.5">
                  {docsChecklist.map((doc, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 text-xs flex items-center justify-between"
                    >
                      <span>{doc}</span>
                      <CheckCircle2 size={14} className="text-success" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Étape 6 (ou 3 pour non-concours) : Notifications */}
          {((isConcours && currentStep === 6) || (!isConcours && currentStep === 3)) && (
            <div className="flex flex-col gap-3.5">
              <div>
                <label className="font-bold text-[11.5px] text-[var(--text2)] block mb-1">
                  {t('academicEvents.formRoles')}
                </label>
                <p className="text-[11px] text-[var(--text3)] mb-3">
                  {isConcours
                    ? t('academicEvents.wizard.rolesHint')
                    : 'Sélectionnez les personnes de l\'établissement informées par la cloche in-app.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_ROLES.map((r) => {
                    const isSelected = targetRoles.includes(r)
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-purple-600 bg-purple-500/10 text-purple-700 font-bold'
                            : 'border-[var(--border)] hover:bg-[var(--bg2)] text-[var(--text2)]'
                        }`}
                      >
                        <span className="text-xs">{t(`academicEvents.roleNames.${r}`) ?? r}</span>
                        {isSelected && <CheckCircle2 size={15} />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Étape 7 (ou 4 pour non-concours) : Récapitulatif */}
          {((isConcours && currentStep === 7) || (!isConcours && currentStep === 4)) && (
            <div className="flex flex-col gap-3">
              <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5">
                <h4 className="font-bold text-xs text-purple-700 mb-2">
                  {t('academicEvents.wizard.summaryTitle')}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10.5px] text-[var(--text3)] block">Type</span>
                    <span className="font-bold">{t(`academicEvents.type.${type}`)}</span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-[var(--text3)] block">Mode</span>
                    <span className="font-bold">{t(`academicEvents.category.${category}`)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10.5px] text-[var(--text3)] block">Titre</span>
                    <span className="font-bold">{title}</span>
                  </div>
                  {isConcours && (
                    <>
                      <div>
                        <span className="text-[10.5px] text-[var(--text3)] block">Places</span>
                        <span className="font-bold">{availableSeats}</span>
                      </div>
                      <div>
                        <span className="text-[10.5px] text-[var(--text3)] block">Seuil</span>
                        <span className="font-bold">{admissionThreshold} / 20</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10.5px] text-[var(--text3)] block">Épreuves</span>
                        <span className="font-bold">
                          {subjects.map((s) => `${s.name} (×${s.coefficient})`).join(', ')}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <span className="text-[10.5px] text-[var(--text3)] block">Rôles notifiés</span>
                    <span className="font-bold">
                      {targetRoles.map((r) => t(`academicEvents.roleNames.${r}`) ?? r).join(', ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
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
