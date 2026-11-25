/**
 * INFRASTRUCTURE — Données de référence MINESEC (seed data)
 *
 * Montants officiels des frais de scolarité et d'examens.
 * Source : MINESEC / DECC / OBC / GCE Board — session 2024-2025.
 *
 * Règle : ces montants sont lus depuis la table TarifMinesecReference,
 * jamais en dur dans le code applicatif. Ce fichier sert au seed initial.
 */
import type { PrismaClient } from '@prisma/client';

const TARIFS_2025_2026 = [
  // ── CONTRIBUTIONS EXIGIBLES (frais de scolarité) ──
  { typeFrais: 'SCOLARITE_PREMIER_CYCLE' as const, anneeScolaire: '2025-2026', niveau: '1er_cycle', montantFCFA: 7500, description: 'Contributions exigibles — 1er cycle (6e, 5e, 4e, 3e)' },
  { typeFrais: 'SCOLARITE_SECOND_CYCLE' as const, anneeScolaire: '2025-2026', niveau: '2nd_cycle', montantFCFA: 10000, description: 'Contributions exigibles — 2nd cycle (2nde, 1ère, Terminale)' },

  // ── EXAMENS DECC (BEPC, CAP) ──
  { typeFrais: 'EXAMEN_BEPC' as const, anneeScolaire: '2025-2026', niveau: null, montantFCFA: 7000, description: 'Frais inscription BEPC — DECC (général et bilingue)' },

  // ── EXAMENS OBC (Probatoire, BAC) ──
  { typeFrais: 'EXAMEN_PROBATOIRE' as const, anneeScolaire: '2025-2026', niveau: null, montantFCFA: 12000, description: 'Frais inscription Probatoire — OBC (hausse officielle 9500→12000 depuis 2024)' },
  { typeFrais: 'EXAMEN_BAC' as const, anneeScolaire: '2025-2026', niveau: null, montantFCFA: 12000, description: 'Frais inscription BAC — OBC (ESG, Technique, BT, BTI)' },

  // ── EXAMENS GCE BOARD (anglophone) ──
  // Montants de base (frais fixes d'inscription)
  { typeFrais: 'EXAMEN_GCE_OL' as const, anneeScolaire: '2025-2026', niveau: 'OL_BASE', montantFCFA: 8000, description: 'GCE Ordinary Level — frais fixes d\'inscription' },
  { typeFrais: 'EXAMEN_GCE_AL' as const, anneeScolaire: '2025-2026', niveau: 'AL_BASE', montantFCFA: 9000, description: 'GCE Advanced Level — frais fixes d\'inscription' },
] as const;

/**
 * Montants variables GCE (calculés à la volée, pas en base) :
 * - GCE OL par matière : 1 000 FCFA × nombre de matières
 * - GCE AL par matière : 2 000 FCFA × nombre de matières
 * - GCE pratique par matière : 5 000 FCFA × nombre de matières avec pratique
 * - Timbre formulaire GCE : 1 500 FCFA
 *
 * Ces montants sont utilisés par le use case GenererPaiementsMinesecUseCase
 * pour calculer le montant total d'un élève GCE.
 */
export const GCE_VARIABLES = {
  OL_PAR_MATIERE: 1000,
  AL_PAR_MATIERE: 2000,
  PRATIQUE_PAR_MATIERE: 5000,
  TIMBRE_FORMULAIRE: 1500,
} as const;

export async function seedTarifsMinesec(prisma: PrismaClient): Promise<void> {
  for (const tarif of TARIFS_2025_2026) {
    await prisma.tarifMinesecReference.upsert({
      where: {
        typeFrais_anneeScolaire_niveau: {
          typeFrais: tarif.typeFrais,
          anneeScolaire: tarif.anneeScolaire,
          niveau: tarif.niveau,
        },
      },
      create: tarif,
      update: { montantFCFA: tarif.montantFCFA, description: tarif.description },
    });
  }
  console.info(`✓ ${TARIFS_2025_2026.length} tarifs MINESEC seedés pour 2025-2026`);
}

/**
 * Estime les frais GCE pour un élève donné.
 * Les montants de base sont en base ; les montants variables sont calculés ici.
 */
export function estimerFraisGCE(params: {
  niveau: 'OL' | 'AL';
  nbMatieres: number;
  nbMatieresAvecPratique: number;
}): number {
  const base = params.niveau === 'OL' ? 8000 : 9000;
  const parMatiere = params.niveau === 'OL' ? GCE_VARIABLES.OL_PAR_MATIERE : GCE_VARIABLES.AL_PAR_MATIERE;
  return base
    + (params.nbMatieres * parMatiere)
    + (params.nbMatieresAvecPratique * GCE_VARIABLES.PRATIQUE_PAR_MATIERE)
    + GCE_VARIABLES.TIMBRE_FORMULAIRE;
}
