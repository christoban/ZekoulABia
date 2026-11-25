'use client';

import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { PublicationItem } from '../types';
import { PublishMainFields } from './PublishMainFields';
import { PublishAttachmentsSection } from './PublishAttachmentsSection';
import { PublishAudienceAndOptions } from './PublishAudienceAndOptions';
import { PublishPreviewPane } from './PublishPreviewPane';
import { PublishFooterActions } from './PublishFooterActions';
import { PublishModalsOverlay } from './PublishModalsOverlay';
import { PUBLISH_ALL_ROLES, useBabillardPublishForm } from './useBabillardPublishForm';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onSaved?: () => void;
  initialData?: PublicationItem | null;
  userRole?: string;
}

export default function BabillardPublishModal({
  isOpen,
  onClose,
  onSuccess,
  onSaved,
  initialData,
  userRole,
}: Props) {
  const {
    titre,
    setTitre,
    categorie,
    setCategorie,
    priorite,
    setPriorite,
    corps,
    setCorps,
    roles,
    selectedClasses,
    setSelectedClasses,
    targetAllClasses,
    setTargetAllClasses,
    epinglee,
    setEpinglee,
    duree,
    setDuree,
    programmeeLe,
    setProgrammeeLe,
    piecesJointes,
    availableClasses,
    uploading,
    submitting,
    titreError,
    setTitreError,
    corpsError,
    setCorpsError,
    rolesError,
    serverError,
    showConfirmation,
    setShowConfirmation,
    mobileTab,
    setMobileTab,
    selectedLightboxImage,
    setSelectedLightboxImage,
    titreInputRef,
    editorRef,
    previewItem,
    toggleRole,
    selectAllRoles,
    handleFileUpload,
    removePieceJointe,
    handleFormSubmit,
    executeSave,
  } = useBabillardPublishForm({ initialData, onClose, onSuccess, onSaved });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-[1240px] bg-[var(--surface)] text-[var(--text)] rounded-xl shadow-2xl border border-[var(--border)] flex flex-col max-h-[94vh] overflow-hidden">
        {/* En-tête du modal */}
        <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-spectral font-bold text-lg sm:text-xl text-[var(--text)]">
              {initialData?.id ? 'Modifier le communiqué' : 'Publier un communiqué officiel'}
            </h2>
            {/* Bascule mobile formulaire / aperçu */}
            <div className="flex sm:hidden rounded bg-[var(--bg)] p-0.5 text-xs font-semibold border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setMobileTab('form')}
                className={`px-2.5 py-1 rounded transition-colors ${mobileTab === 'form' ? 'bg-[var(--surface)] shadow-xs text-[var(--text)] font-bold' : 'text-[var(--text2)]'}`}
              >
                Saisie
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('preview')}
                className={`px-2.5 py-1 rounded transition-colors ${mobileTab === 'preview' ? 'bg-[var(--surface)] shadow-xs text-[var(--text)] font-bold' : 'text-[var(--text2)]'}`}
              >
                Aperçu direct
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--bg)] text-[var(--text3)] hover:text-[var(--text)] transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {serverError && (
          <div className="mx-5 mt-3 p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{serverError}</span>
          </div>
        )}

        {/* Corps du modal en deux colonnes sur grand écran */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonne gauche : Formulaire */}
          <div className={`space-y-4 lg:col-span-7 ${mobileTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
            <PublishMainFields
              titre={titre}
              onTitreChange={(val) => {
                setTitre(val);
                if (titreError && val.trim()) setTitreError(null);
              }}
              titreError={titreError}
              titreInputRef={titreInputRef}
              categorie={categorie}
              onCategorieChange={setCategorie}
              priorite={priorite}
              onPrioriteChange={setPriorite}
              corps={corps}
              onCorpsChange={(val) => {
                setCorps(val);
                if (corpsError && val.trim() && val !== '<p></p>' && val !== '<br>') setCorpsError(null);
              }}
              corpsError={corpsError}
              editorRef={editorRef}
            />

            <PublishAttachmentsSection
              piecesJointes={piecesJointes}
              initialPublicationId={initialData?.id}
              uploading={uploading}
              onFileUpload={handleFileUpload}
              onRemovePieceJointe={removePieceJointe}
              onOpenLightbox={setSelectedLightboxImage}
            />

            <PublishAudienceAndOptions
              allRoles={PUBLISH_ALL_ROLES}
              roles={roles}
              rolesError={rolesError}
              onToggleRole={toggleRole}
              onSelectAllRoles={selectAllRoles}
              targetAllClasses={targetAllClasses}
              onSelectTargetAllClasses={(targetAll) => {
                setTargetAllClasses(targetAll);
                if (targetAll) setSelectedClasses([]);
              }}
              availableClasses={availableClasses}
              selectedClasses={selectedClasses}
              onToggleClass={(classId) => {
                setSelectedClasses((prev) =>
                  prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
                );
              }}
              duree={duree}
              onDureeChange={setDuree}
              programmeeLe={programmeeLe}
              onProgrammeeLeChange={setProgrammeeLe}
              epinglee={epinglee}
              onEpingleeChange={setEpinglee}
            />
          </div>

          {/* Colonne droite : Aperçu en temps réel STICKY sur grand écran (B7) */}
          <PublishPreviewPane
            previewItem={previewItem}
            userRole={userRole}
            initialPublicationId={initialData?.id}
            mobileTab={mobileTab}
            onOpenLightbox={setSelectedLightboxImage}
          />
        </div>

        <PublishFooterActions
          submitting={submitting}
          uploading={uploading}
          onClose={onClose}
          onSaveDraft={() => handleFormSubmit(true)}
          onPublish={() => handleFormSubmit(false)}
        />
      </div>

      <PublishModalsOverlay
        showConfirmation={showConfirmation}
        roles={roles}
        targetAllClasses={targetAllClasses}
        selectedClassesCount={selectedClasses.length}
        submitting={submitting}
        onCancelConfirmation={() => setShowConfirmation(false)}
        onConfirmPublish={() => executeSave(false)}
        selectedLightboxImage={selectedLightboxImage}
        onCloseLightbox={() => setSelectedLightboxImage(null)}
      />
    </div>
  );
}
