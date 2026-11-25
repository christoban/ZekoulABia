'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { fetchApi } from '@/lib/fetchApi';
import { getCachedData, putCachedData } from '@/lib/offline/db';
import { EVENEMENT_BABILLARD_NON_LUS_CHANGE } from '@/hooks/useUnreadBabillardCount';
import type { Publication } from '../types';

export type BabillardTabType = 'all' | 'pinned' | 'for_me' | 'unread' | 'archives';

export interface BabillardTabCounts {
  all: number;
  pinned: number;
  for_me: number;
  unread: number;
  archives: number;
}

const TAB_PARAM_MAP: Record<BabillardTabType, string> = {
  all: 'tous',
  pinned: 'une',
  for_me: 'pourMoi',
  unread: 'nonLus',
  archives: 'archives',
};

function matchesRoleAudience(pub: Publication, userRole: string): boolean {
  const roles = pub.audience?.roles || pub.audienceRoles || pub.targetRoles;
  return !roles || roles.length === 0 || (userRole ? roles.includes(userRole) : true);
}

function filterPublicationsForTab(pubs: Publication[], tab: BabillardTabType, role: string): Publication[] {
  if (tab === 'pinned') return pubs.filter((p) => p.isPinned || p.epinglee);
  if (tab === 'archives') return pubs.filter((p) => p.statut === 'ARCHIVEE');
  if (tab === 'unread') return pubs.filter((p) => !p.isRead);
  if (tab === 'for_me') {
    const userRole = role?.toUpperCase();
    return pubs.filter((p) => matchesRoleAudience(p, userRole));
  }
  return pubs;
}

function deriveCountsFromPublications(pubs: Publication[], role: string): BabillardTabCounts {
  const userRole = role?.toUpperCase();
  return {
    all: pubs.length,
    pinned: pubs.filter((p) => p.isPinned || p.epinglee).length,
    for_me: pubs.filter((p) => matchesRoleAudience(p, userRole)).length,
    unread: pubs.filter((p) => !p.isRead).length,
    archives: pubs.filter((p) => p.statut === 'ARCHIVEE').length,
  };
}

export function useBabillardBoardData(
  role: string,
  showToast: (text: string, type?: 'success' | 'error') => void
) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<BabillardTabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isOffline, setIsOffline] = useState(false);
  const [tabCounts, setTabCounts] = useState<BabillardTabCounts>({
    all: 0,
    pinned: 0,
    for_me: 0,
    unread: 0,
    archives: 0,
  });

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
  const handleTabChange = (tab: BabillardTabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('filtre', TAB_PARAM_MAP[tab]);
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

  // Load publications with accurate counts & Dexie encrypted cache
  const loadPublications = useCallback(async () => {
    const tabParam = TAB_PARAM_MAP[activeTab];
    const url = `/api/v2/babillard?tab=${tabParam}`;
    const cacheKey = `babillard:publications:${activeTab}`;

    // 1. Lecture instantanée depuis Dexie (0 ms)
    const [cachedPubs, cachedCounts] = await Promise.all([
      getCachedData<Publication[]>(cacheKey),
      getCachedData<BabillardTabCounts>('babillard:counts'),
    ]);

    let allPubsFallback: Publication[] = [];
    if (!cachedPubs?.data || cachedPubs.data.length === 0) {
      const allCached = await getCachedData<Publication[]>('babillard:publications:all');
      if (allCached?.data && Array.isArray(allCached.data) && allCached.data.length > 0) {
        allPubsFallback = allCached.data;
        setPublications(filterPublicationsForTab(allPubsFallback, activeTab, role));
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
        setTabCounts(deriveCountsFromPublications(basePubs, role));
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
        const countsObj: BabillardTabCounts = {
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
      if (selectedCategory !== 'ALL' && pub.categorie !== selectedCategory) {
        return false;
      }
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
      window.dispatchEvent(new Event(EVENEMENT_BABILLARD_NON_LUS_CHANGE));
    } catch (_) {}
  };

  // Handle Pin Toggle
  const handleTogglePin = async (pub: Publication) => {
    const newPinnedState = !pub.isPinned;
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
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Impossible de modifier l’épinglage', 'error');
      setPublications((prev) =>
        prev.map((p) => (p.id === pub.id ? { ...p, isPinned: !newPinnedState, epinglee: !newPinnedState } : p))
      );
    }
  };

  return {
    loading,
    activeTab,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    isOffline,
    tabCounts,
    peutPublier,
    categoryCounts,
    filteredPublications,
    pinnedList,
    standardList,
    handleTabChange,
    loadPublications,
    handleMarquerLue,
    handleTogglePin,
  };
}

