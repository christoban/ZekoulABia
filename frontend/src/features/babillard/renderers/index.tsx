import React from 'react';
import type { PublicationItem, PublicationType } from '../types';
import AnnonceCardRenderer from './AnnonceCardRenderer';
import AnnonceDetailRenderer from './AnnonceDetailRenderer';

export interface BabillardCardProps {
  publication: PublicationItem;
  canManage: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  stats?: { lecturesCount: number; destinatairesEligiblesCount: number } | null;
}

export interface BabillardDetailProps {
  publication: PublicationItem;
  schoolName?: string;
  stats?: { lecturesCount: number; destinatairesEligiblesCount: number } | null;
  onClose?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export interface PublicationRendererRegistration {
  CardComponent: React.ComponentType<BabillardCardProps>;
  DetailComponent: React.ComponentType<BabillardDetailProps>;
}

/**
 * Registre de rendu par type de publication.
 * Permet d'ajouter de futurs types (ex. 'RESULTATS') sans modifier le panneau ni le routage.
 */
export const BABILLARD_RENDERERS: Record<PublicationType, PublicationRendererRegistration> = {
  ANNONCE: {
    CardComponent: AnnonceCardRenderer,
    DetailComponent: AnnonceDetailRenderer,
  },
  RESULTATS: {
    // Rendu par défaut réutilisant la structure annonce en attendant l'interface dédiée résultats
    CardComponent: AnnonceCardRenderer,
    DetailComponent: AnnonceDetailRenderer,
  },
};
