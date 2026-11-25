import type { DrawerDossier } from '@/components/enrollment/ValidationDrawer'

export interface Dossier extends DrawerDossier {
  createdAt: string
  matchScore: number | null
}

export type TabType = 'A_VALIDER' | 'RENVOYES' | 'REFUSES' | 'HISTORIQUE'

export const STATUT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text2, #4b5563)', label: 'Brouillon' },
  LINK_SENT: { bg: 'var(--blue-light)', color: 'var(--blue)', label: 'Chez la famille' },
  SUBMITTED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: 'Soumis à la direction' },
  RETURNED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: 'À compléter' },
  VALIDATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green, #16a34a)', label: 'Inscrit' },
  ACTIVATED: { bg: 'rgba(22,163,74,0.12)', color: 'var(--green, #16a34a)', label: 'Inscrit' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)', color: 'var(--red, #ef4444)', label: 'Refusé' },
  EXPIRED: { bg: 'var(--bg2, #f3f4f6)', color: 'var(--text3, #9ca3af)', label: 'Expiré' },
}

export const SOURCE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CONCOURS: { label: 'Concours', color: 'var(--green)', bg: 'var(--green-light)' },
  AUTOSERVICE: { label: 'Hors concours', color: 'var(--blue)', bg: 'var(--blue-light)' },
  HORS_CONCOURS: { label: 'Hors concours', color: 'var(--blue)', bg: 'var(--blue-light)' },
  TRANSFERT: { label: 'Transfert', color: 'var(--purple)', bg: 'var(--purple-light)' },
  IMPORT_MASSE: { label: 'Import', color: 'var(--amber)', bg: 'var(--amber-light)' },
  DIRECT: { label: 'Hors concours', color: 'var(--blue)', bg: 'var(--blue-light)' },
}
