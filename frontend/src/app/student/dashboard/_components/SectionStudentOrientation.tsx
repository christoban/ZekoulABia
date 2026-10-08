'use client'
import { useState, useCallback, useEffect } from 'react'
import { Compass, Clock, CheckCircle, Sparkles, AlertCircle, BookMarked, ArrowRight, Languages, Lock, Info, CheckCircle2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { resolveOrientationEligibility } from '@/lib/orientationEligibility'
import type { UserInfo } from '../_types'

interface Props {
  user: UserInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

type SuggestedTrack = { track: string; score: number; justification: string }

interface Recommandation {
  id: string
  status: string
  suggestedTracks: SuggestedTrack[] | null
  responseDeadline: string | null
  finalTrack: string | null
}

interface Lv2Subject { id: string; name: string }
interface Lv2WindowData {
  window: { id: string; level: string; openDate: string; closeDate: string }
  currentChoice: { subjectId: string; subjectName?: string } | null
  availableSubjects: Lv2Subject[]
}

export default function SectionStudentOrientation({ user, onToast }: Props) {
  const t = useT('student')
  const tcommon = useT('common')

  const eligibility = resolveOrientationEligibility(
    user?.studentProfile?.class?.name,
    user?.studentProfile?.class?.level,
    user?.studentProfile?.class?.serie
  )

  const activeCheckpoint = eligibility.checkpointKey === 'FIN_TROISIEME' || eligibility.checkpointKey === 'FIN_SECONDE_C'
    ? eligibility.checkpointKey
    : null

  // ── Cas Palier 3e ou 2nde C ──
  const [selectedTrack, setSelectedTrack] = useState('')
  const [submittingChoice, setSubmittingChoice] = useState(false)
  const [desiredTrack, setDesiredTrack] = useState('')
  const [careerInterest, setCareerInterest] = useState('')
  const [savingAspiration, setSavingAspiration] = useState(false)
  const [aspirationSaved, setAspirationSaved] = useState(false)

  // ── Cas Palier LV2 ──
  const [lv2Data, setLv2Data] = useState<Lv2WindowData | null>(null)
  const [lv2Loading, setLv2Loading] = useState(false)
  const [selectedLv2, setSelectedLv2] = useState('')
  const [submittingLv2, setSubmittingLv2] = useState(false)

  const cacheKey = user && activeCheckpoint ? `student:orientation:${user.id}:${activeCheckpoint}` : ''

  const fetchFn = useCallback(async (): Promise<Recommandation | null> => {
    if (!activeCheckpoint) return null
    try {
      const res = await fetchApi(`/api/v2/orientation/ma-recommandation/${activeCheckpoint}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data) {
        return json.data
      }
    } catch {
      // aucune recommandation active
    }
    return null
  }, [activeCheckpoint])

  const { data: reco, loading, refetch } = useCachedFetch<Recommandation | null>(cacheKey, fetchFn)

  // Chargement spécifique si éligible LV2 (avec résilience Dexie hors-ligne)
  useEffect(() => {
    if (eligibility.checkpointKey === 'LV2') {
      setLv2Loading(true)
      const uid = user?.id

      if (uid) {
        getCachedData<Lv2WindowData>(`student:lv2-choice:${uid}`)
          .then((cached) => {
            if (cached?.data) {
              setLv2Data(cached.data)
              if (cached.data.currentChoice?.subjectId) {
                setSelectedLv2(cached.data.currentChoice.subjectId)
              }
            }
          })
          .catch(() => {})
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLv2Loading(false)
        return
      }

      fetchApi('/api/v2/students/me/lv2-choice-window', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data) {
            setLv2Data(d.data)
            if (uid) putCachedData(`student:lv2-choice:${uid}`, d.data).catch(() => {})
            if (d.data.currentChoice?.subjectId) {
              setSelectedLv2(d.data.currentChoice.subjectId)
            }
          }
        })
        .catch(() => {})
        .finally(() => setLv2Loading(false))
    }
  }, [eligibility.checkpointKey, user?.id])

  const handleChoisirPiste = async () => {
    if (!reco || !selectedTrack) return
    setSubmittingChoice(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/recommandations/${reco.id}/choisir-piste`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ track: selectedTrack }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('orientationCheckpoint.toast_choice_saved') || 'Votre choix a été enregistré avec succès !', 'success')
        refetch()
      } else {
        onToast(json.message || 'Erreur lors de l\'enregistrement', 'error')
      }
    } catch {
      onToast('Erreur de connexion', 'error')
    } finally {
      setSubmittingChoice(false)
    }
  }

  const handleSaveAspiration = async () => {
    setSavingAspiration(true)
    try {
      const res = await fetchApi('/api/v2/orientation/aspirations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          checkpointType: activeCheckpoint,
          desiredTrack: desiredTrack || undefined,
          careerInterest: careerInterest || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('orientationCheckpoint.toast_aspiration_saved') || 'Vos aspirations ont été transmises au conseiller !', 'success')
        setAspirationSaved(true)
      } else {
        onToast(json.message || 'Erreur lors de l\'enregistrement', 'error')
      }
    } catch {
      onToast('Erreur de communication', 'error')
    } finally {
      setSavingAspiration(false)
    }
  }

  const handleSaveLv2 = async () => {
    if (!selectedLv2) return
    setSubmittingLv2(true)
    try {
      const res = await fetchApi('/api/v2/students/me/lv2-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chosenSubjectId: selectedLv2 }),
      })
      const json = await res.json()
      if (json.success) {
        onToast('Votre choix de Langue Vivante 2 a été enregistré avec succès !', 'success')
        const refreshed = await fetchApi('/api/v2/students/me/lv2-choice-window', { credentials: 'include' }).then((r) => r.json())
        if (refreshed.success && refreshed.data) setLv2Data(refreshed.data)
      } else {
        onToast(json.message || 'Erreur lors de l\'enregistrement', 'error')
      }
    } catch {
      onToast('Erreur de communication', 'error')
    } finally {
      setSubmittingLv2(false)
    }
  }

  // ── Cas 1 : Classe non éligible à l'orientation (ex: 6e, 2nde A, 1ère, Terminale) ──
  if (!eligibility.isEligible) {
    const currentClass = user?.studentProfile?.class?.name || 'actuelle'
    return (
      <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 max-w-3xl mx-auto space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
        <div>
          <h2 className="text-lg sm:text-xl font-black m-0" style={{ color: 'var(--text)' }}>
            Projet d&apos;Orientation Scolaire
          </h2>
          <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
            Information relative aux paliers officiels d&apos;orientation
          </p>
        </div>

        <div className="p-6 rounded-2xl border text-center space-y-3 bg-[var(--surface)] border-[var(--border)] shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[var(--bg2)] text-[var(--text3)] flex items-center justify-center mx-auto">
            <Compass size={24} />
          </div>
          <h3 className="text-base font-black m-0" style={{ color: 'var(--text)' }}>
            Aucun palier d&apos;orientation pour votre classe ({currentClass})
          </h3>
          <p className="text-xs text-[var(--text2)] max-w-md mx-auto leading-relaxed">
            Votre niveau scolaire actuel ne fait l&apos;objet d&apos;aucun changement de cycle ou choix de filière pour cette année scolaire. Votre cursus se poursuit normalement dans votre parcours inscrit.
          </p>
          <div className="p-3.5 rounded-xl bg-[var(--bg2)] border border-[var(--border)] text-left text-xs space-y-2 mt-4 text-[var(--text2)]">
            <span className="font-bold block text-[var(--text)]">Rappel des paliers d&apos;orientation officiels au Cameroun :</span>
            <ul className="m-0 pl-4 space-y-1 text-[11.5px] text-[var(--text3)]">
              <li><strong>Fin de 5ème (ou 4ème) :</strong> Choix de la Langue Vivante 2 (Allemand, Espagnol, Chinois, Italien).</li>
              <li><strong>Fin de 3ème :</strong> Transition vers le Second Cycle (Seconde Littéraire A, Seconde Scientifique C ou Technique).</li>
              <li><strong>Fin de Seconde C :</strong> Spécialisation vers les séries de Première (Première C Mathématiques, Première D Biologie, Première TI Informatique).</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // ── Cas 2 : Palier Choix LV2 (5e / 4e selon école) ──
  if (eligibility.checkpointKey === 'LV2') {
    const isSubmitted = Boolean(lv2Data?.currentChoice?.subjectId)
    const closeDate = lv2Data?.window?.closeDate ? new Date(lv2Data.window.closeDate).toLocaleDateString('fr-FR') : null

    return (
      <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 max-w-3xl mx-auto space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
        <div>
          <h2 className="text-lg sm:text-xl font-black m-0" style={{ color: 'var(--text)' }}>
            {eligibility.titleFr}
          </h2>
          <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
            {eligibility.subtitleFr}
          </p>
        </div>

        {/* Notice explicative et règles */}
        <div className="p-3.5 rounded-xl border flex items-start gap-2.5 bg-[var(--blue-light)] border-[var(--blue)]/30 text-[var(--blue)]">
          <Languages size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-extrabold block mb-0.5">Règle de reconduction et d&apos;affectation :</span>
            Votre choix de LV2 est modifiable à tout moment tant que l&apos;année scolaire en cours n&apos;est pas achevée. À la clôture de l&apos;année, votre choix est définitivement verrouillé et transmis au secrétariat pour votre affectation automatique dans la classe supérieure.
          </div>
        </div>

        {lv2Loading ? (
          <div className="p-8 text-center text-xs text-[var(--text3)]">
            Chargement des langues vivantes disponibles…
          </div>
        ) : (
          <div className="p-5 rounded-2xl border bg-[var(--surface)] border-[var(--border)] space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3 border-[var(--border)]">
              <div>
                <span className="text-sm font-black block" style={{ color: 'var(--text)' }}>
                  Sélectionnez votre langue d&apos;étude
                </span>
                <span className="text-xs text-[var(--text3)] mt-0.5 block">
                  Langues proposées par votre établissement scolaire
                </span>
              </div>
              {closeDate && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[var(--bg2)] text-[var(--text2)] flex items-center gap-1">
                  <Clock size={11} /> Clôture le {closeDate}
                </span>
              )}
            </div>

            {/* Statut actuel enregistré */}
            {isSubmitted && (
              <div className="p-3 rounded-xl border flex items-center justify-between bg-[var(--green-light)] border-[var(--green)]/30 text-[var(--green)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span className="text-xs font-bold">
                    Choix actuel enregistré : <strong>{lv2Data?.currentChoice?.subjectName}</strong>
                  </span>
                </div>
                <span className="text-[10.5px] font-semibold text-[var(--green)]">Modifiable jusqu&apos;à la clôture</span>
              </div>
            )}

            {/* Grille de sélection des matières */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(lv2Data?.availableSubjects || []).map((s) => {
                const isSelected = selectedLv2 === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedLv2(s.id)}
                    className="p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between"
                    style={{
                      background: isSelected ? 'var(--blue-light)' : 'var(--bg2)',
                      borderColor: isSelected ? 'var(--blue)' : 'var(--border)',
                    }}
                  >
                    <div>
                      <span className="font-bold text-xs block text-[var(--text)]">{s.name}</span>
                      <span className="text-[11px] text-[var(--text3)] mt-0.5 block">Dispensée dans l&apos;établissement</span>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px]"
                      style={{
                        borderColor: isSelected ? 'var(--blue)' : 'var(--border)',
                        background: isSelected ? 'var(--blue)' : 'var(--surface)',
                        color: 'white',
                      }}
                    >
                      {isSelected ? '✓' : ''}
                    </div>
                  </button>
                )
              })}
            </div>

            {(!lv2Data?.availableSubjects || lv2Data.availableSubjects.length === 0) && (
              <div className="p-4 text-center text-xs text-[var(--text3)]">
                Aucune langue vivante 2 n&apos;est actuellement ouverte au choix dans l&apos;établissement.
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleSaveLv2}
                disabled={!selectedLv2 || submittingLv2}
                className="h-9 px-4 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
              >
                {submittingLv2 ? 'Enregistrement…' : isSubmitted ? 'Mettre à jour mon choix' : 'Valider mon choix de LV2'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Cas 3 : Palier Fin de 3ème OU Fin de 2nde C ──
  const tracks = reco?.suggestedTracks ?? []
  const hasProposal = Boolean(reco && reco.status === 'PROPOSEE_A_L_ELEVE')
  const isFinalized = Boolean(reco && (reco.status === 'VALIDEE_ELEVE' || reco.finalTrack))

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 max-w-3xl mx-auto space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête personnalisé au palier unique */}
      <div>
        <h2 className="text-lg sm:text-xl font-black m-0" style={{ color: 'var(--text)' }}>
          {eligibility.titleFr}
        </h2>
        <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
          {eligibility.subtitleFr}
        </p>
      </div>

      {loading && !reco ? (
        <div className="p-8 text-center text-xs text-[var(--text3)]">
          {tcommon('status.loading')}
        </div>
      ) : isFinalized ? (
        <div className="rounded-2xl p-5 border flex items-center gap-3.5 bg-[var(--green-light)] border-[var(--green)]">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[var(--green)] text-white">
            <CheckCircle size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-black text-[var(--text)]">
              Filière retenue : <span style={{ color: 'var(--green)' }}>{reco?.finalTrack}</span>
            </div>
            <div className="text-xs font-semibold mt-0.5 text-[var(--text2)]">
              Votre orientation est validée et officiellement enregistrée pour la rentrée prochaine.
            </div>
          </div>
        </div>
      ) : hasProposal ? (
        <div className="rounded-2xl p-4 sm:p-5 border bg-[var(--amber-light)] border-[var(--amber)]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 font-black text-sm text-[var(--text)]">
              <Compass size={18} style={{ color: 'var(--amber)' }} />
              <span>Proposition du Conseiller d&apos;Orientation</span>
            </div>
            {reco?.responseDeadline && (
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--amber)' }}>
                <Clock size={13} /> Réponse avant le {new Date(reco.responseDeadline).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold mb-3.5 text-[var(--text2)]">
            À la suite de l&apos;analyse de vos compétences académiques et résultats, les filières suivantes vous sont suggérées :
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            {tracks.map((st) => {
              const isSelected = selectedTrack === st.track
              return (
                <button
                  key={st.track}
                  type="button"
                  onClick={() => setSelectedTrack(st.track)}
                  className="p-3.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between"
                  style={{
                    background: isSelected ? 'var(--surface)' : 'rgba(255,255,255,0.7)',
                    borderColor: isSelected ? 'var(--amber)' : 'rgba(217,119,6,0.25)',
                    boxShadow: isSelected ? '0 2px 8px rgba(217,119,6,0.2)' : 'none',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-base font-black text-[var(--text)]">{st.track}</span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--amber-light)] text-[var(--amber)]">
                        Adéquation : {st.score}%
                      </span>
                    </div>
                    <p className="text-xs font-medium m-0 leading-relaxed text-[var(--text2)]">
                      {st.justification}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-bold" style={{ color: isSelected ? 'var(--amber)' : 'var(--text3)' }}>
                    <span>{isSelected ? '✓ Piste sélectionnée' : 'Sélectionner cette piste'}</span>
                  </div>
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={handleChoisirPiste}
            disabled={!selectedTrack || submittingChoice}
            className="px-4 py-2.5 rounded-xl font-black text-xs text-white border-0 cursor-pointer transition-all inline-flex items-center gap-2"
            style={{
              background: 'var(--amber)',
              opacity: selectedTrack && !submittingChoice ? 1 : 0.6,
              cursor: selectedTrack && !submittingChoice ? 'pointer' : 'not-allowed',
            }}
          >
            <span>{submittingChoice ? 'Validation en cours...' : 'Confirmer mon choix de série'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border p-5 flex items-center gap-3.5 bg-[var(--surface)] border-[var(--border)]">
          <div className="w-10 h-10 rounded-full bg-[var(--bg2)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-sm font-black text-[var(--text)]">
              En attente de délibération d&apos;orientation
            </div>
            <div className="text-xs font-semibold mt-0.5 text-[var(--text3)]">
              Le conseiller d&apos;orientation et le conseil de classe préparent les avis officiels. Vous pouvez renseigner vos aspirations ci-dessous.
            </div>
          </div>
        </div>
      )}

      {/* Recueil des vœux et aspirations contextuel à sa classe */}
      <div className="rounded-2xl border p-4 sm:p-5 bg-[var(--surface)] border-[var(--border)]">
        <div className="flex items-center gap-2 mb-2 font-black text-sm text-[var(--text)]">
          <BookMarked size={16} className="text-[var(--blue)]" />
          <span>Mes Vœux & Aspirations d&apos;Études</span>
        </div>
        <p className="text-xs font-semibold mb-3.5 text-[var(--text3)]">
          Indiquez vos préférences de formation et secteurs d&apos;activité favoris pour guider l&apos;équipe pédagogique.
        </p>

        {aspirationSaved ? (
          <div className="p-3 rounded-xl border flex items-center gap-2 text-xs font-bold bg-[var(--green-light)] border-[var(--green)] text-[var(--green)]">
            <CheckCircle size={15} />
            <span>Vos aspirations ont bien été transmises au Conseiller d&apos;Orientation.</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold mb-1 text-[var(--text2)]">
                {activeCheckpoint === 'FIN_TROISIEME'
                  ? 'Filière de Seconde souhaitée (ex : Seconde C, Seconde A4, Seconde STI) :'
                  : 'Filière de Première souhaitée (ex : Première C, Première D, Première TI) :'}
              </label>
              <input
                type="text"
                value={desiredTrack}
                onChange={(e) => setDesiredTrack(e.target.value)}
                placeholder={activeCheckpoint === 'FIN_TROISIEME' ? 'Ex : Seconde C' : 'Ex : Première C'}
                className="w-full px-3 py-2 rounded-lg border text-xs font-medium outline-none bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 text-[var(--text2)]">
                Projet professionnel ou secteur de prédilection :
              </label>
              <input
                type="text"
                value={careerInterest}
                onChange={(e) => setCareerInterest(e.target.value)}
                placeholder="Ex : Ingénierie, Médecine, Droit, Économie, Agronomie..."
                className="w-full px-3 py-2 rounded-lg border text-xs font-medium outline-none bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveAspiration}
              disabled={savingAspiration || (!desiredTrack && !careerInterest)}
              className="px-4 py-2 rounded-lg font-bold text-xs text-white border-0 cursor-pointer"
              style={{
                background: 'var(--blue)',
                opacity: (desiredTrack || careerInterest) && !savingAspiration ? 1 : 0.6,
                cursor: (desiredTrack || careerInterest) && !savingAspiration ? 'pointer' : 'not-allowed',
              }}
            >
              {savingAspiration ? 'Enregistrement...' : 'Enregistrer mes vœux'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
