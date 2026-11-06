/**
 * Test d'intégration — GradeController (calculerMoyenne / calculerMoyenneSequence)
 * Prérequis : bun test --env-file .env.test
 *
 * Couvre, via de vraies requêtes HTTP sur les routes réelles (pas d'appel direct aux méthodes
 * privées), les deux calculs de moyenne qui n'avaient jusqu'ici aucun test :
 *  - calculerMoyenneSequence (PUT /grades/:id) : note → moyenne matière, modes single/triple/weighted.
 *  - calculerMoyenne (GET /grades/average/:studentId) : moyenne matière → moyenne pondérée
 *    entre matières + rang, y compris le cas coefficient=0 (régression corrigée dans
 *    domain/rules/GradingEngine.ts — vérifié ici de bout en bout, pas seulement au niveau unitaire).
 *
 * Note : calculerMoyenneSequence ne prend PAS de coefficient en paramètre (seul
 * calculerMoyenne en a un) — les cas limites testés ici pour calculerMoyenneSequence sont donc
 * les notes manquantes/partielles et le clamp sur maxValue, pas un coefficient.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

const enrollmentRepo = new PrismaEnrollmentRepository(prismaTest);

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let classId: string;
let academicYearId: string;
let sequenceId: string;

const authHeaders = () => ({
  Cookie: `access_token=${adminToken}`,
  'Content-Type': 'application/json',
});

async function creerNoteDraft(studentId: string, subjectId: string) {
  return prismaTest.grade.create({
    data: {
      schoolId, studentId, subjectId, classId, academicYearId, sequenceId,
      validationStatus: 'DRAFT',
    },
  });
}

async function modifierNote(gradeId: string, body: Record<string, unknown>) {
  const res = await fetch(`${baseUrl}/grades/${gradeId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json() as { success: boolean; grade?: { sequenceAverage: number | null } };
  return { status: res.status, sequenceAverage: json.grade?.sequenceAverage ?? null };
}

async function definirModeCalcul(mode: 'single' | 'triple' | 'weighted') {
  await prismaTest.schoolConfig.update({ where: { schoolId }, data: { sequenceCalculationMode: mode } });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'gradeCtrl');
  schoolId = school.id;
  await prismaTest.schoolConfig.create({ data: { schoolId, sequenceCalculationMode: 'single' } });

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  academicYearId = annee.id;

  const classe = await prismaTest.class.create({ data: { schoolId, name: '3ème Test', academicYearId } });
  classId = classe.id;

  const periode = await prismaTest.academicPeriod.create({
    data: { academicYearId, name: 'Trimestre 1', orderIndex: 1, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-20') },
  });
  const sequence = await prismaTest.academicSequence.create({
    data: { academicPeriodId: periode.id, schoolId, name: 'Séquence 1', type: 'DS', orderIndex: 1 },
  });
  sequenceId = sequence.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.reportCardSubjectLine.deleteMany({ where: { reportCard: { schoolId } } });
  await prismaTest.reportCard.deleteMany({ where: { schoolId } });
  await prismaTest.classCouncilDecision.deleteMany({ where: { session: { schoolId } } });
  await prismaTest.classCouncilSession.deleteMany({ where: { schoolId } });
  await prismaTest.assessmentParticipation.deleteMany({ where: { schoolId } });
  await prismaTest.harmonizedAssessmentSession.deleteMany({ where: { schoolId } });
  await prismaTest.assessmentScope.deleteMany({ where: { schoolId } });
  await prismaTest.grade.deleteMany({ where: { schoolId } });
  await prismaTest.academicSequence.deleteMany({ where: { schoolId } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId } } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.schoolConfig.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('GradeController.calculerMoyenneSequence — mode single (PUT /grades/:id)', () => {
  it('sequenceScore seul → valeur directe', async () => {
    await definirModeCalcul('single');
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Maths' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, { sequenceScore: 15 });
    expect(sequenceAverage).toBe(15);
  });

  it('sequenceScore absent, repli sur (theoreticalScore + practicalScore) / 2', async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'SVT' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, { theoreticalScore: 12, practicalScore: 16 });
    expect(sequenceAverage).toBe(14);
  });

  it('sequenceScore et theorique/pratique absents, repli sur classTestScore*0.3 + terminalExamScore*0.7', async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Physique' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, { classTestScore: 10, terminalExamScore: 14 });
    expect(sequenceAverage).toBe(12.8);
  });

  it('note manquante (aucune composante fournie) → 0, jamais NaN ni null', async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Musique' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, {});
    expect(sequenceAverage).toBe(0);
  });

  it('clamp sur maxValue : sequenceScore au-delà du barème est plafonné', async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Anglais' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, { sequenceScore: 18, maxValue: 15 });
    expect(sequenceAverage).toBe(15);
  });
});

describe('GradeController.calculerMoyenneSequence — mode triple (PUT /grades/:id)', () => {
  it('seq1Score + seq2Score + compositionScore → (ds1 + ds2 + compo*2) / 4', async () => {
    await definirModeCalcul('triple');
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Histoire' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, { seq1Score: 12, seq2Score: 14, compositionScore: 16 });
    expect(sequenceAverage).toBe(14.5);
  });

  it('seq1Score absent, repli sur sequenceScore comme ds1', async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Géographie' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, { sequenceScore: 13, seq2Score: 15, compositionScore: 17 });
    expect(sequenceAverage).toBe(15.5);
  });

  it('note manquante (compositionScore absent, aucun autre repli disponible) → 0', async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'EPS' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    // seq1/seq2 fournis mais compositionScore manquant → le mode triple ne peut pas calculer,
    // et aucun des replis single (sequenceScore/theorique-pratique/classTest-terminal) n'a de
    // donnée non plus → 0, pas une exception ni une moyenne partielle silencieusement fausse.
    const { sequenceAverage } = await modifierNote(grade.id, { seq1Score: 12, seq2Score: 14 });
    expect(sequenceAverage).toBe(0);
  });
});

describe('GradeController.calculerMoyenneSequence — mode weighted (PUT /grades/:id)', () => {
  it('classTestScore*0.3 + terminalExamScore*0.7', async () => {
    await definirModeCalcul('weighted');
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Philosophie' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, { classTestScore: 8, terminalExamScore: 14 });
    expect(sequenceAverage).toBe(12.2);
  });

  it('note manquante (terminalExamScore absent) → 0', async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Chimie' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const grade = await creerNoteDraft(student.id, subject.id);

    const { sequenceAverage } = await modifierNote(grade.id, { classTestScore: 8 });
    expect(sequenceAverage).toBe(0);
  });
});

describe('GradeController.calculerMoyenne — moyenne pondérée entre matières (GET /grades/average/:studentId)', () => {
  // IMPORTANT — découvert en écrivant ce test : `Grade.coefficient` est une colonne NON
  // NULLABLE avec @default(1) (prisma/schema.prisma:1115 — `Float`, pas `Float?`). Donc
  // `g.coefficient ?? g.subject.coefficient ?? 1` dans calculerMoyenne ne peut JAMAIS retomber
  // sur `g.subject.coefficient` : Prisma renvoie toujours un nombre concret pour g.coefficient,
  // jamais null/undefined. Cette branche de repli est du code mort en l'état actuel du schéma —
  // le coefficient de la matière (`Subject.coefficient`, utilisé ailleurs pour l'AFFICHAGE côté
  // frontend, cf. SectionStudentGrades.tsx:134) n'est donc PAS automatiquement récupéré par ce
  // calcul. C'est pourquoi ces tests fixent `coefficient` directement sur `Grade`, seul chemin
  // réellement atteignable — pas sur `Subject`, qui ne changerait rien au résultat.
  it('moyenne pondérée nominale sur plusieurs matières (coefficient porté par Grade)', async () => {
    await definirModeCalcul('single');
    const subjectMaths = await prismaTest.subject.create({ data: { schoolId, name: 'Maths (moy)' } });
    const subjectFr = await prismaTest.subject.create({ data: { schoolId, name: 'Français (moy)' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });

    await prismaTest.grade.create({ data: { schoolId, studentId: student.id, subjectId: subjectMaths.id, classId, academicYearId, sequenceId, sequenceAverage: 15, coefficient: 3, validationStatus: 'LOCKED' } });
    await prismaTest.grade.create({ data: { schoolId, studentId: student.id, subjectId: subjectFr.id, classId, academicYearId, sequenceId, sequenceAverage: 10, coefficient: 2, validationStatus: 'LOCKED' } });

    const res = await fetch(`${baseUrl}/grades/average/${student.id}?classId=${classId}&sequenceId=${sequenceId}`, { headers: authHeaders() });
    const body = await res.json() as { average: number };
    // (15*3 + 10*2) / (3+2) = 65/5 = 13
    expect(body.average).toBe(13);
  });

  it('coefficient 0 sur une note : celle-ci est exclue du calcul (bout en bout, régression du câblage GradingEngine)', async () => {
    const subjectExclue = await prismaTest.subject.create({ data: { schoolId, name: 'Matière coeff 0' } });
    const subjectNormale = await prismaTest.subject.create({ data: { schoolId, name: 'Matière normale' } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });

    await prismaTest.grade.create({ data: { schoolId, studentId: student.id, subjectId: subjectExclue.id, classId, academicYearId, sequenceId, sequenceAverage: 18, coefficient: 0, validationStatus: 'LOCKED' } });
    await prismaTest.grade.create({ data: { schoolId, studentId: student.id, subjectId: subjectNormale.id, classId, academicYearId, sequenceId, sequenceAverage: 10, coefficient: 2, validationStatus: 'LOCKED' } });

    const res = await fetch(`${baseUrl}/grades/average/${student.id}?classId=${classId}&sequenceId=${sequenceId}`, { headers: authHeaders() });
    const body = await res.json() as { average: number };
    // La note à coefficient 0 (moyenne 18) ne doit pas peser dans le calcul : seule la note à
    // coefficient 2 (moyenne 10) doit compter → moyenne = 10, pas une pondération des deux.
    expect(body.average).toBe(10);
  });

  it('aucune note validée pour cette séquence → {average:0, rank:0, totalStudents:0}', async () => {
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });

    const res = await fetch(`${baseUrl}/grades/average/${student.id}?classId=${classId}&sequenceId=${sequenceId}`, { headers: authHeaders() });
    const body = await res.json();
    expect(body).toEqual({ average: 0, rank: 0, totalStudents: 0 });
  });

  it('classement correct entre plusieurs élèves de la même séquence', async () => {
    // Séquence dédiée à ce test : le classement (`rank`/`totalStudents`) est calculé par un
    // groupBy sur {schoolId, classId, sequenceId} — le réutiliser aurait mélangé les élèves des
    // tests précédents de ce describe (moyenne nominale, coefficient 0) dans le classement.
    const periodeClassement = await prismaTest.academicPeriod.create({
      data: { academicYearId, name: 'Trimestre Classement', orderIndex: 99, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-20') },
    });
    const sequenceClassement = await prismaTest.academicSequence.create({
      data: { academicPeriodId: periodeClassement.id, schoolId, name: 'Séquence Classement', type: 'DS', orderIndex: 1 },
    });

    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Matière classement', coefficient: 1 } });
    const eleveFort = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const eleveMoyen = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const eleveFaible = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });

    await prismaTest.grade.create({ data: { schoolId, studentId: eleveFort.id, subjectId: subject.id, classId, academicYearId, sequenceId: sequenceClassement.id, sequenceAverage: 18, validationStatus: 'LOCKED' } });
    await prismaTest.grade.create({ data: { schoolId, studentId: eleveMoyen.id, subjectId: subject.id, classId, academicYearId, sequenceId: sequenceClassement.id, sequenceAverage: 12, validationStatus: 'LOCKED' } });
    await prismaTest.grade.create({ data: { schoolId, studentId: eleveFaible.id, subjectId: subject.id, classId, academicYearId, sequenceId: sequenceClassement.id, sequenceAverage: 6, validationStatus: 'LOCKED' } });

    const res = await fetch(`${baseUrl}/grades/average/${eleveMoyen.id}?classId=${classId}&sequenceId=${sequenceClassement.id}`, { headers: authHeaders() });
    const body = await res.json() as { average: number; rank: number; totalStudents: number };
    expect(body.average).toBe(12);
    expect(body.rank).toBe(2);
    expect(body.totalStudents).toBe(3);
  });
});

describe('Scénario B — le coefficient de la matière est stampé sur la note (SaisirNoteUseCase / modifier)', () => {
  it("POST /grades (création réelle, pas un raccourci de fixture) stampe le coefficient de la matière sur la note", async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'SVT (stamping)', coefficient: 3 } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });

    const res = await fetch(`${baseUrl}/grades`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        studentId: student.id, subjectId: subject.id, classId, academicYearId, sequenceId,
        sequenceScore: 12,
      }),
    });
    expect(res.status).toBe(201);

    const grade = await prismaTest.grade.findFirst({ where: { studentId: student.id, subjectId: subject.id, sequenceId } });
    expect(grade?.coefficient).toBe(3);
  });

  it("pipeline complet : POST /grades (création réelle) → GET /grades/average reflète correctement le poids de la matière", async () => {
    // Contrairement aux tests de calculerMoyenne plus haut (qui fixent coefficient directement
    // sur Grade via prismaTest, en connaissance du bug historique), ce test passe par la VRAIE
    // route de création — c'est la vérification de bout en bout du correctif scénario B.
    await definirModeCalcul('single');
    const subjectFort = await prismaTest.subject.create({ data: { schoolId, name: 'Maths (pipeline)', coefficient: 4 } });
    const subjectFaible = await prismaTest.subject.create({ data: { schoolId, name: 'Dessin (pipeline)', coefficient: 1 } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });

    // Notes saisies via la vraie route — le coefficient n'est JAMAIS passé dans le body,
    // exactement comme le fait le frontend aujourd'hui. sequenceAverage n'est calculé qu'au
    // premier PUT (calculerMoyenneSequence ne vit que dans `modifier`, pas dans `saisir`) — donc
    // un cycle POST puis PUT, qui reflète le vrai flux (saisie brute, puis calcul de la moyenne
    // de séquence), est nécessaire ici pour obtenir un sequenceAverage exploitable.
    const c1 = await fetch(`${baseUrl}/grades`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ studentId: student.id, subjectId: subjectFort.id, classId, academicYearId, sequenceId, sequenceScore: 16 }),
    });
    const { data: d1 } = await c1.json() as { data: { noteId: string } };
    await modifierNote(d1.noteId, { sequenceScore: 16 });

    const c2 = await fetch(`${baseUrl}/grades`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ studentId: student.id, subjectId: subjectFaible.id, classId, academicYearId, sequenceId, sequenceScore: 6 }),
    });
    const { data: d2 } = await c2.json() as { data: { noteId: string } };
    await modifierNote(d2.noteId, { sequenceScore: 6 });

    // Verrouiller les deux notes pour qu'elles comptent dans calculerMoyenne (LOCKED requis)
    await prismaTest.grade.updateMany({ where: { id: { in: [d1.noteId, d2.noteId] } }, data: { validationStatus: 'LOCKED' } });

    const res = await fetch(`${baseUrl}/grades/average/${student.id}?classId=${classId}&sequenceId=${sequenceId}`, { headers: authHeaders() });
    const body = await res.json() as { average: number };
    // (16*4 + 6*1) / (4+1) = (64+6)/5 = 70/5 = 14 — preuve que la pondération réelle par matière
    // s'applique désormais de bout en bout (création → agrégation), pas seulement en théorie.
    expect(body.average).toBe(14);
  });

  it("PUT /grades/:id (modification en DRAFT) re-stampe le coefficient si celui de la matière a changé depuis la création", async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Physique (restamp)', coefficient: 2 } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });

    const createRes = await fetch(`${baseUrl}/grades`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ studentId: student.id, subjectId: subject.id, classId, academicYearId, sequenceId, sequenceScore: 10 }),
    });
    const created = await createRes.json() as { data: { noteId: string } };
    let grade = await prismaTest.grade.findUnique({ where: { id: created.data.noteId } });
    expect(grade?.coefficient).toBe(2);

    // Le coefficient officiel de la matière change APRÈS la création de la note (encore DRAFT)
    await prismaTest.subject.update({ where: { id: subject.id }, data: { coefficient: 5 } });

    await modifierNote(created.data.noteId, { sequenceScore: 11 });
    grade = await prismaTest.grade.findUnique({ where: { id: created.data.noteId } });
    // Note toujours DRAFT à ce stade → re-stampée avec la nouvelle valeur en vigueur (5).
    expect(grade?.coefficient).toBe(5);
  });

  it("une fois LOCKED, le coefficient reste figé même si celui de la matière change ensuite (verrouillage post-publication)", async () => {
    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Chimie (verrou)', coefficient: 2 } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });

    const grade = await prismaTest.grade.create({
      data: { schoolId, studentId: student.id, subjectId: subject.id, classId, academicYearId, sequenceId, sequenceAverage: 15, coefficient: 2, validationStatus: 'LOCKED' },
    });

    // Le coefficient officiel de la matière change APRÈS validation de la note
    await prismaTest.subject.update({ where: { id: subject.id }, data: { coefficient: 6 } });

    // Tentative de modification bloquée (loi 6 déjà en place, hors périmètre de ce correctif) —
    // ce test documente que le seul chemin de re-stamping (PUT /grades/:id) est justement celui
    // qui devient inaccessible dès LOCKED, donc le coefficient ne peut plus jamais changer.
    const res = await fetch(`${baseUrl}/grades/${grade.id}`, {
      method: 'PUT', headers: authHeaders(), body: JSON.stringify({ sequenceScore: 16 }),
    });
    expect(res.status).toBe(409);

    const toujoursFige = await prismaTest.grade.findUnique({ where: { id: grade.id } });
    expect(toujoursFige?.coefficient).toBe(2);
  });
});

describe("Bulletin (GenererBulletinUseCase) — vérification via le VRAI flux de saisie (draftEnMasse, pas saisir/modifier)", () => {
  it("la moyenne générale du bulletin reflète correctement la pondération par coefficient de matière", async () => {
    // Isolation totale (classe/période/séquence dédiées) : la génération de bulletin calcule
    // aussi les rangs sur TOUTE la classe, il ne faut aucune pollution des tests précédents.
    const classeBulletin = await prismaTest.class.create({ data: { schoolId, name: '3ème Bulletin', academicYearId } });
    const periodeBulletin = await prismaTest.academicPeriod.create({
      data: { academicYearId, name: 'Trimestre Bulletin', orderIndex: 1, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-20') },
    });
    const sequenceBulletin = await prismaTest.academicSequence.create({
      data: { academicPeriodId: periodeBulletin.id, schoolId, name: 'Séquence Bulletin', type: 'DS', orderIndex: 1 },
    });

    const subjectFort = await prismaTest.subject.create({ data: { schoolId, name: 'Maths (bulletin)', coefficient: 4 } });
    const subjectFaible = await prismaTest.subject.create({ data: { schoolId, name: 'Dessin (bulletin)', coefficient: 1 } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    await creerEleveAvecClasse(enrollmentRepo, { userId: student.id, classId: classeBulletin.id, enrolledById: student.id });

    // 1. Saisie via le VRAI flux enseignant (grille de saisie en masse), pas saisir/modifier —
    //    c'est ce que le frontend appelle réellement (POST /grades/draft, un appel par matière).
    await fetch(`${baseUrl}/grades/draft`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        classId: classeBulletin.id, subjectId: subjectFort.id, sequenceId: sequenceBulletin.id,
        grades: [{ studentId: student.id, value: 16 }],
      }),
    });
    await fetch(`${baseUrl}/grades/draft`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        classId: classeBulletin.id, subjectId: subjectFaible.id, sequenceId: sequenceBulletin.id,
        grades: [{ studentId: student.id, value: 6 }],
      }),
    });

    // 2. Validation (le mécanisme HTTP de soumission/validation ne touche ni sequenceAverage ni
    //    coefficient — déjà vérifié par ailleurs — donc mise à jour directe équivalente ici).
    await prismaTest.grade.updateMany({
      where: { classId: classeBulletin.id, sequenceId: sequenceBulletin.id, studentId: student.id },
      data: { validationStatus: 'LOCKED' },
    });

    // 3. Conseil de classe verrouillé (Loi 5b, prérequis de génération)
    await prismaTest.classCouncilSession.create({
      data: { schoolId, classId: classeBulletin.id, academicPeriodId: periodeBulletin.id, presidedById: (await prismaTest.user.findFirstOrThrow({ where: { schoolId, role: 'ADMIN' } })).id, status: 'LOCKED' },
    });

    // 4. Génération réelle du bulletin
    const res = await fetch(`${baseUrl}/report-cards/generate`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ classId: classeBulletin.id, academicPeriodId: periodeBulletin.id, academicYearId }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const reportCard = await prismaTest.reportCard.findFirst({ where: { studentId: student.id, academicPeriodId: periodeBulletin.id } });
    // (16×4 + 6×1) / (4+1) = 70/5 = 14 — si ce test échoue avec la moyenne simple (11), c'est que
    // draftEnMasse (flux réel) ne bénéficie pas du câblage scénario B, contrairement à
    // saisir/modifier (flux singulier, non utilisé par le frontend).
    expect(reportCard?.generalAverage).toBe(14);

    const ligneMaths = await prismaTest.reportCardSubjectLine.findFirst({ where: { reportCardId: reportCard!.id, subjectName: 'Maths (bulletin)' } });
    expect(ligneMaths?.coefficient).toBe(4);
  });
});

describe("GradeController.importerDepuisExcel — troisième voie de saisie, stampe désormais le coefficient", () => {
  it("POST /grades/import stampe Subject.coefficient sur les notes créées via le fichier Excel", async () => {
    const classeImport = await prismaTest.class.create({ data: { schoolId, name: '4ème Import', academicYearId } });
    const subjectImport = await prismaTest.subject.create({ data: { schoolId, name: 'SVT (import)', coefficient: 3 } });
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    await creerEleveAvecClasse(enrollmentRepo, { userId: student.id, classId: classeImport.id, enrolledById: student.id, extraProfileData: { matricule: 'IMP0001' } });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['matricule', 'note', 'observation'],
      ['IMP0001', 15, 'RAS'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Notes');
    const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const form = new FormData();
    form.append('classId', classeImport.id);
    form.append('subjectId', subjectImport.id);
    form.append('sequenceId', sequenceId);
    form.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'notes.xlsx');

    const res = await fetch(`${baseUrl}/grades/import`, {
      method: 'POST',
      headers: { Cookie: `access_token=${adminToken}` },
      body: form,
    });
    const body = await res.json() as { success: boolean; message?: string; imported?: number; errors?: unknown[] };

    if (!body.success) throw new Error(`Échec import Excel : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.imported).toBe(1);
    expect(body.errors).toEqual([]);

    const grade = await prismaTest.grade.findFirst({ where: { studentId: student.id, subjectId: subjectImport.id, sequenceId } });
    expect(grade?.coefficient).toBe(3);
    expect(grade?.sequenceScore).toBe(15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Croisement Grade/Attendance : un absent avec note ne fausse ni moyenne ni classement
// ═══════════════════════════════════════════════════════════════════════════════

describe('Croisement Grade/Attendance — un absent avec note ne fausse ni moyenne ni classement', () => {
  let elevePresentId: string;
  let eleveAbsentId: string;
  let subjectId: string;
  let testClassId: string;
  let testSequenceId: string;

  beforeAll(async () => {
    // Classe isolée pour ce test — sinon le classement est pollué par les élèves
    // des tests précédents qui partagent la même classe (rank global).
    const testClass = await prismaTest.class.create({ data: { schoolId, name: '3ème Absence', academicYearId } });
    testClassId = testClass.id;
    const testPeriode = await prismaTest.academicPeriod.create({
      data: { academicYearId, name: 'Trimestre Absence', orderIndex: 90, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-20') },
    });
    const testSequence = await prismaTest.academicSequence.create({
      data: { academicPeriodId: testPeriode.id, schoolId, name: 'Séquence Absence', type: 'DS', orderIndex: 1 },
    });
    testSequenceId = testSequence.id;

    // Créer 2 élèves + 1 matière
    const elevePresent = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'present' });
    elevePresentId = elevePresent.id;
    await creerEleveAvecClasse(enrollmentRepo, { userId: elevePresent.id, classId: testClassId, enrolledById: elevePresent.id });

    const eleveAbsent = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'absent' });
    eleveAbsentId = eleveAbsent.id;
    await creerEleveAvecClasse(enrollmentRepo, { userId: eleveAbsent.id, classId: testClassId, enrolledById: eleveAbsent.id });

    const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Maths Absence Test', coefficient: 2 } });
    subjectId = subject.id;

    // Notes DIFFÉRENTES pour prouver l'effet :
    // - Élève présent : 14/20
    // - Élève absent (isAbsentGrade) : 18/20 — PLUS ÉLEVÉ, pour prouver qu'un absent ne peut
    //   pas se placer au-dessus d'un présent dans le classement.
    await prismaTest.grade.create({
      data: { schoolId, studentId: elevePresentId, subjectId, classId: testClassId, academicYearId, sequenceId: testSequenceId, sequenceAverage: 14, coefficient: 2, validationStatus: 'LOCKED' },
    });
    await prismaTest.grade.create({
      data: { schoolId, studentId: eleveAbsentId, subjectId, classId: testClassId, academicYearId, sequenceId: testSequenceId, sequenceAverage: 18, coefficient: 2, validationStatus: 'LOCKED', isAbsentGrade: true },
    });

    // Participation : eleveAbsent est ABSENT à l'évaluation
    const scope = await prismaTest.assessmentScope.create({
      data: { schoolId, academicYearId, name: 'Test Scope', sequenceType: 'DS', subjectIds: [subjectId], classIds: [testClassId] },
    });
    const session = await prismaTest.harmonizedAssessmentSession.create({
      data: { schoolId, assessmentScopeId: scope.id, subjectId, classId: testClassId, scheduledDate: new Date(), status: 'COMPLETED' },
    });
    await prismaTest.assessmentParticipation.create({
      data: { schoolId, harmonizedAssessmentSessionId: session.id, studentId: elevePresentId, status: 'PRESENT' },
    });
    await prismaTest.assessmentParticipation.create({
      data: { schoolId, harmonizedAssessmentSessionId: session.id, studentId: eleveAbsentId, status: 'ABSENT' },
    });
  });

  it('le présent garde sa moyenne intacte (14/20) — le 18/20 de l\'absent est exclu', async () => {
    const res = await fetch(`${baseUrl}/grades/average/${elevePresentId}?classId=${testClassId}&sequenceId=${testSequenceId}`, { headers: authHeaders() });
    const body = await res.json() as { average: number };
    expect(body.average).toBe(14);
  });

  it('le 18/20 de l\'absent ne le place PAS au-dessus du présent — le présent reste classé 1er', async () => {
    // Sans l'exclusion, l'absent (18/20) serait classé 1er et le présent (14/20) 2e.
    // Avec l'exclusion, le présent reste 1er sur le seul élève réellement présent.
    const res = await fetch(`${baseUrl}/grades/average/${elevePresentId}?classId=${testClassId}&sequenceId=${testSequenceId}`, { headers: authHeaders() });
    const body = await res.json() as { rank: number };
    expect(body.rank).toBe(1);
  });

  it('l\'absent a bien isAbsentGrade=true en base', async () => {
    const grade = await prismaTest.grade.findFirst({ where: { studentId: eleveAbsentId, subjectId, sequenceId: testSequenceId } });
    expect(grade?.isAbsentGrade).toBe(true);
  });
});
