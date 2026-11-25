'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown, Check } from 'lucide-react';
import { BABILLARD_CATEGORIES, CategorieDetails } from '../types';

interface BabillardCategoryFilterProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  categoryCounts?: Record<string, number>;
}

export const BabillardCategoryFilter: React.FC<BabillardCategoryFilterProps> = ({
  selectedCategory,
  onSelectCategory,
  categoryCounts = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentCategoryDetail: CategorieDetails | undefined =
    selectedCategory !== 'ALL'
      ? (BABILLARD_CATEGORIES as Record<string, CategorieDetails>)[selectedCategory]
      : undefined;

  const currentLabel = currentCategoryDetail
    ? currentCategoryDetail.label
    : 'Toutes catégories';

  const handleSelect = (key: string) => {
    onSelectCategory(key);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      {/* Trigger Button - compact et épuré */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filtrer par catégorie"
        className={`flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-2 min-h-[38px] rounded-xl border text-xs font-bold transition shadow-xs select-none ${
          selectedCategory !== 'ALL'
            ? 'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary)]/40 ring-1 ring-[var(--primary)]/20'
            : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--bg2)]'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {selectedCategory !== 'ALL' && currentCategoryDetail ? (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: currentCategoryDetail.badgeColor }}
            />
          ) : (
            <Filter size={13} className="text-[var(--text3)] shrink-0" />
          )}
          <span className="truncate max-w-[85px] sm:max-w-[130px] text-left">
            {currentLabel}
          </span>
          {categoryCounts[selectedCategory] !== undefined && (
            <span className="text-[10px] opacity-75 font-semibold shrink-0">
              ({categoryCounts[selectedCategory]})
            </span>
          )}
        </div>

        <ChevronDown
          size={13}
          className={`text-[var(--text3)] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-[var(--primary)]' : ''
          }`}
        />
      </button>

      {/* Menu déroulant compact — positionné juste sous le bouton, sans bloquer l'écran */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="Liste des catégories"
          className="absolute left-0 top-full mt-1.5 z-40 w-48 sm:w-56 max-h-56 overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl p-1 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Option: Toutes catégories */}
          <button
            type="button"
            role="option"
            aria-selected={selectedCategory === 'ALL'}
            onClick={() => handleSelect('ALL')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition text-left ${
              selectedCategory === 'ALL'
                ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold'
                : 'text-[var(--text)] hover:bg-[var(--bg2)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text3)]" />
              <span>Toutes catégories</span>
            </div>
            <div className="flex items-center gap-1.5">
              {categoryCounts.ALL !== undefined && (
                <span className="text-[10px] text-[var(--text3)] font-normal">
                  {categoryCounts.ALL}
                </span>
              )}
              {selectedCategory === 'ALL' && <Check size={13} className="text-[var(--primary)]" />}
            </div>
          </button>

          <div className="my-1 border-t border-[var(--border)]" />

          {/* Liste des catégories */}
          <div className="space-y-0.5">
            {(Object.entries(BABILLARD_CATEGORIES) as [string, CategorieDetails][]).map(([key, cat]) => {
              const isSelected = selectedCategory === key;
              const count = categoryCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(key)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold transition text-left ${
                    isSelected
                      ? 'bg-[var(--primary-light)] text-[var(--primary)] font-bold'
                      : 'text-[var(--text)] hover:bg-[var(--bg2)]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.badgeColor }}
                    />
                    <span className="truncate">{cat.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {count !== undefined && (
                      <span className="text-[10px] text-[var(--text3)] font-normal">
                        {count}
                      </span>
                    )}
                    {isSelected && <Check size={13} className="text-[var(--primary)]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BabillardCategoryFilter;
