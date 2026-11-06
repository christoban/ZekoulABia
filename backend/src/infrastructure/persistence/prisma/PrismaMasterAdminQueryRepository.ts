/**
 * INFRASTRUCTURE — Adapter Prisma pour MasterAdminQueryRepository
 * Reprend EXACTEMENT les requêtes présentes dans MasterAdminHexController
 * (mêmes includes, mêmes filtres) avant extraction.
 */
import type { Prisma, PrismaClient, SubjectType } from '@prisma/client';
import type {
  MasterAdminQueryRepository,
  EcoleDetail,
  EcoleInvitePending,
} from '@domain/ports/repositories/MasterAdminQueryRepository';

export class PrismaMasterAdminQueryRepository implements MasterAdminQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listSchools(where: Record<string, unknown>, skip: number, take: number): Promise<unknown[]> {
    return this.prisma.school.findMany({
      where: where as Prisma.SchoolWhereInput,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        invites: { where: { status: 'PENDING' }, take: 1, orderBy: { createdAt: 'desc' } },
        users: { where: { role: 'ADMIN', isActive: true }, take: 1, select: { email: true } },
        _count: { select: { users: true, classes: true } },
      },
    });
  }

  countSchools(where: Record<string, unknown>): Promise<number> {
    return this.prisma.school.count({ where: where as Prisma.SchoolWhereInput });
  }

  findSchoolWithDetail(id: string): Promise<unknown | null> {
    return this.prisma.school.findUnique({
      where: { id },
      include: {
        invites: { orderBy: { createdAt: 'desc' }, take: 5 },
        schoolConfig: true,
        schoolSettings: true,
        _count: { select: { users: true, classes: true, subjects: true, feePlans: true } },
      },
    });
  }

  async findSchoolBasic(id: string): Promise<EcoleDetail | null> {
    const row = await this.prisma.school.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, onboardingConfig: true, templateCode: true },
    });
    return row ? {
      id: row.id,
      name: row.name,
      status: row.status,
      onboardingConfig: row.onboardingConfig,
      templateCode: row.templateCode,
    } : null;
  }

  async findSchoolBySubdomain(subdomain: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.school.findUnique({
      where: { subdomain },
      select: { id: true, name: true },
    });
  }

  async findSchoolWithPendingInvite(id: string): Promise<{ id: string; name: string; invites: EcoleInvitePending[] } | null> {
    const school = await this.prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        invites: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!school) return null;
    return {
      id: school.id,
      name: school.name,
      invites: school.invites.map(inv => ({ id: inv.id, email: inv.email ?? '', schoolName: inv.schoolName ?? '' })),
    };
  }

  listMasterAuthAudit(where: Record<string, unknown>, skip: number, take: number): Promise<unknown[]> {
    return this.prisma.masterAuthAudit.findMany({
      where: where as Prisma.MasterAuthAuditWhereInput,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { masterUser: { select: { id: true, email: true, name: true } } },
    });
  }

  countMasterAuthAudit(where: Record<string, unknown>): Promise<number> {
    return this.prisma.masterAuthAudit.count({ where: where as Prisma.MasterAuthAuditWhereInput });
  }

  listEmailLogs(where: Record<string, unknown>, skip: number, take: number): Promise<unknown[]> {
    return this.prisma.emailLog.findMany({
      where: where as Prisma.EmailLogWhereInput,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { school: { select: { id: true, name: true, subdomain: true } } },
    });
  }

  countEmailLogs(where: Record<string, unknown>): Promise<number> {
    return this.prisma.emailLog.count({ where: where as Prisma.EmailLogWhereInput });
  }

  listAiActionAudit(where: Record<string, unknown>, skip: number, take: number): Promise<unknown[]> {
    return this.prisma.aIActionAuditLog.findMany({ where: where as Prisma.AIActionAuditLogWhereInput, skip, take, orderBy: { timestamp: 'desc' } });
  }

  countAiActionAudit(where: Record<string, unknown>): Promise<number> {
    return this.prisma.aIActionAuditLog.count({ where: where as Prisma.AIActionAuditLogWhereInput });
  }

  findSchoolTemplateByCode(code: string): Promise<unknown | null> {
    return this.prisma.schoolTemplate.findUnique({ where: { code } });
  }

  countSubjectsBySchool(schoolId: string): Promise<number> {
    return this.prisma.subject.count({ where: { schoolId } });
  }

  async supprimerEcole(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // TeacherSubject : la cascade School→Subject→TeacherSubject ne passe pas par schoolId direct
      await tx.teacherSubject.deleteMany({ where: { subject: { schoolId: id } } });
      // User.schoolId est nullable (SetNull par défaut) → les users resteraient orphelins sans cette ligne
      await tx.user.deleteMany({ where: { schoolId: id } });
      // School.delete() cascade tout ce qui a onDelete: Cascade (profiles, classes, notes, etc.)
      await tx.school.delete({ where: { id } });
    });
  }

  async renvoyerInvitation(inviteId: string, token: string, expiresAt: Date): Promise<void> {
    await this.prisma.schoolInvite.update({
      where: { id: inviteId },
      data: { token, expiresAt },
    });
  }

  async changerStatutEcole(id: string, statut: 'PENDING'): Promise<void> {
    await this.prisma.school.update({ where: { id }, data: { status: statut } });
  }

  async reinitialiserMfa(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, mfaRecoveryCodeHashes: [], mfaRecoveryCodeGeneratedAt: null },
    });
  }

  async findUserForMfaReset(schoolId: string, email: string): Promise<{ id: string; role: string; mfaEnabled: boolean } | null> {
    return this.prisma.user.findFirst({
      where: { schoolId, email },
      select: { id: true, role: true, mfaEnabled: true },
    });
  }

  async synchroniser(schoolId: string): Promise<{ subjectsCreated: number; subjectCoefficientsUpserted: number }> {
    const school = await this.findSchoolBasic(schoolId);
    if (!school) throw new Error('École introuvable');

    const existingCount = await this.countSubjectsBySchool(schoolId);

    const config = (school.onboardingConfig ?? {}) as Record<string, unknown>;
    const templateCode: string | undefined = school.templateCode ?? (config.templateCode as string | undefined);

    const effectiveTemplate = templateCode
      ? await this.findSchoolTemplateByCode(templateCode)
      : null;

    let subjectCount = 0;
    let subjectCoeffCount = 0;

    const CYCLE2_LEVELS: string[] = ['2nde', '1ere', '1ère', 'Tle'];
    const NIVEAU_MAP: Record<string, string> = {
      '2nde': 'SECONDE', '1ere': 'PREMIERE', '1ère': 'PREMIERE', 'Tle': 'TERMINALE',
    };

    await this.prisma.$transaction(async (tx) => {
      // Créer les matières de base si aucune n'existe
      // Skip for templates with full reference data — subjects are created on-demand below
      const TEMPLATES_WITH_REFERENCE_DATA = ['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE'];
      const hasReferenceData = templateCode && TEMPLATES_WITH_REFERENCE_DATA.includes(templateCode);
      if (existingCount === 0 && effectiveTemplate && !hasReferenceData) {
        interface TemplateSubjectDef { name: string; code: string; coefficient: number; hoursPerWeek?: number; subjectType?: string }
        const tCfg = ((effectiveTemplate as { config?: unknown })?.config ?? {}) as Record<string, unknown>;
        const frSubjects = (tCfg.defaultSubjects as TemplateSubjectDef[] | undefined) ?? [];
        const enSubjects = (tCfg.defaultSubjectsEN as TemplateSubjectDef[] | undefined) ?? [];

        for (const s of frSubjects) {
          await tx.subject.create({
            data: { schoolId, name: s.name, code: s.code, coefficient: s.coefficient, hoursPerWeek: s.hoursPerWeek ?? 2, subjectType: (s.subjectType ?? 'THEORETICAL') as SubjectType },
          });
        }
        for (const s of enSubjects) {
          await tx.subject.create({
            data: { schoolId, name: frSubjects.length > 0 ? `${s.name} (EN)` : s.name, code: frSubjects.length > 0 ? `${s.code}_EN` : s.code, coefficient: s.coefficient, hoursPerWeek: s.hoursPerWeek ?? 2, subjectType: (s.subjectType ?? 'THEORETICAL') as SubjectType },
          });
        }
        subjectCount = frSubjects.length + enSubjects.length;
      }

      // SubjectCoefficients 2e cycle
      const cycle2Classes = await tx.class.findMany({
        where: { schoolId, level: { in: CYCLE2_LEVELS } },
        select: { name: true, level: true },
      });

      if (cycle2Classes.length > 0) {
        const schoolSubjects = await tx.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
        const subjectByName = new Map(schoolSubjects.map(s => [s.name, s.id]));
        const processed = new Set<string>();

        for (const classe of cycle2Classes) {
          const niveauBac = NIVEAU_MAP[classe.level];
          if (!niveauBac) continue;
          const nameParts = classe.name.split(' ');
          const serieRaw2 = nameParts[1];
          if (!serieRaw2) continue;
          const dashIdx2 = serieRaw2.indexOf('-');
          const seriePart = dashIdx2 >= 0 ? serieRaw2.slice(0, dashIdx2) : serieRaw2;
          const serieCode = seriePart === 'A4' && dashIdx2 >= 0 ? serieRaw2 : seriePart;
          const key = `${niveauBac}|${serieCode}`;
          if (processed.has(key)) continue;
          processed.add(key);

          const bacCoeffs = await tx.bacCoefficient.findMany({ where: { serie: seriePart, niveau: niveauBac } });
          for (const bc of bacCoeffs) {
            let subjectName = bc.subjectName;
            if (seriePart === 'A4' && bc.subjectName === 'LV2' && dashIdx2 >= 0) {
              subjectName = serieRaw2.slice(dashIdx2 + 1);
            }
            let subjectId = subjectByName.get(subjectName);
            if (!subjectId) {
              const code = subjectName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
              const newS = await tx.subject.create({
                data: { schoolId, name: subjectName, code, coefficient: bc.coefficient, hoursPerWeek: 2, subjectType: 'THEORETICAL' as SubjectType },
              });
              subjectId = newS.id;
              subjectByName.set(subjectName, subjectId);
              subjectCount++;
            }
            await tx.subjectCoefficient.upsert({
              where: { schoolId_subjectId_classLevel_serieCode: { schoolId, subjectId, classLevel: classe.level, serieCode } },
              update: { coefficient: bc.coefficient },
              create: { schoolId, subjectId, classLevel: classe.level, serieCode, coefficient: bc.coefficient },
            });
            subjectCoeffCount++;
          }
        }
      }
    });

    return {
      subjectsCreated: subjectCount,
      subjectCoefficientsUpserted: subjectCoeffCount,
    };
  }
}
