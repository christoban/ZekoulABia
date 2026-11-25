'use client'

import React, { useState, useEffect, useRef } from 'react'
import { FileCheck, CheckCircle, ArrowRight, X, Info } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { CepInputTabs } from './cepBatch/CepInputTabs'
import { CepProposalReview } from './cepBatch/CepProposalReview'
import { parseCepSpreadsheet } from './cepBatch/parseCepFile'
import type { Candidate, CandidatPromotion, CepProposeItem, PropositionResult } from './cepBatch/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  sessionId: string
  sessionName: string
  isAdmin?: boolean
  onRefresh?: () => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function ConcoursCepBatchModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  isAdmin = true,
  onRefresh,
  onToast,
}: Props) {
  const [activeTab, setActiveTab] = useState<'MANUEL' | 'IMPORT'>('MANUEL')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [provisoires, setProvisoires] = useState<Candidate[]>([])
  const [manualDecisions, setManualDecisions] = useState<Record<string, 'REUSSI' | 'ECHOUE' | 'NONE'>>({})
  const [proposal, setProposal] = useState<PropositionResult | null>(null)
  const [selectedPromotions, setSelectedPromotions] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setProposal(null)
    setManualDecisions({})
    fetchApi(`/api/v2/entrance-exams/${sessionId}/details`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          const list: Candidate[] = d.data.candidates ?? []
          const provs = list.filter((c) => c.admissionStatus === 'ADMIS_PROVISOIRE')
          setProvisoires(provs)
          const initial: Record<string, 'REUSSI' | 'ECHOUE' | 'NONE'> = {}
          provs.forEach((c) => {
            initial[c.id] = c.cepResult === 'REUSSI' ? 'REUSSI' : c.cepResult === 'ECHOUE' ? 'ECHOUE' : 'NONE'
          })
          setManualDecisions(initial)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen, sessionId])

  if (!isOpen) return null

  const handleProposer = async (items: CepProposeItem[]) => {
    if (items.length === 0) {
      onToast?.('Aucun résultat renseigné à vérifier', 'error')
      return
    }
    try {
      setLoading(true)
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/cep-batch/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (data.success && data.data) {
        setProposal(data.data)
        const promoMap: Record<string, boolean> = {}
        ;(data.data.promotionsProposees ?? []).forEach((p: CandidatPromotion) => {
          promoMap[p.candidateId] = true
        })
        setSelectedPromotions(promoMap)
        onToast?.('Vérification effectuée : prévisualisation prête', 'info')
      } else {
        onToast?.(data.message || 'Erreur lors de la vérification', 'error')
      }
    } catch {
      onToast?.('Erreur de communication serveur', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleProposeManual = () => {
    const items = Object.entries(manualDecisions)
      .filter(([, val]) => val === 'REUSSI' || val === 'ECHOUE')
      .map(([candidateId, val]) => ({
        candidateId,
        cepResult: val as 'REUSSI' | 'ECHOUE',
      }))
    handleProposer(items)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const items = await parseCepSpreadsheet(file)
      if (items.length === 0) {
        onToast?.('Aucune ligne exploitable trouvée dans le fichier', 'error')
        return
      }
      handleProposer(items)
    } catch {
      onToast?.('Erreur de lecture du fichier Excel/CSV', 'error')
    }
  }

  const handleApply = async () => {
    if (!proposal) return
    if (!isAdmin) {
      onToast?.('Seul un administrateur peut valider et appliquer les résultats définitivement', 'error')
      return
    }

    try {
      setApplying(true)
      const decisions = proposal.rapproches.map((r) => ({
        candidateId: r.candidateId,
        cepResult: r.cepResult,
      }))
      const promotionsIds = Object.entries(selectedPromotions)
        .filter(([, checked]) => checked)
        .map(([id]) => id)

      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/cep-batch/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decisions, promotionsIds }),
      })
      const data = await res.json()
      if (data.success) {
        onToast?.(
          `Résultats CEP appliqués : ${data.data.confirmes} confirmés (${data.data.dossiersCrees} dossiers brouillons), ${data.data.annules} annulés, ${data.data.promus} promus.`,
          'success'
        )
        onRefresh?.()
        onClose()
      } else {
        onToast?.(data.message || "Erreur lors de l'application", 'error')
      }
    } catch {
      onToast?.('Erreur de communication avec le serveur', 'error')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          color: 'var(--text, #111827)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 780,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border, #e5e7eb)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--blue, #2563eb)',
              }}
            >
              <FileCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                Saisie & Validation des résultats du CEP
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text2, #6b7280)' }}>
                Session : <strong>{sessionName}</strong> • {provisoires.length} admis provisoire(s) à traiter
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              color: 'var(--text2)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Info size={16} style={{ color: 'var(--blue, #2563eb)', flexShrink: 0 }} />
            <span>
              <strong>Règle de notification :</strong> Aucun SMS n'est envoyé aux admis ou recalés du CEP (familles déjà informées). Les dossiers d'inscription sont créés en brouillon. En cas d'échec, la place est libérée et le candidat promu en liste d'attente reçoit un SMS.
            </span>
          </div>

          {!proposal ? (
            <CepInputTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              provisoires={provisoires}
              manualDecisions={manualDecisions}
              setManualDecisions={setManualDecisions}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
            />
          ) : (
            <CepProposalReview
              proposal={proposal}
              selectedPromotions={selectedPromotions}
              setSelectedPromotions={setSelectedPromotions}
            />
          )}
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg, #f9fafb)',
          }}
        >
          {proposal ? (
            <button
              type="button"
              onClick={() => setProposal(null)}
              disabled={applying}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← Modifier la saisie
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Étape 1 : Saisie / Importation
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>

            {!proposal ? (
              <button
                type="button"
                onClick={handleProposeManual}
                disabled={loading || provisoires.length === 0}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--blue, #2563eb)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Vérifier le lot <ArrowRight size={15} />
              </button>
            ) : isAdmin ? (
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                style={{
                  padding: '8px 22px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--green, #16a34a)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle size={16} />
                {applying ? 'Application en cours...' : 'Confirmer et Appliquer définitivement'}
              </button>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', alignSelf: 'center' }}>
                En attente de validation par un administrateur
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
