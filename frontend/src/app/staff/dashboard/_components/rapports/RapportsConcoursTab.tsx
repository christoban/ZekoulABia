'use client'

import { Award } from 'lucide-react'
import type { StatConcours } from './rapportsTypes'

interface Props {
  concours: StatConcours[]
}

export default function RapportsConcoursTab({ concours }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {concours.length === 0 ? (
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
          <Award size={32} style={{ color: 'var(--text3)', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            Aucun concours d’entrée enregistré
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Les statistiques apparaîtront dès la première session de concours configurée.
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
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Session</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Date</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Places</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Candidats</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Admis</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Attente</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Refusés</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Réussite</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Moyenne</th>
              </tr>
            </thead>
            <tbody>
              {concours.map((s) => (
                <tr key={s.sessionId} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>{s.sessionName}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>
                    {new Date(s.examDate).toLocaleDateString('fr-FR')}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>{s.capacity}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{s.totalCandidats}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                    {s.admis}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#d97706' }}>{s.listeAttente}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#ef4444' }}>{s.refuses}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                    {s.tauxReussitePercent}%
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                    {s.moyenneGenerale > 0 ? `${s.moyenneGenerale}/20` : '—'}
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
