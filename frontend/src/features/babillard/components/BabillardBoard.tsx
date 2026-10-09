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
import { getCachedData, putCachedData } from '@/lib/offline/db';
import { Publication, BABILLARD_CATEGORIES, CategorieDetails } from '../types';
import AnnonceCardRenderer from '../renderers/AnnonceCardRenderer';
import { BabillardReaderModal } from './BabillardReaderModal';
import BabillardPublishModal from './BabillardPublishModal';
import { BabillardCategoryFilter } from './BabillardCategoryFilter';

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

  // Load publications with accurate counts & Dexie encrypted cache
  const loadPublications = useCallback(async () => {
    const tabParamMap: Record<TabType, string> = {
      all: 'tous',
      pinned: 'une',
      for_me: 'pourMoi',
      unread: 'nonLus',
      archives: 'archives',
    };

    const tabParam = tabParamMap[activeTab];
    const url = `/api/v2/babillard?tab=${tabParam}`;
    const cacheKey = `babillard:publications:${activeTab}`;

    // 1. Lecture instantanée depuis Dexie (0 ms)
    const [cachedPubs, cachedCounts] = await Promise.all([
      getCachedData<Publication[]>(cacheKey),
      getCachedData<{ all: number; pinned: number; for_me: number; unread: number; archives: number }>('babillard:counts'),
    ]);

    let allPubsFallback: Publication[] = [];
    if (!cachedPubs?.data || cachedPubs.data.length === 0) {
      const allCached = await getCachedData<Publication[]>('babillard:publications:all');
      if (allCached?.data && Array.isArray(allCached.data) && allCached.data.length > 0) {
        allPubsFallback = allCached.data;
        let filtered = allPubsFallback;
        if (activeTab === 'pinned') {
          filtered = allPubsFallback.filter((p) => p.isPinned || p.epinglee);
        } else if (activeTab === 'archives') {
          filtered = allPubsFallback.filter((p) => p.statut === 'ARCHIVEE');
        } else if (activeTab === 'unread') {
          filtered = allPubsFallback.filter((p) => !p.isRead);
        } else if (activeTab === 'for_me') {
          const userRole = role?.toUpperCase();
          filtered = allPubsFallback.filter((p) => {
            const roles = p.audience?.roles || p.audienceRoles || p.targetRoles;
            return !roles || roles.length === 0 || (userRole ? roles.includes(userRole) : true);
          });
        }
        setPublications(filtered);
        setLoading(false);
      }
    } else {
      setPublications(cachedPubs.data);
      setLoading(false);
    }

    if (cachedCounts?.data && (cachedCounts.data.all > 0 || cachedCounts.data.pinned > 0)) {
      setTabCounts(cachedCounts.data);
    } else {
      const basePubs = allPubsFallback.length > 0 ? allPubsFallback : (cachedPubs?.data ?? []);
      if (basePubs.length > 0) {
        const userRole = role?.toUpperCase();
        const derived = {
          all: basePubs.length,
          pinned: basePubs.filter((p) => p.isPinned || p.epinglee).length,
          for_me: basePubs.filter((p) => {
            const roles = p.audience?.roles || p.audienceRoles || p.targetRoles;
            return !roles || roles.length === 0 || (userRole ? roles.includes(userRole) : true);
          }).length,
          unread: basePubs.filter((p) => !p.isRead).length,
          archives: basePubs.filter((p) => p.statut === 'ARCHIVEE').length,
        };
        setTabCounts(derived);
      }
    }

    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setLoading(false);
      return;
    }

    try {
      if (!cachedPubs?.data || cachedPubs.data.length === 0) setLoading(true);
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
      await putCachedData(cacheKey, items);
      // Pré-cache asynchrone des publications individuelles pour consultation hors-ligne instantanée
      Promise.all(items.map((item) => putCachedData(`babillard:publication:${item.id}`, item))).catch(() => {});

      // Sync exact counts from backend
      if (data.counts) {
        const countsObj = {
          all: data.counts.tous ?? 0,
          pinned: data.counts.une ?? 0,
          for_me: data.counts.pourMoi ?? 0,
          unread: data.counts.nonLus ?? 0,
          archives: data.counts.archives ?? 0,
        };
        setTabCounts(countsObj);
        await putCachedData('babillard:counts', countsObj);
      }
    } catch {
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, [activeTab, role]);

  useEffect(() => {
    loadPublications();
  }, [loadPublications]);

  // A5: Strictly ADMIN, PRINCIPAL, CENSEUR can publish
  const peutPublier = useMemo(() => {
    const pubRoles = ['ADMIN', 'PRINCIPAL', 'CENSEUR'];
    return pubRoles.includes(role.toUpperCase());
  }, [role]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: publications.length };
    publications.forEach((p) => {
      counts[p.categorie] = (counts[p.categorie] || 0) + 1;
    });
    return counts;
  }, [publications]);

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
              ? 'bg-[var(--surface)] text-[var(--success)] border-[var(--success)]/30'
              : 'bg-[var(--surface)] text-[var(--red)] border-[var(--red)]/30'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[var(--success)] shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-[var(--red)] shrink-0" />
          )}
          <span className="text-[var(--text)]">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-[var(--bg2)] rounded-md ml-2 text-[var(--text2)]"
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
        <h1 className="font-spectral text-xl font-extrabold text-[var(--text)]">
          Babillard
        </h1>

        {peutPublier && (
          <button
            onClick={() => {
              setEditingPublication(null);
              setIsPublishModalOpen(true);
            }}
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
            onClick={() => {
              setEditingPublication(null);
              setIsPublishModalOpen(true);
            }}
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
            onClick={() => handleTabChange('all')}
            className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text2)] hover:bg-[var(--bg2)] hover:text-[var(--text)]'
            }`}
          >
            Tous ({tabCounts.all})
          </button>
          <button
            onClick={() => handleTabChange('pinned')}
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
            onClick={() => handleTabChange('unread')}
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
            onClick={() => handleTabChange('for_me')}
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
            onClick={() => handleTabChange('archives')}
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
            onSelectCategory={setSelectedCategory}
            categoryCounts={categoryCounts}
          />

          {/* B2: Search Input with clear magnifying glass icon */}
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Rechercher un communiqué..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[var(--surface)] rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text)] placeholder-[var(--text3)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] shadow-xs"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)] pointer-events-none z-10" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text3)] hover:text-[var(--text)] z-10 p-0.5"
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
        ) : filteredPublications.length === 0 ? (
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
                  onClick={() => setIsPublishModalOpen(true)}
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
