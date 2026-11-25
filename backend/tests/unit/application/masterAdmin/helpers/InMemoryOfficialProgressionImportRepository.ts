import type {
  OfficialProgressionImportRepository,
  OfficialProgressionNaturalKey,
  OfficialProgressionSnapshot,
  OfficialProgressionUpsertMutation,
} from '@domain/ports/repositories/OfficialProgressionImportRepository';
import { construireCleProgression } from '@application/masterAdmin/progressions';

export class InMemoryOfficialProgressionImportRepository
  implements OfficialProgressionImportRepository
{
  public templates: Set<string>;
  /** Map scopeKey ("templateCode::level::filiere" ou "*::level::filiere") -> noms canoniques */
  public knownSubjectsByScope = new Map<string, string[]>();
  public rows = new Map<string, OfficialProgressionSnapshot>();
  public applyCallCount = 0;
  /** Permet de simuler une panne en milieu de transaction pour prouver l'atomicité (rollback). */
  public failOnMutationIndex: number | null = null;
  private idCounter = 1;

  constructor(templates: string[] = ['__ALL__', 'LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'LYCEE_BILINGUE']) {
    this.templates = new Set(templates);
  }

  seedSubjects(scope: { templateCode: string; level: string; filiere: string }, subjects: string[]): void {
    this.knownSubjectsByScope.set(`${scope.templateCode}::${scope.level}::${scope.filiere}`, subjects);
  }

  seedRow(row: Omit<OfficialProgressionSnapshot, 'id' | 'updatedAt'> & { id?: string; updatedAt?: Date }): OfficialProgressionSnapshot {
    const id = row.id ?? `prog_${this.idCounter++}`;
    const snap: OfficialProgressionSnapshot = {
      ...row,
      id,
      updatedAt: row.updatedAt ?? new Date('2026-10-01T10:00:00Z'),
    };
    this.rows.set(construireCleProgression(snap), snap);
    return snap;
  }

  async listExistingTemplateCodes(): Promise<string[]> {
    return Array.from(this.templates);
  }

  async listKnownSubjectsForScope(params: {
    templateCode: string;
    level: string;
    filiere: string;
  }): Promise<string[]> {
    const exact = this.knownSubjectsByScope.get(`${params.templateCode}::${params.level}::${params.filiere}`);
    if (exact) return exact;
    if (params.templateCode === '__ALL__') {
      const merged = new Set<string>();
      for (const [k, list] of this.knownSubjectsByScope.entries()) {
        const [, lvl, fil] = k.split('::');
        if (lvl === params.level && (params.filiere === '' || fil === params.filiere)) {
          for (const s of list) merged.add(s);
        }
      }
      return Array.from(merged);
    }
    return [];
  }

  async findProgressionsByKeys(
    keys: OfficialProgressionNaturalKey[],
  ): Promise<OfficialProgressionSnapshot[]> {
    const out: OfficialProgressionSnapshot[] = [];
    for (const k of keys) {
      const found = this.rows.get(construireCleProgression(k));
      if (found) out.push(found);
    }
    return out;
  }

  async applyImportTransaction(
    mutations: OfficialProgressionUpsertMutation[],
  ): Promise<OfficialProgressionSnapshot[]> {
    this.applyCallCount += 1;
    // Copie transactionnelle (rollback complet si une erreur survient à l'index failOnMutationIndex)
    const staged = new Map(this.rows);
    const written: OfficialProgressionSnapshot[] = [];

    for (let idx = 0; idx < mutations.length; idx++) {
      if (this.failOnMutationIndex !== null && idx === this.failOnMutationIndex) {
        throw new Error(`Erreur simulée en milieu de transaction (index=${idx})`);
      }

      const m = mutations[idx]!;
      const cle = construireCleProgression(m);
      const existing = staged.get(cle);
      const saved: OfficialProgressionSnapshot = {
        id: existing?.id ?? m.existingId ?? `prog_${this.idCounter++}`,
        templateCode: m.templateCode,
        level: m.level,
        filiere: m.filiere,
        subjectName: m.subjectName,
        titre: m.titre,
        chapitres: m.chapitres,
        source: m.source,
        manuallyEdited: false,
        importChecksum: m.importChecksum,
        active: m.active,
        updatedAt: new Date(),
      };
      staged.set(cle, saved);
      written.push(saved);
    }

    // Commit atomique uniquement si toutes les mutations ont réussi
    this.rows = staged;
    return written;
  }
}

