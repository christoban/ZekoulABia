'use client'

import { useState } from 'react'
import { FileBadge, Award, Download, CheckCircle, ShieldCheck, AlertCircle, FileText } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useT } from '@/lib/i18n'
import type { UserInfo } from '../_types'

interface Props {
  user: UserInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  onNav: (section: string) => void
}

export default function SectionStudentDocuments({ user, onToast, onNav }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const isOnline = useOnlineStatus()
  const [downloadingCarte, setDownloadingCarte] = useState(false)
  const [downloadingCertificat, setDownloadingCertificat] = useState(false)

  const downloadPdf = async (endpoint: string, filename: string, setLoader: (v: boolean) => void) => {
    if (!isOnline) {
      onToast(t('documents.offline_toast') || 'Le téléchargement nécessite une connexion internet', 'warning')
      return
    }
    setLoader(true)
    try {
      const res = await fetchApi(endpoint, { credentials: 'include' })
      if (!res.ok) {
        throw new Error('Erreur de téléchargement')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      onToast(t('documents.success_toast') || 'Document téléchargé avec succès !', 'success')
    } catch {
      onToast(t('documents.error_toast') || 'Impossible de générer le document', 'error')
    } finally {
      setLoader(false)
    }
  }

  const matricule = user?.studentProfile?.matricule || user?.studentProfile?.numeroInterne || user?.id.substring(0, 8).toUpperCase()
  const className = user?.studentProfile?.class?.name || 'Classe non assignée'

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête */}
      <div>
        <h2 className="text-lg sm:text-xl font-black m-0" style={{ color: 'var(--text)' }}>
          {t('documents.title') || 'Mes Documents Officiels'}
        </h2>
        <p className="text-xs font-semibold m-0 mt-0.5" style={{ color: 'var(--text3)' }}>
          {t('documents.subtitle') || 'Pièces scolaires officielles certifiées avec QR Code infalsifiable'}
        </p>
      </div>

      {!isOnline && (
        <div className="p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold" style={{ background: 'var(--amber-light)', borderColor: 'var(--amber)', color: 'var(--amber)' }}>
          <AlertCircle size={15} className="shrink-0" />
          <span>Mode hors-ligne : la génération et le téléchargement des documents PDF officiels nécessitent une connexion active.</span>
        </div>
      )}

      {/* Grille des documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Carte d'Identité Scolaire */}
        <div className="rounded-2xl border p-4 sm:p-5 flex flex-col justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>
              <FileBadge size={20} strokeWidth={2} />
            </div>
            <div className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
              {t('documents.student_card_title') || 'Carte d\'Identité Scolaire'}
            </div>
            <div className="text-xs font-medium mt-1 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Carte officielle de l'élève avec photo, matricule, QR code de vérification sécurisé et coordonnées d'urgence.
            </div>
            <div className="mt-3 text-xs font-semibold p-2.5 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text3)' }}>
              <div>Élève : <strong style={{ color: 'var(--text)' }}>{user?.lastName} {user?.firstName}</strong></div>
              <div>Matricule : <strong style={{ color: 'var(--text)' }}>{matricule}</strong></div>
              <div>Classe : <strong style={{ color: 'var(--text)' }}>{className}</strong></div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: 'var(--green)' }}>
              <ShieldCheck size={13} /> Certifié MINESEC
            </span>
            <button
              onClick={() => downloadPdf('/api/v2/students/me/carte', `carte-scolaire-${matricule}.pdf`, setDownloadingCarte)}
              disabled={downloadingCarte || !isOnline}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white border-0 cursor-pointer inline-flex items-center gap-1.5 transition-all"
              style={{
                background: 'var(--blue)',
                opacity: isOnline && !downloadingCarte ? 1 : 0.6,
                cursor: isOnline && !downloadingCarte ? 'pointer' : 'not-allowed',
              }}
            >
              <Download size={13} />
              <span>{downloadingCarte ? 'Génération...' : 'Télécharger'}</span>
            </button>
          </div>
        </div>

        {/* Certificat de Scolarité */}
        <div className="rounded-2xl border p-4 sm:p-5 flex flex-col justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: 'var(--green-light)', color: 'var(--green)' }}>
              <Award size={20} strokeWidth={2} />
            </div>
            <div className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
              {t('documents.certificate_title') || 'Certificat de Scolarité'}
            </div>
            <div className="text-xs font-medium mt-1 leading-relaxed" style={{ color: 'var(--text2)' }}>
              Attestation officielle d'inscription pour l'année scolaire en cours, visée par le chef d'établissement pour les démarches administratives.
            </div>
            <div className="mt-3 text-xs font-semibold p-2.5 rounded-lg" style={{ background: 'var(--bg)', color: 'var(--text3)' }}>
              <div>Année académique en cours</div>
              <div>Statut : <span className="text-green-600 font-bold">Inscrit & Actif</span></div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: 'var(--green)' }}>
              <ShieldCheck size={13} /> Avec signature et QR Code
            </span>
            <button
              onClick={() => downloadPdf('/api/v2/students/me/certificat', `certificat-scolarite-${matricule}.pdf`, setDownloadingCertificat)}
              disabled={downloadingCertificat || !isOnline}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white border-0 cursor-pointer inline-flex items-center gap-1.5 transition-all"
              style={{
                background: 'var(--green)',
                opacity: isOnline && !downloadingCertificat ? 1 : 0.6,
                cursor: isOnline && !downloadingCertificat ? 'pointer' : 'not-allowed',
              }}
            >
              <Download size={13} />
              <span>{downloadingCertificat ? 'Génération...' : 'Télécharger'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Raccourci vers les bulletins */}
      <div className="rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
            <FileText size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-extrabold" style={{ color: 'var(--text)' }}>
              Bulletins Périodiques & Relevés de Notes
            </div>
            <div className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
              Retrouvez l'historique complet de vos bulletins trimestriels et séquentiels.
            </div>
          </div>
        </div>

        <button
          onClick={() => onNav('bulletins')}
          className="px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer self-start sm:self-auto"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Accéder aux bulletins →
        </button>
      </div>
    </div>
  )
}
