import { describe, it, expect } from 'bun:test';
import { parseSMSAttendance } from '../../../../src/application/attendance/TraiterSmsPresenceUseCase';

describe('parseSMSAttendance — parsing SMS de présence (PRES#CLASSE#1,0,1,...)', () => {
  it('parse un message valide avec 3 statuts', () => {
    const parsed = parseSMSAttendance('PRES#4e#1,0,1', '237671234567');
    expect(parsed).not.toBeNull();
    // Le parser uppercasse le message (comportement historique préservé)
    expect(parsed!.className).toBe('4E');
    expect(parsed!.phoneNumber).toBe('237671234567');
    expect(parsed!.records).toEqual([
      { index: 0, status: 'PRESENT' },
      { index: 1, status: 'ABSENT' },
      { index: 2, status: 'PRESENT' },
    ]);
  });

  it('rejette un message sans préfixe PRES', () => {
    expect(parseSMSAttendance('ABS#4e#1,0', '237671234567')).toBeNull();
  });

  it('rejette un message avec moins de 3 parties', () => {
    expect(parseSMSAttendance('PRES#4e', '237671234567')).toBeNull();
  });

  it('accepte un message en minuscules (uppercassé par le parser)', () => {
    const parsed = parseSMSAttendance('pres#4e#0,1', '237671234567');
    expect(parsed!.className).toBe('4E');
    expect(parsed!.records[0].status).toBe('ABSENT');
  });

  it('rejette un message avec espaces internes autour des parties', () => {
    expect(parseSMSAttendance('PRES # 4e # 0,1', '237671234567')).toBeNull();
  });
});