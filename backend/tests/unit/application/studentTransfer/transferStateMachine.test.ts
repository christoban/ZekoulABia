import { describe, expect, it } from 'bun:test';
import {
  transitionTransferRequest,
  type TransferRequestEvent,
  type TransferRequestStatus,
} from '../../../../src/application/studentTransfer/transferStateMachine.ts';

const transitions: Array<[TransferRequestStatus, TransferRequestEvent, TransferRequestStatus]> = [
  ['PENDING_GUARDIAN', 'GUARDIAN_ACCEPT', 'PENDING_SOURCE'],
  ['PENDING_GUARDIAN', 'GUARDIAN_REFUSE', 'REFUSED_BY_GUARDIAN'],
  ['PENDING_GUARDIAN', 'PARENT_EXPIRE', 'EXPIRED'],
  ['PENDING_GUARDIAN', 'PARENT_REVOKE', 'REVOKED'],
  ['PENDING_SOURCE', 'SOURCE_ACCEPT', 'APPROVED'],
  ['PENDING_SOURCE', 'SOURCE_AUTO_APPROVE', 'APPROVED'],
  ['PENDING_SOURCE', 'SOURCE_REFUSE', 'REFUSED_BY_SOURCE'],
  ['PENDING_SOURCE', 'PARENT_REVOKE', 'REVOKED'],
  ['APPROVED', 'PARENT_REVOKE', 'REVOKED'],
  ['APPROVED', 'SNAPSHOT_GENERATED', 'COMPLETED'],
  ['PENDING_SOURCE', 'TARGET_CANCEL', 'CANCELLED'],
];

describe('machine à états TransferRequest', () => {
  it.each(transitions)('%s + %s -> %s', (status, event, expected) => {
    expect(transitionTransferRequest(status, event)).toBe(expected);
  });

  it('refuse toute transition depuis un état final', () => {
    for (const status of ['REFUSED_BY_GUARDIAN', 'REFUSED_BY_SOURCE', 'EXPIRED', 'REVOKED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(() => transitionTransferRequest(status, 'TARGET_CANCEL')).toThrow('final');
    }
  });

  it('refuse les événements incompatibles avec l’état courant', () => {
    expect(() => transitionTransferRequest('PENDING_GUARDIAN', 'SOURCE_ACCEPT')).toThrow('Transition');
    expect(() => transitionTransferRequest('APPROVED', 'SOURCE_ACCEPT')).toThrow('Transition');
  });
});
