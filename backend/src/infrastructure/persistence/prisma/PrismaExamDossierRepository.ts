import type { PrismaClient } from '@prisma/client';
import type { ExamDossierRepository, StudentProfileExamInfo, ExamRegistrationInfo, PaiementMinesecInfo, InscriptionMinesecInfo, ExamRegistrationListItem, ExamResultUpdateData } from '@domain/ports/repositories/ExamDossierRepository';
import type { TypeExamen, TypeFraisMinesec } from '@domain/types/enums';

export class PrismaExamDossierRepository implements ExamDossierRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findStudentProfileForExam(schoolId: string, studentUserId: string): Promise<StudentProfileExamInfo | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { user: { id: studentUserId, schoolId } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { name: true, level: true } } },
          take: 1,
        },
      },
    });
    if (!profile) return null;
    return {
      id: profile.id,
      matricule: profile.matricule,
      matriculeVerifieAt: profile.matriculeVerifieAt,
      user: profile.user,
      classeActuelle: profile.enrollmentsYearScoped[0]?.class ?? null,
    };
  }

  async findExamRegistration(studentId: string, anneeScolaire: string, typeExamen: TypeExamen): Promise<ExamRegistrationInfo | null> {
    const existing = await this.prisma.examRegistration.findFirst({
      where: { studentId, anneeScolaire, typeExamen },
    });
    return existing ? { id: existing.id } : null;
  }

  async findPaiementMinesec(studentId: string, typeFrais: TypeFraisMinesec, anneeScolaire: string): Promise<PaiementMinesecInfo | null> {
    const paiement = await this.prisma.paiementMinesec.findFirst({
      where: { studentId, typeFrais, anneeScolaire },
    });
    return paiement ? { id: paiement.id, status: paiement.status } : null;
  }

  async findOrCreateInscriptionMinesec(studentId: string, schoolId: string, anneeScolaire: string, classe: string): Promise<InscriptionMinesecInfo> {
    let enrollment = await this.prisma.inscriptionMinesec.findUnique({
      where: { studentId_schoolId_anneeScolaire: { studentId, schoolId, anneeScolaire } },
    });
    if (!enrollment) {
      enrollment = await this.prisma.inscriptionMinesec.create({
        data: { studentId, schoolId, anneeScolaire, classe, status: 'ACTIVE' },
      });
    }
    return { id: enrollment.id };
  }

  async createExamRegistration(data: {
    studentId: string; enrollmentId: string; schoolId: string;
    anneeScolaire: string; typeExamen: TypeExamen; session: number;
    matriculeNational: string; paiementMinesecId: string | null;
  }): Promise<ExamRegistrationInfo> {
    const registration = await this.prisma.examRegistration.create({ data });
    return { id: registration.id };
  }

  async studentProfileBelongsToSchool(profileId: string, schoolId: string): Promise<boolean> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { id: profileId, user: { schoolId } },
      select: { id: true },
    });
    return profile !== null;
  }

  async findExamRegistrationsByStudent(studentId: string): Promise<ExamRegistrationListItem[]> {
    const registrations = await this.prisma.examRegistration.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return registrations.map((r) => ({
      id: r.id,
      anneeScolaire: r.anneeScolaire,
      typeExamen: r.typeExamen,
      status: r.status,
      session: r.session,
      matriculeNational: r.matriculeNational,
      numeroCandidatExamen: r.numeroCandidatExamen,
      resultatStatus: r.resultatStatus,
      resultatMention: r.resultatMention,
      resultatScore: r.resultatScore,
      resultatSource: r.resultatSource,
      resultatVerifiedAt: r.resultatVerifiedAt,
      createdAt: r.createdAt,
    }));
  }

  async setNumeroCandidat(examId: string, schoolId: string, numeroCandidatExamen: string): Promise<number> {
    const maj = await this.prisma.examRegistration.updateMany({
      where: { id: examId, schoolId },
      data: { numeroCandidatExamen, status: 'CONFIRMED' },
    });
    return maj.count;
  }

  async setExamResult(examId: string, schoolId: string, data: ExamResultUpdateData): Promise<number> {
    const maj = await this.prisma.examRegistration.updateMany({
      where: { id: examId, schoolId },
      data: {
        resultatStatus: data.resultatStatus,
        resultatMention: data.resultatMention,
        resultatScore: data.resultatScore,
        resultatSource: data.resultatSource,
        resultatVerifiedAt: new Date(),
        status: 'RESULT_AVAILABLE',
      },
    });
    return maj.count;
  }
}
