/**
 * APPLICATION — Use case : Générer les paiements MINESEC attendus
 *
 * Crée automatiquement les lignes PaiementMinesec selon le niveau de la classe
 * et les tarifs en base (TarifMinesecReference).
 *
 * Règles de génération :
 * - 1er cycle (6e-3e) : SCOLARITE_PREMIER_CYCLE
 * - 2nd cycle (2nde-Tle) : SCOLARITE_SECOND_CYCLE
 * - 3e : + EXAMEN_BEPC
 * - 1ère : + EXAMEN_PROBATOIRE (francophone)
 * - Tle : + EXAMEN_BAC (francophone) ou EXAMEN_GCE_AL (anglophone)
 * - Form 5 : + EXAMEN_GCE_OL (anglophone)
 */
import type { PaiementMinesecRepository, TypeFraisMinesec } from '@domain/ports/repositories/PaiementMinesecRepository';
import { CycleResolver } from '@domain/services/CycleResolver';

export class GenererPaiementsMinesecUseCase {
  constructor(private readonly paiementRepository: PaiementMinesecRepository) {}

  async execute(cmd: {
    schoolId: string;
    studentProfileId: string;
    anneeScolaire: string;
  }): Promise<{ generated: number; skipped: number; enrollmentCreated: boolean }> {
    // Récupérer l'élève et sa classe (source du niveau — le champ Enrollment.classe en est dérivé)
    const profile = await this.paiementRepository.trouverProfileAvecClasse(cmd.studentProfileId, cmd.schoolId);
    if (!profile) throw new Error('Élève introuvable');
    const niveau = profile.niveau;
    if (!niveau) throw new Error("Cet élève n'est affecté à aucune classe — impossible de déterminer les frais applicables");

    // Trouver ou créer l'Enrollment de l'année — aucun mécanisme ne le créait auparavant,
    // ce qui rendait ce use case définitivement inatteignable (jamais d'enrollmentId valide).
    let enrollment = await this.paiementRepository.trouverEnrollment(profile.id, cmd.schoolId, cmd.anneeScolaire);
    let enrollmentCreated = false;
    if (!enrollment) {
      enrollment = await this.paiementRepository.creerEnrollment({
        studentId: profile.id,
        schoolId: cmd.schoolId,
        anneeScolaire: cmd.anneeScolaire,
        classe: niveau,
      });
      enrollmentCreated = true;
    }

    const isAnglophone = await this.isEcoleAnglophone(cmd.schoolId);

    // Déterminer les types de frais applicables
    const typesFrais = this.getTypesFraisApplicables(niveau, isAnglophone);

    let generated = 0;
    let skipped = 0;

    for (const typeFrais of typesFrais) {
      // Vérifier si un paiement existe déjà pour ce type + enrollment
      const existing = await this.paiementRepository.trouverPaiementExistant(enrollment.id, typeFrais);
      if (existing) {
        skipped++;
        continue;
      }

      // Récupérer le tarif depuis la base
      const tarif = await this.paiementRepository.trouverTarif(typeFrais, cmd.anneeScolaire, this.getNiveauCategory(niveau));

      if (!tarif) {
        skipped++;
        continue;
      }

      // Créer le paiement
      await this.paiementRepository.creerPaiement({
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        schoolId: cmd.schoolId,
        anneeScolaire: cmd.anneeScolaire,
        typeFrais,
        montantAttendu: tarif.montantFCFA,
      });
      generated++;
    }

    return { generated, skipped, enrollmentCreated };
  }

  private getTypesFraisApplicables(niveau: string, isAnglophone: boolean): TypeFraisMinesec[] {
    const types: TypeFraisMinesec[] = [];

    // Scolarité selon le cycle
    if (CycleResolver.isPremierCycle(niveau)) {
      types.push('SCOLARITE_PREMIER_CYCLE');
    } else if (CycleResolver.isSecondCycle(niveau)) {
      types.push('SCOLARITE_SECOND_CYCLE');
    }

    // Examens selon le niveau normalisé
    const normalized = CycleResolver.normalizeLevel(niveau);
    if (normalized === '3e' || normalized === 'Form5') {
      types.push(isAnglophone ? 'EXAMEN_GCE_OL' : 'EXAMEN_BEPC');
    }
    if (normalized === '1ere' && !isAnglophone) {
      types.push('EXAMEN_PROBATOIRE');
    }
    if (normalized === 'Tle' && !isAnglophone) {
      types.push('EXAMEN_BAC');
    }
    if (normalized === 'UpperSixth' && isAnglophone) {
      types.push('EXAMEN_GCE_AL');
    }

    return types;
  }

  private getNiveauCategory(niveau: string): string {
    if (CycleResolver.isSecondCycle(niveau)) return '2nd_cycle';
    return '1er_cycle';
  }

  private async isEcoleAnglophone(schoolId: string): Promise<boolean> {
    const school = await this.paiementRepository.trouverEcoleSubsystem(schoolId);
    return school?.subsystem === 'ANGLOPHONE' || school?.subsystem === 'BILINGUAL';
  }
}
