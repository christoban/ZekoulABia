'use client';

import React from 'react';
import { AlertTriangle, Eye, Pin } from 'lucide-react';
import type { CategorieDetails, PublicationPriorite } from '../types';

interface AnnonceSheetHeaderProps {
  nomEtablissement: string;
  logoUrl?: string | null;
  isAnglophone: boolean;
  showDevises: boolean;
  showMinistere: boolean;
  refNum: string;
  catCfg: CategorieDetails;
  priorite: PublicationPriorite;
  isPinned: boolean;
  dateFormatee: string;
  auteurNomComplet: string;
  auteurTitre: string;
  modifieLe?: string | null;
  titre: string;
  rolesLabels: string[];
  classesLabels: string[];
  stats?: { lecturesCount: number; destinatairesEligiblesCount: number } | null;
}

export function AnnonceSheetHeader({
  nomEtablissement,
  logoUrl,
  isAnglophone,
  showDevises,
  showMinistere,
  refNum,
  catCfg,
  priorite,
  isPinned,
  dateFormatee,
  auteurNomComplet,
  auteurTitre,
  modifieLe,
  titre,
  rolesLabels,
  classesLabels,
  stats,
}: AnnonceSheetHeaderProps) {
  return (
    <>
      {/* A2 & B8: En-tête officiel de l'établissement */}
      <div className="text-center pb-5 mb-6 border-b border-[var(--paper-edge)]">
        {showDevises && (
          <div className="mb-2">
            {/* Desktop : une ligne */}
            <div className="hidden sm:block text-[11px] font-bold uppercase tracking-widest text-[var(--paper-text-sub)]">
              {isAnglophone
                ? 'REPUBLIC OF CAMEROON — PEACE · WORK · FATHERLAND'
                : 'RÉPUBLIQUE DU CAMEROUN — PAIX · TRAVAIL · PATRIE'}
            </div>
            {/* Mobile (B8) : deux lignes nettes pour éviter que « · PATRIE » soit orphelin */}
            <div className="sm:hidden text-[10.5px] font-bold uppercase tracking-wider text-[var(--paper-text-sub)] leading-tight">
              <div>{isAnglophone ? 'REPUBLIC OF CAMEROON' : 'RÉPUBLIQUE DU CAMEROUN'}</div>
              <div className="text-[10px] text-[var(--paper-text-sub)] mt-0.5 opacity-80">
                {isAnglophone ? 'Peace · Work · Fatherland' : 'Paix · Travail · Patrie'}
              </div>
            </div>
          </div>
        )}

        {showMinistere && (
          <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--paper-text-sub)] mb-2 opacity-90">
            {isAnglophone
              ? 'MINISTRY OF SECONDARY EDUCATION'
              : 'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES'}
          </div>
        )}

        {/* Logo et Nom de l'établissement */}
        <div className="flex items-center justify-center gap-3">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={nomEtablissement}
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
            />
          )}
          <div>
            <h1 className="font-spectral font-extrabold text-[20px] sm:text-[24px] text-[var(--paper-text)] tracking-tight leading-tight">
              {nomEtablissement}
            </h1>
            <div className="text-xs text-[var(--paper-text-muted)] italic mt-0.5">
              Babillard Officiel &amp; Publications Institutionnelles
            </div>
          </div>
        </div>

        {/* C: Numéro de référence */}
        <div className="mt-2 text-[11px] font-mono text-[var(--paper-text-sub)]">
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

          {priorite === 'URGENTE' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider text-white bg-red-600">
              <AlertTriangle size={12} />
              Urgent
            </span>
          )}

          {isPinned && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-orange-800 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/40">
              <Pin size={12} />
              À la une
            </span>
          )}
        </div>

        {/* A2: Ligne méta complète avec Auteur et Date */}
        <div className="text-xs text-[var(--paper-text-sub)]">
          Publié le <span className="font-semibold text-[var(--paper-text)]">{dateFormatee}</span>
          {auteurNomComplet ? (
            <span> · <strong className="text-[var(--paper-text)]">{auteurNomComplet}</strong>, {auteurTitre}</span>
          ) : (
            <span> · {auteurTitre}</span>
          )}
          {modifieLe && (
            <span className="italic ml-2 text-[var(--paper-text-sub)] opacity-75">
              (Modifié le {new Date(modifieLe).toLocaleDateString('fr-FR')})
            </span>
          )}
        </div>
      </div>

      {/* Grand Titre en Spectral */}
      <h2 className="font-spectral font-bold text-[24px] sm:text-[30px] text-[var(--paper-text)] leading-tight mb-4">
        {titre}
      </h2>

      {/* Publics destinataires */}
      <div className="bg-[var(--paper-footer-bg)] rounded-md p-3 mb-6 border border-[var(--paper-footer-border)] flex items-center justify-between gap-3 flex-wrap text-xs">
        <div>
          <span className="font-bold text-[var(--paper-text-muted)] mr-1.5">Destinataires :</span>
          <span className="text-[var(--paper-text)] font-medium">
            {rolesLabels.length >= 5 ? 'Tous les usagers' : rolesLabels.join(', ')}
          </span>
          {classesLabels.length > 0 && (
            <span className="ml-2 font-semibold text-primary">
              · {classesLabels.length} classe{classesLabels.length > 1 ? 's' : ''} concernée{classesLabels.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {stats && (
          <div
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--surface)] border border-[var(--paper-edge)] font-medium text-xs text-[var(--paper-text-muted)]"
            title="Statistiques de consultation"
          >
            <Eye size={13} />
            <span>
              Lu par <strong className="text-[var(--paper-text)]">{stats.lecturesCount}</strong> sur <strong className="text-[var(--paper-text)]">{stats.destinatairesEligiblesCount}</strong> destinataires
            </span>
          </div>
        )}
      </div>
    </>
  );
}

