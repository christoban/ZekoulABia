'use client';

import React from 'react';
import { Download, ExternalLink, FileText, Paperclip } from 'lucide-react';
import type { PieceJointe } from '../types';

interface AnnonceAttachmentsListProps {
  publicationId: string;
  piecesJointes: PieceJointe[];
  onSelectImage: (url: string) => void;
}

export function AnnonceAttachmentsList({
  publicationId,
  piecesJointes,
  onSelectImage,
}: AnnonceAttachmentsListProps) {
  if (!piecesJointes || piecesJointes.length === 0) return null;

  const images = piecesJointes.filter((p) => p.mime.startsWith('image/'));
  const documents = piecesJointes.filter((p) => !p.mime.startsWith('image/'));

  return (
    <div className="border-t border-[var(--paper-edge)] pt-6 mb-8">
      <h3 className="text-sm font-bold text-[var(--paper-text-muted)] uppercase tracking-wider mb-4 flex items-center gap-2">
        <Paperclip size={15} />
        Documents joints ({piecesJointes.length})
      </h3>

      {/* Galerie d'images en grand format */}
      <div className="space-y-4 mb-4">
        {images.map((pj) => {
          const imgUrl = pj.previewUrl || `/api/v2/babillard/${publicationId}/pieces-jointes/${pj.id}`;
          return (
            <div key={pj.id} className="relative rounded overflow-hidden border border-[var(--paper-edge)] group">
              <img
                src={imgUrl}
                alt={pj.texteAlternatif ?? pj.nomOriginal}
                className="w-full max-h-[550px] object-contain bg-[var(--paper-footer-bg)] cursor-zoom-in"
                onClick={() => onSelectImage(imgUrl)}
              />
              <div className="p-2.5 bg-[var(--paper-footer-bg)] border-t border-[var(--paper-edge)] flex items-center justify-between text-xs text-[var(--paper-text-muted)]">
                <span className="font-semibold truncate text-[var(--paper-text)]">{pj.nomOriginal}</span>
                <a
                  href={imgUrl}
                  download={pj.nomOriginal}
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  <Download size={12} /> Télécharger
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fichiers PDF et documents */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {documents.map((pj) => (
          <div
            key={pj.id}
            className="p-3.5 rounded-lg border border-[var(--paper-edge)] bg-[var(--paper-footer-bg)] flex items-center justify-between gap-3 hover:bg-[var(--bg2)] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--paper-text)] truncate" title={pj.nomOriginal}>
                  {pj.nomOriginal}
                </div>
                <div className="text-[11px] text-[var(--paper-text-sub)]">
                  {pj.nbPages ? `${pj.nbPages} page${pj.nbPages > 1 ? 's' : ''} · ` : ''}
                  {(pj.taille / 1024).toFixed(0)} Ko
                </div>
              </div>
            </div>

            <a
              href={`/api/v2/babillard/${publicationId}/pieces-jointes/${pj.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded bg-[var(--surface)] text-[var(--paper-text)] hover:bg-[var(--bg2)] shadow-xs border border-[var(--paper-edge)] transition-colors shrink-0"
              title="Ouvrir le document"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

