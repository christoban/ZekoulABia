/**
 * INFRASTRUCTURE — Calendrier Académique Officiel (Arrêté Conjoint MINESEC / MINEDUB)
 *
 * Source officielle : Arrêté conjoint signé le 14 août 2026
 * fixant le calendrier de l'année scolaire 2026-2027 en République du Cameroun.
 *
 * Ce calendrier national sert de référence temporelle pour tous les établissements.
 * Les établissements peuvent ajouter leurs congés locaux ("override local"),
 * mais ne peuvent pas altérer les jalons officiels nationaux.
 */
import type { PrismaClient } from '@prisma/client';

export const CALENDRIER_OFFICIEL_2026_2027 = {
  academicYear: '2026-2027',
  establishmentType: 'MINESEC',
  arreteReference: 'Arrêté conjoint MINESEC/MINEDUB du 14 août 2026',
  dateRentreeOfficielle: new Date('2026-09-07T00:00:00.000Z'),
  dateClotureOfficielle: new Date('2027-07-30T23:59:59.000Z'),
  trimestres: [
    {
      orderIndex: 1,
      name: 'Trimestre 1',
      startDate: '2026-09-07T00:00:00.000Z',
      endDate: '2026-12-04T23:59:59.000Z',
    },
    {
      orderIndex: 2,
      name: 'Trimestre 2',
      startDate: '2027-01-04T00:00:00.000Z',
      endDate: '2027-04-02T23:59:59.000Z',
    },
    {
      orderIndex: 3,
      name: 'Trimestre 3',
      startDate: '2027-04-19T00:00:00.000Z',
      endDate: '2027-07-30T23:59:59.000Z',
    },
  ],
  periodesVacances: [
    {
      name: 'Interruption 1er Trimestre',
      startDate: '2026-12-04T00:00:00.000Z',
      endDate: '2026-12-07T00:00:00.000Z',
    },
    {
      name: 'Départs en Congés de Noël',
      startDate: '2026-12-18T12:00:00.000Z',
      endDate: '2027-01-04T07:30:00.000Z',
    },
    {
      name: 'Départs en Congés de Pâques',
      startDate: '2027-04-02T12:00:00.000Z',
      endDate: '2027-04-19T07:30:00.000Z',
    },
    {
      name: 'Grandes Vacances & Clôture',
      startDate: '2027-07-30T12:00:00.000Z',
      endDate: '2027-09-06T07:30:00.000Z',
    },
  ],
  active: true,
};

export async function seedOfficialAcademicCalendar(prisma: PrismaClient): Promise<void> {
  await prisma.officialAcademicCalendar.upsert({
    where: {
      academicYear_establishmentType: {
        academicYear: CALENDRIER_OFFICIEL_2026_2027.academicYear,
        establishmentType: CALENDRIER_OFFICIEL_2026_2027.establishmentType,
      },
    },
    create: CALENDRIER_OFFICIEL_2026_2027,
    update: {
      dateRentreeOfficielle: CALENDRIER_OFFICIEL_2026_2027.dateRentreeOfficielle,
      dateClotureOfficielle: CALENDRIER_OFFICIEL_2026_2027.dateClotureOfficielle,
      trimestres: CALENDRIER_OFFICIEL_2026_2027.trimestres,
      periodesVacances: CALENDRIER_OFFICIEL_2026_2027.periodesVacances,
      arreteReference: CALENDRIER_OFFICIEL_2026_2027.arreteReference,
      active: true,
    },
  });

  console.log(`✓ Calendrier académique officiel ${CALENDRIER_OFFICIEL_2026_2027.academicYear} (Arrêté conjoint) seedé`);
}
