'use client';

import React from 'react';
import { Eye } from 'lucide-react';
import type { PublicationItem } from '../types';
import PublicationCard from './PublicationCard';

interface PublishPreviewPaneProps {
  previewItem: PublicationItem;
  userRole?: string;
  initialPublicationId?: string;
  mobileTab: 'form' | 'preview';
  onOpenLightbox: (image: { url: string; title: string }) => void;
}

export function PublishPreviewPane({
  previewItem,
  userRole,
  initialPublicationId,
  mobileTab,
  onOpenLightbox,
}: PublishPreviewPaneProps) {
  return (
    <div className={`lg:col-span-5 ${mobileTab === 'form' ? 'hidden lg:block' : 'block'}`}>
      <div className="lg:sticky lg:top-4">
        <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--text)] mb-2">
          <span className="flex items-center gap-1.5">
            <Eye size={14} />
            Aperçu tel qu&apos;il apparaîtra sur le babillard
          </span>
          <span className="text-[11px] text-[var(--text3)] font-semibold">Rendu réel</span>
        </div>

        <div
          className="p-4 sm:p-5 rounded-xl border border-[var(--border)] flex items-center justify-center min-h-[420px]"
          style={{
            background: 'var(--board-bg, #ece5d8)',
            backgroundImage: 'var(--board-texture)',
          }}
        >
          {/* A4: Exact même composant PublicationCard que le panneau */}
          <div className="w-full max-w-[360px]">
            <PublicationCard
              publication={previewItem}
              userRole={userRole}
              canManage={false}
              onClick={() => {
                const imgPj = previewItem.piecesJointes?.find((p) => p.mime.startsWith('image/'));
                const imgUrl =
                  imgPj?.previewUrl ||
                  (initialPublicationId && imgPj?.id
                    ? `/api/v2/babillard/${initialPublicationId}/pieces-jointes/${imgPj.id}`
                    : undefined);
                if (imgUrl) {
                  onOpenLightbox({
                    url: imgUrl,
                    title: imgPj?.nomOriginal || previewItem.titre,
                  });
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

