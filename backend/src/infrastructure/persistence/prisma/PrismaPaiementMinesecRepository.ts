import type { PrismaClient, TypeFraisMinesec as TypeFraisMinesecPrisma } from '@prisma/client';
import type {
  PaiementMinesecRepository,
  InscriptionMinesecData,
  PaiementMinesecData,
  TarifMinesecData,
  TypeFraisMinesec,
} from '@domain/ports/repositories/PaiementMinesecRepository';

export class PrismaPaiementMinesecRepository implements PaiementMinesecRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async trouverProfileAvecClasse(profileId: string, schoolId: string): Promise<{ id: string; niveau: string | null } | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id: profileId, user: { schoolId } },
      include: {
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { level: true, name: true } } },
          take: 1,
        },
      },
    });
    if (!profile) return null;
    const classe = profile.enrollmentsYearScoped?.[0]?.class;
    return { id: profile.id, niveau: classe?.level ?? classe?.name ?? null };
  }

  async trouverEnrollment(studentId: string, schoolId: string, anneeScolaire: string): Promise<InscriptionMinesecData | null> {
    return this.prisma.inscriptionMinesec.findUnique({
      where: { studentId_schoolId_anneeScolaire: { studentId, schoolId, anneeScolaire } },
    }) as Promise<InscriptionMinesecData | null>;
  }

  async creerEnrollment(data: { studentId: string; schoolId: string; anneeScolaire: string; classe: string }): Promise<InscriptionMinesecData> {
    return this.prisma.inscriptionMinesec.create({
      data: { ...data, status: 'ACTIVE' },
    }) as Promise<InscriptionMinesecData>;
  }

  async trouverPaiementExistant(enrollmentId: string, typeFrais: TypeFraisMinesec): Promise<{ id: string } | null> {
    return this.prisma.paiementMinesec.findFirst({
      where: { enrollmentId, typeFrais: typeFrais as TypeFraisMinesecPrisma },
      select: { id: true },
    });
  }

  async trouverTarif(typeFrais: TypeFraisMinesec, anneeScolaire: string, niveauCategory: string): Promise<TarifMinesecData | null> {
    return this.prisma.tarifMinesecReference.findFirst({
      where: {
        typeFrais: typeFrais as TypeFraisMinesecPrisma,
        anneeScolaire,
        actif: true,
        OR: [{ niveau: null }, { niveau: niveauCategory }],
      },
      select: { montantFCFA: true },
    }) as Promise<TarifMinesecData | null>;
  }

  async creerPaiement(data: { studentId: string; enrollmentId: string; schoolId: string; anneeScolaire: string; typeFrais: TypeFraisMinesec; montantAttendu: number }): Promise<{ id: string }> {
    return this.prisma.paiementMinesec.create({
      data: {
        studentId: data.studentId,
        enrollmentId: data.enrollmentId,
        schoolId: data.schoolId,
        anneeScolaire: data.anneeScolaire,
        typeFrais: data.typeFrais as TypeFraisMinesecPrisma,
        montantAttendu: data.montantAttendu,
        status: 'IMPAYE',
        dataSource: 'MANUAL',
      },
      select: { id: true },
    });
  }

  async trouverPaiement(paiementId: string): Promise<PaiementMinesecData | null> {
    return this.prisma.paiementMinesec.findUnique({
      where: { id: paiementId },
      include: { student: { select: { matricule: true } } },
    }) as Promise<PaiementMinesecData | null>;
  }

  async mettreAJourPaiement(paiementId: string, data: Record<string, unknown>): Promise<void> {
    await this.prisma.paiementMinesec.update({
      where: { id: paiementId },
      data,
    });
  }

  async listerImpayes(studentId: string, anneeScolaire: string): Promise<PaiementMinesecData[]> {
    return this.prisma.paiementMinesec.findMany({
      where: { studentId, anneeScolaire, status: 'IMPAYE' },
    }) as Promise<PaiementMinesecData[]>;
  }

  async listerPaiementsEnrollment(enrollmentId: string): Promise<PaiementMinesecData[]> {
    return this.prisma.paiementMinesec.findMany({
      where: { enrollmentId },
      orderBy: { typeFrais: 'asc' },
    }) as Promise<PaiementMinesecData[]>;
  }

  async listerPaiementsEtablissementEnrollment(enrollmentId: string): Promise<{ id: string; typeFrais: string; montantAttendu: number; montantPaye: number | null; status: string; recu: string | null }[]> {
    const rows = await this.prisma.paiementEtablissement.findMany({
      where: { enrollmentId },
      orderBy: { typeFrais: 'asc' },
    });
    return rows.map((p) => ({
      id: p.id,
      typeFrais: p.typeFrais,
      montantAttendu: p.montantAttendu,
      montantPaye: p.montantPaye,
      status: p.status,
      recu: p.recu,
    }));
  }

  async compterInscriptionsActives(schoolId: string, anneeScolaire: string): Promise<number> {
    return this.prisma.inscriptionMinesec.count({
      where: { schoolId, anneeScolaire, status: 'ACTIVE' },
    });
  }

  async agregerPaiementsMinesec(schoolId: string, anneeScolaire: string): Promise<{ status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[]> {
    const rows = await this.prisma.paiementMinesec.groupBy({
      by: ['status'],
      where: { schoolId, anneeScolaire },
      _count: { _all: true },
      _sum: { montantAttendu: true, montantPaye: true },
    });
    return rows.map((r) => ({ status: r.status, _count: r._count, _sum: r._sum }));
  }

  async agregerPaiementsEtablissement(schoolId: string, anneeScolaire: string): Promise<{ status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[]> {
    const rows = await this.prisma.paiementEtablissement.groupBy({
      by: ['status'],
      where: { schoolId, anneeScolaire },
      _count: { _all: true },
      _sum: { montantAttendu: true, montantPaye: true },
    });
    return rows.map((r) => ({ status: r.status, _count: r._count, _sum: r._sum }));
  }

  async listerProfilsActifs(schoolId: string): Promise<{ id: string }[]> {
    return this.prisma.studentProfile.findMany({
      where: { user: { schoolId }, studentStatus: 'ACTIVE', enrollmentsYearScoped: { some: { status: 'ACTIVE', academicYear: { isCurrent: true } } } },
      select: { id: true },
    });
  }

  async trouverEcoleSubsystem(schoolId: string): Promise<{ subsystem: string } | null> {
    return this.prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } });
  }

  async trouverProfileDashboard(studentUserId: string, schoolId: string): Promise<{
    id: string;
    nom: string;
    prenom: string;
    classe: string;
    matricule: string | null;
  } | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { user: { id: studentUserId, schoolId } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { name: true } } },
          take: 1,
        },
      },
    });
    if (!profile) return null;
    return {
      id: profile.id,
      nom: profile.user.lastName,
      prenom: profile.user.firstName,
      classe: profile.enrollmentsYearScoped?.[0]?.class?.name ?? '',
      matricule: profile.matricule,
    };
  }

  async trouverEnrollmentActif(studentId: string, schoolId: string): Promise<InscriptionMinesecData | null> {
    return this.prisma.inscriptionMinesec.findFirst({
      where: { studentId, schoolId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    }) as Promise<InscriptionMinesecData | null>;
  }

  async listerPaiements(studentId: string, anneeScolaire: string): Promise<PaiementMinesecData[]> {
    return this.prisma.paiementMinesec.findMany({
      where: { studentId, anneeScolaire },
      orderBy: { typeFrais: 'asc' },
    }) as Promise<PaiementMinesecData[]>;
  }

  async listerImpayesMinesecSchool(schoolId: string, now: Date): Promise<{ id: string; studentId: string; studentName: string; typeFrais: string; montantAttendu: number; dateEcheance: Date | null }[]> {
    const rows = await this.prisma.paiementMinesec.findMany({
      where: { schoolId, status: 'IMPAYE', dateEcheance: { lt: now } },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { dateEcheance: 'asc' },
    });
    return rows.map((p) => ({
      id: p.id,
      studentId: p.studentId,
      studentName: p.student?.user ? `${p.student.user.firstName} ${p.student.user.lastName}` : '',
      typeFrais: p.typeFrais,
      montantAttendu: p.montantAttendu,
      dateEcheance: p.dateEcheance,
    }));
  }

  async listerImpayesEtablissementSchool(schoolId: string): Promise<{ id: string; studentId: string; studentName: string; typeFrais: string; montantAttendu: number; montantPaye: number | null }[]> {
    const rows = await this.prisma.paiementEtablissement.findMany({
      where: { schoolId, status: 'IMPAYE' },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    return rows.map((p) => ({
      id: p.id,
      studentId: p.studentId,
      studentName: p.student?.user ? `${p.student.user.firstName} ${p.student.user.lastName}` : '',
      typeFrais: p.typeFrais,
      montantAttendu: p.montantAttendu,
      montantPaye: p.montantPaye,
    }));
  }
}