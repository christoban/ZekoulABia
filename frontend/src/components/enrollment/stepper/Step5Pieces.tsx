'use client'

import React, { useState, useEffect } from 'react'
import {
  FileText,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Printer,
  Info,
} from 'lucide-react'
import EnrollmentCompletenessRing from '../EnrollmentCompletenessRing'
import type { StepperFormState } from './types'

interface Props {
  form: StepperFormState
  onChange: (updates: Partial<StepperFormState>) => void
  scoreCompletude: number
  piecesState: Array<{ code: string; libelle: string; obligatoire: boolean; received: boolean; note?: string }>
  onTogglePiece: (code: string) => void
}

export default function Step5Pieces({
  form,
  onChange,
  scoreCompletude,
  piecesState,
  onTogglePiece,
}: Props) {
  const piecesManquantes = piecesState.filter((p) => p.obligatoire && !p.received)

  const handlePrintPiecesManquantes = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const nomEleve = `${form.nom.trim()} ${form.prenom.trim()}`.trim() || 'Élève'
    const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pièces manquantes - ${nomEleve}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
            h1 { font-size: 18px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
            .header { margin-bottom: 24px; font-size: 13px; color: #555; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; font-size: 14px; }
            .badge { display: inline-block; padding: 2px 6px; font-size: 11px; background: #fee2e2; color: #dc2626; border-radius: 4px; font-weight: bold; }
            .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 12px; color: #777; }
          </style>
        </head>
        <body>
          <h1>Liste des pièces justificatives à fournir</h1>
          <div class="header">
            <strong>Élève :</strong> ${nomEleve}<br/>
            <strong>Niveau demandé :</strong> ${form.level || 'Non précisé'}<br/>
            <strong>Date d'émission :</strong> ${dateStr}
          </div>
          <p>Madame, Monsieur, veuillez compléter le dossier d'inscription en fournissant les pièces suivantes au secrétariat :</p>
          <ul>
            ${piecesState
              .map(
                (p) => `
              <li>
                [ ${p.received ? '✓' : ' '} ] <strong>${p.libelle}</strong>
                ${p.obligatoire ? '<span class="badge">Obligatoire</span>' : '(Facultative)'}
              </li>`,
              )
              .join('')}
          </ul>
          <div class="footer">
            Document officiel remis par le secrétariat. Merci de rapporter ces éléments dans les plus brefs délais.
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* En-tête avec anneau de complétude et action d'impression */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--border, #e5e7eb)',
          background: 'var(--bg2, #f9fafb)',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <EnrollmentCompletenessRing
            score={scoreCompletude}
            validableSousReserve={form.validableSousReserve}
            size="md"
          />
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text, #111827)' }}>
              Complétude du dossier : {scoreCompletude}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2, #4b5563)', marginTop: 2 }}>
              {piecesManquantes.length > 0
                ? `${piecesManquantes.length} pièce(s) obligatoire(s) manquante(s)`
                : 'Toutes les pièces obligatoires ont été réceptionnées'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrintPiecesManquantes}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface, #fff)',
            color: 'var(--text, #111827)',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Printer size={14} />
          <span>Imprimer la liste des pièces</span>
        </button>
      </div>

      {/* Case : Dossier validable sous réserve */}
      {piecesManquantes.length > 0 && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            background: form.validableSousReserve ? 'rgba(234,179,8,0.12)' : 'var(--surface, #fff)',
            border: form.validableSousReserve ? '1px solid rgba(234,179,8,0.35)' : '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#b45309', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.validableSousReserve}
              onChange={(e) => onChange({ validableSousReserve: e.target.checked })}
            />
            Dossier validable sous réserve de remise ultérieure des pièces manquantes
          </label>
        </div>
      )}

      {/* Liste des pièces à cocher */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2, #4b5563)', marginBottom: 2 }}>
          Pièces requises pour l'inscription :
        </div>

        {piecesState.map((piece) => {
          return (
            <div
              key={piece.code}
              onClick={() => onTogglePiece(piece.code)}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                border: piece.received ? '1.5px solid var(--green, #16a34a)' : '1px solid var(--border, #e5e7eb)',
                background: piece.received ? 'rgba(22,163,74,0.04)' : 'var(--surface, #fff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {piece.received ? (
                  <CheckCircle2 size={18} style={{ color: 'var(--green, #16a34a)' }} />
                ) : (
                  <Circle size={18} style={{ color: 'var(--text3, #9ca3af)' }} />
                )}
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)' }}>
                    {piece.libelle}
                  </span>
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: piece.obligatoire ? 'rgba(239,68,68,0.1)' : 'var(--bg2)',
                      color: piece.obligatoire ? 'var(--red, #ef4444)' : 'var(--text3)',
                    }}
                  >
                    {piece.obligatoire ? 'Obligatoire' : 'Facultative'}
                  </span>
                </div>
              </div>

              <span style={{ fontSize: 12, fontWeight: 600, color: piece.received ? 'var(--green, #16a34a)' : 'var(--text3)' }}>
                {piece.received ? 'Reçue' : 'En attente'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
