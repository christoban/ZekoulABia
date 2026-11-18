'use client';

import React, { type RefObject } from 'react';
import { AlertCircle } from 'lucide-react';
import type { PublicationCategorie, PublicationPriorite } from '../types';
import { CATEGORIE_CONFIG } from '../types';
import LightweightRichEditor from './LightweightRichEditor';

interface PublishMainFieldsProps {
  titre: string;
  onTitreChange: (val: string) => void;
  titreError: string | null;
  titreInputRef: RefObject<HTMLInputElement | null>;
  categorie: PublicationCategorie;
  onCategorieChange: (val: PublicationCategorie) => void;
  priorite: PublicationPriorite;
  onPrioriteChange: (val: PublicationPriorite) => void;
  corps: string;
  onCorpsChange: (val: string) => void;
  corpsError: string | null;
  editorRef: RefObject<HTMLDivElement | null>;
}

export function PublishMainFields({
  titre,
  onTitreChange,
  titreError,
  titreInputRef,
  categorie,
  onCategorieChange,
  priorite,
  onPrioriteChange,
  corps,
  onCorpsChange,
  corpsError,
  editorRef,
}: PublishMainFieldsProps) {
  return (
    <>
      {/* 1. Titre avec validation inline (B4, B5) */}
      <div>
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--text)] mb-1">
          <label htmlFor="pub-titre">Titre du communiqué *</label>
          <span className={`text-[11px] ${titre.length > 120 ? 'text-red-500 font-bold' : 'text-[var(--text3)]'}`}>
            {titre.length} / 120
          </span>
        </div>
        <input
          ref={titreInputRef}
          id="pub-titre"
          type="text"
          value={titre}
          maxLength={120}
          aria-invalid={!!titreError}
          aria-describedby={titreError ? 'pub-titre-error' : undefined}
          onChange={(e) => onTitreChange(e.target.value)}
          placeholder="Ex : Rentrée scolaire 2026/2027"
          className={`w-full px-3 py-2 rounded-lg border bg-[var(--bg)] text-sm text-[var(--text)] placeholder-[var(--text3)] focus:outline-none transition-colors ${
            titreError ? 'border-red-500 ring-1 ring-red-500' : 'border-[var(--border)] focus:border-primary'
          }`}
        />
        {titreError && (
          <p id="pub-titre-error" className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
            <AlertCircle size={12} /> {titreError}
          </p>
        )}
      </div>

      {/* 2 & 3. Catégorie et Priorité */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs sm:text-sm font-bold text-[var(--text)] mb-1">Catégorie</label>
          <select
            value={categorie}
            onChange={(e) => onCategorieChange(e.target.value as PublicationCategorie)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] focus:outline-none focus:border-primary"
          >
            {Object.entries(CATEGORIE_CONFIG).map(([k, v]) => (
              <option key={k} value={k} className="bg-[var(--surface)] text-[var(--text)]">
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-bold text-[var(--text)] mb-1">Priorité</label>
          <div className="grid grid-cols-3 gap-1 bg-[var(--bg)] border border-[var(--border)] p-1 rounded-lg text-xs font-semibold text-center">
            {(['NORMALE', 'IMPORTANTE', 'URGENTE'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPrioriteChange(p)}
                className={`py-1 rounded transition-all ${
                  priorite === p
                    ? p === 'URGENTE'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : p === 'IMPORTANTE'
                      ? 'bg-orange-500 text-white font-bold shadow-xs'
                      : 'bg-primary text-white font-bold shadow-xs'
                    : 'text-[var(--text2)] hover:text-[var(--text)]'
                }`}
              >
                {p === 'NORMALE' ? 'Normale' : p === 'IMPORTANTE' ? 'Importante' : 'Urgente'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Contenu du message avec validation inline (A1, B4) */}
      <div ref={editorRef}>
        <label className="block text-xs sm:text-sm font-bold text-[var(--text)] mb-1">Message officiel *</label>
        <LightweightRichEditor value={corps} onChange={onCorpsChange} />
        {corpsError && (
          <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
            <AlertCircle size={12} /> {corpsError}
          </p>
        )}
      </div>
    </>
  );
}

