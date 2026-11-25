import type {
  AnnouncementRepository,
  AnnonceData,
  CreerAnnonceData,
  ModifierAnnonceData,
  AnnonceAuteurRef,
} from '@domain/ports/repositories/AnnouncementRepository';
import type { UserRole } from '@domain/types/enums';

export class InMemoryAnnouncementRepository implements AnnouncementRepository {
  private store = new Map<string, AnnonceData>();
  private seq = 0;

  ajouter(annonce: AnnonceData): void {
    this.store.set(annonce.id, annonce);
  }

  async creer(data: CreerAnnonceData): Promise<AnnonceData> {
    const annonce: AnnonceData = {
      id: `annonce-${++this.seq}`,
      schoolId: data.schoolId,
      authorId: data.authorId,
      title: data.title,
      content: data.content,
      targetRoles: data.targetRoles,
      isPinned: data.isPinned,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
    };
    this.store.set(annonce.id, annonce);
    return annonce;
  }

  async lister(schoolId: string, role: string): Promise<AnnonceData[]> {
    const now = new Date();
    const rows = [...this.store.values()].filter(
      (a) =>
        a.schoolId === schoolId &&
        (a.expiresAt === null || a.expiresAt > now),
    );
    if (role !== 'ADMIN') {
      return rows.filter((a) => a.targetRoles.includes(role as UserRole) || a.targetRoles.length === 0);
    }
    return rows;
  }

  async trouverParId(announcementId: string, schoolId: string): Promise<AnnonceAuteurRef | null> {
    const a = this.store.get(announcementId);
    if (!a || a.schoolId !== schoolId) return null;
    return { id: a.id, authorId: a.authorId };
  }

  async modifier(announcementId: string, data: ModifierAnnonceData): Promise<AnnonceData> {
    const existing = this.store.get(announcementId);
    if (!existing) throw new Error('Annonce introuvable.');
    const updated: AnnonceData = { ...existing, ...data };
    this.store.set(announcementId, updated);
    return updated;
  }

  async supprimer(announcementId: string): Promise<AnnonceData | void> {
    const existing = this.store.get(announcementId);
    this.store.delete(announcementId);
    return existing;
  }

  async purgerExpirees(seuil: Date): Promise<{ count: number }> {
    let count = 0;
    for (const [id, a] of [...this.store.entries()]) {
      if (a.expiresAt && a.expiresAt < seuil) {
        this.store.delete(id);
        count++;
      }
    }
    return { count };
  }
}