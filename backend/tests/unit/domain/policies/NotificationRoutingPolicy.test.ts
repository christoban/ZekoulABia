import { describe, it, expect } from 'bun:test';
import { resoudreCanal } from '../../../../src/domain/policies/NotificationRoutingPolicy.ts';

describe('resoudreCanal', () => {
  it('LOW → IN_APP seul', () => {
    expect(resoudreCanal('LOW', true)).toEqual(['IN_APP']);
    expect(resoudreCanal('LOW', false, { push: false, sms: false })).toEqual(['IN_APP']);
  });

  it('LOW ignore push même avec token et prefs on', () => {
    expect(resoudreCanal('LOW', true, { push: true, sms: true })).toEqual(['IN_APP']);
  });

  it('NORMAL avec push actif et pref push on → PUSH+IN_APP', () => {
    expect(resoudreCanal('NORMAL', true, { push: true, sms: true })).toEqual(['PUSH', 'IN_APP']);
  });

  it('NORMAL avec push actif mais pref push off → IN_APP seul', () => {
    expect(resoudreCanal('NORMAL', true, { push: false, sms: true })).toEqual(['IN_APP']);
  });

  it('NORMAL sans push → IN_APP', () => {
    expect(resoudreCanal('NORMAL', false)).toEqual(['IN_APP']);
    expect(resoudreCanal('NORMAL', false, { push: true, sms: true })).toEqual(['IN_APP']);
  });

  it('HIGH même matrice que NORMAL (prefs)', () => {
    expect(resoudreCanal('HIGH', true, { push: true, sms: true })).toEqual(['PUSH', 'IN_APP']);
    expect(resoudreCanal('HIGH', true, { push: false, sms: true })).toEqual(['IN_APP']);
    expect(resoudreCanal('HIGH', false, { push: true, sms: true })).toEqual(['IN_APP']);
  });

  it('URGENT avec push → PUSH+IN_APP même si pref push off', () => {
    expect(resoudreCanal('URGENT', true, { push: false, sms: false })).toEqual(['PUSH', 'IN_APP']);
  });

  it('URGENT sans push → SMS+IN_APP même si pref sms off', () => {
    expect(resoudreCanal('URGENT', false, { push: false, sms: false })).toEqual(['SMS', 'IN_APP']);
  });

  it('URGENT sans push avec prefs null → SMS+IN_APP', () => {
    expect(resoudreCanal('URGENT', false, null)).toEqual(['SMS', 'IN_APP']);
  });

  it('prefs null = tout autorisé', () => {
    expect(resoudreCanal('NORMAL', true, null)).toEqual(['PUSH', 'IN_APP']);
    expect(resoudreCanal('HIGH', true, null)).toEqual(['PUSH', 'IN_APP']);
    expect(resoudreCanal('LOW', true, null)).toEqual(['IN_APP']);
  });

  it('NORMAL prefs sms off n’affecte pas PUSH', () => {
    expect(resoudreCanal('NORMAL', true, { push: true, sms: false })).toEqual(['PUSH', 'IN_APP']);
  });
});
