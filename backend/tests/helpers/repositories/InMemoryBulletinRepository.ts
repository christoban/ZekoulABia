import { Bulletin } from '@domain/entities/Bulletin';
import type {
  BulletinRepository,
  BulletinAvecContexteClasse,
  BulletinEnrichi,
  BulletinExportData,
  BulletinPublicVerifyRecord,
  BulletinRevocationArchiveRecord,
  BulletinRevocationLookupRecord,
} from '@domain/ports/repositories/BulletinRepository';

export class InMemoryBulletinRepository implements BulletinRepository {
  private store = new Map<string, Bulletin>();
  private periodeStore = new Map<string, Bulletin>(); // key: studentId:academicPeriodId
  private revocations: BulletinRevocationLookupRecord[] = [];
  private classesParEleve = new Map<string, string>();
  private profPrincipalByClasse = new Map<string, string>();
  private sectionCodeByClasse = new Map<string, string>();
  private schoolSubsystemBySchool = new Map<string, string>();
  private studentNames = new Map<string, { firstName: string; lastName: string }>();

  ajouter(b: Bulletin): void {
    this.store.set(b.id, b);
    const props = b.toObject();
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, b);
  }

  compter(): number {
    return this.store.size;
  }

  definirClasseEleve(studentId: string, classId: string): void {
    this.classesParEleve.set(studentId, classId);
  }

  definirProfPrincipal(classeId: string, professorPrincipalId: string): void {
    this.profPrincipalByClasse.set(classeId, professorPrincipalId);
  }

  definirSectionCode(classeId: string, code: string): void {
    this.sectionCodeByClasse.set(classeId, code);
  }

  definirSchoolSubsystem(schoolId: string, subsystem: string): void {
    this.schoolSubsystemBySchool.set(schoolId, subsystem);
  }

  definirStudentName(studentId: string, firstName: string, lastName: string): void {
    this.studentNames.set(studentId, { firstName, lastName });
  }

  async findById(id: string): Promise<Bulletin | null> {
    return this.store.get(id) ?? null;
  }

  async findByEleve(studentId: string, _academicYearId: string): Promise<Bulletin[]> {
    return [...this.store.values()].filter(b => b.studentId === studentId);
  }

  async findByEleveEtPeriode(studentId: string, academicPeriodId: string): Promise<Bulletin | null> {
    return this.periodeStore.get(`${studentId}:${academicPeriodId}`) ?? null;
  }

  async findByClasse(classId: string, academicPeriodId: string): Promise<Bulletin[]> {
    return [...this.store.values()].filter(
      bulletin =>
        this.classesParEleve.get(bulletin.studentId) === classId &&
        bulletin.academicPeriodId === academicPeriodId
    );
  }

  async findBySchool(schoolId: string, academicYearId: string): Promise<Bulletin[]> {
    return [...this.store.values()].filter(
      bulletin =>
        bulletin.schoolId === schoolId &&
        bulletin.academicYearId === academicYearId
    );
  }

  async findWithClasseContext(bulletinId: string, schoolId: string): Promise<BulletinAvecContexteClasse | null> {
    const bulletin = this.store.get(bulletinId);
    if (!bulletin || bulletin.schoolId !== schoolId) return null;
    const classId = this.classesParEleve.get(bulletin.studentId) ?? null;
    const professorPrincipalId = classId ? (this.profPrincipalByClasse.get(classId) ?? null) : null;
    return { bulletin, professorPrincipalId };
  }

  async findEnrichedById(bulletinId: string, schoolId: string): Promise<BulletinEnrichi | null> {
    const bulletin = this.store.get(bulletinId);
    if (!bulletin || bulletin.schoolId !== schoolId) return null;
    const classId = this.classesParEleve.get(bulletin.studentId) ?? null;
    const professorPrincipalId = classId ? (this.profPrincipalByClasse.get(classId) ?? null) : null;
    const sectionCode = classId ? (this.sectionCodeByClasse.get(classId) ?? null) : null;
    const schoolSubsystem = this.schoolSubsystemBySchool.get(schoolId) ?? null;
    const names = this.studentNames.get(bulletin.studentId) ?? { firstName: '', lastName: '' };
    return {
      bulletin,
      schoolSubsystem,
      sectionCode,
      studentFirstName: names.firstName,
      studentLastName: names.lastName,
      professorPrincipalId,
    };
  }

  async findPreviousByStudent(studentId: string, schoolId: string, excludeBulletinId?: string): Promise<{ generalAverage: number | null } | null> {
    const candidates = [...this.store.values()]
      .filter(b => b.studentId === studentId && b.schoolId === schoolId && b.id !== excludeBulletinId)
      .sort((a, b) => b.toObject().createdAt.getTime() - a.toObject().createdAt.getTime());
    if (candidates.length === 0) return null;
    return { generalAverage: candidates[0].generalAverage ?? null };
  }

  async getMoyennesClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<{ studentId: string; generalAverage: number }[]> {
    return [...this.store.values()]
      .filter(
        bulletin =>
          this.classesParEleve.get(bulletin.studentId) === classId &&
          bulletin.academicPeriodId === academicPeriodId &&
          bulletin.generalAverage !== undefined
      )
      .map(bulletin => ({
        studentId: bulletin.studentId,
        generalAverage: bulletin.generalAverage!,
      }));
  }

  async save(b: Bulletin): Promise<void> {
    this.store.set(b.id, b);
    const props = b.toObject();
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, b);
  }

  async update(b: Bulletin): Promise<void> {
    this.store.set(b.id, b);
    const props = b.toObject();
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, b);
  }

  async archiverEtRemplacerRevoque(revokedBulletin: Bulletin, replacement: Bulletin): Promise<void> {
    const rev = revokedBulletin.toObject();
    const nm = this.studentNames.get(rev.studentId);
    this.revocations.push({
      id: crypto.randomUUID(),
      originalReportCardId: rev.id,
      schoolId: rev.schoolId,
      studentId: rev.studentId,
      academicYearId: rev.academicYearId,
      academicPeriodId: rev.academicPeriodId,
      computationVersion: rev.computationVersion ?? 1,
      templateSpecId: rev.templateSpecId ?? null,
      templateVersion: rev.templateVersion ?? 1,
      generalAverage: rev.generalAverage ?? null,
      rank: rev.rank ?? null,
      snapshotData: rev.snapshotData ?? null,
      contentHash: rev.contentHash ?? null,
      verifyToken: rev.verifyToken ?? null,
      shortVerifyCode: rev.shortVerifyCode ?? null,
      revokedById: rev.revokedById ?? 'SYSTEM',
      revocationReason: rev.revocationReason ?? 'Régénération contrôlée',
      revokedAt: rev.revokedAt ?? new Date(),
      schoolName: 'Établissement Test',
      academicYearName: rev.academicYearId,
      academicPeriodName: rev.academicPeriodId,
      studentFirstName: nm?.firstName ?? null,
      studentLastName: nm?.lastName ?? null,
    });
    this.store.delete(rev.id);
    this.periodeStore.delete(`${rev.studentId}:${rev.academicPeriodId}`);
    await this.save(replacement);
  }

  async findRevocationsByStudent(schoolId: string, studentId: string): Promise<BulletinRevocationArchiveRecord[]> {
    return this.revocations
      .filter(r => r.schoolId === schoolId && r.studentId === studentId)
      .sort((a, b) => b.revokedAt.getTime() - a.revokedAt.getTime());
  }

  async updatePdfUrl(bulletinId: string, pdfUrl: string): Promise<void> {
    const bulletin = this.store.get(bulletinId);
    if (!bulletin) {
      throw new Error('Bulletin introuvable');
    }

    if (!bulletin.isGenerated) {
      bulletin.marquerGenere(pdfUrl);
    } else {
      const props = bulletin.toObject();
      this.store.set(
        bulletinId,
        Bulletin.reconstituer({ ...props, pdfUrl, isGenerated: true })
      );
    }
  }

  async updatePdfMetadata(
    bulletinId: string,
    params: { pdfUrl: string; templateSpecId?: string | null; templateVersion?: number },
  ): Promise<void> {
    const bulletin = this.store.get(bulletinId);
    if (!bulletin) throw new Error('Bulletin introuvable');
    bulletin.scellerStockagePdf(params);
    const props = bulletin.toObject();
    this.store.set(bulletinId, Bulletin.reconstituer({ ...props, isGenerated: true }));
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, Bulletin.reconstituer({ ...props, isGenerated: true }));
  }

  async updateClassMasterComment(bulletinId: string, comment: string): Promise<void> {
    const b = this.store.get(bulletinId);
    if (!b) throw new Error('Bulletin introuvable');
    const props = b.toObject();
    this.store.set(bulletinId, Bulletin.reconstituer({ ...props, classMasterComment: comment }));
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, Bulletin.reconstituer({ ...props, classMasterComment: comment }));
  }

  async updateAiComment(bulletinId: string, comment: string): Promise<void> {
    const b = this.store.get(bulletinId);
    if (!b) throw new Error('Bulletin introuvable');
    const props = b.toObject();
    this.store.set(bulletinId, Bulletin.reconstituer({ ...props, aiComment: comment }));
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, Bulletin.reconstituer({ ...props, aiComment: comment }));
  }

  async findRecentSince(schoolId: string, academicPeriodId: string, since: Date): Promise<Array<{ studentId: string; student: { id: string; firstName: string | null; lastName: string | null } }>> {
    return [...this.store.values()]
      .filter(b => { const p = b.toObject(); return p.schoolId === schoolId && p.academicPeriodId === academicPeriodId && p.createdAt >= since; })
      .map(b => {
        const p = b.toObject();
        const names = this.studentNames.get(p.studentId) ?? { firstName: null, lastName: null };
        return { studentId: p.studentId, student: { id: p.studentId, firstName: names.firstName ?? null, lastName: names.lastName ?? null } };
      });
  }

  async findForExport(schoolId: string, academicPeriodId: string): Promise<BulletinExportData[]> {
    return [...this.store.values()]
      .filter(b => { const p = b.toObject(); return p.schoolId === schoolId && p.academicPeriodId === academicPeriodId; })
      .map(b => {
        const p = b.toObject();
        const names = this.studentNames.get(p.studentId) ?? { firstName: '', lastName: '' };
        const classId = this.classesParEleve.get(p.studentId);
        const sectionCode = classId ? (this.sectionCodeByClasse.get(classId) ?? null) : null;
        return {
          id: p.id, schoolId: p.schoolId, studentId: p.studentId, academicYearId: p.academicYearId, academicPeriodId: p.academicPeriodId,
          template: p.template as string, generalAverage: p.generalAverage ?? null, rank: p.rank ?? null, totalStudents: (p as any).totalStudents ?? null,
          absenceCount: p.absenceCount ?? 0, mention: p.mention ?? null, classMasterComment: (p as any).classMasterComment ?? null,
          academicYear: null, academicPeriod: null,
          student: { id: p.studentId, firstName: names.firstName, lastName: names.lastName, studentProfile: { enrollmentsYearScoped: classId ? [{ class: { name: classId, section: sectionCode ? { code: sectionCode } : null } } as any] : [] } },
          subjectLines: (p.lignesMatiere ?? []).map(l => ({ subjectId: l.subjectId, subjectName: l.subjectName, coefficient: l.coefficient, seq1Score: l.seq1Score ?? null, seq2Score: l.seq2Score ?? null, compositionScore: l.compositionScore ?? null, seq3Score: l.seq3Score ?? null, seq4Score: l.seq4Score ?? null, seq5Score: l.seq5Score ?? null, seq6Score: l.seq6Score ?? null, classTestScore: l.classTestScore ?? null, terminalExamScore: l.terminalExamScore ?? null, theoreticalScore: l.theoreticalScore ?? null, practicalScore: l.practicalScore ?? null, professionalAttitude: l.professionalAttitude ?? null, oralScore: l.oralScore ?? null, selfDevelopmentScore: l.selfDevelopmentScore ?? null, subjectAverage: l.subjectAverage ?? null, teacherComment: l.teacherComment ?? null, competenceLabel: l.competenceLabel ?? null })),
          school: { id: p.schoolId, name: '', subsystem: this.schoolSubsystemBySchool.get(p.schoolId) ?? null, schoolConfig: null, schoolSettings: null },
          section: sectionCode ? { code: sectionCode } : null,
        } as unknown as BulletinExportData;
      });
  }

  async findExportDataByPeriode(schoolId: string, academicPeriodId: string): Promise<BulletinExportData[]> {
    return this.findForExport(schoolId, academicPeriodId);
  }

  async findForPdf(bulletinId: string, schoolId: string): Promise<BulletinExportData | null> {
    const b = this.store.get(bulletinId);
    if (!b || b.schoolId !== schoolId) return null;
    const rows = await this.findForExport(b.schoolId, b.academicPeriodId);
    return rows.find(r => r.id === bulletinId) ?? null;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async findByEleveFiltre(params: { schoolId: string; studentId: string; academicYearId?: string; classWorkflowStatusIn?: string[] }): Promise<Record<string, unknown>[]> {
    return [...this.store.values()]
      .filter(b => {
        const p = b.toObject();
        return p.schoolId === params.schoolId && p.studentId === params.studentId && (!params.academicYearId || p.academicYearId === params.academicYearId);
      })
      .map(b => ({ ...b.toObject(), academicYear: null, academicPeriod: null } as unknown as Record<string, unknown>));
  }

  async findPaginated(params: { schoolId: string; academicYearId?: string; academicPeriodId?: string; studentId?: string | { in: string[] }; classId?: string; classWorkflowStatusIn?: string[]; page: number; limit: number }): Promise<{ items: Record<string, unknown>[]; total: number }> {
    let items = [...this.store.values()].filter(b => {
      const p = b.toObject();
      if (p.schoolId !== params.schoolId) return false;
      if (params.academicYearId && p.academicYearId !== params.academicYearId) return false;
      if (params.academicPeriodId && p.academicPeriodId !== params.academicPeriodId) return false;
      if (params.classId && this.classesParEleve.get(p.studentId) !== params.classId) return false;
      if (params.studentId !== undefined) {
        if (typeof params.studentId === 'string') { if (p.studentId !== params.studentId) return false; }
        else { if (!params.studentId.in.includes(p.studentId)) return false; }
      }
      return true;
    });
    const total = items.length;
    const start = (params.page - 1) * params.limit;
    const paged = items.slice(start, start + params.limit).map(b => ({ ...b.toObject(), academicYear: null, academicPeriod: null, student: { id: b.studentId, firstName: '', lastName: '' } } as unknown as Record<string, unknown>));
    return { items: paged, total };
  }

  async getStatsValidationParClasse(_params: { classId: string; schoolId: string; sequenceIds: string[] }): Promise<{ total: number; DRAFT: number; LOCKED: number }> {
    return { total: 0, DRAFT: 0, LOCKED: 0 };
  }

  async findTableauHonneur(params: { classId: string; schoolId: string; academicPeriodId: string; top: number }): Promise<{ student: { firstName: string; lastName: string }; generalAverage: number; mention: string | null }[]> {
    // InMemory: no student name store — return empty to keep simple; tests override if needed
    return [];
  }

  async findForAnnual(params: { classId: string; schoolId: string; periodIds: string[] }): Promise<{ studentId: string; student: { firstName: string; lastName: string }; generalAverage: number | null }[]> {
    return [];
  }

  async upsertBulletin(data: { schoolId: string; studentId: string; academicYearId: string; academicPeriodId: string; generalAverage: number; rank: number | null; mention: string; absenceCount: number }): Promise<{ id: string }> {
    const existing = this.periodeStore.get(`${data.studentId}:${data.academicPeriodId}`);
    if (existing) {
      const props = existing.toObject();
      const updated = Bulletin.reconstituer({ ...props, generalAverage: data.generalAverage, rank: data.rank ?? undefined, mention: data.mention, absenceCount: data.absenceCount, isGenerated: true, validationStatus: props.validationStatus ?? 'GENERATED' as any });
      this.store.set(props.id, updated);
      this.periodeStore.set(`${data.studentId}:${data.academicPeriodId}`, updated);
      return { id: props.id };
    }
    const persisted = Bulletin.reconstituer({
      id: crypto.randomUUID(),
      schoolId: data.schoolId,
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      academicPeriodId: data.academicPeriodId,
      template: 'FR_SECONDARY' as any,
      validationStatus: 'GENERATED' as any,
      generalAverage: data.generalAverage,
      rank: data.rank ?? undefined,
      mention: data.mention,
      absenceCount: data.absenceCount,
      isGenerated: true,
      createdAt: new Date(),
      lignesMatiere: [],
    });
    this.store.set(persisted.id, persisted);
    this.periodeStore.set(`${data.studentId}:${data.academicPeriodId}`, persisted);
    return { id: persisted.id };
  }

  async upsertLigneMatiere(reportCardId: string, ligne: { subjectId: string; subjectName: string; coefficient: number; seq1Score: number | null; seq2Score: number | null; subjectAverage: number }): Promise<void> {
    const bulletin = this.store.get(reportCardId);
    if (!bulletin) return;
    const props = bulletin.toObject();
    const existingIdx = props.lignesMatiere.findIndex(l => l.subjectId === ligne.subjectId);
    const newLine: any = { id: crypto.randomUUID(), subjectId: ligne.subjectId, subjectName: ligne.subjectName, coefficient: ligne.coefficient, seq1Score: ligne.seq1Score ?? undefined, seq2Score: ligne.seq2Score ?? undefined, subjectAverage: ligne.subjectAverage };
    if (existingIdx >= 0) props.lignesMatiere[existingIdx] = { ...props.lignesMatiere[existingIdx], ...newLine, id: props.lignesMatiere[existingIdx].id };
    else props.lignesMatiere.push(newLine);
    this.store.set(reportCardId, Bulletin.reconstituer(props));
    this.periodeStore.set(`${props.studentId}:${props.academicPeriodId}`, Bulletin.reconstituer(props));
  }

  async majStatutWorkflowParClasse(classId: string, academicPeriodId: string, schoolId: string, _status: import('@domain/types/enums').BulletinValidationStatus | null): Promise<number> {
    // classWorkflowStatus is Prisma-only (not on BulletinProps), so we can only count matches
    let count = 0;
    for (const [, bulletin] of this.store) {
      const props = bulletin.toObject();
      if (props.schoolId === schoolId && props.academicPeriodId === academicPeriodId && this.classesParEleve.get(props.studentId) === classId) {
        count++;
      }
    }
    return count;
  }

  async findPublicVerifyRecord(tokenOrCodeOrId: string): Promise<BulletinPublicVerifyRecord | null> {
    const key = tokenOrCodeOrId.trim();
    const upper = key.toUpperCase();
    for (const b of this.store.values()) {
      const o = b.toObject();
      if (o.id === key || o.verifyToken === key || (o.shortVerifyCode && o.shortVerifyCode.toUpperCase() === upper)) {
        const nm = this.studentNames.get(o.studentId) ?? { firstName: '', lastName: '' };
        return {
          id: o.id,
          schoolId: o.schoolId,
          schoolName: 'Établissement Test',
          studentFirstName: nm.firstName,
          studentLastName: nm.lastName,
          className: this.classesParEleve.get(o.studentId) ?? null,
          classLevel: null,
          academicYearName: o.academicYearId,
          academicPeriodName: o.academicPeriodId,
          issuedAt: o.createdAt,
          computationVersion: o.computationVersion ?? 1,
          templateSpecId: o.templateSpecId ?? null,
          templateVersion: o.templateVersion ?? 1,
          snapshotData: o.snapshotData ?? null,
          contentHash: o.contentHash ?? null,
          verifyToken: o.verifyToken ?? null,
          shortVerifyCode: o.shortVerifyCode ?? null,
          reprintCount: o.reprintCount ?? 0,
          validationStatus: o.validationStatus,
          revokedAt: o.revokedAt ?? null,
        };
      }
    }
    return null;
  }

  async findRevocationByTokenOrId(tokenOrCodeOrId: string): Promise<BulletinRevocationLookupRecord | null> {
    const key = tokenOrCodeOrId.trim();
    const upper = key.toUpperCase();
    return (
      this.revocations.find(
        (r) =>
          r.originalReportCardId === key ||
          r.verifyToken === key ||
          (r.shortVerifyCode && r.shortVerifyCode.toUpperCase() === upper),
      ) ?? null
    );
  }

  async incrementReprintCount(bulletinId: string, schoolId: string): Promise<number> {
    const b = this.store.get(bulletinId);
    if (!b || b.schoolId !== schoolId) throw new Error(`Bulletin introuvable : ${bulletinId}`);
    const obj = b.toObject();
    const next = (obj.reprintCount ?? 0) + 1;
    const updated = Bulletin.reconstituer({ ...obj, reprintCount: next });
    this.store.set(bulletinId, updated);
    this.periodeStore.set(`${obj.studentId}:${obj.academicPeriodId}`, updated);
    return next;
  }
}
