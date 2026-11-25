'use client';

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Edit2,
  MoreVertical,
  Pin,
  Printer,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { confirmAction } from '@/components/shell/ConfirmDialog';

interface AnnonceDetailToolbarProps {
  publicationTitle: string;
  isPinned: boolean;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  canManage: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPinToggle?: () => void;
  onShare: () => void;
  onPrint: () => void;
}

export function AnnonceDetailToolbar({
  publicationTitle,
  isPinned,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  canManage,
  onEdit,
  onDelete,
  onPinToggle,
  onShare,
  onPrint,
}: AnnonceDetailToolbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleDeleteClick = async () => {
    if (!onDelete) return;
    if (await confirmAction(`Voulez-vous vraiment supprimer « ${publicationTitle} » ?`)) {
      onDelete();
    }
  };

  const renderManageItems = (iconSize: number) => (
    <>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg2)] text-left font-medium"
        >
          <Edit2 size={iconSize} /> Modifier
        </button>
      )}
      {onPinToggle && (
        <button
          type="button"
          onClick={onPinToggle}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg2)] text-left font-medium"
        >
          <Pin size={iconSize} /> {isPinned ? 'Désépingler' : 'Épingler'}
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={handleDeleteClick}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-500/10 text-red-500 text-left font-semibold"
        >
          <Trash2 size={iconSize} /> Supprimer
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Sticky Bar (sm:hidden) */}
      <div className="sm:hidden print:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2.5 bg-[var(--surface)]/95 text-[var(--text)] backdrop-blur-md rounded-t-xl border-b border-[var(--border)] mb-2 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 text-[var(--text)] hover:bg-[var(--bg2)] rounded-full transition-colors"
              aria-label="Fermer"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <span className="text-xs font-semibold truncate text-[var(--text)]">
            {publicationTitle}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className="p-1.5 rounded text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-20 transition-colors"
              aria-label="Précédent"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="p-1.5 rounded text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-20 transition-colors"
              aria-label="Suivant"
            >
              <ChevronRight size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-full hover:bg-[var(--bg2)] text-[var(--text)] transition-colors"
            aria-label="Menu d'actions"
          >
            <MoreVertical size={18} />
          </button>

          {/* Mobile dropdown menu */}
          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 bg-[var(--surface)] rounded-xl shadow-2xl border border-[var(--border)] py-1.5 z-50 text-[var(--text)] text-xs"
              onClick={() => setIsMenuOpen(false)}
            >
              <button
                type="button"
                onClick={onShare}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg2)] text-left"
              >
                <Share2 size={14} /> Partager le lien
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--bg2)] text-left"
              >
                <Printer size={14} /> Imprimer
              </button>
              {canManage && (
                <>
                  <div className="my-1 border-t border-[var(--border)]" />
                  {renderManageItems(14)}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Toolbar (hidden on mobile, print:hidden) */}
      <div className="hidden sm:flex print:hidden items-center justify-between gap-2 pb-3 mb-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-1">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg2)] disabled:opacity-30 border border-[var(--border)] shadow-xs text-xs font-medium transition-colors"
              title="Précédent (Flèche gauche)"
            >
              <ChevronLeft size={14} />
              <span>Précédent</span>
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg2)] disabled:opacity-30 border border-[var(--border)] shadow-xs text-xs font-medium transition-colors"
              title="Suivant (Flèche droite)"
            >
              <span>Suivant</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg2)] border border-[var(--border)] text-xs font-medium shadow-xs transition-colors"
            title="Copier le lien direct"
          >
            <Share2 size={13} />
            <span>Partager</span>
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg2)] border border-[var(--border)] text-xs font-medium shadow-xs transition-colors"
            title="Imprimer ce document officiel"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>

          {canManage && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1.5 rounded-lg bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg2)] border border-[var(--border)] shadow-xs"
                title="Actions de gestion"
              >
                <MoreVertical size={14} />
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-44 bg-[var(--surface)] rounded-xl shadow-xl border border-[var(--border)] py-1 z-50 text-xs text-[var(--text)]"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {renderManageItems(13)}
                </div>
              )}
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <X size={13} />
              <span>Fermer (Échap)</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}

