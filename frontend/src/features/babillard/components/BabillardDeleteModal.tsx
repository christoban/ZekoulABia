'use client';

import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Publication } from '../types';

interface BabillardDeleteModalProps {
  publication: Publication | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function BabillardDeleteModal({
  publication,
  isDeleting,
  onCancel,
  onConfirm,
}: BabillardDeleteModalProps) {
  if (!publication) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 mb-4 text-rose-600 dark:text-rose-400">
          <div className="p-3 bg-rose-100 dark:bg-rose-950/50 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
            Supprimer ce communiqué ?
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 mb-6 leading-relaxed">
          Êtes-vous certain de vouloir retirer «{' '}
          <strong>{publication.titre}</strong> » du babillard ? Cette action est définitive.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow transition flex items-center gap-2"
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmer la suppression
          </button>
        </div>
      </div>
    </div>
  );
}

