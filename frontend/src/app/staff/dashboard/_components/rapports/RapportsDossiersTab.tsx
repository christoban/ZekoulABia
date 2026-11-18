'use client'

import { CheckCircle2 } from 'lucide-react'
import type { DossierIncomplet } from './rapportsTypes'

interface Props {
  dossiers: DossierIncomplet[]
}

export default function RapportsDossiersTab({ dossiers }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dossiers.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            background: 'var(--surface, #fff)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            color: 'var(--text2)',
          }}
        >
          <CheckCircle2 size={32} style={{ color: '#16a34a', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            Tous les dossiers sont complets !
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Aucune pièce manquante sur les dossiers d’inscription soumis.
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg2, #f9fafb)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Élève</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Classe</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Téléphone</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Complétude</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Pièces manquantes</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{d.nomProvisoire}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{d.className || 'Non affectée'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{d.contactTelephone || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          (d.completenessScore ?? 0) >= 80
                            ? 'rgba(22, 163, 74, 0.1)'
                            : (d.completenessScore ?? 0) >= 50
                            ? 'rgba(217, 119, 6, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                        color:
                          (d.completenessScore ?? 0) >= 80
                            ? '#16a34a'
                            : (d.completenessScore ?? 0) >= 50
                            ? '#d97706'
                            : '#ef4444',
                      }}
                    >
                      {d.completenessScore ?? 0}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {d.piecesManquantes.map((piece, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: 11,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                          }}
                        >
                          {piece}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
