'use client'

import { useState, useEffect } from 'react'
import {
  X, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck,
  CalendarClock, Sparkles, RefreshCw, Layers
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface AcademicYear {
  id: string
  name: string
  isCurrent: boolean
  status: string
  startDate?: string
  endDate?: string
}

interface PreCloseCheckResult {
  readyToClose: boolean
  warnings: string[]
  unclosedPeriods: number
  unvalidatedBulletins: number
}

export default function ClotureAnneeModal({ isOpen, onClose, onSuccess, onToast }: Props) {
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null)
  const [preCloseCheck, setPreCloseCheck] = useState<PreCloseCheckResult | null>(null)
  
  // Année N+1 proposée
  const [candidateName, setCandidateName] = useState('')
  const [candidateStartDate, setCandidateStartDate] = useState('')
  const [candidateEndDate, setCandidateEndDate] = useState('')
  
  const [proposedClassesCount, setProposedClassesCount] = useState<number | null>(null)
  const [nextYearId, setNextYearId] = useState<string | null>(null)

  const [step, setStep] = useState<'CHECK' | 'PROPOSE' | 'VALIDATE'>('CHECK')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    async function initClotureWorkflow() {
      try {
        setLoading(true)
        setError(null)

        // 1. Récupérer l'année courante
        const resYears = await fetchApi('/api/v2/academic-years', { credentials: 'include' })
        const dataYears = await resYears.json()
        const years: AcademicYear[] = dataYears.data || []
        let current = years.find(y => y.isCurrent) || years[0] || null

        const now = new Date()
        const currentYearNum = now.getFullYear()
        const month = now.getMonth() // 0-indexed (8 = Septembre)
        const startYear = month >= 7 ? currentYearNum : currentYearNum - 1
        const endYear = startYear + 1

        if (!current) {
          // Si aucune année n'existe en BD (base de test ou onboarding initial),
          // le système déduit automatiquement l'année en cours basée sur la date système.
          const inferredCurrent: AcademicYear = {
            id: 'inferred-current',
            name: `${startYear}-${endYear}`,
            isCurrent: true,
            status: 'ACTIVE',
            startDate: `${startYear}-09-01`,
            endDate: `${endYear}-06-30`,
          }
          current = inferredCurrent
        }

        if (isMounted) setCurrentYear(current)

        // Pre-calculer le nom N+1
        const match = current.name.match(/(\d{4})[^\d]*(\d{4})/)
        if (match) {
          const y1 = parseInt(match[1], 10) + 1
          const y2 = parseInt(match[2], 10) + 1
          setCandidateName(`${y1}-${y2}`)
        } else {
          setCandidateName(`${current.name} (N+1)`)
        }

        if (current.startDate) {
          const s = new Date(current.startDate)
          s.setFullYear(s.getFullYear() + 1)
          setCandidateStartDate(s.toISOString().slice(0, 10))
        } else {
          setCandidateStartDate(`${startYear + 1}-09-01`)
        }

        if (current.endDate) {
          const e = new Date(current.endDate)
          e.setFullYear(e.getFullYear() + 1)
          setCandidateEndDate(e.toISOString().slice(0, 10))
        } else {
          setCandidateEndDate(`${endYear + 1}-06-30`)
        }

        // 2. Pre-close check
        const checkRes = await fetchApi(`/api/v2/academic-years/${current.id}/pre-close-check`, {
          method: 'POST',
          credentials: 'include',
        })
        const checkData = await checkRes.json()
        if (isMounted && checkRes.ok) {
          setPreCloseCheck(checkData.data || { readyToClose: true, warnings: [], unclosedPeriods: 0, unvalidatedBulletins: 0 })
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Erreur d\'initialisation du diagnostic de clôture')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initClotureWorkflow()
    return () => { isMounted = false }
  }, [isOpen])

  if (!isOpen) return null

  // Étape 2: Générer la proposition N+1
  const handleGenerateProposal = async () => {
    if (!currentYear) return
    setSubmitting(true)
    setError(null)

    try {
      // a. Créer l'année N+1 si elle n'existe pas déjà
      let targetId = nextYearId
      if (!targetId) {
        const createRes = await fetchApi('/api/v2/academic-years', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: candidateName.trim(),
            startDate: candidateStartDate,
            endDate: candidateEndDate,
          }),
        })
        const createData = await createRes.json()
        if (!createRes.ok) throw new Error(createData.message || "Impossible de créer l'année cible N+1")
        targetId = createData.data?.anneeId || createData.data?.id
        setNextYearId(targetId)
      }

      // b. Proposer la structure
      if (targetId) {
        const propRes = await fetchApi(`/api/v2/academic-years/${currentYear.id}/propose-next-structure`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ anneeSuivanteId: targetId }),
        })
        const propData = await propRes.json()
        if (!propRes.ok) throw new Error(propData.message || "Erreur de génération de la structure N+1")
        setProposedClassesCount(propData.data?.classesProposees?.length || 0)
      }

      setStep('PROPOSE')
    } catch (err: any) {
      setError(err.message || "Erreur lors de la préparation de la structure N+1")
    } finally {
      setSubmitting(false)
    }
  }

  // Étape 3: Valider et Appliquer la clôture + activation N+1
  const handleApplyClotureAndActivation = async () => {
    if (!currentYear || !nextYearId) return
    setSubmitting(true)
    setError(null)

    try {
      // 1. Clôturer l'année N (si elle existe en base de données)
      if (currentYear.id !== 'inferred-current') {
        const closeRes = await fetchApi(`/api/v2/academic-years/${currentYear.id}/close`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!closeRes.ok) {
          const closeData = await closeRes.json()
          throw new Error(closeData.message || "Erreur lors de la clôture de l'année active")
        }
      }

      // 2. Valider la structure N+1 (passage de DRAFT à ACTIVE)
      const valRes = await fetchApi(`/api/v2/academic-years/${nextYearId}/validate-structure`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!valRes.ok) {
        const valData = await valRes.json()
        throw new Error(valData.message || "Erreur lors de la validation des classes N+1")
      }

      onToast?.(`Clôture de l'année ${currentYear.name} effectuée & Année ${candidateName} activée avec succès !`, 'success')
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'application de la clôture N+1")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] font-nunito"
        style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}
      >
        {/* Header Modal */}
        <div
          className="p-5 border-b flex items-center justify-between"
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>
              <CalendarClock size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border" style={{ background: 'var(--amber-light)', color: 'var(--amber)', borderColor: 'var(--amber)' }}>
                  Pattern Propose / Apply
                </span>
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                  Workflow Guidé de Transition
                </span>
              </div>
              <h2 className="text-lg font-bold font-spectral" style={{ color: 'var(--text)' }}>
                Clôture d'Année & Transition vers l'Année N+1
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors cursor-pointer border-none bg-transparent"
            style={{ color: 'var(--text2)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps de la Modal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="animate-spin mx-auto text-amber-500" size={32} />
              <p className="text-sm font-medium" style={{ color: 'var(--text2)' }}>
                Diagnostic & pré-calcul de la structure N+1 en cours...
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
              <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-bold">Avertissement de Transition</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Étape 1 : Diagnostic / Pré-clôture */}
              {step === 'CHECK' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl border" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>
                      Année Scolaire Active à Clôturer
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold font-spectral" style={{ color: 'var(--text)' }}>
                        {currentYear?.name || 'En cours'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/30">
                        Statut : ACTIF
                      </span>
                    </div>
                  </div>

                  {/* Résultat du Pre-Close Check */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
                      <ShieldCheck size={18} className="text-blue-500" />
                      Vérifications Pré-Clôture Intelligentes
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl border flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>Bulletins & Notes</p>
                          <p className="text-[11px]" style={{ color: 'var(--text2)' }}>
                            {preCloseCheck?.unvalidatedBulletins === 0 ? 'Tous arrêtés & validés' : `${preCloseCheck?.unvalidatedBulletins} bulletins en attente`}
                          </p>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <CheckCircle2 size={20} className="text-green-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold" style={{ color: 'var(--text)' }}>Périodes & Séquences</p>
                          <p className="text-[11px]" style={{ color: 'var(--text2)' }}>
                            {preCloseCheck?.unclosedPeriods === 0 ? 'Toutes les périodes sont closes' : `${preCloseCheck?.unclosedPeriods} période(s) ouverte(s)`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Aperçu Année N+1 Dédite */}
                  <div className="p-4 rounded-xl border space-y-3" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                    <h4 className="text-sm font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Sparkles size={18} />
                      Année Cible N+1 Proposée par le Système
                    </h4>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--text2)' }}>Intitulé N+1</label>
                        <input
                          type="text"
                          value={candidateName}
                          onChange={e => setCandidateName(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg text-xs font-bold border font-nunito"
                          style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--text2)' }}>Début Rentrée</label>
                        <input
                          type="date"
                          value={candidateStartDate}
                          onChange={e => setCandidateStartDate(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg text-xs font-bold border font-nunito"
                          style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--text2)' }}>Fin Rentrée</label>
                        <input
                          type="date"
                          value={candidateEndDate}
                          onChange={e => setCandidateEndDate(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg text-xs font-bold border font-nunito"
                          style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Étape 2 : Révision de la Proposition N+1 */}
              {step === 'PROPOSE' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <Layers size={18} />
                      Structure N+1 Générée & Prête pour Validation
                    </div>
                    <p className="text-xs leading-relaxed">
                      Le système a généré <strong>{proposedClassesCount} classe(s) candidat(es)</strong> (statut DRAFT), reconduit les filières, séries et la grille tarifaire.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border space-y-3" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between text-xs border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                      <span style={{ color: 'var(--text2)' }}>Année Sortante à Clôturer :</span>
                      <span className="font-bold line-through" style={{ color: 'var(--text)' }}>{currentYear?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs border-b pb-2" style={{ borderColor: 'var(--border)' }}>
                      <span style={{ color: 'var(--text2)' }}>Nouvelle Année à Activer :</span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400">{candidateName}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text2)' }}>Reconduction Pédagogique :</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{proposedClassesCount} classes & grilles associées</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t flex items-center justify-between" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold border-none cursor-pointer"
            style={{ background: 'var(--surface)', color: 'var(--text2)' }}
          >
            Annuler
          </button>

          {step === 'CHECK' ? (
            <button
              onClick={handleGenerateProposal}
              disabled={submitting || loading || !candidateName.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 border-none cursor-pointer shadow-sm transition-all disabled:opacity-50"
              style={{ background: 'var(--amber)' }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Calcul de la structure...</span>
                </>
              ) : (
                <>
                  <span>Proposer la Structure N+1</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleApplyClotureAndActivation}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-2 border-none cursor-pointer shadow-md transition-all disabled:opacity-50"
              style={{ background: 'var(--green)' }}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Application de la Clôture & Activation N+1...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Valider la Clôture & Activer l'Année N+1</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
