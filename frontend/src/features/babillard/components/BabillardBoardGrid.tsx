'use client';

import React from 'react';
import {
  Archive,
  BookOpen,
  Clock,
  Loader2,
  Pin,
  Plus,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { Publication } from '../types';
import AnnonceCardRenderer from '../renderers/AnnonceCardRenderer';
import type { BabillardTabType } from './useBabillardBoardData';

interface BabillardBoardGridProps {
  loading: boolean;
  activeTab: BabillardTabType;
  peutPublier: boolean;
  role: string;
  currentUserId?: string;
  filteredCount: number;
  pinnedList: Publication[];
  standardList: Publication[];
  onCreateNew: () => void;
  onOpenReader: (pub: Publication) => void;
  onPinToggle: (pub: Publication) => void;
  onEdit: (pub: Publication) => void;
  onDelete: (pub: Publication) => void;
  onMarquerLue: (id: string) => void;
}

export function BabillardBoardGrid({
  loading,
  activeTab,
  peutPublier,
  role,
  currentUserId,
  filteredCount,
  pinnedList,
  standardList,
  onCreateNew,
  onOpenReader,
  onPinToggle,
  onEdit,
  onDelete,
  onMarquerLue,
}: BabillardBoardGridProps) {
  return (
    /* ========================================================
       C: CADRE MATÉRIALISÉ DU PANNEAU DE LIÈGE
       ======================================================== */
    <main
      className="w-full max-w-7xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 pb-2.5 sm:pb-5 border-[5px] sm:border-[7px] shadow-xl shrink-0 h-auto"
      style={{
        backgroundColor: 'var(--cork-panel-bg)',
        borderColor: 'var(--cork-panel-border)',
        backgroundImage: 'radial-gradient(var(--cork-panel-dots) 0.75px, transparent 0.75px)',
        backgroundSize: '14px 14px',
        boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.12), 0 8px 24px -4px rgba(0, 0, 0, 0.15)',
      }}
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)] mb-3" />
          <p className="text-xs sm:text-sm font-semibold text-[var(--cork-panel-text)]">
            Synchronisation du babillard officiel...
          </p>
        </div>
      ) : filteredCount === 0 ? (
        /* Empty Cork Board Message */
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div
            className="relative p-6 sm:p-10 max-w-md w-full text-center rounded-lg shadow-md"
            style={{
              backgroundColor: 'var(--paper, #fcfbf9)',
              color: 'var(--paper-text, var(--text))',
              border: '1px solid var(--paper-edge, var(--border))',
              transform: 'rotate(-0.5deg)',
            }}
          >
            <div className="w-10 h-10 rounded-full bg-[var(--primary-light)] text-[var(--primary)] flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-spectral text-lg font-bold text-[var(--paper-text, var(--text))] mb-1">
              Babillard vide
            </h3>
            <p className="text-xs text-[var(--paper-text-muted, var(--text2))] leading-relaxed mb-4">
              {activeTab === 'archives'
                ? 'Aucune archive n’est enregistrée sur le babillard.'
                : activeTab === 'unread'
                ? 'Vous êtes à jour ! Aucun communiqué non lu.'
                : 'Aucun communiqué officiel n’est affiché pour le moment.'}
            </p>
            {peutPublier && activeTab === 'all' && (
              <button
                onClick={onCreateNew}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg text-xs font-bold shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Rédiger une publication
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          {/* B3: Pinned Section ("À la une") with 2-col first card on desktop */}
          {pinnedList.length > 0 && (
            <section aria-labelledby="pinned-section-title">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[var(--border)]">
                <Pin className="w-4 h-4 text-orange-600 fill-current shrink-0" />
                <h2
                  id="pinned-section-title"
                  className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[var(--cork-panel-title)]"
                >
                  À la une de l’établissement
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                {pinnedList.map((pub, idx) => (
                  <div
                    key={pub.id}
                    className={idx === 0 ? 'lg:col-span-2' : ''}
                  >
                    <AnnonceCardRenderer
                      publication={pub}
                      userRole={role}
                      userId={currentUserId}
                      onClick={() => onOpenReader(pub)}
                      onPinToggle={() => onPinToggle(pub)}
                      onEdit={() => onEdit(pub)}
                      onDelete={() => onDelete(pub)}
                      onMarquerLue={() => onMarquerLue(pub.id)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Standard Publications Section */}
          {standardList.length > 0 && (
            <section aria-labelledby="general-section-title">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[var(--border)]">
                {activeTab === 'unread' ? (
                  <>
                    <BookOpen className="w-4 h-4 text-[var(--cork-panel-title)] shrink-0" />
                    <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[var(--cork-panel-title)]">
                      Communiqués non lus ({standardList.length})
                    </h2>
                  </>
                ) : activeTab === 'for_me' ? (
                  <>
                    <UserCheck className="w-4 h-4 text-[var(--cork-panel-title)] shrink-0" />
                    <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[var(--cork-panel-title)]">
                      Publications pour moi ({standardList.length})
                    </h2>
                  </>
                ) : activeTab === 'archives' ? (
                  <>
                    <Archive className="w-4 h-4 text-[var(--cork-panel-title)] shrink-0" />
                    <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[var(--cork-panel-title)]">
                      Archives du babillard ({standardList.length})
                    </h2>
                  </>
                ) : pinnedList.length > 0 ? (
                  <>
                    <Clock className="w-4 h-4 text-[var(--cork-panel-title)] shrink-0" />
                    <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[var(--cork-panel-title)]">
                      Autres publications
                    </h2>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-[var(--cork-panel-title)] shrink-0" />
                    <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[var(--cork-panel-title)]">
                      Toutes les publications ({standardList.length})
                    </h2>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                {standardList.map((pub) => (
                  <AnnonceCardRenderer
                    key={pub.id}
                    publication={pub}
                    userRole={role}
                    userId={currentUserId}
                    onClick={() => onOpenReader(pub)}
                    onPinToggle={() => onPinToggle(pub)}
                    onEdit={() => onEdit(pub)}
                    onDelete={() => onDelete(pub)}
                    onMarquerLue={() => onMarquerLue(pub.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

