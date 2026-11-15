/**
 * APPLICATION LAYER — ListerCarnetEleveUseCase
 * Liste les entrées du carnet de liaison par élève ou classe,
 * et construit la boîte de réception unifiée Parent (Annonces Babillard + Carnet).
 */
import type {
  CarnetLiaisonRepository,
  LiaisonEntryItem,
  LiaisonFilters,
} from '@domain/ports/repositories/CarnetLiaisonRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { PublicationRepository } from '@domain/ports/repositories/PublicationRepository';
import type { BabillardContextRepository } from '@domain/ports/repositories/BabillardContextRepository';
import { peutVoir } from '@domain/rules/BabillardVisibilityRules';

export interface UnifiedParentInboxItem {
  kind: 'ANNOUNCEMENT' | 'CARNET';
  id: string;
  studentId: string | null;
  studentName: string | null;
  category: string;
  title: string;
  content: string;
  authorName: string | null;
  isUrgent: boolean;
  isRead: boolean;
  requiresConfirmation: boolean;
  confirmedByMe: boolean | null;
  createdAt: Date;
  carnetEntry?: LiaisonEntryItem;
}

export class ListerCarnetEleveUseCase {
  constructor(
    private readonly carnetRepo: CarnetLiaisonRepository,
    private readonly parentRepo: ParentRepository,
    private readonly publicationRepo?: PublicationRepository,
    private readonly babillardContextRepo?: BabillardContextRepository,
  ) {}

  async listerPourEleve(params: {
    studentId: string;
    schoolId: string;
    userId: string;
    role: string;
    filtres?: LiaisonFilters;
  }): Promise<LiaisonEntryItem[]> {
    const role = params.role.toUpperCase();
    if (role === 'PARENT') {
      const ok = await this.parentRepo.aAccesEleve(params.userId, params.studentId);
      if (!ok) {
        throw new Error('FORBIDDEN_PARENT_STUDENT');
      }
    } else if (role === 'STUDENT' && params.userId !== params.studentId) {
      throw new Error('FORBIDDEN_STUDENT_CARNET');
    }

    return this.carnetRepo.listerParEleve(params.studentId, params.schoolId, params.filtres);
  }

  async listerPourClasse(params: {
    classId: string;
    schoolId: string;
    role: string;
    filtres?: LiaisonFilters;
  }): Promise<LiaisonEntryItem[]> {
    const role = params.role.toUpperCase();
    if (role === 'PARENT' || role === 'STUDENT') {
      throw new Error('FORBIDDEN_CLASS_CARNET');
    }
    return this.carnetRepo.listerParClasse(params.classId, params.schoolId, params.filtres);
  }

  async listerBoiteUnifieeParent(params: {
    parentUserId: string;
    schoolId: string;
    academicYearId?: string;
    studentId?: string;
  }): Promise<{
    items: UnifiedParentInboxItem[];
    unreadCarnetCount: number;
    unreadAnnouncementsCount: number;
    pendingConfirmationsCount: number;
  }> {
    const allChildIds = await this.parentRepo.findStudentIdsByParent(params.parentUserId);
    if (params.studentId && !allChildIds.includes(params.studentId)) {
      throw new Error('FORBIDDEN_PARENT_STUDENT');
    }

    const childIds = params.studentId ? [params.studentId] : allChildIds;
    const carnetEntries = await this.carnetRepo.listerParEleves(childIds, params.schoolId, {
      academicYearId: params.academicYearId,
      limit: 100,
    });

    const carnetItems: UnifiedParentInboxItem[] = carnetEntries.map((entry) => {
      const isRead =
        entry.authorId === params.parentUserId ||
        entry.readReceipts.some((r) => r.userId === params.parentUserId);
      const myResp = [...entry.responses]
        .reverse()
        .find((r) => r.authorId === params.parentUserId && r.confirmed !== null);

      return {
        kind: 'CARNET',
        id: entry.id,
        studentId: entry.studentId,
        studentName: entry.studentName ?? null,
        category: entry.category,
        title: entry.title,
        content: entry.content,
        authorName: entry.authorName ?? null,
        isUrgent: entry.isUrgent,
        isRead,
        requiresConfirmation: entry.requiresConfirmation,
        confirmedByMe: myResp?.confirmed ?? null,
        createdAt: entry.createdAt,
        carnetEntry: entry,
      };
    });

    let announcementItems: UnifiedParentInboxItem[] = [];
    if (this.publicationRepo && this.babillardContextRepo) {
      const ctx = await this.babillardContextRepo.chargerUtilisateurContexte({
        userId: params.parentUserId,
        schoolId: params.schoolId,
        role: 'PARENT',
      });
      const res = await this.publicationRepo.lister(params.schoolId, { filtre: 'tous', limite: 50 });
      const visibles = res.publications.filter((p) => peutVoir(ctx, p, { inclureArchives: false }));
      const lusSet = await this.publicationRepo.getIdsLusParUtilisateur(
        params.parentUserId,
        visibles.map((v) => v.id),
      );
      announcementItems = visibles.map((pub) => ({
        kind: 'ANNOUNCEMENT',
        id: pub.id,
        studentId: null,
        studentName: null,
        category: pub.categorie,
        title: pub.titre,
        content: pub.corps,
        authorName: pub.auteurTitre ?? null,
        isUrgent: pub.priorite === 'URGENTE' || pub.priorite === 'IMPORTANTE',
        isRead: lusSet.has(pub.id),
        requiresConfirmation: false,
        confirmedByMe: null,
        createdAt: pub.publieeLe ?? pub.createdAt,
      }));
    }

    const items = [...carnetItems, ...announcementItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const unreadCarnetCount = carnetItems.filter((i) => !i.isRead).length;
    const unreadAnnouncementsCount = announcementItems.filter((i) => !i.isRead).length;
    const pendingConfirmationsCount = carnetItems.filter(
      (i) => i.requiresConfirmation && i.confirmedByMe === null,
    ).length;

    return {
      items,
      unreadCarnetCount,
      unreadAnnouncementsCount,
      pendingConfirmationsCount,
    };
  }
}

