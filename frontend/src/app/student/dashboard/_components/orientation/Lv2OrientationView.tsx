'use client'

import { Clock, Languages, CheckCircle2 } from 'lucide-react'
import type { Lv2WindowData } from './types'

interface Props {
  titleFr: string
  subtitleFr: string
  lv2Data: Lv2WindowData | null
  lv2Loading: boolean
  selectedLv2: string
  onSelectLv2: (id: string) => void
  submittingLv2: boolean
  onSaveLv2: () => void
}

export default function Lv2OrientationView({
  titleFr,
  subtitleFr,
  lv2Data,
  lv2Loading,
  selectedLv2,
  onSelectLv2,
  submittingLv2,
  onSaveLv2,
}: Props) {
  const isSubmitted = Boolean(lv2Data?.currentChoice?.subjectId)
  const closeDate = lv2Data?.window?.closeDate
    ? new Date(lv2Data.window.closeDate).toLocaleDateString('fr-FR')
    : null

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 max-w-3xl mx-auto space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <div>
        <h2 className="text-lg sm:text-xl font-black m-0" style={{ color: 'var(--text)' }}>
          {titleFr}
        </h2>
        <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
          {subtitleFr}
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
                  onClick={() => onSelectLv2(s.id)}
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
              onClick={onSaveLv2}
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
