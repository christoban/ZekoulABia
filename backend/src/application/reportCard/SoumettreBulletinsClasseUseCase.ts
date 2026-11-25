/**
 * APPLICATION LAYER — Use Case : Soumettre les bulletins d'une classe pour validation
 * Le professeur principal ou un admin soumet l'ensemble des bulletins d'une classe/période.
 */
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinValidationRepository } from '@domain/ports/repositories/BulletinValidationRepository';

export interface SoumettreBulletinsCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
  demandeurId: string;
  demandeurRole: string;
}

export class SoumettreBulletinsClasseUseCase {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly bulletinValidationRepository: BulletinValidationRepository,
  ) {}

  async execute(commande: SoumettreBulletinsCommande) {
    const { schoolId, classId, academicPeriodId, demandeurId, demandeurRole } = commande;

    // 1. Autorisation : ADMIN ou PP de la classe
    const role = demandeurRole.toUpperCase();
    if (role !== 'ADMIN') {
      const classePP = await this.classeRepository.findClasseDeProfPrincipal(demandeurId);
      if (!classePP || classePP.id !== classId) {
        throw new Error('Seul un Admin ou le Professeur Principal de cette classe peut soumettre les bulletins');
      }
    }

    // 2. Garde : aucune session existante
    const existante = await this.bulletinValidationRepository.sessionExistante(classId, academicPeriodId);
    if (existante) {
      throw new Error('Une soumission existe déjà pour cette classe et cette période');
    }

    // 3. Garde stricte : tous les bulletins doivent être générés
    const bulletins = await this.bulletinRepository.findByClasse(classId, academicPeriodId);
    const nonGeneres = bulletins.filter(b => !b.estGenere());
    if (nonGeneres.length > 0) {
      throw new Error(
        `Certains bulletins ne sont pas encore générés — élèves manquants: ${nonGeneres.map(b => b.studentId).join(', ')}`
      );
    }

    // 4. Créer la session et mettre à jour le workflow
    const session = await this.bulletinValidationRepository.creerSession({
      schoolId,
      classId,
      academicPeriodId,
      submittedById: demandeurId,
    });

    await this.bulletinRepository.majStatutWorkflowParClasse(
      classId,
      academicPeriodId,
      schoolId,
      'SUBMITTED',
    );

    return { session, bulletinsCount: bulletins.length };
  }
}