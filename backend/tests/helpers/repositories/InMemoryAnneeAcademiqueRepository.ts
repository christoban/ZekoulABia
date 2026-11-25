import type {
  AnneeAcademiqueRepository,
  AnneeAcademiqueProps,
  PeriodeAcademiqueProps,
  SequenceAcademiqueProps,
  CalendrierPeriode,
} from '@domain/ports/repositories/AnneeAcademiqueRepository';

export class InMemoryAnneeAcademiqueRepository implements AnneeAcademiqueRepository {
  private annees = new Map<string, AnneeAcademiqueProps>();
  private periodes = new Map<string, PeriodeAcademiqueProps>();
  private sequences = new Map<string, SequenceAcademiqueProps>();

  notesNonValidees = 0;
  classesSansBulletins: { classeId: string; classeNom: string; periodeNom: string }[] = [];
  classesSansConseil: { classeId: string; classeNom: string }[] = [];

  ajouterAnnee(a: AnneeAcademiqueProps): void { this.annees.set(a.id, a); }
  ajouterPeriode(p: PeriodeAcademiqueProps): void { this.periodes.set(p.id, p); }
  ajouterSequence(s: SequenceAcademiqueProps): void { this.sequences.set(s.id, s); }

  async findById(id: string) { return this.annees.get(id) ?? null; }
  async findBySchool(schoolId: string) {
    return [...this.annees.values()].filter(a => a.schoolId === schoolId);
  }
  async findCourante(schoolId: string) {
    return [...this.annees.values()].find(a => a.schoolId === schoolId && a.isCurrent) ?? null;
  }
  async existsByName(schoolId: string, name: string) {
    return [...this.annees.values()].some(a => a.schoolId === schoolId && a.name === name);
  }
  async save(a: AnneeAcademiqueProps) { this.annees.set(a.id, a); }
  async update(a: AnneeAcademiqueProps) { this.annees.set(a.id, a); }
  async archiver(id: string) {
    const a = this.annees.get(id);
    if (a) this.annees.set(id, { ...a, status: 'ARCHIVED', isCurrent: false });
  }
  async desactiverToutesAnneesEcole(schoolId: string) {
    for (const [id, a] of this.annees) {
      if (a.schoolId === schoolId) this.annees.set(id, { ...a, isCurrent: false });
    }
  }

  // _schoolId non utilisé : PeriodeAcademiqueProps ne porte pas de schoolId (la tenancy d'une
  // période vient de son AcademicYear). L'isolation des périodes ne peut donc être vérifiée qu'en
  // test d'intégration contre la vraie base, pas ici.
  async findPeriodeById(id: string, _schoolId: string) { return this.periodes.get(id) ?? null; }
  async findPeriodesByAnnee(academicYearId: string) {
    return [...this.periodes.values()].filter(p => p.academicYearId === academicYearId);
  }
  async findPeriodeCourante(_schoolId: string) {
    return [...this.periodes.values()].find(p => p.isCurrent) ?? null;
  }
  async findDernierePeriode(academicYearId: string) {
    const ps = [...this.periodes.values()]
      .filter(p => p.academicYearId === academicYearId)
      .sort((a, b) => b.orderIndex - a.orderIndex);
    return ps[0] ?? null;
  }
  async savePeriode(p: PeriodeAcademiqueProps) { this.periodes.set(p.id, p); }
  async desactiverToutesPeriodes(academicYearId: string) {
    for (const [id, p] of this.periodes) {
      if (p.academicYearId === academicYearId) this.periodes.set(id, { ...p, isCurrent: false });
    }
  }
  async activerPeriode(id: string) {
    const p = this.periodes.get(id);
    if (p) this.periodes.set(id, { ...p, isCurrent: true });
  }

  async findSequenceById(id: string, schoolId: string) {
    const seq = this.sequences.get(id);
    return seq && seq.schoolId === schoolId ? seq : null;
  }
  async findSequencesByPeriode(academicPeriodId: string) {
    return [...this.sequences.values()].filter(s => s.academicPeriodId === academicPeriodId);
  }
  async findSequenceCourante(_schoolId: string) {
    return [...this.sequences.values()].find(s => s.isCurrent) ?? null;
  }
  async saveSequence(s: SequenceAcademiqueProps) { this.sequences.set(s.id, s); }
  async desactiverToutesSequences(academicPeriodId: string) {
    for (const [id, s] of this.sequences) {
      if (s.academicPeriodId === academicPeriodId) this.sequences.set(id, { ...s, isCurrent: false });
    }
  }
  async activerSequence(id: string) {
    const s = this.sequences.get(id);
    if (s) this.sequences.set(id, { ...s, isCurrent: true });
  }

  async upsertCalendrier(_yearId: string, _schoolId: string, _periodes: CalendrierPeriode[]) {}

  async countNotesNonValidees(_yearId: string) { return this.notesNonValidees; }
  async getClassesAvecBulletinsManquants(_yearId: string) { return this.classesSansBulletins; }
  async getClassesSansConseilVerrouille(_yearId: string) { return this.classesSansConseil; }
}
