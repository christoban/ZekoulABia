'use client';

import React, { useEffect, useState } from 'react';
import { Megaphone, ArrowRight, X } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { Publication } from '../types';
import { BabillardReaderModal } from './BabillardReaderModal';

interface UnreadAnnouncementBannerProps {
  onNavigateToBabillard?: () => void;
  userRole?: string;
  userId?: string;
}

export const UnreadAnnouncementBanner: React.FC<UnreadAnnouncementBannerProps> = ({
  onNavigateToBabillard,
  userRole,
  userId,
}) => {
  const [unreadPinned, setUnreadPinned] = useState<Publication | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkUnread = async () => {
      try {
        const res = await fetchApi('/api/v2/babillard?tab=une');
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        const pinnedItems: Publication[] = data.publications || [];
        const firstUnread = pinnedItems.find((p) => !p.isRead);
        if (firstUnread) {
          setUnreadPinned(firstUnread);
        }
      } catch (_) {}
    };

    checkUnread();
    return () => {
      isMounted = false;
    };
  }, []);

  if (!unreadPinned || dismissed) return null;

  return (
    <>
      <aside
        aria-label="Avis officiel important"
        className="w-full mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-800 to-amber-900 text-white shadow-md flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-white/10 shrink-0">
            <Megaphone className="w-5 h-5 text-amber-200 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold bg-amber-600/60 px-2 py-0.5 rounded text-amber-100">
                Avis officiel
              </span>
              <span className="text-xs text-amber-200">À la une</span>
            </div>
            <p className="text-sm font-semibold truncate mt-0.5 font-spectral">
              {unreadPinned.titre}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsReaderOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-amber-950 hover:bg-amber-50 font-semibold text-xs transition shadow-sm"
          >
            <span>Lire le communiqué</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-amber-200 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Masquer le bandeau"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {unreadPinned && (
        <BabillardReaderModal
          publication={unreadPinned}
          isOpen={isReaderOpen}
          onClose={() => {
            setIsReaderOpen(false);
            setDismissed(true);
          }}
          onMarquerLue={async (id) => {
            try {
              await fetchApi(`/api/v2/babillard/${id}/lu`, { method: 'POST' });
              setDismissed(true);
            } catch (_) {}
          }}
          userRole={userRole}
          userId={userId}
        />
      )}
    </>
  );
};
