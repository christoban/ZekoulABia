'use client';

import React, { useEffect } from 'react';
import { Publication } from '../types';
import AnnonceDetailRenderer from '../renderers/AnnonceDetailRenderer';

interface BabillardReaderModalProps {
  publication: Publication | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onMarquerLue?: (id: string) => void;
  userRole?: string;
  userId?: string;
  onEdit?: (pub: Publication) => void;
  onDelete?: (pub: Publication) => void;
  onPinToggle?: (pub: Publication) => void;
}

export const BabillardReaderModal: React.FC<BabillardReaderModalProps> = ({
  publication,
  isOpen,
  onClose,
  onNavigate,
  hasPrev = false,
  hasNext = false,
  onMarquerLue,
  userRole = 'STUDENT',
  userId,
  onEdit,
  onDelete,
  onPinToggle,
}) => {
  // Mark as read when modal opens
  useEffect(() => {
    if (isOpen && publication?.id && onMarquerLue && !publication.isRead) {
      onMarquerLue(publication.id);
    }
  }, [isOpen, publication?.id, publication?.isRead, onMarquerLue]);

  // Keyboard navigation: Escape, ArrowLeft, ArrowRight
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev && onNavigate) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && hasNext && onNavigate) {
        onNavigate('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, onNavigate, onClose]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !publication) return null;

  // Management permissions check
  const isAuthor = !!userId && (publication.auteurId === userId || publication.auteur?.id === userId);
  const isAdminOrCenseur = ['ADMIN', 'PRINCIPAL', 'CENSEUR'].includes(userRole.toUpperCase());
  const canManage = isAdminOrCenseur || isAuthor;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-modal-title"
      data-lenis-prevent
      className="fixed inset-0 z-50 flex flex-col items-center justify-start sm:justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 overscroll-contain"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Sheet Container */}
      <div className="relative w-full max-w-3xl my-2 sm:my-auto animate-in zoom-in-95 duration-200">
        <AnnonceDetailRenderer
          publication={publication}
          onClose={onClose}
          onPrev={hasPrev && onNavigate ? () => onNavigate('prev') : undefined}
          onNext={hasNext && onNavigate ? () => onNavigate('next') : undefined}
          hasPrev={hasPrev}
          hasNext={hasNext}
          canManage={canManage}
          onEdit={onEdit ? () => onEdit(publication) : undefined}
          onDelete={onDelete ? () => onDelete(publication) : undefined}
          onPinToggle={onPinToggle ? () => onPinToggle(publication) : undefined}
        />
      </div>
    </div>
  );
};
