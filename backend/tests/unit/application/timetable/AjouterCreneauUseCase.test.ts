import { describe, it, expect, beforeEach } from 'bun:test';
import { AjouterCreneauUseCase } from '../../../../src/application/timetable/AjouterCreneauUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import { ConflitHoraireError } from '@domain/errors/ConflitHoraireError';
import { ConflitSalleError } from '@domain/errors/ConflitSalleError';
import { VolumeHoraireAPError } from '@domain/errors/VolumeHoraireAPError';

describe('AjouterCreneauUseCase', () => {
  let repo: InMemoryTimetableRepository;
  let useCase: AjouterCreneauUseCase;

  const creerEdtDraft = () =>
    EmploiDuTemps.reconstituer({
      id: 'edt-1',
      schoolId: 'school-1',
      classId: 'classe-1',
      academicYearId: 'annee-1',
      status: 'DRAFT',
      generatedByAI: false,
      createdAt: new Date(),
    });

  const commandeBase = {
    timetableId: 'edt-1',
    schoolId: 'school-1',
    teacherId: 'teacher-1',
    dayOfWeek: 0,
    startTime: '08:00',
    endTime: '09:00',
    kind: 'CLASS' as const,
  };

  beforeEach(() => {
    repo = new InMemoryTimetableRepository();
    useCase = new AjouterCreneauUseCase(repo);
    repo.ajouterEDT(creerEdtDraft());
    repo.definirEnseignant('teacher-1', 'M. Dupont', false);
    repo.definirEnseignant('ap-1', 'Mme. Martin (AP)', true);
    repo.definirSalle('salle-1', 'Labo Physique');
  });

  it('devrait ajouter un créneau valide', async () => {
    const resultat = await useCase.execute(commandeBase);
    expect(resultat.creneauId).toBeDefined();
  });

  it('devrait lancer ConflitHoraireError si chevauchement', async () => {
    const existant = CreneauHoraire.create({
      timetableId: 'edt-1',
      teacherId: 'teacher-1',
      dayOfWeek: 0,
      startTime: '08:00',
      endTime: '09:00',
      kind: 'CLASS',
    });
    repo.ajouterCreneau(existant);

    await expect(useCase.execute(commandeBase)).rejects.toThrow(ConflitHoraireError);
  });

  it('devrait lancer ConflitSalleError si la salle est déjà occupée sur le créneau', async () => {
    const existant = CreneauHoraire.create({
      timetableId: 'edt-1',
      teacherId: 'autre-teacher',
      roomId: 'salle-1',
      dayOfWeek: 0,
      startTime: '08:00',
      endTime: '09:00',
      kind: 'CLASS',
    });
    repo.ajouterCreneau(existant);

    await expect(
      useCase.execute({ ...commandeBase, teacherId: 'teacher-1', roomId: 'salle-1' })
    ).rejects.toThrow(ConflitSalleError);
  });

  it('devrait accepter deux créneaux dans des salles différentes au même horaire', async () => {
    repo.definirSalle('salle-2', 'Salle 12');
    const existant = CreneauHoraire.create({
      timetableId: 'edt-1',
      teacherId: 'autre-teacher',
      roomId: 'salle-1',
      dayOfWeek: 0,
      startTime: '08:00',
      endTime: '09:00',
      kind: 'CLASS',
    });
    repo.ajouterCreneau(existant);

    const resultat = await useCase.execute({ ...commandeBase, teacherId: 'teacher-1', roomId: 'salle-2' });
    expect(resultat.creneauId).toBeDefined();
  });

  it('devrait rejeter si la salle est introuvable', async () => {
    await expect(
      useCase.execute({ ...commandeBase, roomId: 'salle-inconnue' })
    ).rejects.toThrow('Salle introuvable');
  });

  it('devrait Loi 7 : bloquer un AP qui dépasse 14h', async () => {
    // 14 créneaux d'1h chacun = 14h exactement → le +1 suivant dépasse
    for (let i = 0; i < 14; i++) {
      const hDebut = String(8 + (i % 8)).padStart(2, '0');
      const hFin = String(9 + (i % 8)).padStart(2, '0');
      repo.ajouterCreneau(
        CreneauHoraire.create({
          timetableId: 'edt-1',
          teacherId: 'ap-1',
          dayOfWeek: i < 5 ? i : 0,
          startTime: `${hDebut}:00`,
          endTime: `${hFin}:00`,
          kind: 'CLASS',
        })
      );
    }

    await expect(
      useCase.execute({
        ...commandeBase,
        teacherId: 'ap-1',
        dayOfWeek: 5,
        startTime: '08:00',
        endTime: '09:00',
      })
    ).rejects.toThrow(VolumeHoraireAPError);
  });

  it('ne devrait pas vérifier le volume AP pour un créneau BREAK', async () => {
    for (let i = 0; i < 14; i++) {
      const hDebut = String(8 + (i % 8)).padStart(2, '0');
      const hFin = String(9 + (i % 8)).padStart(2, '0');
      repo.ajouterCreneau(
        CreneauHoraire.create({
          timetableId: 'edt-1',
          teacherId: 'ap-1',
          dayOfWeek: i < 5 ? i : 0,
          startTime: `${hDebut}:00`,
          endTime: `${hFin}:00`,
          kind: 'CLASS',
        })
      );
    }

    const resultat = await useCase.execute({
      ...commandeBase,
      teacherId: 'ap-1',
      kind: 'BREAK',
      dayOfWeek: 5,
    });
    expect(resultat.creneauId).toBeDefined();
  });

  it('devrait rejeter si sous-groupe hors de la classe', async () => {
    await expect(
      useCase.execute({ ...commandeBase, subGroupId: 'groupe-autre-classe' })
    ).rejects.toThrow("n'appartient pas");
  });

  it('devrait accepter un sous-groupe valide', async () => {
    repo.ajouterSousGroupeValide('groupe-a', 'classe-1');

    const resultat = await useCase.execute({
      ...commandeBase,
      subGroupId: 'groupe-a',
    });
    expect(resultat.creneauId).toBeDefined();
  });

  it('devrait rejeter si EDT est publié', async () => {
    const edtPublie = EmploiDuTemps.reconstituer({
      id: 'edt-publie',
      schoolId: 'school-1',
      classId: 'classe-1',
      academicYearId: 'annee-1',
      status: 'PUBLISHED',
      generatedByAI: false,
      createdAt: new Date(),
    });
    repo.ajouterEDT(edtPublie);

    await expect(
      useCase.execute({ ...commandeBase, timetableId: 'edt-publie' })
    ).rejects.toThrow('publié');
  });

  it('devrait rejeter si EDT introuvable', async () => {
    await expect(
      useCase.execute({ ...commandeBase, timetableId: 'inconnu' })
    ).rejects.toThrow('introuvable');
  });
});
