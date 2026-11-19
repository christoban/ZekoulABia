import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaCarnetLiaisonRepository } from '@infrastructure/persistence/prisma/PrismaCarnetLiaisonRepository';
import { PrismaPublicationRepository } from '@infrastructure/persistence/prisma/PrismaPublicationRepository';
import { PrismaBabillardContextRepository } from '@infrastructure/persistence/prisma/PrismaBabillardContextRepository';
import { PrismaPushSubscriptionRepository } from '@infrastructure/persistence/prisma/PrismaPushSubscriptionRepository';
import { PrismaTaskRepository } from '@infrastructure/persistence/prisma/PrismaTaskRepository';
import { PrismaSanteEleveRepository } from '@infrastructure/persistence/prisma/PrismaSanteEleveRepository';
import { PrismaOrientationRepository } from '@infrastructure/persistence/prisma/PrismaOrientationRepository';
import { PrismaGradeOrientationRepository } from '@infrastructure/persistence/prisma/PrismaGradeOrientationRepository';
import { GroqIAService } from '@infrastructure/services/ai/GroqIAService';
import { RulesBasedPredictionService } from '@infrastructure/services/ai/RulesBasedPredictionService';
import { TabPfnPredictionService } from '@infrastructure/services/ai/TabPfnPredictionService';
import { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';
import { TraiterSmsPresenceUseCase } from '@application/attendance/TraiterSmsPresenceUseCase';
import { SaisirHeuresAbsenceSequenceUseCase } from '@application/attendance/SaisirHeuresAbsenceSequenceUseCase';
import { ObtenirEnfantsUseCase } from '@application/parent/ObtenirEnfantsUseCase';
import { ObtenirAlertesSoldeUseCase } from '@application/parent/ObtenirAlertesSoldeUseCase';
import { VerifierAccesEnfantUseCase } from '@application/parent/VerifierAccesEnfantUseCase';
import { CreerEntreeCarnetUseCase } from '@application/carnetLiaison/CreerEntreeCarnetUseCase';
import { ListerCarnetEleveUseCase } from '@application/carnetLiaison/ListerCarnetEleveUseCase';
import { MarquerEntreeCarnetLueUseCase } from '@application/carnetLiaison/MarquerEntreeCarnetLueUseCase';
import { RepondreEntreeCarnetUseCase } from '@application/carnetLiaison/RepondreEntreeCarnetUseCase';
import { RelancerParentsNonLusCarnetUseCase } from '@application/carnetLiaison/RelancerParentsNonLusCarnetUseCase';
import { SouscrirePushUseCase } from '@application/pushNotification/SouscrirePushUseCase';
import { DesinscrirePushUseCase } from '@application/pushNotification/DesinscrirePushUseCase';
import { CreerTaskUseCase } from '@application/task/CreerTaskUseCase';
import { ListerTasksUseCase } from '@application/task/ListerTasksUseCase';
import { MettreAJourStatutTaskUseCase } from '@application/task/MettreAJourStatutTaskUseCase';
import { CalculerIndiceSanteUseCase } from '@application/ai/CalculerIndiceSanteUseCase';
import { CompareRisquePredictionsUseCase } from '@application/ai/CompareRisquePredictionsUseCase';
import { CreerFicheOrientationUseCase } from '@application/orientation/CreerFicheOrientationUseCase';
import { AjouterEntretienUseCase } from '@application/orientation/AjouterEntretienUseCase';
import { AjouterTestAptitudeUseCase } from '@application/orientation/AjouterTestAptitudeUseCase';
import { CreerRecommandationSerieUseCase } from '@application/orientation/CreerRecommandationSerieUseCase';
import { AjouterSuiviUseCase } from '@application/orientation/AjouterSuiviUseCase';
import { ListerFichesOrientationUseCase } from '@application/orientation/ListerFichesOrientationUseCase';
import { GetStatsOrientationUseCase } from '@application/orientation/GetStatsOrientationUseCase';
import { SaisirAspirationsEleveUseCase } from '@application/orientation/SaisirAspirationsEleveUseCase';
import { GenererRecommandationOrientationUseCase } from '@application/orientation/GenererRecommandationOrientationUseCase';
import { ValiderRecommandationConseillerUseCase } from '@application/orientation/ValiderRecommandationConseillerUseCase';
import { ProposerRecommandationEleveUseCase } from '@application/orientation/ProposerRecommandationEleveUseCase';
import { ChoisirPisteEleveUseCase } from '@application/orientation/ChoisirPisteEleveUseCase';
import { ListerElevesAOrienterUseCase } from '@application/orientation/ListerElevesAOrienterUseCase';
import { ConfigurerCheckpointOrientationUseCase } from '@application/orientation/ConfigurerCheckpointOrientationUseCase';
import type { CoreContainerContext } from './coreContext';

export function createCommunicationContainer(core: CoreContainerContext) {
  const carnetLiaisonRepository = new PrismaCarnetLiaisonRepository(prisma);
  const publicationRepository = new PrismaPublicationRepository(prisma);
  const babillardContextRepository = new PrismaBabillardContextRepository(prisma);
  const pushSubscriptionRepository = new PrismaPushSubscriptionRepository(prisma);
  const taskRepository = new PrismaTaskRepository(prisma);
  const santeEleveRepository = new PrismaSanteEleveRepository(prisma);
  const orientationRepository = new PrismaOrientationRepository(prisma);
  const gradeOrientationRepository = new PrismaGradeOrientationRepository(prisma);

  const groqIAService = new GroqIAService();
  const rulesBasedPredictionService = new RulesBasedPredictionService();
  const tabPfnPredictionService = new TabPfnPredictionService();

  return {
    attendance: {
      enregistrerPresence: new EnregistrerPresenceUseCase(
        core.presenceRepository,
        core.userRepository,
        core.notificationService,
        core.rattachementRepository,
        core.metricCache,
      ),
      traiterSmsPresence: new TraiterSmsPresenceUseCase(
        core.classeRepository,
        core.enrollmentRepository,
        core.userRepository,
        core.presenceRepository,
      ),
      saisirHeuresSequence: new SaisirHeuresAbsenceSequenceUseCase(
        core.sequenceAbsenceRepository,
        core.classeRepository,
        core.anneeRepository,
      ),
      sequenceAbsenceRepository: core.sequenceAbsenceRepository,
      presenceRepository: core.presenceRepository,
      userRepository: core.userRepository,
      parentRepository: core.parentRepository,
      rattachementRepository: core.rattachementRepository,
      schoolConfigRepository: core.schoolConfigRepository,
    },
    parent: {
      obtenirEnfants: new ObtenirEnfantsUseCase(core.parentRepository),
      verifierAcces: new VerifierAccesEnfantUseCase(core.parentRepository),
      obtenirAlertesSolde: new ObtenirAlertesSoldeUseCase(core.parentRepository, core.factureRepository),
      parentRepository: core.parentRepository,
    },
    carnetLiaison: {
      repository: carnetLiaisonRepository,
      creerEntree: new CreerEntreeCarnetUseCase(
        carnetLiaisonRepository,
        core.parentRepository,
        core.userRepository,
        core.notificationService,
        core.smsNotificationAdapter,
      ),
      listerCarnet: new ListerCarnetEleveUseCase(
        carnetLiaisonRepository,
        core.parentRepository,
        publicationRepository,
        babillardContextRepository,
      ),
      marquerLue: new MarquerEntreeCarnetLueUseCase(carnetLiaisonRepository, core.parentRepository),
      repondreEntree: new RepondreEntreeCarnetUseCase(
        carnetLiaisonRepository,
        core.parentRepository,
        core.notificationService,
        core.presenceRepository,
      ),
      relancerParents: new RelancerParentsNonLusCarnetUseCase(
        carnetLiaisonRepository,
        core.notificationService,
        core.smsNotificationAdapter,
      ),
      publicationRepository,
      babillardContextRepository,
    },
    pushNotification: {
      souscrire: new SouscrirePushUseCase(pushSubscriptionRepository),
      desinscrire: new DesinscrirePushUseCase(pushSubscriptionRepository),
    },
    notification: {
      service: core.notificationService,
      sms: core.smsNotificationAdapter,
    },
    task: {
      creer: new CreerTaskUseCase(taskRepository, core.userRepository),
      lister: new ListerTasksUseCase(taskRepository),
      mettreAJourStatut: new MettreAJourStatutTaskUseCase(taskRepository),
    },
    ai: {
      calculerIndiceSante: new CalculerIndiceSanteUseCase(santeEleveRepository, groqIAService),
    },
    prediction: {
      // Infrastructure prédictive (Partie B du plan) — jamais branchée à un flux de production réel.
      rulesService: rulesBasedPredictionService,
      tabpfnService: tabPfnPredictionService,
      comparerRisque: new CompareRisquePredictionsUseCase(
        santeEleveRepository,
        rulesBasedPredictionService,
        tabPfnPredictionService,
      ),
    },
    orientation: {
      creerFiche: new CreerFicheOrientationUseCase(orientationRepository),
      ajouterEntretien: new AjouterEntretienUseCase(orientationRepository),
      ajouterTest: new AjouterTestAptitudeUseCase(orientationRepository),
      creerRecommandation: new CreerRecommandationSerieUseCase(orientationRepository),
      ajouterSuivi: new AjouterSuiviUseCase(orientationRepository),
      listerFiches: new ListerFichesOrientationUseCase(orientationRepository),
      getStats: new GetStatsOrientationUseCase(orientationRepository),
      repo: orientationRepository,
      saisirAspiration: new SaisirAspirationsEleveUseCase(orientationRepository),
      genererRecommandation: new GenererRecommandationOrientationUseCase(
        orientationRepository,
        gradeOrientationRepository,
      ),
      validerRecommandationConseiller: new ValiderRecommandationConseillerUseCase(orientationRepository),
      proposerRecommandationEleve: new ProposerRecommandationEleveUseCase(orientationRepository),
      choisirPisteEleve: new ChoisirPisteEleveUseCase(orientationRepository),
      listerElevesAOrienter: new ListerElevesAOrienterUseCase(orientationRepository),
      configurerCheckpoint: new ConfigurerCheckpointOrientationUseCase(orientationRepository),
    },
  };
}
