'use client';

import React, { useState } from 'react';
import type { PublicationItem } from '../types';
import { CATEGORIE_CONFIG, ROLE_LABELS_FR } from '../types';
import { notifyToast } from '@/components/shell/AppToast';
import { AnnonceDetailToolbar } from './AnnonceDetailToolbar';
import { AnnonceSheetHeader } from './AnnonceSheetHeader';
import { AnnonceAttachmentsList } from './AnnonceAttachmentsList';

interface Props {
  publication: PublicationItem;
  schoolName?: string;
  stats?: { lecturesCount: number; destinatairesEligiblesCount: number } | null;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPinToggle?: () => void;
}

export default function AnnonceDetailRenderer({
  publication,
  schoolName = 'Lycée de Bafia',
  stats,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  canManage = false,
  onEdit,
  onDelete,
  onPinToggle,
}: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const catCfg = CATEGORIE_CONFIG[publication.categorie] ?? CATEGORIE_CONFIG.COMMUNIQUE;

  const rolesLabels = (
    publication.audience?.roles ??
    publication.audienceRoles ??
    publication.targetRoles ??
    []
  ).map((r) => ROLE_LABELS_FR[r] ?? r);

  const classesLabels =
    publication.audience?.classeIds ??
    publication.audienceClasses ??
    publication.targetClasses ??
    [];

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/babillard/${publication.id}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      notifyToast('Lien du communiqué copié dans le presse-papier !', 'success');
    }
  };

  const dateFormatee = new Date(publication.publieeLe || publication.createdAt || Date.now()).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Établissement dynamic data
  const etablissement = publication.etablissement;
  const nomEtablissement = etablissement?.nom || schoolName;
  const isAnglophone = etablissement?.sousSysteme === 'ANGLOPHONE';
  const showDevises = etablissement?.devisesActives !== false;
  const showMinistere = !!etablissement?.ministereActif;
  const cachetUrl = etablissement?.cachetUrl;
  const ville = etablissement?.ville;

  // Auteur dynamic data
  const auteurNomComplet = publication.auteur
    ? `${publication.auteur.prenom || publication.auteur.firstName || ''} ${publication.auteur.nom || publication.auteur.lastName || ''}`.trim()
    : '';
  const auteurTitre = publication.auteurTitre || (publication.auteurRole === 'ADMIN' ? 'Le Proviseur' : 'Le Chef d’Établissement');

  // Numéro de référence optionnel (ex. Réf. 2026/001)
  const annee = new Date(publication.publieeLe || Date.now()).getFullYear();
  const refNum = publication.numeroReference || `Réf. ${annee}/${publication.id.slice(-4).toUpperCase()}`;

  return (
    <div className="babillard-detail-root flex flex-col w-full max-w-[840px] mx-auto select-text">
      {/* A3: BARRE D'OUTILS UNIQUE (Mobile sticky + Desktop) */}
      <AnnonceDetailToolbar
        publicationTitle={publication.titre}
        isPinned={Boolean(publication.isPinned || publication.epinglee)}
        onClose={onClose}
        onPrev={onPrev}
        onNext={onNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        canManage={canManage}
        onEdit={onEdit}
        onDelete={onDelete}
        onPinToggle={onPinToggle}
        onShare={handleShare}
        onPrint={handlePrint}
      />

      {/* FEUILLE OFFICIELLE */}
      <div
        className="babillard-sheet-paper relative bg-[var(--paper)] text-[var(--paper-text)] rounded-lg border border-[var(--paper-edge)] shadow-2xl p-6 sm:p-10 transition-all print:p-0 print:border-none print:shadow-none"
        style={{
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        <AnnonceSheetHeader
          nomEtablissement={nomEtablissement}
          logoUrl={etablissement?.logoUrl}
          isAnglophone={isAnglophone}
          showDevises={showDevises}
          showMinistere={showMinistere}
          refNum={refNum}
          catCfg={catCfg}
          priorite={publication.priorite}
          isPinned={Boolean(publication.isPinned || publication.epinglee)}
          dateFormatee={dateFormatee}
          auteurNomComplet={auteurNomComplet}
          auteurTitre={auteurTitre}
          modifieLe={publication.modifieLe}
          titre={publication.titre}
          rolesLabels={rolesLabels}
          classesLabels={classesLabels}
          stats={stats}
        />

        {/* Corps du message formaté (HTML sanitizé) */}
        <div
          className="babillard-body-content text-[17px] sm:text-[18px] leading-[1.75] text-[var(--paper-text)] space-y-4 mb-8 font-normal"
          dangerouslySetInnerHTML={{ __html: publication.corps }}
        />

        {/* Pièces jointes intégrées (Documents & Images) */}
        <AnnonceAttachmentsList
          publicationId={publication.id}
          piecesJointes={publication.piecesJointes}
          onSelectImage={setSelectedImage}
        />

        {/* A2 & C: Bloc Signature officielle dynamique */}
        <div className="pt-6 border-t border-[var(--paper-edge)] flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 text-xs text-[var(--paper-text-muted)]">
          <div className="italic text-[var(--paper-text-sub)]">
            Document officiel publié sur le Babillard numérique ZekoulABia
          </div>

          <div className="text-right sm:min-w-[220px]">
            {/* C: "Fait à {ville}, le {date}" */}
            {ville && (
              <div className="text-xs text-[var(--paper-text-sub)] italic mb-1">
                Fait à {ville}, le {dateFormatee}
              </div>
            )}

            {/* Ligne 1: Titre de l'auteur */}
            <div className="font-spectral font-bold text-base text-[var(--paper-text)]">
              {auteurTitre}
            </div>

            {/* Ligne 2: Nom complet de l'auteur */}
            {auteurNomComplet && (
              <div className="text-[12.5px] font-semibold text-[var(--paper-text)] mt-0.5">
                {auteurNomComplet}
              </div>
            )}

            {/* Visa / Cachet : UNIQUEMENT si l'établissement a configuré un cachet (pas de placeholder pointillé) */}
            {cachetUrl && (
              <div className="h-16 mt-2 flex items-center justify-end">
                <img
                  src={cachetUrl}
                  alt="Cachet officiel"
                  className="max-h-16 object-contain"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox pour zoom image si cliquée */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage}
            alt="Agrandissement"
            className="max-w-full max-h-full object-contain rounded shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
