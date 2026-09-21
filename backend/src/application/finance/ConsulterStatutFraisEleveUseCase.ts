/**
 * APPLICATION LAYER — Use Case : Consulter l'état des frais d'un élève (lecture seule)
 *
 * Permet au secrétariat (MANAGE_ENROLLMENT) et à l'administration de consulter
 * la situation financière d'un élève sans pouvoir modifier les factures ni encaisser.
 * Respecte l'isolation multi-tenant stricte.
 */
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { StudentProfileRepository } from '@domain/ports/repositories/StudentProfileRepository';

export interface FactureLigneStatut {
  id: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate?: Date;
  status: string;
  totalPaye: number;
  soldeRestant: number;
  estEnRetard: boolean;
}

export interface StatutFraisEleveResultat {
  studentId: string;
  nomComplet: string;
  statutGlobal: 'AUCUN_FRAIS' | 'A_JOUR' | 'EN_ATTENTE' | 'EN_RETARD';
  totalDu: number;
  totalPaye: number;
  soldeRestant: number;
  factures: FactureLigneStatut[];
}

export class ConsulterStatutFraisEleveUseCase {
  constructor(
    private readonly factureRepository: FactureRepository,
    private readonly userRepository: UserRepository,
    private readonly studentProfileRepository?: StudentProfileRepository,
  ) {}

  async execute(params: {
    schoolId: string;
    studentId: string;
  }): Promise<StatutFraisEleveResultat> {
    const { schoolId, studentId } = params;

    // 1. Vérification de l'existence et appartenance de l'utilisateur élève
    let user = await this.userRepository.findById(studentId);

    // Si non trouvé directement par User.id, vérifier si c'est un StudentProfile.id
    if ((!user || user.schoolId !== schoolId) && this.studentProfileRepository) {
      const profile = await this.studentProfileRepository.findByIdAndSchool(studentId, schoolId);
      if (profile?.userId) {
        user = await this.userRepository.findById(profile.userId);
      }
    }

    if (!user || user.schoolId !== schoolId) {
      throw new Error('Élève introuvable dans cet établissement');
    }

    const nomComplet = `${user.firstName} ${user.lastName}`.trim();

    // 2. Récupérer toutes les factures de l'élève
    const factures = await this.factureRepository.findByEleve(user.id);

    // 3. Calculer pour chaque facture le montant payé avec succès
    const lignes: FactureLigneStatut[] = [];
    let totalDu = 0;
    let totalPaye = 0;
    let aUneFactureEnRetard = false;
    const now = new Date();

    for (const f of factures) {
      const paye = await this.factureRepository.calculerTotalPayeAvecSucces(f.id);
      const solde = Math.max(0, f.amount - paye);
      const estEnRetard = solde > 0 && !!f.dueDate && f.dueDate < now;

      if (estEnRetard) {
        aUneFactureEnRetard = true;
      }

      totalDu += f.amount;
      totalPaye += paye;

      lignes.push({
        id: f.id,
        description: f.description,
        amount: f.amount,
        currency: f.currency,
        dueDate: f.dueDate,
        status: f.status,
        totalPaye: paye,
        soldeRestant: solde,
        estEnRetard,
      });
    }

    const soldeRestant = Math.max(0, totalDu - totalPaye);

    // 4. Déterminer le statut global
    let statutGlobal: 'AUCUN_FRAIS' | 'A_JOUR' | 'EN_ATTENTE' | 'EN_RETARD';
    if (lignes.length === 0) {
      statutGlobal = 'AUCUN_FRAIS';
    } else if (soldeRestant === 0) {
      statutGlobal = 'A_JOUR';
    } else if (aUneFactureEnRetard) {
      statutGlobal = 'EN_RETARD';
    } else {
      statutGlobal = 'EN_ATTENTE';
    }

    return {
      studentId: user.id,
      nomComplet,
      statutGlobal,
      totalDu,
      totalPaye,
      soldeRestant,
      factures: lignes,
    };
  }
}
