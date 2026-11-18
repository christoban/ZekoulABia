'use client'

import { School } from 'lucide-react'
import type { RapportEffectifs } from './rapportsTypes'

interface Props {
  effectifs: RapportEffectifs
}

export default function RapportsEffectifsTab({ effectifs }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Synthèse par cycle */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue, #2563eb)', marginBottom: 4 }}>
            Premier Cycle (6e - 3e / Form 1 - 5)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            Inscrits : <strong>{effectifs.parCycle.premierCycle.inscrits}</strong> / {effectifs.parCycle.premierCycle.capacite} places
            ({effectifs.parCycle.premierCycle.capacite > 0 ? Math.round((effectifs.parCycle.premierCycle.inscrits / effectifs.parCycle.premierCycle.capacite) * 100) : 0}%)
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            G: {effectifs.parCycle.premierCycle.garcons} • F: {effectifs.parCycle.premierCycle.filles}
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: 'rgba(147, 51, 234, 0.05)',
            border: '1px solid rgba(147, 51, 234, 0.2)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--purple, #9333ea)', marginBottom: 4 }}>
            Second Cycle (2nde - Tle / Lower - Upper Sixth)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            Inscrits : <strong>{effectifs.parCycle.secondCycle.inscrits}</strong> / {effectifs.parCycle.secondCycle.capacite} places
            ({effectifs.parCycle.secondCycle.capacite > 0 ? Math.round((effectifs.parCycle.secondCycle.inscrits / effectifs.parCycle.secondCycle.capacite) * 100) : 0}%)
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            G: {effectifs.parCycle.secondCycle.garcons} • F: {effectifs.parCycle.secondCycle.filles}
          </div>
        </div>
      </div>

      {/* Tableau des classes */}
      <div
        style={{
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg2, #f9fafb)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Classe</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Niveau</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Série/Filière</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Capacité</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Inscrits</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>G / F</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Occupation</th>
              </tr>
            </thead>
            <tbody>
              {effectifs.parClasse.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text3)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <School size={28} style={{ color: 'var(--text3)' }} />
                      <div style={{ fontWeight: 600 }}>Aucune classe configurée pour cette année scolaire</div>
                      <div style={{ fontSize: 12 }}>Les effectifs et capacités apparaîtront dès que les classes seront créées.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                effectifs.parClasse.map((c) => (
                  <tr key={c.classId} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600 }}>{c.className}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{c.level || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{c.serie || c.filiere || '—'}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>{c.capacity}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{c.totalInscrits}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text2)', fontSize: 12 }}>
                      {c.garcons} G / {c.filles} F
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 8,
                            borderRadius: 4,
                            background: 'var(--border, #e5e7eb)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(c.tauxOccupation, 100)}%`,
                              height: '100%',
                              background:
                                c.tauxOccupation > 100
                                  ? 'var(--red, #ef4444)'
                                  : c.tauxOccupation >= 90
                                  ? 'var(--amber, #d97706)'
                                  : 'var(--green, #16a34a)',
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color:
                              c.tauxOccupation > 100
                                ? '#ef4444'
                                : c.tauxOccupation >= 90
                                ? '#d97706'
                                : 'var(--text2)',
                            minWidth: 36,
                            textAlign: 'right',
                          }}
                        >
                          {c.tauxOccupation}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
