'use client';

import React from 'react';

interface PublishFooterActionsProps {
  submitting: boolean;
  uploading: boolean;
  onClose: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}

/**
 * B5: Pied d'actions du modal de publication.
 * - Desktop : Annuler gauche, Brouillon + Diffuser droite
 * - Mobile : Diffuser pleine largeur en haut, Brouillon dessous (Annuler masqué)
 */
export function PublishFooterActions({
  submitting,
  uploading,
  onClose,
  onSaveDraft,
  onPublish,
}: PublishFooterActionsProps) {
  return (
    <div className="px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface)]">
      {/* Mobile layout (sm:hidden) */}
      <div className="flex sm:hidden flex-col gap-2 w-full">
        <button
          type="button"
          disabled={submitting || uploading}
          onClick={onPublish}
          className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm text-center"
        >
          {submitting ? 'Diffusion...' : 'Diffuser le communiqué'}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSaveDraft}
          className="w-full py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg2)] disabled:opacity-50 transition-colors text-center"
        >
          Enregistrer comme brouillon
        </button>
      </div>

      {/* Desktop layout (hidden on mobile) */}
      <div className="hidden sm:flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text2)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
        >
          Annuler
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onSaveDraft}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg)] disabled:opacity-50 transition-colors"
          >
            Enregistrer comme brouillon
          </button>
          <button
            type="button"
            disabled={submitting || uploading}
            onClick={onPublish}
            className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
          >
            {submitting ? 'Diffusion...' : 'Diffuser le communiqué'}
          </button>
        </div>
      </div>
    </div>
  );
}

