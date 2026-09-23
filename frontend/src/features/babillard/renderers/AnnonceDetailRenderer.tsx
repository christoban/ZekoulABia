'use client';

import React, { useState } from 'react';
import {
  Download,
  Printer,
  Share2,
  Paperclip,
  Eye,
  FileText,
  AlertTriangle,
  Pin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import type { PublicationItem } from '../types';
import { CATEGORIE_CONFIG, ROLE_LABELS_FR } from '../types';

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
      alert('Lien du communiqué copié dans le presse-papier !');
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
      {/* ========================================================
          A3: BARRE D'OUTILS UNIQUE
          - Sur mobile : collante en haut, flèche retour, titre tronqué, bouton menu "⋯"
          - Sur desktop : alignée à droite de la feuille au-dessus
         ======================================================== */}
      {/* Mobile Sticky Bar (sm:hidden) */}
      <div className="sm:hidden print:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2.5 bg-neutral-900/95 text-white backdrop-blur-md rounded-t-xl border-b border-white/10 mb-2 shadow-lg">
        <div className="flex items-center gap-2 min-w-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 text-white hover:bg-white/10 rounded-full"
              aria-label="Fermer"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <span className="text-xs font-semibold truncate text-neutral-200">
            {publication.titre}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 relative">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className="p-1.5 rounded text-neutral-300 hover:text-white disabled:opacity-20"
              aria-label="Précédent"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="p-1.5 rounded text-neutral-300 hover:text-white disabled:opacity-20"
              aria-label="Suivant"
            >
              <ChevronRight size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 rounded-full hover:bg-white/15 text-neutral-200 hover:text-white"
            aria-label="Menu d'actions"
          >
            <MoreVertical size={18} />
          </button>

          {/* Mobile dropdown menu */}
          {isMenuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-700 py-1.5 z-50 text-neutral-800 dark:text-neutral-100 text-xs"
              onClick={() => setIsMenuOpen(false)}
            >
              <button
                type="button"
                onClick={handleShare}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left"
              >
                <Share2 size={14} /> Partager le lien
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left"
              >
                <Printer size={14} /> Imprimer
              </button>
              {canManage && (
                <>
                  <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
                  {onEdit && (
                    <button
                      type="button"
                      onClick={onEdit}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left font-medium"
                    >
                      <Edit2 size={14} /> Modifier
                    </button>
                  )}
                  {onPinToggle && (
                    <button
                      type="button"
                      onClick={onPinToggle}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left font-medium"
                    >
                      <Pin size={14} /> {publication.isPinned || publication.epinglee ? 'Désépingler' : 'Épingler'}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Voulez-vous vraiment supprimer « ${publication.titre} » ?`)) {
                          onDelete();
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 text-left font-semibold"
                    >
                      <Trash2 size={14} /> Supprimer
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Toolbar (hidden on mobile, print:hidden) */}
      <div className="hidden sm:flex print:hidden items-center justify-between gap-2 pb-3 mb-2 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-1">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              disabled={!hasPrev}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-white disabled:opacity-30 border border-neutral-200 dark:border-neutral-700 shadow-xs text-xs font-medium transition-colors"
              title="Précédent (Flèche gauche)"
            >
              <ChevronLeft size={14} />
              <span>Précédent</span>
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={!hasNext}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-white disabled:opacity-30 border border-neutral-200 dark:border-neutral-700 shadow-xs text-xs font-medium transition-colors"
              title="Suivant (Flèche droite)"
            >
              <span>Suivant</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-white border border-neutral-200 dark:border-neutral-700 text-xs font-medium shadow-xs transition-colors"
            title="Copier le lien direct"
          >
            <Share2 size={13} />
            <span>Partager</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-white border border-neutral-200 dark:border-neutral-700 text-xs font-medium shadow-xs transition-colors"
            title="Imprimer ce document officiel"
          >
            <Printer size={13} />
            <span>Imprimer</span>
          </button>

          {canManage && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1.5 rounded-lg bg-white/80 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-white border border-neutral-200 dark:border-neutral-700 shadow-xs"
                title="Actions de gestion"
              >
                <MoreVertical size={14} />
              </button>

              {isMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 py-1 z-50 text-xs text-neutral-800 dark:text-neutral-100"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {onEdit && (
                    <button
                      type="button"
                      onClick={onEdit}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left font-medium"
                    >
                      <Edit2 size={13} /> Modifier
                    </button>
                  )}
                  {onPinToggle && (
                    <button
                      type="button"
                      onClick={onPinToggle}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-left font-medium"
                    >
                      <Pin size={13} /> {publication.isPinned || publication.epinglee ? 'Désépingler' : 'Épingler'}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Voulez-vous vraiment supprimer « ${publication.titre} » ?`)) {
                          onDelete();
                        }
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-950 text-red-600 dark:text-red-400 text-left font-semibold"
                    >
                      <Trash2 size={13} /> Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <X size={13} />
              <span>Fermer (Échap)</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          FEUILLE OFFICIELLE
         ======================================================== */}
      <div
        className="babillard-sheet-paper relative bg-[#fcfbf9] text-[#1a1209] rounded-lg border border-[#e2dacb] shadow-2xl p-6 sm:p-10 transition-all print:p-0 print:border-none print:shadow-none"
        style={{
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* A2 & B8: En-tête officiel de l'établissement */}
        <div className="text-center pb-5 mb-6 border-b border-[#d8cfbe]">
          {showDevises && (
            <div className="mb-2">
              {/* Desktop : une ligne */}
              <div className="hidden sm:block text-[11px] font-bold uppercase tracking-widest text-[#786c5a]">
                {isAnglophone
                  ? 'REPUBLIC OF CAMEROON — PEACE · WORK · FATHERLAND'
                  : 'RÉPUBLIQUE DU CAMEROUN — PAIX · TRAVAIL · PATRIE'}
              </div>
              {/* Mobile (B8) : deux lignes nettes pour éviter que « · PATRIE » soit orphelin */}
              <div className="sm:hidden text-[10.5px] font-bold uppercase tracking-wider text-[#786c5a] leading-tight">
                <div>{isAnglophone ? 'REPUBLIC OF CAMEROON' : 'RÉPUBLIQUE DU CAMEROUN'}</div>
                <div className="text-[10px] text-[#8a7c6a] mt-0.5">
                  {isAnglophone ? 'Peace · Work · Fatherland' : 'Paix · Travail · Patrie'}
                </div>
              </div>
            </div>
          )}

          {showMinistere && (
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[#8a7c6a] mb-2">
              {isAnglophone
                ? 'MINISTRY OF SECONDARY EDUCATION'
                : 'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES'}
            </div>
          )}

          {/* Logo et Nom de l'établissement */}
          <div className="flex items-center justify-center gap-3">
            {etablissement?.logoUrl && (
              <img
                src={etablissement.logoUrl}
                alt={nomEtablissement}
                className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
              />
            )}
            <div>
              <h1 className="font-spectral font-extrabold text-[20px] sm:text-[24px] text-[#1a1209] tracking-tight leading-tight">
                {nomEtablissement}
              </h1>
              <div className="text-xs text-[#6b5d4b] italic mt-0.5">
                Babillard Officiel & Publications Institutionnelles
              </div>
            </div>
          </div>

          {/* C: Numéro de référence */}
          <div className="mt-2 text-[11px] font-mono text-[#8a7c6a]">
            {refNum}
          </div>
        </div>

        {/* Ligne des badges (Catégorie, Priorité, Épinglage) & Ligne méta auteur */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider"
              style={{ background: catCfg.badgeBg, color: catCfg.badgeColor }}
            >
              {catCfg.label}
            </span>

            {publication.priorite === 'URGENTE' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider text-white bg-red-600">
                <AlertTriangle size={12} />
                Urgent
              </span>
            )}

            {(publication.isPinned || publication.epinglee) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-orange-800 bg-orange-100">
                <Pin size={12} />
                À la une
              </span>
            )}
          </div>

          {/* A2: Ligne méta complète avec Auteur et Date */}
          <div className="text-xs text-[#786c5a]">
            Publié le <span className="font-semibold text-[#1a1209]">{dateFormatee}</span>
            {auteurNomComplet ? (
              <span> · <strong className="text-[#1a1209]">{auteurNomComplet}</strong>, {auteurTitre}</span>
            ) : (
              <span> · {auteurTitre}</span>
            )}
            {publication.modifieLe && (
              <span className="italic ml-2 text-[#9a8c78]">
                (Modifié le {new Date(publication.modifieLe).toLocaleDateString('fr-FR')})
              </span>
            )}
          </div>
        </div>

        {/* Grand Titre en Spectral */}
        <h2 className="font-spectral font-bold text-[24px] sm:text-[30px] text-[#1a1209] leading-tight mb-4">
          {publication.titre}
        </h2>

        {/* Publics destinataires */}
        <div className="bg-[#f5f0e6] rounded-md p-3 mb-6 border border-[#e6dfd3] flex items-center justify-between gap-3 flex-wrap text-xs">
          <div>
            <span className="font-bold text-[#5a4d3d] mr-1.5">Destinataires :</span>
            <span className="text-[#3b3226]">
              {rolesLabels.length >= 5 ? 'Tous les usagers' : rolesLabels.join(', ')}
            </span>
            {classesLabels.length > 0 && (
              <span className="ml-2 font-semibold text-[#2563eb]">
                · {classesLabels.length} classe{classesLabels.length > 1 ? 's' : ''} concernée{classesLabels.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {stats && (
            <div
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#ede6da] font-medium text-xs text-[#4a3f35]"
              title="Statistiques de consultation"
            >
              <Eye size={13} />
              <span>
                Lu par <strong>{stats.lecturesCount}</strong> sur <strong>{stats.destinatairesEligiblesCount}</strong> destinataires
              </span>
            </div>
          )}
        </div>

        {/* Corps du message formaté (HTML sanitizé) */}
        <div
          className="babillard-body-content text-[17px] sm:text-[18px] leading-[1.75] text-[#2d251e] space-y-4 mb-8 font-normal"
          dangerouslySetInnerHTML={{ __html: publication.corps }}
        />

        {/* Pièces jointes intégrées (Documents & Images) */}
        {publication.piecesJointes && publication.piecesJointes.length > 0 && (
          <div className="border-t border-[#e6dfd3] pt-6 mb-8">
            <h3 className="text-sm font-bold text-[#5a4d3d] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Paperclip size={15} />
              Documents joints ({publication.piecesJointes.length})
            </h3>

            {/* Galerie d'images en grand format */}
            <div className="space-y-4 mb-4">
              {publication.piecesJointes
                .filter((p) => p.mime.startsWith('image/'))
                .map((pj) => (
                  <div key={pj.id} className="relative rounded overflow-hidden border border-[#d8cfbe] group">
                    <img
                      src={`/api/v2/babillard/${publication.id}/pieces-jointes/${pj.id}`}
                      alt={pj.texteAlternatif ?? pj.nomOriginal}
                      className="w-full max-h-[550px] object-contain bg-[#f0eadd] cursor-zoom-in"
                      onClick={() => setSelectedImage(`/api/v2/babillard/${publication.id}/pieces-jointes/${pj.id}`)}
                    />
                    <div className="p-2.5 bg-[#fcfbf9] border-t border-[#d8cfbe] flex items-center justify-between text-xs text-[#5a4d3d]">
                      <span className="font-semibold truncate">{pj.nomOriginal}</span>
                      <a
                        href={`/api/v2/babillard/${publication.id}/pieces-jointes/${pj.id}`}
                        download={pj.nomOriginal}
                        className="inline-flex items-center gap-1 font-semibold text-success hover:underline"
                      >
                        <Download size={12} /> Télécharger
                      </a>
                    </div>
                  </div>
                ))}
            </div>

            {/* Fichiers PDF et documents */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {publication.piecesJointes
                .filter((p) => !p.mime.startsWith('image/'))
                .map((pj) => (
                  <div
                    key={pj.id}
                    className="p-3.5 rounded-lg border border-[#d8cfbe] bg-[var(--bg)] flex items-center justify-between gap-3 hover:bg-[#efe8dd] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1a1209] truncate" title={pj.nomOriginal}>
                          {pj.nomOriginal}
                        </div>
                        <div className="text-[11px] text-[#786c5a]">
                          {pj.nbPages ? `${pj.nbPages} page${pj.nbPages > 1 ? 's' : ''} · ` : ''}
                          {(pj.taille / 1024).toFixed(0)} Ko
                        </div>
                      </div>
                    </div>

                    <a
                      href={`/api/v2/babillard/${publication.id}/pieces-jointes/${pj.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded bg-white text-[#1a1209] hover:bg-[#e6dfd3] shadow-xs border border-[#d8cfbe] transition-colors shrink-0"
                      title="Ouvrir le document"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* A2 & C: Bloc Signature officielle dynamique */}
        <div className="pt-6 border-t border-[#d8cfbe] flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 text-xs text-[#5a4d3d]">
          <div className="italic text-[#786c5a]">
            Document officiel publié sur le Babillard numérique ZekoulABia
          </div>

          <div className="text-right sm:min-w-[220px]">
            {/* C: "Fait à {ville}, le {date}" */}
            {ville && (
              <div className="text-xs text-[#6b5d4b] italic mb-1">
                Fait à {ville}, le {dateFormatee}
              </div>
            )}

            {/* Ligne 1: Titre de l'auteur */}
            <div className="font-spectral font-bold text-base text-[#1a1209]">
              {auteurTitre}
            </div>

            {/* Ligne 2: Nom complet de l'auteur */}
            {auteurNomComplet && (
              <div className="text-[12.5px] font-semibold text-[#3b3226] mt-0.5">
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
