'use client';

import React, { useMemo, useState } from 'react';
import {
  FileText,
  Paperclip,
  MoreVertical,
  Pin,
  PinOff,
  Edit2,
  Trash2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import type { PublicationItem } from '../types';
import { CATEGORIE_CONFIG, ROLE_LABELS_FR } from '../types';
import BabillardPin from './BabillardPin';

export function getPinColor(publication: Partial<PublicationItem>): 'red' | 'orange' | 'green' {
  if (publication.priorite === 'URGENTE') return 'red';
  if (publication.priorite === 'IMPORTANTE' || publication.epinglee || publication.isPinned) return 'orange';
  return 'green';
}

interface PublicationCardProps {
  publication: PublicationItem;
  canManage?: boolean;
  userRole?: string;
  userId?: string;
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  onPinToggle?: () => void;
  onMarquerLue?: () => void;
  showActions?: boolean;
  stats?: { lecturesCount: number; destinatairesEligiblesCount: number } | null;
}

export default function PublicationCard({
  publication,
  canManage,
  userRole,
  userId,
  onClick,
  onEdit,
  onDelete,
  onTogglePin,
  onPinToggle,
  onMarquerLue,
  showActions = true,
  stats,
}: PublicationCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const togglePinAction = onTogglePin ?? onPinToggle;
  const isManager = canManage ?? (
    userRole === 'ADMIN' ||
    userRole === 'PRINCIPAL' ||
    userRole === 'CENSEUR' ||
    Boolean(publication.auteurId && userId && publication.auteurId === userId)
  );

  // Rotation déterministe entre -1.2° et +1.2° calculée à partir de l'id
  const rotationDeg = useMemo(() => {
    const idStr = publication.id || 'preview';
    let hash = 0;
    for (let i = 0; i < idStr.length; i++) {
      hash = (hash << 5) - hash + idStr.charCodeAt(i);
      hash |= 0;
    }
    const normalized = ((Math.abs(hash) % 240) - 120) / 100;
    return normalized;
  }, [publication.id]);

  const pinColor = getPinColor(publication);
  const isPinned = Boolean(publication.epinglee || publication.isPinned);

  const catCfg = CATEGORIE_CONFIG[publication.categorie] ?? CATEGORIE_CONFIG.COMMUNIQUE;

  const formatAudience = () => {
    const roles = publication.audience?.roles ?? publication.audienceRoles ?? publication.targetRoles ?? [];
    const classes = publication.audience?.classeIds ?? publication.audienceClasses ?? publication.targetClasses ?? [];

    if (roles.length >= 5) {
      if (classes.length > 0) return `Tous · ${classes.length} classes`;
      return 'Tous';
    }

    const rolesLabels = roles.map((r) => ROLE_LABELS_FR[r] ?? r);
    if (classes.length > 0) {
      return `${rolesLabels.join(', ')} · ${classes.length} classes`;
    }
    return rolesLabels.join(', ') || 'Tous';
  };

  const premierePieceJointe = publication.piecesJointes?.[0];
  const nbPiecesJointes = publication.piecesJointes?.length ?? 0;

  // Extrait formaté : conserve le gras, italique, souligné tout en éliminant les balises de bloc
  const extraitHtml = useMemo(() => {
    const raw = publication.corps || publication.contenu || '';
    if (!raw.trim()) return 'Aucun contenu supplémentaire.';

    // Remplacer les blocs par des espaces et préserver strong, b, em, i, u, mark
    let inline = raw
      .replace(/<\/?(p|div|br|ul|ol|li|h[1-6]|table|tr|td|th|blockquote|hr)[^>]*>/gi, ' ')
      .replace(/<(?!\/?(strong|b|em|i|u|mark)\b)[^>]+>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return inline || 'Aucun contenu supplémentaire.';
  }, [publication.corps, publication.contenu]);

  const dateFormatee = useMemo(() => {
    try {
      const d = publication.publieeLe ? new Date(publication.publieeLe) : new Date();
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return publication.publieeLe;
    }
  }, [publication.publieeLe]);

  // Construction du libellé de l'auteur : "Nom Prénom · Titre" (jamais "Direction" en dur)
  const auteurLibelle = useMemo(() => {
    let nomComplet = '';
    if (publication.auteur) {
      const p = publication.auteur.prenom || publication.auteur.firstName || '';
      const n = publication.auteur.nom || publication.auteur.lastName || '';
      nomComplet = `${p} ${n}`.trim();
    }
    const titre = publication.auteurTitre || '';
    if (nomComplet && titre) return `${nomComplet} · ${titre}`;
    if (nomComplet) return nomComplet;
    if (titre) return titre;
    if (publication.auteurRole) return ROLE_LABELS_FR[publication.auteurRole] ?? publication.auteurRole;
    return 'Direction de l’établissement';
  }, [publication.auteur, publication.auteurTitre, publication.auteurRole]);

  return (
    <article
      tabIndex={0}
      role="button"
      aria-label={`Ouvrir le communiqué : ${publication.titre}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="babillard-sheet group relative flex flex-col cursor-pointer transition-all duration-200 outline-none select-none"
      style={{
        background: 'var(--paper, #fcfbf9)',
        color: '#1a1209',
        borderRadius: 6,
        border: '1px solid var(--paper-edge, #e6dfd3)',
        boxShadow: 'var(--paper-shadow)',
        transform: `rotate(${rotationDeg}deg)`,
        paddingTop: 18,
      }}
    >
      {/* Punaise centrale haute débordant sur le haut de la feuille */}
      <div className="absolute left-1/2 -top-3.5 -translate-x-1/2 z-20 pointer-events-none">
        <BabillardPin color={pinColor} size={28} />
      </div>

      {/* Bandeau orange discret si épinglée À la une */}
      {isPinned && (
        <div
          className="absolute top-0 left-0 right-0 h-1.5 rounded-t"
          style={{ background: 'var(--pin-orange, #ea580c)' }}
        />
      )}

      {/* Rangée des badges et de la date (qui ne se coupe jamais) */}
      <div className="px-4 sm:px-5 pt-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Badge "Nouveau" réservé aux non-lus (non visible pour l'auteur) */}
          {!publication.isRead && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider text-white"
              style={{ background: 'var(--green, var(--primary))' }}
            >
              Nouveau
            </span>
          )}

          {/* Badge explicite "À la une" avec icône de punaise */}
          {isPinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold text-white bg-amber-600 shadow-xs">
              <Pin size={10} className="fill-current" />
              À la une
            </span>
          )}

          {publication.priorite === 'URGENTE' && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider text-white animate-pulse"
              style={{ background: 'var(--pin-red, #dc2626)' }}
            >
              <AlertTriangle size={11} />
              Urgent
            </span>
          )}

          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11.5px] font-semibold"
            style={{
              background: catCfg.badgeBg,
              color: catCfg.badgeColor,
            }}
          >
            {catCfg.label}
          </span>
        </div>

        {/* Date formatée avec white-space: nowrap pour ne jamais se couper */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <time className="text-[12px] text-[#786c5a] font-medium whitespace-nowrap">
            {dateFormatee}
          </time>

          {/* Menu contextuel pour les utilisateurs habilités (masqué en aperçu) */}
          {showActions && isManager && (
            <div
              className="relative z-30 ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-1 rounded text-[#786c5a] hover:text-[#1a1209] hover:bg-[#ece5d8] transition-colors"
                title="Options"
              >
                <MoreVertical size={16} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-lg bg-white shadow-xl border border-[#e6dfd3] py-1 text-xs text-[#1a1209] z-50">
                  {togglePinAction && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); togglePinAction(); }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--bg)]"
                    >
                      {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                      {isPinned ? 'Désépingler' : 'Épingler à la une'}
                    </button>
                  )}
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onEdit(); }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[var(--bg)]"
                    >
                      <Edit2 size={13} />
                      Modifier
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpen(false); onDelete(); }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={13} />
                      Supprimer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Titre en police Spectral éditoriale */}
      <div className="px-4 sm:px-5 pt-2 pb-1">
        <h3 className="font-spectral font-bold text-[18px] sm:text-[19px] leading-[1.3] text-[#1a1209] tracking-tight line-clamp-2">
          {publication.titre || 'Sans titre'}
        </h3>
      </div>

      {/* Extrait en corps 16px avec styles gras/italique/souligné préservés (3 lignes max) */}
      <div className="px-4 sm:px-5 pt-1 pb-3 flex-1">
        <div
          className="babillard-card-excerpt text-[15px] sm:text-[16px] leading-[1.6] text-[#4a3f35] line-clamp-3 font-normal"
          dangerouslySetInnerHTML={{ __html: extraitHtml }}
        />
      </div>

      {/* Miniature de document épinglé s'il y a une pièce jointe */}
      {premierePieceJointe && (
        <div className="px-4 sm:px-5 pb-3">
          <div
            className="relative rounded overflow-hidden border border-[#e6dfd3] bg-[#f5f0e6] flex flex-col items-center justify-center text-[#786c5a]"
            style={{ height: 170 }}
          >
            {premierePieceJointe.mime.startsWith('image/') ? (
              <img
                src={`/api/v2/babillard/${publication.id}/pieces-jointes/${premierePieceJointe.id}`}
                alt={premierePieceJointe.texteAlternatif ?? premierePieceJointe.nomOriginal}
                className="w-full h-full object-cover object-top"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <FileText size={38} className="text-[#9a8c78] mb-1.5" />
                <span className="text-xs font-semibold line-clamp-1 max-w-[200px] text-[#4a3f35]">
                  {premierePieceJointe.nomOriginal}
                </span>
                {premierePieceJointe.nbPages && (
                  <span className="text-[11px] text-[#786c5a] mt-0.5">
                    Document officiel · {premierePieceJointe.nbPages} page{premierePieceJointe.nbPages > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}

            {nbPiecesJointes > 1 && (
              <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1">
                <Paperclip size={10} />
                +{nbPiecesJointes - 1} autre{nbPiecesJointes > 2 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Pied de la feuille épinglée (13px minimum, jamais de 'Direction' en dur) */}
      <div className="px-4 sm:px-5 py-2.5 mt-auto border-t border-[#f0e9dc] bg-[#faf7f2]/60 flex items-center justify-between gap-3 text-[13px] text-[#5a4d3d]">
        <div className="truncate font-semibold text-[#2d241e]" title={auteurLibelle}>
          {auteurLibelle}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 text-[12.5px] text-[#6b5d4b]">
          <span className="truncate max-w-[150px]" title={formatAudience()}>
            {formatAudience()}
          </span>

          {stats && (
            <span
              className="inline-flex items-center gap-1 bg-[#ede6da] px-1.5 py-0.5 rounded text-[11px] font-medium text-[#4a3f35]"
              title="Lectures uniques / Destinataires éligibles"
            >
              <Eye size={11} />
              {stats.lecturesCount}/{stats.destinatairesEligiblesCount}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
