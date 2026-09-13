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
    <div className="space-y-6 max-w-7xl mx-auto pb-10 px-4 py-6">
      {/* Header Secrétaire */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-semibold mb-2">
              <UserPlus size={14} />
              <span>Espace Secrétariat — Inscriptions & Admission</span>
            </div>
            <h1 className="text-2xl font-bold text-white font-spectral">
              Import & Admission des Élèves
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Importez et validez les fiches d’inscription des élèves via fichier Excel standardisé.
            </p>
          </div>

          <button
            onClick={() => setWizardOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Upload size={16} />
            <span>Lancer l’assistant d’import</span>
          </button>
        </div>
      </div>

      {/* Guide rapide Secrétariat */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-blue-400 font-bold text-sm">
            <Download size={18} />
            <span>1. Télécharger le modèle</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Utilisez le modèle Excel `.xlsx` fourni dans l’assistant pour formater correctement les noms, prénoms, genres et dates de naissance.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-amber-400 font-bold text-sm">
            <FileSpreadsheet size={18} />
            <span>2. Prévisualiser & Corriger</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Vérifiez le mapping automatique des colonnes et la grille de validation avant d’enregistrer les dossiers.
          </p>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
            <CheckCircle2 size={18} />
            <span>3. Valider l’inscription</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
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
