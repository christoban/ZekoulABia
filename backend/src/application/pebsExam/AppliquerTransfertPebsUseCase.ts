import type { AppliquerTransfertPebsCommande } from './types';
import type { PebsExamRepository } from '@domain/ports/repositories/PebsExamRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import type { StudentAffectationRepository } from '@domain/ports/repositories/StudentAffectationRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import { synchroniserAppartenanceProgramme } from '@application/studentGroup/syncGroupMembership';

export interface NotifierEvenementAcademique {
  (schoolId: string, targetRoles: string[], titre: string, corps: string): Promise<void>;
}

interface NotifieCandidat { studentUserId: string; studentName: string }

export class AppliquerTransfertPebsUseCase {
  constructor(
    private readonly pebsRepository: PebsExamRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly affectationRepository: StudentAffectationRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
    private readonly notifier: NotifierEvenementAcademique,
  ) {}

  async execute(cmd: AppliquerTransfertPebsCommande): Promise<{
    transferred: number; confirmed: boolean; selectionnes: NotifieCandidat[]; nonSelectionnes: NotifieCandidat[];
  }> {
    const session = await this.pebsRepository.trouverSession(cmd.sessionId);
    if (!session) throw new Error('Session PEBS introuvable');
    if (session.schoolId !== cmd.schoolId) throw new Error('Accès refusé');
    if (session.status === 'APPLIED') throw new Error('Le transfert a déjà été appliqué');

    // Récupérer tous les candidats traités (sélectionnés + non sélectionnés) avec leur nom
    const allCandidates = await this.pebsRepository.listerCandidatsAvecProfil(cmd.sessionId, ['SELECTIONNE', 'NON_SELECTIONNE']);
    const selected = allCandidates.filter(c => c.selectionResult === 'SELECTIONNE');
    const nonSelected = allCandidates.filter(c => c.selectionResult === 'NON_SELECTIONNE');

    if (selected.length === 0) {
      throw new Error('Aucun candidat sélectionné à transférer');
    }

    // Si pas confirmé, retourner le résumé sans appliquer
    if (!cmd.confirmed) {
      return { transferred: 0, confirmed: false, selectionnes: [], nonSelectionnes: [] };
    }

    const school = await this.pebsRepository.trouverEcoleSubsystem(cmd.schoolId);
    const pebsFiliere = school?.subsystem === 'ANGLOPHONE' ? 'EN_PEBS' : 'FR_PEBS';

    // Résoudre la classe cible + un admin pour enrolledById
    const [targetClass, adminUser] = await Promise.all([
      this.pebsRepository.trouverClasseCible(session.targetClassId),
      this.pebsRepository.trouverAdminEcole(cmd.schoolId),
    ]);
    if (!targetClass) throw new Error('Classe cible PEBS introuvable');
    const enrolledById = adminUser?.id ?? 'SYSTEM';

    // Appliquer les transferts
    const syncRepos = { anneeRepository: this.anneeRepository, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository };
    let transferred = 0;
    const selectionnes: NotifieCandidat[] = [];
    for (const c of selected) {
      try {
        // 1. Mettre à jour pebsFiliere (attribut élève)
        await this.affectationRepository.mettreAJourPEBS(c.studentProfileId, pebsFiliere);
        // 2. Changer la classe via Enrollment
        await this.enrollmentRepository.changerClasseEleve({
          studentId: c.studentProfileId,
          newClassId: session.targetClassId,
          academicYearId: targetClass.academicYearId,
          schoolId: targetClass.schoolId,
          enrolledById,
          exitReason: 'PEBS',
        });
        await synchroniserAppartenanceProgramme(syncRepos, {
          schoolId: cmd.schoolId, studentProfileId: c.studentProfileId, pebsFiliere,
        });
        transferred++;
        if (c.studentProfile?.user) {
          selectionnes.push({ studentUserId: c.studentProfile.user.id, studentName: `${c.studentProfile.user.firstName} ${c.studentProfile.user.lastName}` });
        }
      } catch {
        // Erreur sur un transfert — continuer
      }
    }

    const nonSelectionnes: NotifieCandidat[] = nonSelected
      .filter(c => c.studentProfile?.user)
      .map(c => ({ studentUserId: c.studentProfile!.user!.id, studentName: `${c.studentProfile!.user!.firstName} ${c.studentProfile!.user!.lastName}` }));

    // Marquer la session comme appliquée
    await this.pebsRepository.mettreAJourStatutSession(cmd.sessionId, 'APPLIED');
    void this.notifier(
      cmd.schoolId, ['ADMIN', 'STAFF'],
      'Sélection PEBS clôturée',
      'Le transfert a été appliqué — la session est clôturée et le menu Sélection PEBS n\'est plus mis en avant.',
    ).catch((err) => console.error('[PebsExam] notification clôture:', err?.message));

    return { transferred, confirmed: true, selectionnes, nonSelectionnes };
  }
}
