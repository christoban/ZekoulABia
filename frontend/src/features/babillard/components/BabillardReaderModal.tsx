'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Clock3, Loader2, Users } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { Publication, ROLE_LABELS_FR } from '../types';
import AnnonceDetailRenderer from '../renderers/AnnonceDetailRenderer';

interface RecipientReadItem {
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  readAt?: string | null;
}

interface LecturesDetailsData {
  lecturesCount: number;
  destinatairesEligiblesCount: number;
  vus: RecipientReadItem[];
  nonVus: RecipientReadItem[];
}

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
  const [details, setDetails] = useState<LecturesDetailsData | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showTrackingPanel, setShowTrackingPanel] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [remindFeedback, setRemindFeedback] = useState<string | null>(null);

  const isAuthor = Boolean(userId && publication && (publication.auteurId === userId || publication.auteur?.id === userId));
  const isAdminOrCenseur = ['ADMIN', 'PRINCIPAL', 'CENSEUR', 'STAFF'].includes(userRole.toUpperCase());
  const canManage = isAdminOrCenseur || isAuthor;

  const fetchLecturesDetails = useCallback(async (pubId: string) => {
    setLoadingDetails(true);
    try {
      const res = await fetchApi(`/api/v2/babillard/${pubId}/lectures-details`, { credentials: 'include' });
      const json = await res.json();
      if (res.ok && json?.success && json.data) setDetails(json.data);
    } catch {
      // Hors-ligne ou erreur réseau : on conserve l'état existant
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  // Mark as read when modal opens
  useEffect(() => {
    if (isOpen && publication?.id && onMarquerLue && !publication.isRead) {
      onMarquerLue(publication.id);
    }
  }, [isOpen, publication?.id, publication?.isRead, onMarquerLue]);

  // Load read details ("vus" / "nonVus") for author/admin
  useEffect(() => {
    if (!isOpen || !publication?.id || !canManage) {
      setDetails(null);
      setRemindFeedback(null);
      return;
    }
    void fetchLecturesDetails(publication.id);
  }, [isOpen, publication?.id, canManage, fetchLecturesDetails]);

  const handleRelancerNonLus = async () => {
    if (!publication?.id || reminding) return;
    setReminding(true);
    setRemindFeedback(null);
    try {
      const res = await fetchApi(`/api/v2/babillard/${publication.id}/relancer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (res.ok && json?.success && json.data) {
        const { notifiedCount = 0, smsCount = 0 } = json.data as { notifiedCount?: number; smsCount?: number };
        setRemindFeedback(`Relance envoyée : ${notifiedCount} notification(s) push, ${smsCount} SMS.`);
      } else {
        setRemindFeedback(json?.message || 'Impossible de relancer les non-lus.');
      }
    } catch {
      setRemindFeedback('Erreur réseau lors de la relance.');
    } finally {
      setReminding(false);
    }
  };

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
      <div className="relative w-full max-w-3xl my-2 sm:my-auto animate-in zoom-in-95 duration-200 space-y-3">
        <AnnonceDetailRenderer
          publication={publication}
          stats={details ? { lecturesCount: details.lecturesCount, destinatairesEligiblesCount: details.destinatairesEligiblesCount } : undefined}
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

        {canManage && (
          <div className="rounded-xl border border-[var(--paper-edge)] bg-[var(--surface)] p-4 shadow-md text-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-[var(--text)]">
                <Users size={15} className="text-[var(--primary)]" />
                <span>Suivi des lectures</span>
                {loadingDetails && <Loader2 size={13} className="animate-spin text-[var(--text3)]" />}
                {details && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--bg2)] text-[var(--text2)] font-semibold">
                    {details.lecturesCount}/{details.destinatairesEligiblesCount} vus
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {details && (
                  <button
                    type="button"
                    onClick={() => setShowTrackingPanel((v) => !v)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border2)] bg-[var(--bg)] text-[var(--text2)] font-bold cursor-pointer hover:bg-[var(--bg2)]"
                  >
                    {showTrackingPanel ? 'Masquer la liste' : 'Voir vus / non vus'}
                  </button>
                )}
                {details && details.nonVus.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRelancerNonLus}
                    disabled={reminding}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-white cursor-pointer disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
                  >
                    {reminding ? <Loader2 size={13} className="animate-spin" /> : <BellRing size={13} />}
                    <span>Relancer les non-lus ({details.nonVus.length})</span>
                  </button>
                )}
              </div>
            </div>

            {remindFeedback && (
              <div className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-semibold">
                {remindFeedback}
              </div>
            )}

            {showTrackingPanel && details && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 space-y-1.5 max-h-56 overflow-y-auto">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--green)]">
                    <CheckCircle2 size={13} />
                    <span>Ont vu ({details.vus.length})</span>
                  </div>
                  {details.vus.length === 0 ? (
                    <div className="text-[var(--text3)] italic">Aucune lecture enregistrée pour le moment.</div>
                  ) : (
                    details.vus.map((r) => (
                      <div key={r.userId} className="flex items-center justify-between gap-2 py-0.5 text-[var(--text2)]">
                        <span className="truncate font-semibold">{r.firstName} {r.lastName}</span>
                        <span className="text-[10.5px] text-[var(--text3)] shrink-0">{ROLE_LABELS_FR[r.role] ?? r.role}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 space-y-1.5 max-h-56 overflow-y-auto">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--amber)]">
                    <Clock3 size={13} />
                    <span>N&apos;ont pas encore vu ({details.nonVus.length})</span>
                  </div>
                  {details.nonVus.length === 0 ? (
                    <div className="text-[var(--text3)] italic">Tous les destinataires ont consulté ce communiqué.</div>
                  ) : (
                    details.nonVus.map((r) => (
                      <div key={r.userId} className="flex items-center justify-between gap-2 py-0.5 text-[var(--text2)]">
                        <span className="truncate font-semibold">{r.firstName} {r.lastName}</span>
                        <span className="text-[10.5px] text-[var(--text3)] shrink-0">{ROLE_LABELS_FR[r.role] ?? r.role}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
