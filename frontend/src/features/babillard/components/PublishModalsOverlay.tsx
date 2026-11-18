'use client';

import React from 'react';
import { X } from 'lucide-react';
import { ROLE_LABELS_FR } from '../types';

interface PublishModalsOverlayProps {
  showConfirmation: boolean;
  roles: string[];
  targetAllClasses: boolean;
  selectedClassesCount: number;
  submitting: boolean;
  onCancelConfirmation: () => void;
  onConfirmPublish: () => void;
  selectedLightboxImage: { url: string; title: string } | null;
  onCloseLightbox: () => void;
}

export function PublishModalsOverlay({
  showConfirmation,
  roles,
  targetAllClasses,
  selectedClassesCount,
  submitting,
  onCancelConfirmation,
  onConfirmPublish,
  selectedLightboxImage,
  onCloseLightbox,
}: PublishModalsOverlayProps) {
  return (
    <>
      {/* Boîte modale de confirmation de diffusion avec estimation de l'audience */}
      {showConfirmation && (
        <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-[420px] bg-[var(--surface)] text-[var(--text)] rounded-xl shadow-2xl border border-[var(--border)] p-5">
            <h3 className="font-spectral font-bold text-lg mb-2 text-[var(--text)]">Confirmer la diffusion</h3>
            <p className="text-xs text-[var(--text2)] leading-relaxed mb-4">
              Vous allez diffuser ce communiqué officiel à destination de :{' '}
              <strong className="text-[var(--text)]">
                {roles.length >= 5 ? 'Tous les rôles' : roles.map((r) => ROLE_LABELS_FR[r] ?? r).join(', ')}
              </strong>
              {!targetAllClasses && selectedClassesCount > 0 && (
                <span> ({selectedClassesCount} classe{selectedClassesCount > 1 ? 's' : ''})</span>
              )}.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={onCancelConfirmation}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text2)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={onConfirmPublish}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-sm transition-colors"
              >
                {submitting ? 'Validation...' : 'Confirmer et diffuser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox d'inspection haute résolution pour prévisualiser l'image avant publication */}
      {selectedLightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-70 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={onCloseLightbox}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 text-white z-10">
            <span className="text-xs font-medium max-w-[300px] truncate opacity-80">
              {selectedLightboxImage.title}
            </span>
            <button
              type="button"
              onClick={onCloseLightbox}
              className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
              title="Fermer (Échap)"
            >
              <X size={18} />
            </button>
          </div>
          <div
            className="max-w-[92vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedLightboxImage.url}
              alt={selectedLightboxImage.title}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>
          <div className="mt-3 text-white/70 text-xs">
            Aperçu haute résolution avant diffusion
          </div>
        </div>
      )}
    </>
  );
}

