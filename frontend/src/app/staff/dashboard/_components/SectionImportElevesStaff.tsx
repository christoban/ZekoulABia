'use client'

import { useState } from 'react'
import { UserPlus, Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import ImportUsersWizardModal from '@/app/admin/dashboard/_components/ImportUsersWizardModal'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionImportElevesStaff({ onToast }: Props) {
  const [wizardOpen, setWizardOpen] = useState(true)

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6 px-4 py-4 md:px-7 md:py-6">
      {/* Header Secrétaire */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 md:p-5 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold mb-1.5">
              <UserPlus size={13} />
              <span>Espace Secrétariat — Inscriptions & Admission</span>
            </div>
            <h1 className="text-xl font-bold text-white font-spectral">
              Import & Admission des Élèves
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Importez et validez les fiches d’inscription des élèves via fichier Excel standardisé.
            </p>
          </div>

          <button
            onClick={() => setWizardOpen(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Upload size={14} />
            <span>Lancer l’assistant d’import</span>
          </button>
        </div>
      </div>

      {/* Guide rapide Secrétariat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
            <Download size={15} />
            <span>1. Télécharger le modèle</span>
          </div>
          <p className="text-slate-400 text-[11.5px] leading-normal">
            Utilisez le modèle Excel `.xlsx` fourni dans l’assistant pour formater correctement les noms, prénoms, genres et dates de naissance.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <FileSpreadsheet size={15} />
            <span>2. Prévisualiser & Corriger</span>
          </div>
          <p className="text-slate-400 text-[11.5px] leading-normal">
            Vérifiez le mapping automatique des colonnes et la grille de validation avant d’enregistrer les dossiers.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <CheckCircle2 size={15} />
            <span>3. Valider l’inscription</span>
          </div>
          <p className="text-slate-400 text-[11.5px] leading-normal">
            Les élèves importés reçoivent leur matricule et sont disponibles pour affectation dans les classes par le Censeur.
          </p>
        </div>
      </div>

      {/* Wizard Modal */}
      {wizardOpen && (
        <ImportUsersWizardModal
          onClose={() => setWizardOpen(false)}
          onToast={onToast}
          onSuccess={() => {
            onToast('Import des élèves effectué avec succès !', 'success')
            setWizardOpen(false)
          }}
        />
      )}
    </div>
  )
}
