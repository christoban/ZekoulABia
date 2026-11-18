'use client'

import type React from 'react'
import { Send, Users } from 'lucide-react'
import type { PropositionResult } from './types'

interface Props {
  proposal: PropositionResult
  selectedPromotions: Record<string, boolean>
  setSelectedPromotions: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}

export function CepProposalReview({ proposal, selectedPromotions, setSelectedPromotions }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center' }}>
        <div style={{ padding: 10, background: 'rgba(34, 197, 94, 0.08)', borderRadius: 8, border: '1px solid var(--green)' }}>
          <div style={{ fontSize: 11, color: 'var(--green)' }}>Confirmés</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{proposal.places.reussis}</div>
        </div>
        <div style={{ padding: 10, background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, border: '1px solid var(--red)' }}>
          <div style={{ fontSize: 11, color: 'var(--red)' }}>Échoués (Annulés)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>{proposal.places.echoues}</div>
        </div>
        <div style={{ padding: 10, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 8, border: '1px solid var(--blue)' }}>
          <div style={{ fontSize: 11, color: 'var(--blue)' }}>Places Libérées</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>{proposal.places.placesLiberees}</div>
        </div>
        <div style={{ padding: 10, background: 'rgba(234, 179, 8, 0.08)', borderRadius: 8, border: '1px solid #eab308' }}>
          <div style={{ fontSize: 11, color: '#854d0e' }}>Promotions Proposées</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#854d0e' }}>{proposal.promotionsProposees.length}</div>
        </div>
      </div>

      {proposal.promotionsProposees.length > 0 && (
        <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} /> Promotion automatique des candidats en liste d'attente
          </h4>
          <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text2)' }}>
            Les places libérées sont proposées en priorité aux premiers de la liste complémentaire. Cochez les candidats à promouvoir :
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {proposal.promotionsProposees.map((p) => (
              <label
                key={p.candidateId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedPromotions[p.candidateId])}
                    onChange={(e) =>
                      setSelectedPromotions((prev) => ({ ...prev, [p.candidateId]: e.target.checked }))
                    }
                  />
                  <span style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</span>
                  <span style={{ color: 'var(--text3)' }}>• Rang {p.rank ?? '-'} • {p.examScore?.toFixed(2)}/20</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Send size={12} /> SMS de notification envoyé
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {proposal.nonRapproches.length > 0 && (
        <div style={{ padding: 12, borderRadius: 8, background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#854d0e', fontSize: 12 }}>
          <strong>{proposal.nonRapproches.length} ligne(s) non rapprochée(s) :</strong>
          <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
            {proposal.nonRapproches.map((nr, idx) => (
              <li key={idx}>
                {nr.item.firstName} {nr.item.lastName} : {nr.motif}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
