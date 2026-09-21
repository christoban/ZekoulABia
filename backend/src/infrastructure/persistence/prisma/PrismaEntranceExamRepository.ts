import type {
  PrismaClient,
  EntranceExamStatus as EntranceExamStatusPrisma,
  AdmissionStatus as AdmissionStatusPrisma,
  CepResult as CepResultPrisma,
  CandidatePresence as CandidatePresencePrisma,
} from '@prisma/client';
import type {
  EntranceExamRepository,
  EntranceSessionData,
  EntranceCandidateData,
  EntranceExamStatus,
  EntranceAdmissionStatus,
  EntranceCepResult,
  EntranceSubjectData,
  EntranceRoomData,
  CreerSessionConcoursInput,
  CandidatePresence,
} from '@domain/ports/repositories/EntranceExamRepository';

export class PrismaEntranceExamRepository implements EntranceExamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerSessions(schoolId: string): Promise<EntranceSessionData[]> {
    const sessions = await this.prisma.entranceExamSession.findMany({
      where: { schoolId },
      include: {
        subjects: { orderBy: { orderIndex: 'asc' } },
        rooms: { orderBy: { name: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return sessions as unknown as EntranceSessionData[];
  }

  async trouverSession(sessionId: string): Promise<EntranceSessionData | null> {
    const session = await this.prisma.entranceExamSession.findUnique({
      where: { id: sessionId },
    });
    return session as unknown as EntranceSessionData | null;
  }

  async trouverSessionAvecDetails(sessionId: string): Promise<EntranceSessionData | null> {
    const session = await this.prisma.entranceExamSession.findUnique({
      where: { id: sessionId },
      include: {
        subjects: { orderBy: { orderIndex: 'asc' } },
        rooms: {
          include: {
            _count: { select: { candidates: true } },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!session) return null;

    return {
      ...session,
      rooms: session.rooms.map(r => ({
        id: r.id,
        sessionId: r.sessionId,
        name: r.name,
        capacity: r.capacity,
        assignedCandidatesCount: r._count.candidates,
      })),
    } as unknown as EntranceSessionData;
  }

  async creerSession(data: CreerSessionConcoursInput): Promise<EntranceSessionData> {
    const session = await this.prisma.entranceExamSession.create({
      data: {
        schoolId: data.schoolId,
        name: data.name,
        examDate: data.examDate,
        academicYearId: data.academicYearId,
        admissionThreshold: data.admissionThreshold ?? null,
        availableSeats: data.availableSeats ?? null,
        registrationDeadline: data.registrationDeadline ?? null,
        requireCepForAdmission: data.requireCepForAdmission ?? false,
        seatReservationDays: data.seatReservationDays ?? 14,
        targetClassId: data.targetClassId ?? null,
        status: 'DRAFT',
      },
    });
    return session as unknown as EntranceSessionData;
  }

  async mettreAJourStatutSession(
    sessionId: string,
    status: EntranceExamStatus,
    extra?: { deliberatedAt?: Date; publishedAt?: Date }
  ): Promise<void> {
    await this.prisma.entranceExamSession.update({
      where: { id: sessionId },
      data: {
        status: status as EntranceExamStatusPrisma,
        ...(extra?.deliberatedAt ? { deliberatedAt: extra.deliberatedAt } : {}),
        ...(extra?.publishedAt ? { publishedAt: extra.publishedAt } : {}),
      },
    });
  }

  async compterCandidatsEnAttente(sessionId: string): Promise<number> {
    return this.prisma.entranceExamCandidate.count({
      where: { sessionId, admissionStatus: { in: ['PENDING', 'ADMIS_PROVISOIRE'] } },
    });
  }

  async compterCandidatsSession(sessionId: string): Promise<number> {
    return this.prisma.entranceExamCandidate.count({
      where: { sessionId },
    });
  }

  async listerMatieres(sessionId: string): Promise<EntranceSubjectData[]> {
    const subjects = await this.prisma.entranceExamSubject.findMany({
      where: { sessionId },
      orderBy: { orderIndex: 'asc' },
    });
    return subjects as unknown as EntranceSubjectData[];
  }

  async configurerMatieres(
    sessionId: string,
    matieres: { name: string; coefficient: number; maxScore?: number; eliminatoryScore?: number | null }[]
  ): Promise<EntranceSubjectData[]> {
    return this.prisma.$transaction(async (tx) => {
      await tx.entranceExamSubject.deleteMany({ where: { sessionId } });

      const created = [];
      for (let i = 0; i < matieres.length; i++) {
        const m = matieres[i];
        const s = await tx.entranceExamSubject.create({
          data: {
            sessionId,
            name: m.name,
            coefficient: m.coefficient,
            maxScore: m.maxScore ?? 20.0,
            eliminatoryScore: m.eliminatoryScore ?? null,
            orderIndex: i,
          },
        });
        created.push(s);
      }
      return created as unknown as EntranceSubjectData[];
    });
  }

  async listerSalles(sessionId: string): Promise<EntranceRoomData[]> {
    const rooms = await this.prisma.entranceExamRoom.findMany({
      where: { sessionId },
      include: {
        _count: { select: { candidates: true } },
      },
      orderBy: { name: 'asc' },
    });

    return rooms.map(r => ({
      id: r.id,
      sessionId: r.sessionId,
      name: r.name,
      capacity: r.capacity,
      assignedCandidatesCount: r._count.candidates,
    }));
  }

  async creerSalle(sessionId: string, name: string, capacity: number): Promise<EntranceRoomData> {
    const r = await this.prisma.entranceExamRoom.create({
      data: {
        sessionId,
        name,
        capacity,
      },
    });
    return {
      id: r.id,
      sessionId: r.sessionId,
      name: r.name,
      capacity: r.capacity,
      assignedCandidatesCount: 0,
    };
  }

  async supprimerSalle(roomId: string): Promise<void> {
    await this.prisma.entranceExamRoom.delete({
      where: { id: roomId },
    });
  }

  async assignerSallePlace(candidateId: string, roomId: string | null, deskNumber: number | null): Promise<void> {
    await this.prisma.entranceExamCandidate.update({
      where: { id: candidateId },
      data: {
        roomId,
        deskNumber,
      },
    });
  }

  async creerCandidat(data: {
    sessionId: string;
    candidateNumber?: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date | null;
    originSchool?: string | null;
    examScore?: number | null;
    parentPhone?: string | null;
  }): Promise<{ id: string; candidateNumber: string | null }> {
    const cand = await this.prisma.entranceExamCandidate.create({
      data: {
        sessionId: data.sessionId,
        candidateNumber: data.candidateNumber ?? null,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ?? null,
        originSchool: data.originSchool ?? null,
        examScore: data.examScore ?? null,
        parentPhone: data.parentPhone ?? null,
        admissionStatus: 'PENDING',
        cepResult: 'NON_PASSE',
      },
      select: { id: true, candidateNumber: true },
    });
    return cand;
  }

  async trouverDernierNumeroSequence(sessionId: string): Promise<number> {
    const count = await this.prisma.entranceExamCandidate.count({
      where: { sessionId },
    });
    return count;
  }

  async listerCandidats(
    sessionId: string,
    options?: { avecNote?: boolean; orderBy?: 'score' | 'nom' | 'rang' | 'code'; roomId?: string }
  ): Promise<EntranceCandidateData[]> {
    let orderByClause: Record<string, 'asc' | 'desc'> = { lastName: 'asc' };
    if (options?.orderBy === 'score') {
      orderByClause = { totalAverage: 'desc' };
    } else if (options?.orderBy === 'rang') {
      orderByClause = { rank: 'asc' };
    } else if (options?.orderBy === 'code') {
      orderByClause = { candidateNumber: 'asc' };
    }

    const cands = await this.prisma.entranceExamCandidate.findMany({
      where: {
        sessionId,
        ...(options?.avecNote ? { totalAverage: { not: null } } : {}),
        ...(options?.roomId ? { roomId: options.roomId } : {}),
      },
      include: {
        room: true,
        grades: {
          include: { subject: true },
        },
      },
      orderBy: orderByClause,
    });
    return cands as unknown as EntranceCandidateData[];
  }

  async trouverCandidatAvecSession(candidateId: string): Promise<EntranceCandidateData | null> {
    const cand = await this.prisma.entranceExamCandidate.findUnique({
      where: { id: candidateId },
      include: {
        session: {
          include: { subjects: true },
        },
        room: true,
        grades: {
          include: { subject: true },
        },
      },
    });
    return cand as unknown as EntranceCandidateData | null;
  }

  async trouverCandidatParCodeEtDateNaissance(
    sessionId: string,
    candidateNumber: string,
    dateOfBirth: Date
  ): Promise<EntranceCandidateData | null> {
    const startOfDay = new Date(dateOfBirth);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateOfBirth);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const cand = await this.prisma.entranceExamCandidate.findFirst({
      where: {
        sessionId,
        candidateNumber: { equals: candidateNumber.trim(), mode: 'insensitive' },
        dateOfBirth: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        grades: { include: { subject: true } },
      },
    });
    return cand as unknown as EntranceCandidateData | null;
  }

  async sauvegarderNotesCandidat(
    candidateId: string,
    notes: { subjectId: string; score?: number | null; isAbsent?: boolean }[]
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const n of notes) {
        await tx.entranceExamCandidateGrade.upsert({
          where: {
            candidateId_subjectId: {
              candidateId,
              subjectId: n.subjectId,
            },
          },
          update: {
            score: n.score ?? null,
            isAbsent: n.isAbsent ?? false,
          },
          create: {
            candidateId,
            subjectId: n.subjectId,
            score: n.score ?? null,
            isAbsent: n.isAbsent ?? false,
          },
        });
      }
    });
  }

  async mettreAJourScoreEtRangCandidat(
    candidateId: string,
    totalAverage: number | null,
    rank: number | null,
    admissionStatus?: EntranceAdmissionStatus
  ): Promise<void> {
    await this.prisma.entranceExamCandidate.update({
      where: { id: candidateId },
      data: {
        totalAverage,
        examScore: totalAverage, // rétro-compatibilité
        rank,
        ...(admissionStatus ? { admissionStatus: admissionStatus as AdmissionStatusPrisma } : {}),
      },
    });
  }

  async appliquerDeliberation(
    sessionId: string,
    admissions: { candidateId: string; status: EntranceAdmissionStatus; reservationExpiresAt?: Date | null }[]
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const adm of admissions) {
        await tx.entranceExamCandidate.update({
          where: { id: adm.candidateId },
          data: {
            admissionStatus: adm.status as AdmissionStatusPrisma,
            reservationExpiresAt: adm.reservationExpiresAt ?? null,
          },
        });
      }
    });
  }

  async mettreAJourResultatCEP(
    candidateId: string,
    data: { cepResult: EntranceCepResult; admissionStatus: EntranceAdmissionStatus }
  ): Promise<void> {
    await this.prisma.entranceExamCandidate.update({
      where: { id: candidateId },
      data: {
        cepResult: data.cepResult as CepResultPrisma,
        cepResultDate: new Date(),
        admissionStatus: data.admissionStatus as AdmissionStatusPrisma,
      },
    });
  }

  async mettreAJourStatutAdmission(candidateId: string, admissionStatus: EntranceAdmissionStatus): Promise<void> {
    await this.prisma.entranceExamCandidate.update({
      where: { id: candidateId },
      data: { admissionStatus: admissionStatus as AdmissionStatusPrisma },
    });
  }

  async enregistrerPresenceCandidat(candidateId: string, presenceStatus: CandidatePresence): Promise<void> {
    await this.prisma.entranceExamCandidate.update({
      where: { id: candidateId },
      data: { presenceStatus: presenceStatus as CandidatePresencePrisma },
    });
  }

  async trouverClasseNiveau(schoolId: string, niveau: string): Promise<{ id: string } | null> {
    const classes = await this.prisma.class.findMany({
      where: { schoolId, level: { contains: niveau } },
      orderBy: { name: 'asc' },
      take: 1,
    });
    return classes[0] ? { id: classes[0].id } : null;
  }
}