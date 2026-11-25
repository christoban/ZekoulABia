import { describe, it, expect, beforeEach } from 'bun:test';
import { GenererSeancesGroupeUseCase } from '../../../../src/application/timetable/GenererSeancesGroupeUseCase.ts';
import { InMemoryTimetableRepository } from '../../../helpers/repositories/InMemoryTimetableRepository.ts';
import { InMemoryStudentGroupRepository } from '../../../helpers/repositories/InMemoryStudentGroupRepository.ts';
import { InMemoryStudentGroupMembershipRepository } from '../../../helpers/repositories/InMemoryStudentGroupMembershipRepository.ts';
import { InMemoryClassRoomAssignmentRepository } from '../../../helpers/repositories/InMemoryClassRoomAssignmentRepository.ts';
import { InMemoryRoomRepository } from '../../../helpers/repositories/InMemoryRoomRepository.ts';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { Room } from '@domain/entities/Room';

describe('GenererSeancesGroupeUseCase', () => {
  let timetableRepo: InMemoryTimetableRepository;
  let groupRepo: InMemoryStudentGroupRepository;
  let membershipRepo: InMemoryStudentGroupMembershipRepository;
  let classRoomAssignmentRepo: InMemoryClassRoomAssignmentRepository;
  let roomRepo: InMemoryRoomRepository;
  let useCase: GenererSeancesGroupeUseCase;

  const commandeBase = {
    timetableId: 'edt-1',
    schoolId: 'school-1',
    groupSetId: 'groupset-lv2',
    academicYearId: 'annee-1',
    dayOfWeek: 0,
    startTime: '08:00',
    endTime: '09:00',
    enseignantParGroupe: [
      { groupId: 'groupe-allemand', teacherId: 'teacher-de' },
      { groupId: 'groupe-espagnol', teacherId: 'teacher-es' },
    ],
  };

  beforeEach(() => {
    timetableRepo = new InMemoryTimetableRepository();
    groupRepo = new InMemoryStudentGroupRepository();
    membershipRepo = new InMemoryStudentGroupMembershipRepository();
    classRoomAssignmentRepo = new InMemoryClassRoomAssignmentRepository();
    roomRepo = new InMemoryRoomRepository();
    useCase = new GenererSeancesGroupeUseCase(timetableRepo, groupRepo, membershipRepo, classRoomAssignmentRepo, roomRepo);

    timetableRepo.ajouterEDT(EmploiDuTemps.reconstituer({
      id: 'edt-1', schoolId: 'school-1', classId: 'classe-1', academicYearId: 'annee-1',
      status: 'DRAFT', generatedByAI: false, createdAt: new Date(),
    }));
    timetableRepo.definirEnseignant('teacher-de', 'Mme Allemand', false);
    timetableRepo.definirEnseignant('teacher-es', 'M. Espagnol', false);

    groupRepo.ajouter({ id: 'groupe-allemand', groupSetId: 'groupset-lv2', name: 'Allemand', subjectId: 'subj-de' });
    groupRepo.ajouter({ id: 'groupe-espagnol', groupSetId: 'groupset-lv2', name: 'Espagnol', subjectId: 'subj-es' });

    // 3 élèves en Allemand (le plus nombreux), 2 en Espagnol
    for (const eleveId of ['eleve-1', 'eleve-2', 'eleve-3']) {
      membershipRepo.ajouterMembre(eleveId, 'groupe-allemand', 'groupset-lv2', 'annee-1', 'classe-1');
    }
    for (const eleveId of ['eleve-4', 'eleve-5']) {
      membershipRepo.ajouterMembre(eleveId, 'groupe-espagnol', 'groupset-lv2', 'annee-1', 'classe-1');
    }

    const salleHabituelle = Room.create({ schoolId: 'school-1', name: 'Salle habituelle', capacity: 40 });
    roomRepo.ajouter(salleHabituelle);
    classRoomAssignmentRepo.ajouter({
      id: 'assignation-1', schoolId: 'school-1', classId: 'classe-1', roomId: salleHabituelle.id, academicYearId: 'annee-1',
    });

    const salleFlottanteGrande = Room.create({ schoolId: 'school-1', name: 'Flottante 10', capacity: 10 });
    const salleFlottantePetite = Room.create({ schoolId: 'school-1', name: 'Flottante 5', capacity: 5 });
    timetableRepo.definirSalle(salleHabituelle.id, salleHabituelle.name);
    timetableRepo.definirSalle(salleFlottanteGrande.id, salleFlottanteGrande.name);
    timetableRepo.definirSalle(salleFlottantePetite.id, salleFlottantePetite.name);
    roomRepo.ajouter(salleFlottanteGrande);
    roomRepo.ajouter(salleFlottantePetite);
  });

  it('devrait générer une séance par Group actif, salle habituelle au plus nombreux', async () => {
    const resultat = await useCase.execute(commandeBase);

    expect(resultat.creneauxCrees).toHaveLength(2);

    const seanceAllemand = resultat.creneauxCrees.find(s => s.groupId === 'groupe-allemand')!;
    const seanceEspagnol = resultat.creneauxCrees.find(s => s.groupId === 'groupe-espagnol')!;

    expect(seanceAllemand.participantsCount).toBe(3);
    expect(seanceEspagnol.participantsCount).toBe(2);

    // Le groupe le plus nombreux (Allemand, 3) garde la salle habituelle.
    const salleHabituelle = await classRoomAssignmentRepo.findByClasseAndAnnee('classe-1', 'annee-1');
    expect(seanceAllemand.roomId).toBe(salleHabituelle!.roomId);

    // Le plus petit va dans la plus petite salle flottante qui convient (capacité 5, pas 10).
    const rooms = await roomRepo.findBySchool('school-1');
    const petiteFlottante = rooms.find(r => r.capacity === 5)!;
    expect(seanceEspagnol.roomId).toBe(petiteFlottante.id);
  });

  it('devrait rejeter un 2e appel pour le même GroupSet/créneau (idempotence, pas de doublon)', async () => {
    await useCase.execute(commandeBase);

    await expect(useCase.execute(commandeBase)).rejects.toThrow('existent déjà');

    // Aucun créneau supplémentaire créé.
    const creneaux = await timetableRepo.findCreneauxByTimetable('edt-1');
    expect(creneaux).toHaveLength(2);
  });

  it("devrait rejeter si aucune salle habituelle n'est assignée à la classe", async () => {
    const repoSansAssignation = new InMemoryClassRoomAssignmentRepository();
    const useCaseSansAssignation = new GenererSeancesGroupeUseCase(
      timetableRepo, groupRepo, membershipRepo, repoSansAssignation, roomRepo
    );

    await expect(useCaseSansAssignation.execute(commandeBase)).rejects.toThrow('Aucune salle habituelle');
  });

  it("devrait rejeter si aucun élève de la classe n'appartient à un Group de ce GroupSet", async () => {
    const membershipVide = new InMemoryStudentGroupMembershipRepository();
    const useCaseSansMembres = new GenererSeancesGroupeUseCase(
      timetableRepo, groupRepo, membershipVide, classRoomAssignmentRepo, roomRepo
    );

    await expect(useCaseSansMembres.execute(commandeBase)).rejects.toThrow("n'appartient à un Group");
  });

  it('devrait rejeter si aucun enseignant fourni pour un Group actif', async () => {
    await expect(
      useCase.execute({ ...commandeBase, enseignantParGroupe: [{ groupId: 'groupe-allemand', teacherId: 'teacher-de' }] })
    ).rejects.toThrow('Aucun enseignant fourni');
  });

  it("devrait rejeter si aucune salle flottante n'a une capacité suffisante", async () => {
    // Allemand reste le plus nombreux (garde la salle habituelle) ; Espagnol dépasse la plus
    // grande salle flottante disponible (capacité max 10) — aucune salle ne convient.
    for (let i = 0; i < 15; i++) {
      membershipRepo.ajouterMembre(`eleve-de-supp-${i}`, 'groupe-allemand', 'groupset-lv2', 'annee-1', 'classe-1');
    }
    for (let i = 0; i < 10; i++) {
      membershipRepo.ajouterMembre(`eleve-es-supp-${i}`, 'groupe-espagnol', 'groupset-lv2', 'annee-1', 'classe-1');
    }

    await expect(useCase.execute(commandeBase)).rejects.toThrow('Aucune salle flottante disponible');
  });
});
