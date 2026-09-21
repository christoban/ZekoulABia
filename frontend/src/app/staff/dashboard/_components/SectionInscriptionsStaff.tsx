'use client'

import React, { useState, useEffect, useCallback } from 'react'

import {
  Users,
  PlusCircle,
  Upload,
  Printer,
  FileCheck,
  RefreshCw,
  Download,
  AlertCircle,
  CloudOff,
  Search,
  X,
  Loader2,
  FileText,
  CreditCard,
  Send,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import EnrollmentKanbanBoard, { type KanbanDossier } from '@/components/enrollment/EnrollmentKanbanBoard'
import EnrollmentStepperForm from '@/components/enrollment/EnrollmentStepperForm'
import ValidationDrawer from '@/components/enrollment/ValidationDrawer'
import ImportUsersWizardModal from '@/app/admin/dashboard/_components/ImportUsersWizardModal'

interface Props {
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface StudentSearchResult {
  id: string
  firstName: string
  lastName: string
  matricule?: string | null
  studentProfile?: {
    matricule?: string | null
    class?: { name: string } | null
  } | null
  studentStatus?: string | null
}

export default function SectionInscriptionsStaff({ onToast }: Props) {
  const isOnline = useOnlineStatus()
  const { pendingCount, syncQueue, syncing } = useSyncQueue()
  const [onglet, setOnglet] = useState<'KANBAN' | 'NOUVEAU'>('KANBAN')
  const [dossiers, setDossiers] = useState<KanbanDossier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDossier, setSelectedDossier] = useState<KanbanDossier | null>(null)

  // Modals : Import & Documents scolaires
  const [importWizardOpen, setImportWizardOpen] = useState(false)
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [docStudentSearch, setDocStudentSearch] = useState('')
  const [docSearchResults, setDocSearchResults] = useState<StudentSearchResult[]>([])
  const [docSearching, setDocSearching] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null)
  const [motifTransfert, setMotifTransfert] = useState('Demande des parents')
  const [docGenerating, setDocGenerating] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)

  const chargerDossiers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi('/api/v2/eleve-onboarding')
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setDossiers(data.data)
      } else {
        setError(data.message || 'Impossible de charger les dossiers')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    chargerDossiers()
  }, [chargerDossiers])

  // Recherche d'élèves pour les documents scolaires
  useEffect(() => {
    if (!docStudentSearch || docStudentSearch.trim().length < 2) {
      setDocSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setDocSearching(true)
      try {
        const res = await fetchApi(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(docStudentSearch.trim())}&limit=8`, { credentials: 'include' })
        const data = await res.json()
        const list = Array.isArray(data.data) ? data.data : (Array.isArray(data.users) ? data.users : [])
        setDocSearchResults(list)
      } catch {
        // ignore
      } finally {
        setDocSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [docStudentSearch])

  const handleDownloadPdf = (id: string) => {
    window.open(`/api/v2/eleve-onboarding/${id}/fiche-pdf`, '_blank')
  }

  const generateStudentDoc = async (userId: string, type: 'certificat' | 'carte' | 'lettre-transfert') => {
    setDocGenerating(true)
    setDocError(null)
    try {
      const url = type === 'lettre-transfert'
        ? `/api/v2/students/${userId}/${type}?motif=${encodeURIComponent(motifTransfert || 'Demande de transfert')}`
        : `/api/v2/students/${userId}/${type}`
      const res = await fetchApi(url, { credentials: 'include' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.message || 'Impossible de générer le document')
      }
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      window.open(objUrl, '_blank')
      onToast?.('Document généré avec succès', 'success')
    } catch (err: any) {
      setDocError(err.message || 'Erreur lors de la génération du document')
    } finally {
      setDocGenerating(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
      {/* En-tête */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text, #111827)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Users size={24} style={{ color: 'var(--green, #16a34a)' }} />
            Gestion des Inscriptions & Admissions
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text2, #4b5563)' }}>
            Suivi des dossiers élèves, contrôle des pièces justificatives et capacités de classe.
          </p>
        </div>

        {/* Boutons d'actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {onglet === 'NOUVEAU' ? (
            <button
              type="button"
              onClick={() => setOnglet('KANBAN')}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1.5px solid var(--border, #e5e7eb)',
                background: 'var(--surface, #fff)',
                color: 'var(--text, #111827)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← Retour au tableau
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDocModalOpen(true)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border, #e5e7eb)',
                  background: 'var(--surface, #fff)',
                  color: 'var(--text, #111827)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Printer size={15} />
                Documents scolaires
              </button>

              <button
                type="button"
                onClick={() => setImportWizardOpen(true)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border, #e5e7eb)',
                  background: 'var(--surface, #fff)',
                  color: 'var(--text, #111827)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Upload size={15} />
                Importer Excel
              </button>

              <button
                type="button"
                onClick={() => setOnglet('NOUVEAU')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--green, #16a34a)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <PlusCircle size={15} />
                Nouveau dossier
              </button>
            </>
          )}
        </div>
      </div>

      {(!isOnline || pendingCount > 0) && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: !isOnline ? 'rgba(234,88,12,0.1)' : 'rgba(37,99,235,0.08)',
            border: `1px solid ${!isOnline ? 'rgba(234,88,12,0.3)' : 'rgba(37,99,235,0.2)'}`,
            color: !isOnline ? '#c2410c' : '#1d4ed8',
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!isOnline ? <CloudOff size={16} /> : <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />}
            <span>
              {!isOnline
                ? 'Mode hors-ligne : vous pouvez continuer à saisir des dossiers en brouillon (sauvegardés localement).'
                : `${pendingCount} action(s) locale(s) en attente de synchronisation.`}
            </span>
          </div>
          {isOnline && pendingCount > 0 && (
            <button
              type="button"
              onClick={() => syncQueue().then((synced) => onToast?.(`${synced} action(s) synchronisée(s)`, 'success'))}
              disabled={syncing}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: '#1d4ed8',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: syncing ? 'not-allowed' : 'pointer',
              }}
            >
              {syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            color: 'var(--red, #ef4444)',
            fontSize: 13,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Contenu selon onglet */}
      {onglet === 'KANBAN' && (
        <EnrollmentKanbanBoard
          dossiers={dossiers}
          onSelectDossier={(d) => setSelectedDossier(d)}
          onDownloadPdf={handleDownloadPdf}
        />
      )}

      {onglet === 'NOUVEAU' && (
        <EnrollmentStepperForm
          onSuccess={(newId) => {
            onToast?.('Dossier créé avec succès !', 'success')
            chargerDossiers()
            setOnglet('KANBAN')
          }}
          onCancel={() => setOnglet('KANBAN')}
        />
      )}

      {/* Tiroir de revue */}
      <ValidationDrawer
        dossier={selectedDossier}
        isOpen={!!selectedDossier}
        onClose={() => setSelectedDossier(null)}
        onActionComplete={() => {
          chargerDossiers()
          onToast?.('Dossier mis à jour', 'info')
        }}
        isAdmin={false}
      />

      {/* Modal d'import Excel */}
      {importWizardOpen && (
        <ImportUsersWizardModal
          onClose={() => setImportWizardOpen(false)}
          onToast={onToast ?? (() => {})}
          onSuccess={() => {
            chargerDossiers()
            onToast?.('Import des élèves effectué avec succès !', 'success')
            setImportWizardOpen(false)
          }}
        />
      )}

      {/* Modal Documents Scolaires Officiels */}
      {docModalOpen && (
        <div
          onClick={() => {
            setDocModalOpen(false)
            setSelectedStudent(null)
            setDocStudentSearch('')
            setDocError(null)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--surface, #fff)',
              borderRadius: 14,
              width: 500,
              maxWidth: '96vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Header modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Printer size={18} style={{ color: 'var(--green, #16a34a)' }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text, #111827)' }}>
                  Documents scolaires officiels
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDocModalOpen(false)
                  setSelectedStudent(null)
                  setDocStudentSearch('')
                  setDocError(null)
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3, #9ca3af)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Recherche élève */}
            {!selectedStudent ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2, #4b5563)' }}>
                  Rechercher un élève (nom, prénom ou matricule) :
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text3, #9ca3af)' }} />
                  <input
                    type="text"
                    value={docStudentSearch}
                    onChange={(e) => setDocStudentSearch(e.target.value)}
                    placeholder="Ex: Mbarga, Amina, 2025-001..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px 10px 8px 32px',
                      borderRadius: 8,
                      border: '1px solid var(--border, #e5e7eb)',
                      fontSize: 13,
                    }}
                  />
                  {docSearching && (
                    <Loader2 size={14} className="animate-spin" style={{ position: 'absolute', right: 10, top: 10, color: 'var(--green, #16a34a)' }} />
                  )}
                </div>

                {docSearchResults.length > 0 && (
                  <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
                    {docSearchResults.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          setSelectedStudent(st)
                          setDocError(null)
                        }}
                        style={{
                          padding: '8px 12px',
                          borderBottom: '1px solid var(--border, #f3f4f6)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 13,
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg2, rgba(0,0,0,0.03))')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text, #111827)' }}>
                          {st.lastName} {st.firstName}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text3, #9ca3af)' }}>
                          {st.studentProfile?.class?.name || st.matricule || 'Élève'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {docStudentSearch.length >= 2 && !docSearching && docSearchResults.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3, #9ca3af)', textAlign: 'center', padding: 12 }}>
                    Aucun élève trouvé pour cette recherche.
                  </div>
                )}
              </div>
            ) : (
              /* Choix et génération des documents pour l'élève sélectionné */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg2, rgba(0,0,0,0.03))', padding: '8px 12px', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #111827)' }}>
                      {selectedStudent.lastName} {selectedStudent.firstName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)' }}>
                      {selectedStudent.studentProfile?.class?.name ? `Classe : ${selectedStudent.studentProfile.class.name}` : ''}
                      {selectedStudent.matricule ? ` • Matricule : ${selectedStudent.matricule}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudent(null)}
                    style={{ fontSize: 11, color: 'var(--blue, #2563eb)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Changer d'élève
                  </button>
                </div>

                {docError && (
                  <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', color: 'var(--red, #ef4444)', fontSize: 12 }}>
                    {docError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Certificat de scolarité */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border, #e5e7eb)',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)' }}>Certificat de scolarité</div>
                      <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)' }}>Attestation d'inscription officielle pour l'année courante</div>
                    </div>
                    <button
                      type="button"
                      disabled={docGenerating}
                      onClick={() => generateStudentDoc(selectedStudent.id, 'certificat')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'var(--green, #16a34a)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: docGenerating ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Download size={13} />
                      Télécharger
                    </button>
                  </div>

                  {/* Carte d'identité scolaire */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border, #e5e7eb)',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)' }}>Carte d'identité scolaire</div>
                      <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)' }}>Badge avec QR code de vérification public</div>
                    </div>
                    <button
                      type="button"
                      disabled={docGenerating}
                      onClick={() => generateStudentDoc(selectedStudent.id, 'carte')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        background: 'var(--blue, #2563eb)',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: docGenerating ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Download size={13} />
                      Télécharger
                    </button>
                  </div>

                  {/* Lettre de transfert */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border, #e5e7eb)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)' }}>Lettre de transfert</div>
                        <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)' }}>Certificat de radiation / changement d'établissement</div>
                      </div>
                      <button
                        type="button"
                        disabled={docGenerating}
                        onClick={() => generateStudentDoc(selectedStudent.id, 'lettre-transfert')}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: '#7c3aed',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: docGenerating ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Download size={13} />
                        Télécharger
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text3, #6b7280)', whiteSpace: 'nowrap' }}>Motif :</span>
                      <input
                        type="text"
                        value={motifTransfert}
                        onChange={(e) => setMotifTransfert(e.target.value)}
                        placeholder="Ex: Déménagement familial, affectation..."
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          borderRadius: 4,
                          border: '1px solid var(--border, #e5e7eb)',
                          fontSize: 11,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
