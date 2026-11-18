'use client';

import React from 'react';
import { Eye, FileText, Trash2, UploadCloud } from 'lucide-react';
import type { PieceJointe } from '../types';

interface PublishAttachmentsSectionProps {
  piecesJointes: PieceJointe[];
  initialPublicationId?: string;
  uploading: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePieceJointe: (id: string) => void;
  onOpenLightbox: (image: { url: string; title: string }) => void;
}

export function PublishAttachmentsSection({
  piecesJointes,
  initialPublicationId,
  uploading,
  onFileUpload,
  onRemovePieceJointe,
  onOpenLightbox,
}: PublishAttachmentsSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--text)] mb-1">
        <span>Documents joints (PDF ou Images, max 10 Mo)</span>
        <span className="text-[11px] text-[var(--text3)]">{piecesJointes.length}/5 documents</span>
      </div>

      <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-3.5 bg-[var(--bg2)] text-center">
        <input
          type="file"
          id="pub-file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={onFileUpload}
          disabled={uploading || piecesJointes.length >= 5}
        />
        <label
          htmlFor="pub-file"
          className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
        >
          <UploadCloud size={15} />
          {uploading ? 'Téléversement en cours...' : 'Ajouter un document'}
        </label>
        <div className="text-[11px] text-[var(--text3)] mt-1.5">
          Glissez un fichier ou cliquez ci-dessus. Formats : PDF, JPG, PNG, WebP.
        </div>
      </div>

      {/* Liste des pièces jointes */}
      {piecesJointes.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {piecesJointes.map((pj) => {
            const isImg = pj.mime.startsWith('image/');
            const displayUrl =
              pj.previewUrl ||
              (initialPublicationId
                ? `/api/v2/babillard/${initialPublicationId}/pieces-jointes/${pj.id}`
                : undefined);

            return (
              <div
                key={pj.id}
                className="flex items-center justify-between px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] group hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isImg && displayUrl ? (
                    <button
                      type="button"
                      onClick={() => onOpenLightbox({ url: displayUrl, title: pj.nomOriginal })}
                      className="relative w-9 h-9 rounded overflow-hidden border border-[var(--border)] shrink-0 group/thumb cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                      title="Cliquer pour agrandir l'image"
                    >
                      <img
                        src={displayUrl}
                        alt={pj.nomOriginal}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <Eye size={12} />
                      </div>
                    </button>
                  ) : (
                    <div className="w-9 h-9 rounded bg-[var(--bg2)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                      <FileText size={16} className="text-[var(--text3)]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    {isImg && displayUrl ? (
                      <button
                        type="button"
                        onClick={() => onOpenLightbox({ url: displayUrl, title: pj.nomOriginal })}
                        className="text-left font-medium text-[var(--text)] hover:text-primary transition-colors truncate block max-w-[200px] sm:max-w-[240px] cursor-pointer"
                        title="Cliquer pour inspecter l'image"
                      >
                        {pj.nomOriginal}
                      </button>
                    ) : (
                      <span className="truncate font-medium block max-w-[200px] sm:max-w-[240px]">{pj.nomOriginal}</span>
                    )}
                    <span className="text-[11px] text-[var(--text3)]">
                      {(pj.taille / 1024).toFixed(0)} Ko {isImg && '· Image'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isImg && displayUrl && (
                    <button
                      type="button"
                      onClick={() => onOpenLightbox({ url: displayUrl, title: pj.nomOriginal })}
                      className="text-[var(--text2)] hover:text-primary p-1.5 rounded hover:bg-[var(--bg2)] transition-colors"
                      title="Aperçu grand format"
                    >
                      <Eye size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemovePieceJointe(pj.id)}
                    className="text-red-500 hover:text-red-600 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                    title="Retirer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

