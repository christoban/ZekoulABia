import { describe, expect, it } from 'bun:test';
import {
  transitionTransferRequest,
  type TransferRequestEvent,
  type TransferRequestStatus,
} from '../../../../src/application/studentTransfer/transferStateMachine.ts';

/**
 * Phase 6 — machine à états : chaque paire (état, événement) non listée comme
 * transition valide DOIT être refusée. Contrat encodé ici :
 * - les 10 transitions de la table `TRANSITIONS` ;
 * - `TARGET_CANCEL` est accepté de TOUT état non final (la restriction
 *   « uniquement PENDING_SOURCE, uniquement cible » est un verrou métier de
 *   AnnulerDemandeTransfertUseCase, pas un verrou de la machine) ;
 * - aucun état final n'évolue.
 */
const ETATS: TransferRequestStatus[] = [
  'PENDING_GUARDIAN', 'PENDING_SOURCE', 'APPROVED',
  'REFUSED_BY_GUARDIAN', 'REFUSED_BY_SOURCE', 'EXPIRED',
  'REVOKED', 'COMPLETED', 'CANCELLED',
];

const ETATS_FINaux = new Set<TransferRequestStatus>([
  'REFUSED_BY_GUARDIAN', 'REFUSED_BY_SOURCE', 'EXPIRED', 'REVOKED', 'COMPLETED', 'CANCELLED',
]);

const EVENEMENTS: TransferRequestEvent[] = [
  'GUARDIAN_ACCEPT', 'GUARDIAN_REFUSE', 'PARENT_EXPIRE', 'PARENT_REVOKE',
  'SOURCE_ACCEPT', 'SOURCE_AUTO_APPROVE', 'SOURCE_REFUSE', 'TARGET_CANCEL',
  'SNAPSHOT_GENERATED',
];

/** Paires (état, événement) valides hors TARGET_CANCEL court-circuité. */
const PAIRES_VALIDES = new Set([
  'PENDING_GUARDIAN|GUARDIAN_ACCEPT',
  'PENDING_GUARDIAN|GUARDIAN_REFUSE',
  'PENDING_GUARDIAN|PARENT_EXPIRE',
  'PENDING_GUARDIAN|PARENT_REVOKE',
  'PENDING_SOURCE|SOURCE_ACCEPT',
  'PENDING_SOURCE|SOURCE_AUTO_APPROVE',
  'PENDING_SOURCE|SOURCE_REFUSE',
  'PENDING_SOURCE|PARENT_REVOKE',
  'PENDING_SOURCE|TARGET_CANCEL',
  'APPROVED|PARENT_REVOKE',
  'APPROVED|SNAPSHOT_GENERATED',
]);

describe('machine à états transfert — couverture exhaustive invalide', () => {
  it('chaque transition valide du contrat reste valide (redondance volontaire)', () => {
    for (const paire of PAIRES_VALIDES) {
      const [status, event] = paire.split('|') as [TransferRequestStatus, TransferRequestEvent];
      expect(() => transitionTransferRequest(status, event)).not.toThrow();
    }
    for (const status of ETATS) {
      if (ETATS_FINaux.has(status)) continue;
      expect(transitionTransferRequest(status, 'TARGET_CANCEL')).toBe('CANCELLED');
    }
  });

  it('refuse toutes les paires (état, événement) hors contrat', () => {
    for (const status of ETATS) {
      for (const event of EVENEMENTS) {
        const paire = `${status}|${event}`;
        if (!ETATS_FINaux.has(status) && (event === 'TARGET_CANCEL' || PAIRES_VALIDES.has(paire))) continue;
        expect(() => transitionTransferRequest(status, event)).toThrow();
      }
    }
  });

  it('les 6 états finaux sont immuables, quels que soient les événements', () => {
    for (const status of ETATS_FINaux) {
      for (const event of EVENEMENTS) {
        expect(() => transitionTransferRequest(status, event)).toThrow('final');
      }
    }
  });
});
