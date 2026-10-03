'use client'

import React from 'react'
import ModalOverlay, { fmtCFA } from './ModalOverlay'
import { Printer, CheckCircle, AlertCircle, X } from 'lucide-react'

export interface RecuProvisoireData {
  reference: string
  isOffline: boolean
  date: Date
  schoolName: string
  schoolLogoUrl?: string | null
  studentName: string
  studentId: string
  feePlanName: string
  amountPaid: number
  totalAmount: number
  remainingAmount: number
  receivedBy: string
}

interface Props {
  data: RecuProvisoireData | null
  onClose: () => void
}

export default function RecuProvisoireModal({ data, onClose }: Props) {
  if (!data) return null

  const handlePrint = () => {
    window.print()
  }

  const dateStr = data.date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <ModalOverlay onClose={onClose}>
      <div className="relative print:m-0 print:p-0 print:shadow-none" style={{ position: 'relative' }}>
        {/* Style d'impression dédié */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #recu-imprimable, #recu-imprimable * {
              visibility: visible;
            }
            #recu-imprimable {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 20px;
              background: white !important;
              color: black !important;
            }
            .no-print {
              display: none !important;
            }
          }
        ` }} />

        {/* Bouton fermer (masqué à l'impression) */}
        <button
          onClick={onClose}
          type="button"
          className="no-print"
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            background: 'var(--bg2)',
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text2)',
          }}
          aria-label="Fermer"
        >
          <X size={16} />
        </button>

        {/* Conteneur principal du reçu */}
        <div
          id="recu-imprimable"
          style={{
            position: 'relative',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '20px',
            overflow: 'hidden',
          }}
        >
          {/* Filigrane diagonal si mode hors-ligne */}
          {data.isOffline && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 0,
                opacity: 0.12,
                transform: 'rotate(-28deg)',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 900,
                  color: 'var(--red, #e11d48)',
                  textTransform: 'uppercase',
                  border: '4px dashed var(--red, #e11d48)',
                  padding: '8px 24px',
                  borderRadius: 12,
                  textAlign: 'center',
                  letterSpacing: '2px',
                }}
              >
                PROVISOIRE NON SYNCHRONISÉ
              </span>
            </div>
          )}

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* En-tête */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {data.schoolLogoUrl ? (
                  <img src={data.schoolLogoUrl} alt="Logo" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--primary)' }}>
                    {data.schoolName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{data.schoolName}</h2>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>Service de l'Intendance / Caisse</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    background: data.isOffline ? 'var(--amber-light, #fef3c7)' : 'var(--green-light, #dcfce7)',
                    color: data.isOffline ? 'var(--amber, #d97706)' : 'var(--green, #16a34a)',
                  }}
                >
                  {data.isOffline ? 'MODE HORS-LIGNE' : 'CONFIRMÉ'}
                </span>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{dateStr}</div>
              </div>
            </div>

            {/* Titre du reçu */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '0.5px' }}>
                REÇU D'ENCAISSEMENT ESPÈCES
              </h3>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', fontFamily: 'monospace' }}>
                RÉF : {data.reference}
              </span>
            </div>

            {/* Détails élève & frais */}
            <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '12px 14px', marginBottom: 14, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text3)' }}>Élève :</span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{data.studentName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--text3)' }}>Frais / Motif :</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{data.feePlanName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text3)' }}>Encaissé par :</span>
                <span style={{ color: 'var(--text2)' }}>{data.receivedBy}</span>
              </div>
            </div>

            {/* Montant encaissé mis en valeur */}
            <div
              style={{
                border: '1.5px solid var(--border)',
                borderRadius: 8,
                padding: '12px',
                textAlign: 'center',
                marginBottom: 14,
                background: 'var(--surface)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>
                Montant Reçu en Espèces
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>
                {fmtCFA(data.amountPaid)}
              </div>
            </div>

            {/* Récapitulatif solde */}
            <div style={{ fontSize: 11.5, color: 'var(--text2)', marginBottom: 14, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Montant total de la facture :</span>
                <span style={{ fontWeight: 600 }}>{fmtCFA(data.totalAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: data.remainingAmount > 0 ? 'var(--amber, #d97706)' : 'var(--green, #16a34a)' }}>
                <span>Reste à payer :</span>
                <span>{fmtCFA(data.remainingAmount)}</span>
              </div>
            </div>

            {/* Mention légale / offline */}
            <div style={{ fontSize: 10, color: 'var(--text3)', borderTop: '1px dashed var(--border)', paddingTop: 8, lineHeight: 1.4, textAlign: 'justify' }}>
              {data.isOffline ? (
                <span>
                  <strong>Avertissement :</strong> Ce reçu atteste de la remise d'espèces en mode déconnecté.
                  L'écriture comptable sera définitivement enregistrée sur les serveurs de l'établissement dès le rétablissement de la synchronisation internet.
                </span>
              ) : (
                <span>Ce reçu atteste du paiement intégral ou partiel enregistré dans le système de gestion scolaire ZekoulABia.</span>
              )}
            </div>
          </div>
        </div>

        {/* Boutons d'action (masqués à l'impression) */}
        <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={handlePrint}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Printer size={16} />
            Imprimer le reçu
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
