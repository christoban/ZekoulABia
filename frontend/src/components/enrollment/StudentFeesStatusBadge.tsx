'use client'

import React, { useState, useEffect } from 'react'
import { CheckCircle2, Clock, AlertTriangle, HelpCircle, ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface FactureLigne {
  id: string
  description?: string
  amount: number
  currency: string
  dueDate?: string
  status: string
  totalPaye: number
  soldeRestant: number
  estEnRetard: boolean
}

interface FeesStatusData {
  studentId: string
  nomComplet: string
  statutGlobal: 'AUCUN_FRAIS' | 'A_JOUR' | 'EN_ATTENTE' | 'EN_RETARD'
  totalDu: number
  totalPaye: number
  soldeRestant: number
  factures: FactureLigne[]
}

interface Props {
  studentId?: string | null
}

export default function StudentFeesStatusBadge({ studentId }: Props) {
  const [data, setData] = useState<FeesStatusData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!studentId) {
      setData(null)
      return
    }

    let isMounted = true
    setLoading(true)

    fetchApi(`/api/v2/finance/students/${studentId}/fees-status`)
      .then((res) => res.json())
      .then((json) => {
        if (isMounted && json.success && json.data) {
          setData(json.data)
        }
      })
      .catch(() => {
        // Silencieux si pas de droit ou non trouvé
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [studentId])

  if (!studentId || (!loading && !data)) return null

  if (loading) {
    return (
      <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg2, rgba(0,0,0,0.03))', fontSize: 12, color: 'var(--text3)' }}>
        Chargement de l’état financier...
      </div>
    )
  }

  if (!data) return null

  const getStatusBadge = () => {
    switch (data.statutGlobal) {
      case 'A_JOUR':
        return {
          bg: 'rgba(22, 163, 74, 0.1)',
          color: '#16a34a',
          border: '1px solid rgba(22, 163, 74, 0.25)',
          icon: <CheckCircle2 size={15} />,
          text: 'Frais à jour (0 XAF restant)',
        }
      case 'EN_RETARD':
        return {
          bg: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          icon: <AlertTriangle size={15} />,
          text: `En retard : ${data.soldeRestant.toLocaleString('fr-FR')} XAF impayés`,
        }
      case 'EN_ATTENTE':
        return {
          bg: 'rgba(245, 158, 11, 0.1)',
          color: '#d97706',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          icon: <Clock size={15} />,
          text: `Solde dû : ${data.soldeRestant.toLocaleString('fr-FR')} XAF`,
        }
      case 'AUCUN_FRAIS':
      default:
        return {
          bg: 'rgba(156, 163, 175, 0.1)',
          color: '#6b7280',
          border: '1px solid rgba(156, 163, 175, 0.25)',
          icon: <HelpCircle size={15} />,
          text: 'Aucune facture active',
        }
    }
  }

  const badge = getStatusBadge()

  return (
    <div
      style={{
        borderRadius: 8,
        border: badge.border,
        background: 'var(--surface, #fff)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          background: badge.bg,
          cursor: data.factures.length > 0 ? 'pointer' : 'default',
        }}
        onClick={() => data.factures.length > 0 && setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: badge.color, fontWeight: 700, fontSize: 12 }}>
          {badge.icon}
          <span>{badge.text}</span>
        </div>
        {data.factures.length > 0 && (
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: badge.color,
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {expanded && data.factures.length > 0 && (
        <div style={{ padding: '10px 12px', background: 'var(--surface, #fff)', borderTop: '1px solid var(--border, #e5e7eb)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <DollarSign size={13} />
            Consultation guichet (Lecture seule) — Encaissement réservé à la caisse
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.factures.map((facture) => (
              <div
                key={facture.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: 'var(--bg2, rgba(0,0,0,0.02))',
                  fontSize: 11,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text, #111827)' }}>
                    {facture.description || 'Frais de scolarité'}
                  </div>
                  <div style={{ color: 'var(--text3, #6b7280)', fontSize: 10 }}>
                    Payé : {facture.totalPaye.toLocaleString('fr-FR')} / {facture.amount.toLocaleString('fr-FR')} {facture.currency}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: facture.soldeRestant === 0 ? '#16a34a' : facture.estEnRetard ? '#ef4444' : '#d97706',
                    }}
                  >
                    {facture.soldeRestant === 0
                      ? 'Soldé'
                      : `${facture.soldeRestant.toLocaleString('fr-FR')} ${facture.currency}`}
                  </div>
                  {facture.dueDate && (
                    <div style={{ color: 'var(--text3)', fontSize: 9 }}>
                      Échéance : {new Date(facture.dueDate).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
