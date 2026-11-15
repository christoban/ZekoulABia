import type { PrismaClient, UserRole } from '@prisma/client';
import type { Publication } from '@domain/entities/Publication';
import type { DestinataireLectureItem, LecturesDetailResult } from '@domain/ports/repositories/PublicationRepository';

type EligibleRecipient = Omit<DestinataireLectureItem, 'readAt'>;

/** Récupère les listes complètes "vus" et "nonVus" pour une publication du babillard. */
export async function queryPublicationRecipients(
  prisma: PrismaClient,
  publication: Publication,
): Promise<LecturesDetailResult> {
  const audienceRoles = publication.audience.roles ?? [];
  const classesCiblees = publication.audience.classeIds ?? [];
  const schoolId = publication.tenantId;

  const lectures = await prisma.publicationLecture.findMany({
    where: { publicationId: publication.id, schoolId },
    select: { userId: true, luLe: true },
  });
  const readMap = new Map<string, Date>(lectures.map((l) => [l.userId, l.luLe]));
  const eligibleMap = new Map<string, EligibleRecipient>();

  if (audienceRoles.length > 0) {
    if (classesCiblees.length > 0) {
      if (audienceRoles.includes('STUDENT')) {
        const enrollments = await prisma.enrollment.findMany({
          where: { schoolId, classId: { in: classesCiblees }, status: 'ACTIVE' },
          include: {
            student: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, role: true, phone: true, accessMode: true, isActive: true, deletedAt: true } },
              },
            },
          },
        });
        for (const e of enrollments) {
          const u = e.student?.user;
          if (!u || !u.isActive || u.deletedAt) continue;
          eligibleMap.set(u.id, { userId: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, phone: u.phone ?? null, accessMode: u.accessMode });
        }
      }

      if (audienceRoles.includes('PARENT')) {
        const parentLinks = await prisma.parentStudent.findMany({
          where: { studentProfile: { enrollmentsYearScoped: { some: { schoolId, classId: { in: classesCiblees }, status: 'ACTIVE' } } } },
          include: {
            parentProfile: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, role: true, phone: true, accessMode: true, isActive: true, deletedAt: true } },
              },
            },
          },
        });
        for (const link of parentLinks) {
          const u = link.parentProfile?.user;
          if (!u || !u.isActive || u.deletedAt) continue;
          eligibleMap.set(u.id, { userId: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, phone: u.phone ?? null, accessMode: u.accessMode });
        }
      }

      const autresRoles = audienceRoles.filter((r) => r !== 'STUDENT' && r !== 'PARENT');
      if (autresRoles.length > 0) {
        const autres = await prisma.user.findMany({
          where: { schoolId, deletedAt: null, isActive: true, role: { in: autresRoles as UserRole[] } },
          select: { id: true, firstName: true, lastName: true, role: true, phone: true, accessMode: true },
        });
        for (const u of autres) {
          eligibleMap.set(u.id, { userId: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, phone: u.phone ?? null, accessMode: u.accessMode });
        }
      }
    } else {
      const users = await prisma.user.findMany({
        where: { schoolId, deletedAt: null, isActive: true, role: { in: audienceRoles as UserRole[] } },
        select: { id: true, firstName: true, lastName: true, role: true, phone: true, accessMode: true },
      });
      for (const u of users) {
        eligibleMap.set(u.id, { userId: u.id, firstName: u.firstName, lastName: u.lastName, role: u.role, phone: u.phone ?? null, accessMode: u.accessMode });
      }
    }
  }

  const vus: DestinataireLectureItem[] = [];
  const nonVus: DestinataireLectureItem[] = [];
  for (const u of eligibleMap.values()) {
    const readAt = readMap.get(u.userId) ?? null;
    const item: DestinataireLectureItem = { ...u, readAt };
    if (readAt) vus.push(item);
    else nonVus.push(item);
  }
  vus.sort((a, b) => (b.readAt?.getTime() ?? 0) - (a.readAt?.getTime() ?? 0));
  nonVus.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));

  return { lecturesCount: vus.length, destinatairesEligiblesCount: eligibleMap.size, vus, nonVus };
}

