'use client';

import React from 'react';
import {
  Archive,
  BookOpen,
  Megaphone,
  Pin,
  Plus,
  Search,
  UserCheck,
  WifiOff,
  X,
} from 'lucide-react';
import { BabillardCategoryFilter } from './BabillardCategoryFilter';
import type { BabillardTabCounts, BabillardTabType } from './useBabillardBoardData';

interface BabillardBoardHeaderProps {
  title: string;
  subtitle: string;
  peutPublier: boolean;
  isOffline: boolean;
  activeTab: BabillardTabType;
  tabCounts: BabillardTabCounts;
  selectedCategory: string;
  categoryCounts: Record<string, number>;
  searchQuery: string;
  onPublishClick: () => void;
  onTabChange: (tab: BabillardTabType) => void;
  onSelectCategory: (category: string) => void;
  onSearchChange: (query: string) => void;
}

export function BabillardBoardHeader({
  title,
  subtitle,
  peutPublier,
  isOffline,
  activeTab,
  tabCounts,
  selectedCategory,
  categoryCounts,
  searchQuery,
  onPublishClick,
  onTabChange,
  onSelectCategory,
  onSearchChange,
}: BabillardBoardHeaderProps) {
  return (
    <>
      {/* ========================================================
          B1: HEADER DU PANNEAU
          - Mobile (sm:hidden) : Bandeau compact évitant d'écraser la première feuille
          - Desktop (hidden sm:flex) : Carte d'en-tête élégante
         ======================================================== */}
      {/* Mobile Top Bar (sm:hidden) */}
      <div className="w-full max-w-7xl sm:hidden flex items-center justify-between gap-2 mb-3">
        <h1 className="font-spectral text-xl font-extrabold text-[var(--text)]">
          Babillard
        </h1>

        {peutPublier && (
          <button
            onClick={onPublishClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-95 text-white font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publier</span>
          </button>
        )}
      </div>

      {/* Desktop Header Banner (hidden on mobile < 640px) */}
      <header className="hidden sm:flex w-full max-w-7xl mb-6 items-center justify-between gap-4 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[var(--primary-light)] text-[var(--primary)] shadow-xs">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-spectral text-2xl font-bold tracking-tight text-[var(--text)]">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text2)] mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Action Button: Publish */}
        {peutPublier && (
          <button
            onClick={onPublishClick}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[38px] rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-95 text-white font-bold text-sm shadow-md transition duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>Publier un communiqué</span>
          </button>
        )}
      </header>

      {/* Offline Alert */}
      {isOffline && (
        <div className="w-full max-w-7xl mb-4 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center gap-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
          <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            <strong>Mode hors ligne</strong> — Affichage des communiqués synchronisés.
          </span>
        </div>
      )}

      {/* ========================================================
          B1 & B2: FILTRES AVEC COMPTEURS + RECHERCHE & CATÉGORIE
         ======================================================== */}
      <div className="w-full max-w-7xl mb-6 flex flex-col gap-3">
        {/* Tabs Row (Scrollable horizontally on mobile with counters) */}
        <div
          className="flex items-center gap-1.5 p-1 bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-xs overflow-x-auto scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
        >
          <button
            onClick={() => onTabChange('all')}
            className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text2)] hover:bg-[var(--bg2)] hover:text-[var(--text)]'
            }`}
          >
            Tous ({tabCounts.all})
          </button>
          <button
            onClick={() => onTabChange('pinned')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'pinned'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text2)] hover:bg-[var(--bg2)] hover:text-[var(--text)]'
            }`}
          >
            <Pin className={`w-3 h-3 ${activeTab === 'pinned' ? 'fill-current text-[var(--accent)]' : 'fill-current text-orange-500'}`} />
            <span>À la une</span> ({tabCounts.pinned})
          </button>
          <button
            onClick={() => onTabChange('unread')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'unread'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text2)] hover:bg-[var(--bg2)] hover:text-[var(--text)]'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>Non lus</span> ({tabCounts.unread})
          </button>
          <button
            onClick={() => onTabChange('for_me')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'for_me'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text2)] hover:bg-[var(--bg2)] hover:text-[var(--text)]'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>Pour moi</span> ({tabCounts.for_me})
          </button>
          <button
            onClick={() => onTabChange('archives')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'archives'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text2)] hover:bg-[var(--bg2)] hover:text-[var(--text)]'
            }`}
          >
            <Archive className="w-3 h-3" />
            <span>Archives</span> ({tabCounts.archives})
          </button>
        </div>

        {/* B1: Single row for Category Filter & Search */}
        <div className="flex items-center gap-2 w-full">
          {/* Category Custom Dropdown / Volet */}
          <BabillardCategoryFilter
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            categoryCounts={categoryCounts}
          />

          {/* B2: Search Input with clear magnifying glass icon */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Rechercher un communiqué..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[var(--surface)] rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text)] placeholder-[var(--text3)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] pointer-events-none z-10" />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text3)] hover:text-[var(--text)] z-10 p-0.5"
                title="Effacer la recherche"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

