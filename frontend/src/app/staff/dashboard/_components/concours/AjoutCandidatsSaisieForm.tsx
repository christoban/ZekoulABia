'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface Props {
  saisieNom: string;
  setSaisieNom: (val: string) => void;
  saisiePrenom: string;
  setSaisiePrenom: (val: string) => void;
  saisieDateNaiss: string;
  setSaisieDateNaiss: (val: string) => void;
  saisieEcole: string;
  setSaisieEcole: (val: string) => void;
  saisiePhone: string;
  setSaisiePhone: (val: string) => void;
  saisieFrais: boolean;
  setSaisieFrais: (val: boolean) => void;
  saisiePieces: boolean;
  setSaisiePieces: (val: boolean) => void;
  onAjouterManuel: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text2)',
  display: 'block',
  marginBottom: 4,
};

export default function AjoutCandidatsSaisieForm({
  saisieNom,
  setSaisieNom,
  saisiePrenom,
  setSaisiePrenom,
  saisieDateNaiss,
  setSaisieDateNaiss,
  saisieEcole,
  setSaisieEcole,
  saisiePhone,
  setSaisiePhone,
  saisieFrais,
  setSaisieFrais,
  saisiePieces,
  setSaisiePieces,
  onAjouterManuel,
}: Props) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, background: 'var(--bg)' }}>
      <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
        Saisie d&apos;un candidat au guichet
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Nom de famille *</label>
          <input
            type="text"
            value={saisieNom}
            onChange={(e) => setSaisieNom(e.target.value)}
            placeholder="Ex: NGONO"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Prénom(s) *</label>
          <input
            type="text"
            value={saisiePrenom}
            onChange={(e) => setSaisiePrenom(e.target.value)}
            placeholder="Ex: Marie Chantal"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Date de naissance</label>
          <input
            type="date"
            value={saisieDateNaiss}
            onChange={(e) => setSaisieDateNaiss(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>École d&apos;origine</label>
          <input
            type="text"
            value={saisieEcole}
            onChange={(e) => setSaisieEcole(e.target.value)}
            placeholder="Ex: École Publique de Bastos"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Téléphone du parent</label>
          <input
            type="tel"
            value={saisiePhone}
            onChange={(e) => setSaisiePhone(e.target.value)}
            placeholder="Ex: +237 690 00 00 00"
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={saisieFrais}
              onChange={(e) => setSaisieFrais(e.target.checked)}
            />
            Frais réglés
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={saisiePieces}
              onChange={(e) => setSaisiePieces(e.target.checked)}
            />
            Pièces fournies
          </label>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onAjouterManuel}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent, #2563eb)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={16} /> Ajouter à la liste
        </button>
      </div>
    </div>
  );
}
