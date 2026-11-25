import { describe, it, expect } from 'bun:test';
import { CreerAnnonceUseCase } from '@application/announcement/CreerAnnonceUseCase';
import type { AnnouncementRepository, AnnonceData, CreerAnnonceData } from '@domain/ports/repositories/AnnouncementRepository';
import type { UserRole } from '@domain/types/enums';

class FakeAnnouncementRepository implements AnnouncementRepository {
  created: CreerAnnonceData[] = [];
  async creer(data: CreerAnnonceData): Promise<AnnonceData> {
    this.created.push(data);
    return { id: 'a1', ...data, createdAt: new Date() };
  }
  async lister() { return []; }
  async trouverParId() { return null; }
  async modifier(id, data) { return { id, schoolId: 's1', authorId: 'u1', ...data, createdAt: new Date() }; }
  async supprimer() {}
  async purgerExpirees() { return { count: 0 }; }
}

function cmd(overrides: Record<string, unknown> = {}) {
  return {
    schoolId: 'school-1',
    authorId: 'user-1',
    role: 'ADMIN',
    title: 'Annonce test',
    content: 'Contenu de l\'annonce',
    targetRoles: ['TEACHER'] as UserRole[],
    ...overrides,
  };
}

describe('CreerAnnonceUseCase', () => {
  it('rôle non autorisé (STUDENT) → erreur', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    await expect(uc.execute(cmd({ role: 'STUDENT' }))).rejects.toThrow('Seuls l\'Admin et le Staff peuvent publier sur le babillard.');
    expect(repo.created).toHaveLength(0);
  });

  it('rôle TEACHER → erreur', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    await expect(uc.execute(cmd({ role: 'TEACHER' }))).rejects.toThrow('Seuls l\'Admin et le Staff peuvent publier sur le babillard.');
    expect(repo.created).toHaveLength(0);
  });

  it('titre vide → erreur', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    await expect(uc.execute(cmd({ title: '' }))).rejects.toThrow('Le titre de l\'annonce est requis.');
    expect(repo.created).toHaveLength(0);
  });

  it('titre espaces seulement → erreur', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    await expect(uc.execute(cmd({ title: '   ' }))).rejects.toThrow('Le titre de l\'annonce est requis.');
    expect(repo.created).toHaveLength(0);
  });

  it('contenu vide → erreur', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    await expect(uc.execute(cmd({ content: '' }))).rejects.toThrow('Le contenu de l\'annonce est requis.');
    expect(repo.created).toHaveLength(0);
  });

  it('aucun rôle ciblé → erreur', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    await expect(uc.execute(cmd({ targetRoles: [] }))).rejects.toThrow('Sélectionnez au moins un rôle ciblé.');
    expect(repo.created).toHaveLength(0);
  });

  it('date d\'expiration passée → erreur', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    const pastDate = new Date('2020-01-01');
    await expect(uc.execute(cmd({ expiresAt: pastDate }))).rejects.toThrow('La date d\'expiration doit être future ou absente.');
    expect(repo.created).toHaveLength(0);
  });

  it('STAFF autorisé → création réussie', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    const result = await uc.execute(cmd({ role: 'STAFF' }));
    expect(result).toBeDefined();
    expect(repo.created).toHaveLength(1);
    expect(repo.created[0].title).toBe('Annonce test');
  });

  it('ADMIN autorisé → création avec isPinned par défaut false', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    await uc.execute(cmd());
    expect(repo.created).toHaveLength(1);
    expect(repo.created[0].isPinned).toBe(false);
    expect(repo.created[0].expiresAt).toBeNull();
  });

  it('isPinned et expiresAt fournis → persistés', async () => {
    const repo = new FakeAnnouncementRepository();
    const uc = new CreerAnnonceUseCase(repo);
    const future = new Date('2030-12-31');
    await uc.execute(cmd({ isPinned: true, expiresAt: future }));
    expect(repo.created[0].isPinned).toBe(true);
    expect(repo.created[0].expiresAt).toEqual(future);
  });
});
