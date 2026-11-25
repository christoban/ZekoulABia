'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import ImportUsersWizardModal from '@/app/admin/dashboard/_components/ImportUsersWizardModal'
import SectionInscriptionsStaff from './SectionInscriptionsStaff'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionImportElevesStaff({ onToast }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      {/* Bouton d'accès rapide Import Excel */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '12px 24px 0 24px',
        }}
      >
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface, #fff)',
            color: 'var(--text, #111827)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Upload size={14} />
          Importer un fichier Excel (Import de masse)
        </button>
      </div>

      {/* Vue principale : Gestion des inscriptions & Admissions (Kanban + Formulaire) */}
      <SectionInscriptionsStaff onToast={onToast} />

      {/* Modal d'import Excel */}
      {wizardOpen && (
        <ImportUsersWizardModal
          onClose={() => setWizardOpen(false)}
          onToast={onToast}
          isSecretary={true}
          onSuccess={() => {
            onToast('Import des élèves effectué avec succès !', 'success')
            setWizardOpen(false)
          }}
        />
      )}
    </div>
  )
}
