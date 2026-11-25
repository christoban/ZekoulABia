'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import type { Publication } from '../types';
import { BabillardReaderModal } from './BabillardReaderModal';
import BabillardPublishModal from './BabillardPublishModal';
import { BabillardBoardHeader } from './BabillardBoardHeader';
import { BabillardBoardGrid } from './BabillardBoardGrid';
import { BabillardDeleteModal } from './BabillardDeleteModal';
import { useBabillardBoardData } from './useBabillardBoardData';

interface BabillardBoardProps {
  role?: string;
  currentUserId?: string;
  title?: string;
  subtitle?: string;
}

export const BabillardBoard: React.FC<BabillardBoardProps> = ({
  role = 'STUDENT',
  currentUserId,
  title = 'Babillard Officiel',
  subtitle = 'Communiqués officiels, décisions et avis de l’établissement',
}) => {
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

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const {
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
  } = useBabillardBoardData(role, showToast);

  // Sync with AI assistant FAB hiding
  useEffect(() => {
    const isAnyModalOpen = isPublishModalOpen || !!selectedPublication || !!deletingPublication;
    window.dispatchEvent(new CustomEvent('zekoulabia:modal-open', { detail: { open: isAnyModalOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('zekoulabia:modal-open', { detail: { open: false } }));
    };
  }, [isPublishModalOpen, selectedPublication, deletingPublication]);

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
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Échec de la suppression', 'error');
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

  const handleOpenPublishNew = () => {
    setEditingPublication(null);
    setIsPublishModalOpen(true);
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

      <BabillardBoardHeader
        title={title}
        subtitle={subtitle}
        peutPublier={peutPublier}
        isOffline={isOffline}
        activeTab={activeTab}
        tabCounts={tabCounts}
        selectedCategory={selectedCategory}
        categoryCounts={categoryCounts}
        searchQuery={searchQuery}
        onPublishClick={handleOpenPublishNew}
        onTabChange={handleTabChange}
        onSelectCategory={setSelectedCategory}
        onSearchChange={setSearchQuery}
      />

      <BabillardBoardGrid
        loading={loading}
        activeTab={activeTab}
        peutPublier={peutPublier}
        role={role}
        currentUserId={currentUserId}
        filteredCount={filteredPublications.length}
        pinnedList={pinnedList}
        standardList={standardList}
        onCreateNew={() => setIsPublishModalOpen(true)}
        onOpenReader={openReader}
        onPinToggle={handleTogglePin}
        onEdit={(pub) => {
          setEditingPublication(pub);
          setIsPublishModalOpen(true);
        }}
        onDelete={(pub) => setDeletingPublication(pub)}
        onMarquerLue={handleMarquerLue}
      />

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
      <BabillardDeleteModal
        publication={deletingPublication}
        isDeleting={isDeleting}
        onCancel={() => setDeletingPublication(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
