/**
 * APPLICATION — Use case : Dashboard paiements consolidé par élève
 *
 * Retourne toutes les infos de paiement (MINESEC + établissement) pour un élève.
 */
import type { PaiementMinesecRepository } from '@domain/ports/repositories/PaiementMinesecRepository';
import type { StudentPaymentDashboard } from './types';

export class GetStudentPaymentDashboardUseCase {
  constructor(private readonly paiementRepository: PaiementMinesecRepository) {}

  async execute(schoolId: string, studentUserId: string): Promise<StudentPaymentDashboard> {
    // Récupérer le profil élève
    const profile = await this.paiementRepository.trouverProfileDashboard(studentUserId, schoolId);
    if (!profile) throw new Error('Élève introuvable');

    // Récupérer l'enrollment actif
    const enrollment = await this.paiementRepository.trouverEnrollmentActif(profile.id, schoolId);

    // Paiements MINESEC
    const paiementsMinesec = enrollment
      ? await this.paiementRepository.listerPaiementsEnrollment(enrollment.id)
      : [];

    // Paiements établissement
    const paiementsEtablissement = enrollment
      ? await this.paiementRepository.listerPaiementsEtablissementEnrollment(enrollment.id)
      : [];

    // Calcul totaux
    const totalAttenduMinesec = paiementsMinesec.reduce((s, p) => s + p.montantAttendu, 0);
    const totalPayeMinesec = paiementsMinesec.reduce((s, p) => s + (p.montantPaye ?? 0), 0);
    const totalAttenduEtab = paiementsEtablissement.reduce((s, p) => s + p.montantAttendu, 0);
    const totalPayeEtab = paiementsEtablissement.reduce((s, p) => s + (p.montantPaye ?? 0), 0);

    const totalAttendu = totalAttenduMinesec + totalAttenduEtab;
    const totalPaye = totalPayeMinesec + totalPayeEtab;
    const totalRestant = totalAttendu - totalPaye;

    // Statut global
    let statutGlobal: 'A_JOUR' | 'PARTIELLEMENT_PAYE' | 'EN_RETARD' = 'A_JOUR';
    if (totalRestant > 0) {
      const hasOverdue = paiementsMinesec.some((p) => p.status === 'IMPAYE' && p.dateEcheance && new Date(p.dateEcheance) < new Date())
        || paiementsEtablissement.some((p) => p.status === 'IMPAYE');
      statutGlobal = hasOverdue ? 'EN_RETARD' : 'PARTIELLEMENT_PAYE';
    }

    return {
      student: {
        id: profile.id,
        nom: profile.nom,
        prenom: profile.prenom,
        classe: profile.classe,
        matriculeNational: profile.matricule,
      },
      enrollment: enrollment ? {
        id: enrollment.id,
        status: enrollment.status,
        anneeScolaire: enrollment.anneeScolaire,
      } : { id: '', status: 'NONE', anneeScolaire: '' },
      paiementsMinesec: paiementsMinesec.map((p) => ({
        id: p.id,
        typeFrais: p.typeFrais,
        montantAttendu: p.montantAttendu,
        montantPaye: p.montantPaye,
        status: p.status,
        dateEcheance: p.dateEcheance,
        operateur: p.operateur,
        recuVerifie: p.recuVerifie,
      })),
      paiementsEtablissement: paiementsEtablissement.map((p) => ({
        id: p.id,
        label: p.typeFrais,
        montantAttendu: p.montantAttendu,
        montantPaye: p.montantPaye,
        status: p.status,
        recu: p.recu,
      })),
      totaux: {
        totalAttendu,
        totalPaye,
        totalRestant,
        statutGlobal,
      },
    };
  }
}
