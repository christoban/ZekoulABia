'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Pin,
  Search,
  Plus,
  WifiOff,
  Clock,
  Sparkles,
  Archive,
  BookOpen,
  UserCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Megaphone,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { Publication, BABILLARD_CATEGORIES, CategorieDetails } from '../types';
import AnnonceCardRenderer from '../renderers/AnnonceCardRenderer';
import { BabillardReaderModal } from './BabillardReaderModal';
import BabillardPublishModal from './BabillardPublishModal';

interface BabillardBoardProps {
  role?: string;
  currentUserId?: string;
  title?: string;
  subtitle?: string;
}

type TabType = 'all' | 'pinned' | 'for_me' | 'unread' | 'archives';

export const BabillardBoard: React.FC<BabillardBoardProps> = ({
  role = 'STUDENT',
  currentUserId,
  title = 'Babillard Officiel',
  subtitle = 'Communiqués officiels, décisions et avis de l’établissement',
}) => {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isOffline, setIsOffline] = useState(false);

  // Tab counters
  const [tabCounts, setTabCounts] = useState<{
    all: number;
    pinned: number;
    for_me: number;
    unread: number;
    archives: number;
  }>({ all: 0, pinned: 0, for_me: 0, unread: 0, archives: 0 });

  // Reader Modal State
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null);
  const [readerIndex, setReaderIndex] = useState<number>(-1);

  // Publish / Edit Modal State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null);
  const [deletingPublication, setDeletingPublication] = useState<Publication | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Restore filter from URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const f = params.get('filtre');
      if (f === 'nonLus') setActiveTab('unread');
      else if (f === 'une') setActiveTab('pinned');
      else if (f === 'archives') setActiveTab('archives');
      else if (f === 'pourMoi') setActiveTab('for_me');
      else setActiveTab('all');
    }
  }, []);

  // Update URL on tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParamMap: Record<TabType, string> = {
        all: 'tous',
        pinned: 'une',
        for_me: 'pourMoi',
        unread: 'nonLus',
        archives: 'archives',
      };
      params.set('filtre', tabParamMap[tab]);
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', newUrl);
    }
  };

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync with AI assistant FAB hiding
  useEffect(() => {
    const isAnyModalOpen = isPublishModalOpen || !!selectedPublication || !!deletingPublication;
    window.dispatchEvent(new CustomEvent('zekoulabia:modal-open', { detail: { open: isAnyModalOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('zekoulabia:modal-open', { detail: { open: false } }));
    };
  }, [isPublishModalOpen, selectedPublication, deletingPublication]);

  // Load publications with accurate counts
  const loadPublications = useCallback(async () => {
    setLoading(true);
    const tabParamMap: Record<TabType, string> = {
      all: 'tous',
      pinned: 'une',
      for_me: 'pourMoi',
      unread: 'nonLus',
      archives: 'archives',
    };

    const tabParam = tabParamMap[activeTab];
    const url = `/api/v2/babillard?tab=${tabParam}`;

    try {
      const res = await fetchApi(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Erreur lors du chargement des publications');
      const data = await res.json();
      
      // We successfully communicated with server -> reset offline!
      setIsOffline(false);

      const items: Publication[] = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.publications)
        ? data.publications
        : Array.isArray(data)
        ? data
        : [];
      setPublications(items);

      // Cache locally for offline viewing
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`babillard_cache_${activeTab}`, JSON.stringify(items));
        } catch (_) {}
      }

      // Sync exact counts from backend
      if (data.counts) {
        setTabCounts({
          all: data.counts.tous ?? 0,
          pinned: data.counts.une ?? 0,
          for_me: data.counts.pourMoi ?? 0,
          unread: data.counts.nonLus ?? 0,
          archives: data.counts.archives ?? 0,
        });
      }
    } catch {
      // Offline fallback ONLY if navigator is truly offline
      if (typeof window !== 'undefined' && !navigator.onLine) {
        setIsOffline(true);
        const cached = localStorage.getItem(`babillard_cache_${activeTab}`);
        if (cached) {
          try {
            setPublications(JSON.parse(cached));
          } catch (_) {}
        }
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadPublications();
  }, [loadPublications]);

  // A5: Strictly ADMIN, PRINCIPAL, CENSEUR can publish
  const peutPublier = useMemo(() => {
    const pubRoles = ['ADMIN', 'PRINCIPAL', 'CENSEUR'];
    return pubRoles.includes(role.toUpperCase());
  }, [role]);

  // Filtering publications by search and category
  const filteredPublications = useMemo(() => {
    return publications.filter((pub) => {
      // Category filter
      if (selectedCategory !== 'ALL' && pub.categorie !== selectedCategory) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = pub.titre.toLowerCase().includes(q);
        const textContent = pub.corps || pub.contenu || '';
        const matchesContent = textContent.toLowerCase().includes(q);
        const authorName = pub.auteur
          ? `${pub.auteur.prenom || pub.auteur.firstName || ''} ${pub.auteur.nom || pub.auteur.lastName || ''}`.trim()
          : '';
        const matchesAuthor = authorName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesContent && !matchesAuthor) {
          return false;
        }
      }
      return true;
    });
  }, [publications, selectedCategory, searchQuery]);

  // Separate pinned and non-pinned when on "all" tab
  const { pinnedList, standardList } = useMemo(() => {
    if (activeTab === 'pinned') {
      return { pinnedList: filteredPublications, standardList: [] };
    }
    if (activeTab !== 'all') {
      return { pinnedList: [], standardList: filteredPublications };
    }
    const pinned: Publication[] = [];
    const standard: Publication[] = [];
    filteredPublications.forEach((p) => {
      if (p.isPinned || p.epinglee) pinned.push(p);
      else standard.push(p);
    });
    return { pinnedList: pinned, standardList: standard };
  }, [filteredPublications, activeTab]);

  // Handle Mark As Read
  const handleMarquerLue = async (id: string) => {
    setPublications((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isRead: true } : p))
    );
    setTabCounts((prev) => ({
      ...prev,
      unread: Math.max(0, prev.unread - 1),
    }));
    try {
      await fetchApi(`/api/v2/babillard/${id}/lu`, { method: 'POST' });
    } catch (_) {}
  };

  // Handle Pin Toggle
  const handleTogglePin = async (pub: Publication) => {
    const newPinnedState = !pub.isPinned;
    // Optimistic
    setPublications((prev) =>
      prev.map((p) => (p.id === pub.id ? { ...p, isPinned: newPinnedState, epinglee: newPinnedState } : p))
    );

    try {
      const res = await fetchApi(`/api/v2/babillard/${pub.id}/epingler`, {
        method: 'POST',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de l’épinglage');
      }
      const data = await res.json();
      showToast(
        data.isPinned
          ? 'Communiqué épinglé à la une du babillard.'
          : 'Communiqué retiré de la une.'
      );
      loadPublications();
    } catch (err: any) {
      showToast(err.message || 'Impossible de modifier l’épinglage', 'error');
      // Revert
      setPublications((prev) =>
        prev.map((p) => (p.id === pub.id ? { ...p, isPinned: !newPinnedState, epinglee: !newPinnedState } : p))
      );
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!deletingPublication) return;
    setIsDeleting(true);
    try {
      const res = await fetchApi(`/api/v2/babillard/${deletingPublication.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la suppression');
      }
      showToast('Le communiqué a été supprimé.');
      setDeletingPublication(null);
      loadPublications();
    } catch (err: any) {
      showToast(err.message || 'Échec de la suppression', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Reader navigation
  const openReader = (pub: Publication) => {
    const idx = filteredPublications.findIndex((p) => p.id === pub.id);
    setReaderIndex(idx);
    setSelectedPublication(pub);
  };

  const handleReaderNavigate = (direction: 'prev' | 'next') => {
    if (readerIndex < 0) return;
    const newIdx = direction === 'prev' ? readerIndex - 1 : readerIndex + 1;
    if (newIdx >= 0 && newIdx < filteredPublications.length) {
      setReaderIndex(newIdx);
      setSelectedPublication(filteredPublications[newIdx]);
    }
  };

  return (
    <div
      data-lenis-prevent
      className="h-full w-full overflow-y-auto relative p-3 sm:p-6 lg:p-8 pb-36 sm:pb-24 flex flex-col items-center select-text"
      style={{
        backgroundColor: 'var(--board-bg, #f3eedf)',
        backgroundImage: 'var(--board-texture)',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md border text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-success/90 text-success border-success/30'
              : 'bg-rose-950/90 text-rose-100 border-rose-500/30'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-white/10 rounded-md ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================
          B1: HEADER DU PANNEAU
          - Mobile (sm:hidden) : Bandeau compact évitant d'écraser la première feuille
          - Desktop (hidden sm:flex) : Carte d'en-tête élégante
         ======================================================== */}
      {/* Mobile Top Bar (sm:hidden) */}
      <div className="w-full max-w-7xl sm:hidden flex items-center justify-between gap-2 mb-3">
        <h1 className="font-spectral text-xl font-extrabold text-neutral-900 dark:text-white">
          Babillard
        </h1>

        {peutPublier && (
          <button
            onClick={() => {
              setEditingPublication(null);
              setIsPublishModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success active:scale-95 text-white font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Publier</span>
          </button>
        )}
      </div>

      {/* Desktop Header Banner (hidden on mobile < 640px) */}
      <header className="hidden sm:flex w-full max-w-7xl mb-6 items-center justify-between gap-4 p-5 rounded-2xl bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-amber-900/15 dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-success text-success dark:bg-success shadow-md">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-spectral text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              {title}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Action Button: Publish (Green/Emerald per C rule) */}
        {peutPublier && (
          <button
            onClick={() => {
              setEditingPublication(null);
              setIsPublishModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-success hover:bg-success active:scale-95 text-white font-bold text-sm shadow-md transition duration-150"
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
          className="flex items-center gap-1.5 p-1 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl border border-neutral-300 dark:border-neutral-700 shadow-xs overflow-x-auto scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
        >
          <button
            onClick={() => handleTabChange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-success text-white shadow-xs'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Tous ({tabCounts.all})
          </button>
          <button
            onClick={() => handleTabChange('pinned')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'pinned'
                ? 'bg-success text-white shadow-xs'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Pin className="w-3 h-3 fill-current text-orange-500" />
            <span>À la une</span> ({tabCounts.pinned})
          </button>
          <button
            onClick={() => handleTabChange('unread')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'unread'
                ? 'bg-success text-white shadow-xs'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>Non lus</span> ({tabCounts.unread})
          </button>
          <button
            onClick={() => handleTabChange('for_me')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'for_me'
                ? 'bg-success text-white shadow-xs'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>Pour moi</span> ({tabCounts.for_me})
          </button>
          <button
            onClick={() => handleTabChange('archives')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'archives'
                ? 'bg-success text-white shadow-xs'
                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Archive className="w-3 h-3" />
            <span>Archives</span> ({tabCounts.archives})
          </button>
        </div>

        {/* B1: Single row for Category & Search on mobile and desktop */}
        <div className="flex items-center gap-2 w-full">
          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-36 sm:w-48 px-3 py-2 bg-white dark:bg-neutral-800 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-xs truncate"
          >
            <option value="ALL">Toutes catégories</option>
            {(Object.entries(BABILLARD_CATEGORIES) as [string, CategorieDetails][]).map(([key, cat]) => (
              <option key={key} value={key}>
                {cat.label}
              </option>
            ))}
          </select>

          {/* B2: Search Input with clear magnifying glass icon */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Rechercher un communiqué..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-neutral-800 rounded-xl border-2 border-neutral-300 dark:border-neutral-600 text-xs font-semibold text-neutral-900 dark:text-neutral-100 placeholder-neutral-500 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 dark:text-neutral-300 pointer-events-none z-10" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 z-10 p-0.5"
                title="Effacer la recherche"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          C: CADRE MATÉRIALISÉ DU PANNEAU DE LIÈGE
         ======================================================== */}
      <main
        className="w-full max-w-7xl rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 pb-2.5 sm:pb-5 border-[5px] sm:border-[7px] border-[#9c7a4a] shadow-xl shrink-0 h-auto"
        style={{
          backgroundColor: '#f5efe0',
          backgroundImage: 'radial-gradient(#b89e72 0.75px, transparent 0.75px)',
          backgroundSize: '14px 14px',
          boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.12), 0 8px 24px -4px rgba(0, 0, 0, 0.15)',
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center p-16">
            <Loader2 className="w-8 h-8 animate-spin text-success mb-3" />
            <p className="text-xs sm:text-sm font-semibold text-[#2b2118]">
              Synchronisation du babillard officiel...
            </p>
          </div>
        ) : filteredPublications.length === 0 ? (
          /* Empty Cork Board Message */
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div
              className="relative p-6 sm:p-10 max-w-md w-full text-center rounded-lg shadow-md"
              style={{
                backgroundColor: 'var(--paper, #fcfbf9)',
                color: 'var(--foreground, #1a1209)',
                border: '1px solid var(--paper-edge, #e2dacb)',
                transform: 'rotate(-0.5deg)',
              }}
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-spectral text-lg font-bold text-neutral-900 mb-1">
                Babillard vide
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed mb-4">
                {activeTab === 'archives'
                  ? 'Aucune archive n’est enregistrée sur le babillard.'
                  : activeTab === 'unread'
                  ? 'Vous êtes à jour ! Aucun communiqué non lu.'
                  : 'Aucun communiqué officiel n’est affiché pour le moment.'}
              </p>
              {peutPublier && activeTab === 'all' && (
                <button
                  onClick={() => setIsPublishModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-success hover:bg-success text-white rounded-lg text-xs font-bold shadow-sm transition"
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
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#8c6b45]/40">
                  <Pin className="w-4 h-4 text-orange-600 fill-current shrink-0" />
                  <h2
                    id="pinned-section-title"
                    className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[#2b2118]"
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
                        onClick={() => openReader(pub)}
                        onPinToggle={() => handleTogglePin(pub)}
                        onEdit={() => {
                          setEditingPublication(pub);
                          setIsPublishModalOpen(true);
                        }}
                        onDelete={() => setDeletingPublication(pub)}
                        onMarquerLue={() => handleMarquerLue(pub.id)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Standard Publications Section */}
            {standardList.length > 0 && (
              <section aria-labelledby="general-section-title">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#8c6b45]/40">
                  {activeTab === 'unread' ? (
                    <>
                      <BookOpen className="w-4 h-4 text-[#2b2118] shrink-0" />
                      <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[#2b2118]">
                        Communiqués non lus ({standardList.length})
                      </h2>
                    </>
                  ) : activeTab === 'for_me' ? (
                    <>
                      <UserCheck className="w-4 h-4 text-[#2b2118] shrink-0" />
                      <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[#2b2118]">
                        Publications pour moi ({standardList.length})
                      </h2>
                    </>
                  ) : activeTab === 'archives' ? (
                    <>
                      <Archive className="w-4 h-4 text-[#2b2118] shrink-0" />
                      <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[#2b2118]">
                        Archives du babillard ({standardList.length})
                      </h2>
                    </>
                  ) : pinnedList.length > 0 ? (
                    <>
                      <Clock className="w-4 h-4 text-[#2b2118] shrink-0" />
                      <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[#2b2118]">
                        Autres publications
                      </h2>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-[#2b2118] shrink-0" />
                      <h2 id="general-section-title" className="font-spectral text-base sm:text-lg font-bold tracking-tight text-[#2b2118]">
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
                      onClick={() => openReader(pub)}
                      onPinToggle={() => handleTogglePin(pub)}
                      onEdit={() => {
                        setEditingPublication(pub);
                        setIsPublishModalOpen(true);
                      }}
                      onDelete={() => setDeletingPublication(pub)}
                      onMarquerLue={() => handleMarquerLue(pub.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Espace utile au bas du contenu : zéro vide superflu sur mobile, dégagé sur desktop pour que l'Assistant IA n'empiète jamais sur le cadre */}
      <div
        className="w-full h-1 md:h-28 shrink-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Reader Modal */}
      <BabillardReaderModal
        publication={selectedPublication}
        isOpen={!!selectedPublication}
        onClose={() => setSelectedPublication(null)}
        onNavigate={handleReaderNavigate}
        hasPrev={readerIndex > 0}
        hasNext={readerIndex >= 0 && readerIndex < filteredPublications.length - 1}
        onMarquerLue={handleMarquerLue}
        userRole={role}
        userId={currentUserId}
        onEdit={(pub) => {
          setSelectedPublication(null);
          setEditingPublication(pub);
          setIsPublishModalOpen(true);
        }}
        onDelete={(pub) => {
          setSelectedPublication(null);
          setDeletingPublication(pub);
        }}
        onPinToggle={(pub) => handleTogglePin(pub)}
      />

      {/* Publish / Edit Modal */}
      <BabillardPublishModal
        isOpen={isPublishModalOpen}
        onClose={() => {
          setIsPublishModalOpen(false);
          setEditingPublication(null);
        }}
        onSaved={() => {
          setIsPublishModalOpen(false);
          setEditingPublication(null);
          showToast(
            editingPublication
              ? 'Communiqué mis à jour avec succès.'
              : 'Communiqué publié sur le babillard.'
          );
          loadPublications();
        }}
        initialData={editingPublication}
        userRole={role}
      />

      {/* Delete Confirmation Modal */}
      {deletingPublication && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/50 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                Supprimer ce communiqué ?
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 mb-6 leading-relaxed">
              Êtes-vous certain de vouloir retirer «{' '}
              <strong>{deletingPublication.titre}</strong> » du babillard ? Cette action est définitive.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingPublication(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs sm:text-sm font-semibold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow transition flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
