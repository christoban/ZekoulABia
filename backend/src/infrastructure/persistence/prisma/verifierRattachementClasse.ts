/**
 * APPLICATION LAYER — Vérification partagée du rattachement d'un enseignant à une classe.
 *
 * Source unique de vérité pour une règle utilisée par plusieurs use cases (notes, présences,
 * cahier de texte, demande de rattrapage) et leurs deux points d'entrée respectifs (route HTTP
 * classique + catalogue d'actions du copilot IA) : un enseignant n'agit que sur une classe où il
 * est réellement rattaché, jamais sur n'importe quelle classe de l'école sous prétexte qu'il
 * enseigne la même matière ailleurs. Corrigé une seule fois ici, hérité par tous les appelants.
 */
import type { PrismaClient } from '@prisma/client';

export interface VerifierRattachementOptions {
  /**
   * true  : un professeur principal de la classe est aussi autorisé, même sans assignation sur
   *         cette matière précise (présences, rattrapage sans matière précisée — l'usage réel).
   * false : seule une assignation classe+matière (TeachingAssignment) compte — pour tout ce qui
   *         est intrinsèquement lié à UNE matière (notes, cahier de texte).
   */
  autoriserProfesseurPrincipal: boolean;
}

export async function estRattacheALaClasse(
  prisma: PrismaClient,
  teacherId: string,
  classId: string,
  subjectId: string | undefined,
  options: VerifierRattachementOptions,
): Promise<boolean> {
  const assignation = await prisma.teachingAssignment.findFirst({
    where: { teacherId, classId, ...(subjectId ? { subjectId } : {}) },
    select: { id: true },
  });
  if (assignation) return true;
  if (!options.autoriserProfesseurPrincipal) return false;

  const estProfPrincipal = await prisma.class.findFirst({
    where: { id: classId, professorPrincipalId: teacherId },
    select: { id: true },
  });
  return !!estProfPrincipal;
}
