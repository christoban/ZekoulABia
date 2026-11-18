'use client'

import type React from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import type { Candidate } from './types'

interface Props {
  activeTab: 'MANUEL' | 'IMPORT'
  onTabChange: (tab: 'MANUEL' | 'IMPORT') => void
  provisoires: Candidate[]
  manualDecisions: Record<string, 'REUSSI' | 'ECHOUE' | 'NONE'>
  setManualDecisions: React.Dispatch<React.SetStateAction<Record<string, 'REUSSI' | 'ECHOUE' | 'NONE'>>>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function CepInputTabs({
  activeTab,
  onTabChange,
  provisoires,
  manualDecisions,
  setManualDecisions,
  fileInputRef,
  onFileUpload,
}: Props) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={() => onTabChange('MANUEL')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'MANUEL' ? '2px solid var(--green, #16a34a)' : 'none',
            color: activeTab === 'MANUEL' ? 'var(--green, #16a34a)' : 'var(--text2)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Saisie à cocher ({provisoires.length})
        </button>
        <button
          type="button"
          onClick={() => onTabChange('IMPORT')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            borderBottom: activeTab === 'IMPORT' ? '2px solid var(--green, #16a34a)' : 'none',
            color: activeTab === 'IMPORT' ? 'var(--green, #16a34a)' : 'var(--text2)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Import de liste (Excel / CSV)
        </button>
      </div>

      {activeTab === 'MANUEL' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>
              Cochez le résultat du CEP pour chaque candidat admis provisoire :
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => {
                  const allReussi: Record<string, 'REUSSI'> = {}
                  provisoires.forEach((p) => { allReussi[p.id] = 'REUSSI' })
                  setManualDecisions(allReussi)
                }}
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
              >
                Tous Réussis
              </button>
              <button
                type="button"
                onClick={() => setManualDecisions({})}
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
              >
                Réinitialiser
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Candidat</th>
                  <th style={{ padding: '8px 12px' }}>Moyenne Concours</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Décision CEP</th>
                </tr>
              </thead>
              <tbody>
                {provisoires.map((c) => {
                  const cur = manualDecisions[c.id] || 'NONE'
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.candidateNumber || 'Sans matricule'}</div>
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                        {c.examScore !== null && c.examScore !== undefined ? `${c.examScore.toFixed(2)}/20` : '-'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6, background: 'var(--bg)', padding: 4, borderRadius: 6, border: '1px solid var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => setManualDecisions((prev) => ({ ...prev, [c.id]: 'REUSSI' }))}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 11,
                              background: cur === 'REUSSI' ? 'var(--green, #16a34a)' : 'transparent',
                              color: cur === 'REUSSI' ? '#fff' : 'var(--text2)',
                            }}
                          >
                            ✓ Réussi
                          </button>
                          <button
                            type="button"
                            onClick={() => setManualDecisions((prev) => ({ ...prev, [c.id]: 'ECHOUE' }))}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 4,
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                              fontSize: 11,
                              background: cur === 'ECHOUE' ? 'var(--red, #ef4444)' : 'transparent',
                              color: cur === 'ECHOUE' ? '#fff' : 'var(--text2)',
                            }}
                          >
                            ✕ Échoué
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 16px', border: '2px dashed var(--border)', borderRadius: 12 }}>
          <FileSpreadsheet size={36} style={{ color: 'var(--green)', marginBottom: 8 }} />
          <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700 }}>
            Importer un fichier de résultats officiels
          </h4>
          <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--text2)' }}>
            Colonnes reconnues : <strong>Nom, Prénom, Date de naissance, Résultat</strong> (Réussi / Échoué)
          </p>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={onFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--green, #16a34a)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Upload size={16} /> Choisir le fichier Excel ou CSV
          </button>
        </div>
      )}
    </>
  )
}
