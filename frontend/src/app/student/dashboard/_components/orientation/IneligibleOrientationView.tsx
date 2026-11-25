'use client'

import { Compass } from 'lucide-react'

interface Props {
  currentClass: string
}

export default function IneligibleOrientationView({ currentClass }: Props) {
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
