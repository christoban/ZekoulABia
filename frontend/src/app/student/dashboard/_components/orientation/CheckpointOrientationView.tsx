'use client'

import { Compass, Clock, CheckCircle, Sparkles, BookMarked, ArrowRight } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { ActiveCheckpointKey, Recommandation } from './types'

interface Props {
  titleFr: string
  subtitleFr: string
  activeCheckpoint: ActiveCheckpointKey | null
  reco: Recommandation | null | undefined
  loading: boolean
  selectedTrack: string
  onSelectTrack: (track: string) => void
  submittingChoice: boolean
  onConfirmTrack: () => void
  desiredTrack: string
  onChangeDesiredTrack: (val: string) => void
  careerInterest: string
  onChangeCareerInterest: (val: string) => void
  savingAspiration: boolean
  aspirationSaved: boolean
  onSaveAspiration: () => void
}

export default function CheckpointOrientationView({
  titleFr,
  subtitleFr,
  activeCheckpoint,
  reco,
  loading,
  selectedTrack,
  onSelectTrack,
  submittingChoice,
  onConfirmTrack,
  desiredTrack,
  onChangeDesiredTrack,
  careerInterest,
  onChangeCareerInterest,
  savingAspiration,
  aspirationSaved,
  onSaveAspiration,
}: Props) {
  const tcommon = useT('common')
  const tracks = reco?.suggestedTracks ?? []
  const hasProposal = Boolean(reco && reco.status === 'PROPOSEE_A_L_ELEVE')
  const isFinalized = Boolean(reco && (reco.status === 'VALIDEE_ELEVE' || reco.finalTrack))

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 max-w-3xl mx-auto space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête personnalisé au palier unique */}
      <div>
        <h2 className="text-lg sm:text-xl font-black m-0" style={{ color: 'var(--text)' }}>
          {titleFr}
        </h2>
        <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
          {subtitleFr}
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
                  onClick={() => onSelectTrack(st.track)}
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
            onClick={onConfirmTrack}
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
                onChange={(e) => onChangeDesiredTrack(e.target.value)}
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
                onChange={(e) => onChangeCareerInterest(e.target.value)}
                placeholder="Ex : Ingénierie, Médecine, Droit, Économie, Agronomie..."
                className="w-full px-3 py-2 rounded-lg border text-xs font-medium outline-none bg-[var(--bg)] border-[var(--border)] text-[var(--text)]"
              />
            </div>

            <button
              type="button"
              onClick={onSaveAspiration}
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
