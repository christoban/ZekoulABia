/**
 * DTOs et validateurs pour le module Notes
 */

export interface SaisirNoteDto {
  studentId: string;
  subjectId: string;
  classId: string;
  sequenceId: string;
  sequenceScore?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;
  coefficient?: number;
  maxValue?: number;
}

export function validerSaisirNoteDto(body: unknown): SaisirNoteDto {
  const b = body as SaisirNoteDto & Record<string, unknown>;
  const erreurs: string[] = [];
  if (!b.studentId) erreurs.push('studentId requis');
  if (!b.subjectId) erreurs.push('subjectId requis');
  if (!b.classId) erreurs.push('classId requis');
  if (!b.sequenceId) erreurs.push('sequenceId requis');

  const scores = [
    'sequenceScore', 'classTestScore', 'terminalExamScore',
    'theoreticalScore', 'practicalScore', 'professionalAttitude',
    'oralScore', 'selfDevelopmentScore',
  ];
  const aUnScore = scores.some(s => body[s] !== undefined && body[s] !== null);
  if (!aUnScore) erreurs.push('Au moins un score est requis');

  if (erreurs.length > 0) throw new Error(`Données invalides : ${erreurs.join(', ')}`);

  return {
    studentId: b.studentId,
    subjectId: b.subjectId,
    classId: b.classId,
    sequenceId: b.sequenceId,
    sequenceScore: b.sequenceScore,
    classTestScore: b.classTestScore,
    terminalExamScore: b.terminalExamScore,
    theoreticalScore: b.theoreticalScore,
    practicalScore: b.practicalScore,
    professionalAttitude: b.professionalAttitude,
    oralScore: b.oralScore,
    selfDevelopmentScore: b.selfDevelopmentScore,
    coefficient: b.coefficient,
    maxValue: b.maxValue,
  };
}
