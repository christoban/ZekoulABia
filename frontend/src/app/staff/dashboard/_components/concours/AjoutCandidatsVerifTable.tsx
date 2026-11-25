'use client';

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import type { CandidatAEnregistrer } from './ajoutCandidatsUtils';

interface Props {
  candidatesList: CandidatAEnregistrer[];
  countValides: number;
  countErreurs: number;
  onAddMore: () => void;
  onModifyRow: <K extends keyof CandidatAEnregistrer>(
    tempId: string,
    champ: K,
    val: CandidatAEnregistrer[K]
  ) => void;
  onDeleteRow: (tempId: string) => void;
}

const cellInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
};

export default function AjoutCandidatsVerifTable({
  candidatesList,
  countValides,
  countErreurs,
  onAddMore,
  onModifyRow,
  onDeleteRow,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green, var(--green))', fontWeight: 700, fontSize: 13 }}>
            ✓ {countValides} valides
          </div>
          {countErreurs > 0 && (
            <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red, #ef4444)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={14} /> {countErreurs} à corriger / doublons
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onAddMore}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + Ajouter d&apos;autres candidats
        </button>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 10px', width: 40 }}>#</th>
              <th style={{ padding: '8px 10px' }}>Nom *</th>
              <th style={{ padding: '8px 10px' }}>Prénom(s) *</th>
              <th style={{ padding: '8px 10px' }}>Date Naiss.</th>
              <th style={{ padding: '8px 10px' }}>École d&apos;origine</th>
              <th style={{ padding: '8px 10px' }}>Tél. Parent</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}>Frais</th>
              <th style={{ padding: '8px 10px', textAlign: 'center', width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {candidatesList.map((cand, idx) => {
              const hasError = cand.isDuplicate || cand.errorMessage;
              return (
                <tr
                  key={cand.tempId}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: hasError ? 'rgba(239, 68, 68, 0.05)' : idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                  }}
                >
                  <td style={{ padding: '8px 10px', color: 'var(--text3)', fontSize: 12 }}>{idx + 1}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <input
                      type="text"
                      value={cand.lastName}
                      onChange={(e) => onModifyRow(cand.tempId, 'lastName', e.target.value)}
                      style={{
                        ...cellInputStyle,
                        border: hasError && !cand.lastName ? '1px solid var(--red)' : '1px solid var(--border)',
                      }}
                    />
                    {cand.errorMessage && (
                      <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 2 }}>
                        {cand.errorMessage}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input
                      type="text"
                      value={cand.firstName}
                      onChange={(e) => onModifyRow(cand.tempId, 'firstName', e.target.value)}
                      style={{
                        ...cellInputStyle,
                        border: hasError && !cand.firstName ? '1px solid var(--red)' : '1px solid var(--border)',
                      }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input
                      type="date"
                      value={cand.dateOfBirth || ''}
                      onChange={(e) => onModifyRow(cand.tempId, 'dateOfBirth', e.target.value)}
                      style={{ ...cellInputStyle, padding: '4px 6px', fontSize: 12 }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input
                      type="text"
                      value={cand.originSchool || ''}
                      onChange={(e) => onModifyRow(cand.tempId, 'originSchool', e.target.value)}
                      style={cellInputStyle}
                    />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <input
                      type="tel"
                      value={cand.parentPhone || ''}
                      onChange={(e) => onModifyRow(cand.tempId, 'parentPhone', e.target.value)}
                      placeholder="+237..."
                      style={cellInputStyle}
                    />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={cand.fraisPayes || false}
                      onChange={(e) => onModifyRow(cand.tempId, 'fraisPayes', e.target.checked)}
                    />
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onDeleteRow(cand.tempId)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
