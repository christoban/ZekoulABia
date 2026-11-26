import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaRoomRepository } from '@infrastructure/persistence/prisma/PrismaRoomRepository';
import { PrismaTeacherUnavailabilityRepository } from '@infrastructure/persistence/prisma/PrismaTeacherUnavailabilityRepository';
import { PrismaClassRoomAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaClassRoomAssignmentRepository';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { PrismaProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaProgrammeRepository';
import { PrismaChapitreRepository } from '@infrastructure/persistence/prisma/PrismaChapitreRepository';
import { PrismaCahierDeTexteRepository } from '@infrastructure/persistence/prisma/PrismaCahierDeTexteRepository';
import { PrismaMaterialisationProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaMaterialisationProgrammeRepository';
import { PrismaChapitreAvancementRepository } from '@infrastructure/persistence/prisma/PrismaChapitreAvancementRepository';
import { PrismaSynchronisationProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaSynchronisationProgrammeRepository';
import { FeatureFlaggedAutoMaterialisationService } from '@infrastructure/services/pedagogie/FeatureFlaggedAutoMaterialisationService';
import { SchedulingGridAdapter } from '@infrastructure/scheduling/SchedulingGridAdapter';
import { ORToolsWasmAdapter } from '@infrastructure/scheduling/ORToolsWasmAdapter';
import { JwtQrTokenService } from '@infrastructure/services/qr/QrTokenService';
import { CreerSalleUseCase } from '@application/room/CreerSalleUseCase';
import { ModifierSalleUseCase } from '@application/room/ModifierSalleUseCase';
import { SupprimerSalleUseCase } from '@application/room/SupprimerSalleUseCase';
import { CreerIndisponibiliteEnseignantUseCase } from '@application/timetable/CreerIndisponibiliteEnseignantUseCase';
import { ModifierIndisponibiliteEnseignantUseCase } from '@application/timetable/ModifierIndisponibiliteEnseignantUseCase';
import { SupprimerIndisponibiliteEnseignantUseCase } from '@application/timetable/SupprimerIndisponibiliteEnseignantUseCase';
import { ListerIndisponibilitesEnseignantUseCase } from '@application/timetable/ListerIndisponibilitesEnseignantUseCase';
import { CreerStudentGroupSetUseCase } from '@application/studentGroup/CreerStudentGroupSetUseCase';
import { ModifierStudentGroupSetUseCase } from '@application/studentGroup/ModifierStudentGroupSetUseCase';
import { SupprimerStudentGroupSetUseCase } from '@application/studentGroup/SupprimerStudentGroupSetUseCase';
import { CreerStudentGroupUseCase } from '@application/studentGroup/CreerStudentGroupUseCase';
import { ModifierStudentGroupUseCase } from '@application/studentGroup/ModifierStudentGroupUseCase';
import { SupprimerStudentGroupUseCase } from '@application/studentGroup/SupprimerStudentGroupUseCase';
import { AssignerSalleClasseUseCase } from '@application/studentGroup/AssignerSalleClasseUseCase';
import { RetirerAssignationSalleUseCase } from '@application/studentGroup/RetirerAssignationSalleUseCase';
import { CreerEmploiDuTempsUseCase } from '@application/timetable/CreerEmploiDuTempsUseCase';
import { AjouterCreneauUseCase } from '@application/timetable/AjouterCreneauUseCase';
import { ModifierCreneauUseCase } from '@application/timetable/ModifierCreneauUseCase';
import { SupprimerCreneauUseCase } from '@application/timetable/SupprimerCreneauUseCase';
import { ViderCreneauxClasseUseCase } from '@application/timetable/ViderCreneauxClasseUseCase';
import { SoumettreEmploiDuTempsUseCase } from '@application/timetable/SoumettreEmploiDuTempsUseCase';
import { PublierEmploiDuTempsUseCase } from '@application/timetable/PublierEmploiDuTempsUseCase';
import { PublierTousEmploisDuTempsUseCase } from '@application/timetable/PublierTousEmploisDuTempsUseCase';
import { RouvrirEmploiDuTempsUseCase } from '@application/timetable/RouvrirEmploiDuTempsUseCase';
import { DemanderRattrapageUseCase } from '@application/timetable/DemanderRattrapageUseCase';
import { GenererSeancesGroupeUseCase } from '@application/timetable/GenererSeancesGroupeUseCase';
import { ResoudreParticipantsSeanceUseCase } from '@application/timetable/ResoudreParticipantsSeanceUseCase';
import { ProposerEmploiDuTempsUseCase } from '@application/timetable/ProposerEmploiDuTempsUseCase';
import { GenererSqueletteEmploiDuTempsUseCase } from '@application/timetable/GenererSqueletteEmploiDuTempsUseCase';
import { AppliquerPropositionEmploiDuTempsUseCase } from '@application/timetable/AppliquerPropositionEmploiDuTempsUseCase';
import { SimulerEmploiDuTempsUseCase } from '@application/timetable/SimulerEmploiDuTempsUseCase';
import { PointerPresenceEnseignantUseCase } from '@application/staffAttendance/PointerPresenceEnseignantUseCase';
import { VerifierPresenceAvantCahierDeTexte } from '@application/staffAttendance/VerifierPresenceAvantCahierDeTexte';
import { ListerProgrammeUseCase } from '@application/pedagogie/ListerProgrammeUseCase';
import { GererProgrammeUseCase } from '@application/pedagogie/GererProgrammeUseCase';
import { GererChapitreUseCase } from '@application/pedagogie/GererChapitreUseCase';
import { GererCahierDeTexteUseCase } from '@application/pedagogie/GererCahierDeTexteUseCase';
import { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';
import { ObtenirSlotDuJourUseCase } from '@application/pedagogie/ObtenirSlotDuJourUseCase';
import { GenererRapportPedagogieUseCase } from '@application/pedagogie/GenererRapportPedagogieUseCase';
import { ProposerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/ProposerInitialisationProgrammesClasseUseCase';
import { AppliquerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/AppliquerInitialisationProgrammesClasseUseCase';
import { BasculerAvancementChapitreUseCase } from '@application/pedagogie/BasculerAvancementChapitreUseCase';
import { BasculerModuleActifUseCase } from '@application/pedagogie/BasculerModuleActifUseCase';
import { InitialiserProgrammesEcoleUseCase } from '@application/pedagogie/InitialiserProgrammesEcoleUseCase';
import { ListerDerivesProgrammesEcoleUseCase } from '@application/pedagogie/ListerDerivesProgrammesEcoleUseCase';
import { ProposerSynchronisationProgrammeUseCase } from '@application/pedagogie/ProposerSynchronisationProgrammeUseCase';
import { AppliquerSynchronisationProgrammeUseCase } from '@application/pedagogie/AppliquerSynchronisationProgrammeUseCase';
import type { CoreContainerContext } from './coreContext';

export function createTimetableContainer(core: CoreContainerContext) {
  const roomRepository = new PrismaRoomRepository(prisma);
  const classRoomAssignmentRepository = new PrismaClassRoomAssignmentRepository(prisma);
  const teacherUnavailabilityRepository = new PrismaTeacherUnavailabilityRepository(prisma);
  const timetableRepository = new PrismaTimetableRepository(prisma);
  const schedulingGridAdapter = new SchedulingGridAdapter();
  const schedulingSolver = new ORToolsWasmAdapter();
  const programmeRepository = new PrismaProgrammeRepository(prisma);
  const chapitreRepository = new PrismaChapitreRepository(prisma);
  const cahierDeTexteRepository = new PrismaCahierDeTexteRepository(prisma);
  const materialisationProgrammeRepository = new PrismaMaterialisationProgrammeRepository(prisma);
  const chapitreAvancementRepository = new PrismaChapitreAvancementRepository(prisma);
  const synchronisationProgrammeRepository = new PrismaSynchronisationProgrammeRepository(prisma);
  const proposerInitialisationProgrammesClasse = new ProposerInitialisationProgrammesClasseUseCase(
    materialisationProgrammeRepository,
  );
  const appliquerInitialisationProgrammesClasse = new AppliquerInitialisationProgrammesClasseUseCase(
    proposerInitialisationProgrammesClasse,
    materialisationProgrammeRepository,
  );
  const initialiserProgrammesEcole = new InitialiserProgrammesEcoleUseCase(
    synchronisationProgrammeRepository,
    proposerInitialisationProgrammesClasse,
    appliquerInitialisationProgrammesClasse,
  );
  const autoMaterialisationProgrammes = new FeatureFlaggedAutoMaterialisationService(
    appliquerInitialisationProgrammesClasse,
    initialiserProgrammesEcole,
  );

  const proposerEmploiDuTempsUseCase = new ProposerEmploiDuTempsUseCase(
    timetableRepository,
    roomRepository,
    classRoomAssignmentRepository,
    teacherUnavailabilityRepository,
    schedulingSolver,
    schedulingGridAdapter,
    core.studentGroupSetRepository,
    core.studentGroupRepository,
    core.studentGroupMembershipRepository,
  );

  const verifierPresenceAvantCahier = new VerifierPresenceAvantCahierDeTexte(
    core.staffAttendanceRepository,
    timetableRepository,
  );

  return {
    room: {
      creer: new CreerSalleUseCase(roomRepository),
      modifier: new ModifierSalleUseCase(roomRepository),
      supprimer: new SupprimerSalleUseCase(roomRepository),
    },
    teacherUnavailability: {
      creer: new CreerIndisponibiliteEnseignantUseCase(teacherUnavailabilityRepository, core.userRepository),
      modifier: new ModifierIndisponibiliteEnseignantUseCase(teacherUnavailabilityRepository),
      supprimer: new SupprimerIndisponibiliteEnseignantUseCase(teacherUnavailabilityRepository),
      lister: new ListerIndisponibilitesEnseignantUseCase(teacherUnavailabilityRepository, core.userRepository),
    },
    studentGroup: {
      creerGroupSet: new CreerStudentGroupSetUseCase(core.studentGroupSetRepository),
      modifierGroupSet: new ModifierStudentGroupSetUseCase(core.studentGroupSetRepository),
      supprimerGroupSet: new SupprimerStudentGroupSetUseCase(core.studentGroupSetRepository),
      creerGroup: new CreerStudentGroupUseCase(core.studentGroupRepository, core.studentGroupSetRepository),
      modifierGroup: new ModifierStudentGroupUseCase(core.studentGroupRepository, core.studentGroupSetRepository),
      supprimerGroup: new SupprimerStudentGroupUseCase(core.studentGroupRepository, core.studentGroupSetRepository),
      assignerSalleClasse: new AssignerSalleClasseUseCase(classRoomAssignmentRepository, core.classeRepository, roomRepository),
      retirerAssignationSalle: new RetirerAssignationSalleUseCase(classRoomAssignmentRepository),
    },
    timetable: {
      creer: new CreerEmploiDuTempsUseCase(timetableRepository),
      ajouterCreneau: new AjouterCreneauUseCase(timetableRepository, schedulingGridAdapter),
      modifierCreneau: new ModifierCreneauUseCase(timetableRepository),
      supprimerCreneau: new SupprimerCreneauUseCase(timetableRepository, core.activityLog),
      viderCreneaux: new ViderCreneauxClasseUseCase(timetableRepository, core.activityLog),
      soumettre: new SoumettreEmploiDuTempsUseCase(timetableRepository, core.activityLog),
      publier: new PublierEmploiDuTempsUseCase(timetableRepository, core.activityLog),
      publierTous: new PublierTousEmploisDuTempsUseCase(timetableRepository, core.activityLog),
      rouvrir: new RouvrirEmploiDuTempsUseCase(timetableRepository, core.activityLog),
      demanderRattrapage: new DemanderRattrapageUseCase(
        core.userRepository,
        core.notificationService,
        core.rattachementRepository,
        core.schoolRepository,
      ),
      genererSeancesGroupe: new GenererSeancesGroupeUseCase(
        timetableRepository,
        core.studentGroupRepository,
        core.studentGroupMembershipRepository,
        classRoomAssignmentRepository,
        roomRepository,
      ),
      resoudreParticipantsSeance: new ResoudreParticipantsSeanceUseCase(
        timetableRepository,
        core.studentGroupMembershipRepository,
      ),
      proposerEmploiDuTemps: proposerEmploiDuTempsUseCase,
      appliquerProposition: new AppliquerPropositionEmploiDuTempsUseCase(timetableRepository, proposerEmploiDuTempsUseCase),
      simulerEmploiDuTemps: new SimulerEmploiDuTempsUseCase(
        proposerEmploiDuTempsUseCase,
        schedulingSolver,
        timetableRepository,
      ),
      genererSquelette: new GenererSqueletteEmploiDuTempsUseCase(
        timetableRepository,
        core.anneeRepository,
        schedulingGridAdapter,
      ),
      timetableRepository,
    },
    staffAttendance: {
      pointerPresenceEnseignant: new PointerPresenceEnseignantUseCase(
        core.staffAttendanceRepository,
        timetableRepository,
        core.userRepository,
        new JwtQrTokenService(),
      ),
      verifierPresenceAvantCahier,
      staffAttendanceRepository: core.staffAttendanceRepository,
    },
    pedagogie: {
      listerProgramme: new ListerProgrammeUseCase(programmeRepository),
      gererProgramme: new GererProgrammeUseCase(programmeRepository, core.anneeRepository),
      gererChapitre: new GererChapitreUseCase(chapitreRepository, programmeRepository),
      gererCahier: new GererCahierDeTexteUseCase(
        cahierDeTexteRepository,
        core.anneeRepository,
        core.rattachementRepository,
        verifierPresenceAvantCahier,
      ),
      calculerProgression: new CalculerProgressionProgrammeUseCase(
        programmeRepository,
        cahierDeTexteRepository,
        core.classeRepository,
        core.anneeRepository,
        chapitreAvancementRepository,
      ),
      obtenirSlot: new ObtenirSlotDuJourUseCase(timetableRepository, core.anneeRepository),
      genererRapport: new GenererRapportPedagogieUseCase(
        cahierDeTexteRepository,
        core.departmentRepository,
        core.anneeRepository,
      ),
      proposerInitialisationClasse: proposerInitialisationProgrammesClasse,
      appliquerInitialisationClasse: appliquerInitialisationProgrammesClasse,
      initialiserEcole: initialiserProgrammesEcole,
      listerDerivesEcole: new ListerDerivesProgrammesEcoleUseCase(synchronisationProgrammeRepository),
      proposerSynchronisation: new ProposerSynchronisationProgrammeUseCase(synchronisationProgrammeRepository),
      appliquerSynchronisation: new AppliquerSynchronisationProgrammeUseCase(synchronisationProgrammeRepository),
      autoMaterialisation: autoMaterialisationProgrammes,
      basculerAvancementChapitre: new BasculerAvancementChapitreUseCase(
        chapitreAvancementRepository,
        cahierDeTexteRepository,
        core.rattachementRepository,
      ),
      basculerModuleActif: new BasculerModuleActifUseCase(
        chapitreAvancementRepository,
        core.rattachementRepository,
      ),
    },
  };
}
