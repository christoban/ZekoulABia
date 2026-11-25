import type { Request, Response, NextFunction } from 'express';
import { generateWithGroq } from '../../services/ai/GroqClient.ts';
import { resolveLanguage, type Language } from '../../../domain/policies/LanguagePolicy';
import { instructionLangue } from '../../services/ai/prompts/LanguagePrompt';
import type { CompareRisquePredictionsUseCase } from '@application/ai/CompareRisquePredictionsUseCase';
import type { CalculerIndiceSanteUseCase } from '@application/ai/CalculerIndiceSanteUseCase';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import type { AIContextQueryRepository } from '@domain/ports/repositories/AIContextQueryRepository';
import { getClassIdActuelEleve } from '@application/shared/studentEnrollment';
import { AIHealthTrackingDelegate } from './helpers/AIHealthTrackingDelegate';

export class AIController {
  private readonly healthTrackingDelegate: AIHealthTrackingDelegate;

  constructor(
    private readonly contextRepo: AIContextQueryRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly compareRisquePredictions?: CompareRisquePredictionsUseCase,
    calculerIndiceSante?: CalculerIndiceSanteUseCase,
  ) {
    this.healthTrackingDelegate = new AIHealthTrackingDelegate(contextRepo, calculerIndiceSante);
  }

  /** Résout la langue de l'école courante (via son sous-système) pour les prompts Groq. */
  private async langueEcole(schoolId: string): Promise<Language> {
    const subsystem = await this.contextRepo.getLanguageSousSysteme(schoolId);
    return resolveLanguage(subsystem);
  }

  /**
   * Garde-fou de confidentialité (données de santé/risque scolaire — sensibles) : vérifie que
   * l'utilisateur authentifié a un lien légitime avec l'élève demandé, pas seulement qu'il est
   * connecté. Même principe que le scoping déjà appliqué dans getAtRiskStudentsForTeacher (via
   * TeachingAssignment/professorPrincipalId) et getHealthTracking (via ParentStudent), regroupé
   * ici pour être réutilisable par détectRisk et toute future route élève-par-élève. ADMIN et
   * STAFF avec la permission VALIDATE_GRADES (censeur — même permission que celle qui déclenche
   * déjà leur notification de risque critique, voir inngest/functions.ts) voient tout ; les
   * autres rôles doivent avoir un lien direct et vérifiable avec CET élève précis.
   */
  private async estAutoriseAVoirRisqueEleve(
    user: { userId: string; schoolId: string; role: string; permissions?: string[] },
    studentId: string,
  ): Promise<boolean> {
    const profile = await this.contextRepo.findStudentProfile(studentId, user.schoolId);
    if (!profile) return false;

    const role = user.role.toUpperCase();

    if (role === 'ADMIN') return true;

    // Permission portée par le JWT (voir AuthPayload/JwtTokenService) — même source que
    // authorizeSchool('perm:...'), pas de requête DB supplémentaire nécessaire.
    if (role === 'STAFF') {
      return Array.isArray(user.permissions) && user.permissions.includes('VALIDATE_GRADES');
    }

    if (role === 'TEACHER') {
      const classId = await getClassIdActuelEleve(this.enrollmentRepository, studentId);
      if (!classId) return false;
      const [assignment, estProfPrincipal] = await Promise.all([
        this.contextRepo.hasTeachingAssignment(user.userId, classId),
        this.contextRepo.isProfesseurPrincipal(classId, user.userId),
      ]);
      return assignment || estProfPrincipal;
    }

    if (role === 'PARENT') {
      return this.contextRepo.hasParentStudentLink(user.userId, studentId);
    }

    if (role === 'STUDENT') {
      return user.userId === studentId;
    }

    return false;
  }

  getStudentsHealth = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.healthTrackingDelegate.getStudentsHealth(req, res, next);

  getAtRiskStudentsForTeacher = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.healthTrackingDelegate.getAtRiskStudentsForTeacher(req, res, next);

  getHealthTracking = (req: Request, res: Response, next: NextFunction): Promise<void> =>
    this.healthTrackingDelegate.getHealthTracking(req, res, next);

  generateInsight = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const schoolId = user.schoolId;
      let prompt = '';
      let insight = '';

      if (user.role === 'ADMIN') {
        const [students, grades, attendance] = await Promise.all([
          this.contextRepo.countStudentProfiles(schoolId),
          this.contextRepo.getRecentValidatedGrades(schoolId),
          this.contextRepo.getAttendanceStatusCountsSince(schoolId, new Date(Date.now() - 7 * 86400000)),
        ]);
        // ponytail: simple avg, stdlib 1-liner — centralize when weighted coeffs diverge
        const avgGrade = grades.length ? (grades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / grades.length).toFixed(1) : 'N/A';
        const present = attendance.find((a) => a.status === 'PRESENT')?._count ?? 0;
        const total = attendance.reduce((s, a) => s + a._count, 0);
        const attendanceRate = total ? ((present / total) * 100).toFixed(1) : 'N/A';
        prompt = `Tu es conseiller pédagogique pour un établissement scolaire camerounais.\nDonnées : ${students} élèves, moyenne ${avgGrade}/20, présence ${attendanceRate}% (7j).\nGénère un insight pédagogique concis (2-3 phrases) avec une recommandation actionnable.`;

      } else if (user.role === 'TEACHER') {
        const profile = await this.contextRepo.findTeacherProfileWithSubjects(user.userId);
        const subjects = profile?.teacherSubjects.map((ts) => ts.subject.name).join(', ') || 'non spécifié';
        prompt = `Tu es conseiller pédagogique. Un enseignant de ${subjects} dans un lycée camerounais demande un conseil pédagogique. Donne 2-3 recommandations concrètes adaptées au contexte camerounais.`;

      } else if (user.role === 'STUDENT') {
        const grades = await this.contextRepo.findRecentGradesByStudent(schoolId, user.userId);
        const summary = grades.map((g) => `${g.subject.name}: ${g.sequenceAverage ?? 0}/20`).join(', ');
        prompt = `Tu es un tuteur bienveillant pour un lycéen camerounais. Ses dernières notes : ${summary || 'pas encore de notes'}. Donne un encouragement et un conseil pratique (2-3 phrases).`;

      } else {
        insight = "Les insights IA ne sont pas disponibles pour ce rôle.";
      }

      if (prompt) {
        const lang = await this.langueEcole(schoolId);
        insight = await generateWithGroq(prompt, instructionLangue(lang));
      }
      res.json({ success: true, insight, timestamp: new Date() });
    } catch (error) {
      next(error);
    }
  };

  generateBulletinComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { studentName, average, mention, subjectLines, className } = req.body;
      if (!studentName || average === undefined) {
        res.status(400).json({ message: 'studentName et average requis' });
        return;
      }
      const lignes = (subjectLines ?? []) as { subjectAverage?: number; subjectName?: string }[];
      const weakSubjects = lignes.filter((s) => (s.subjectAverage ?? 0) < 10).map((s) => s.subjectName).slice(0, 3);
      const strongSubjects = lignes.filter((s) => (s.subjectAverage ?? 0) >= 14).map((s) => s.subjectName).slice(0, 3);
      // Le commentaire doit être dans la langue DU BULLETIN. Si l'appelant (frontend) connaît la
      // langue du template, il peut la passer en `language` ; sinon on la déduit du sous-système.
      const bodyLang = req.body.language;
      const lang: Language = bodyLang === 'fr' || bodyLang === 'en' ? bodyLang : await this.langueEcole(req.user!.schoolId);
      const clauseLangue = lang === 'fr' ? 'En français' : 'In English';
      const prompt = `Tu es un professeur principal dans un lycée camerounais.\nGénère un commentaire de bulletin bienveillant pour :\n- Élève : ${studentName}, Classe : ${className || 'N/A'}\n- Moyenne : ${average}/20, Mention : ${mention || 'N/A'}\n- Points forts : ${strongSubjects.join(', ') || 'aucun'}\n- À améliorer : ${weakSubjects.join(', ') || 'aucun'}\n${clauseLangue}, 2-4 phrases, encourageant, adapté au contexte camerounais.`;
      const comment = await generateWithGroq(prompt, instructionLangue(lang));
      res.json({ comment });
    } catch (error) {
      next(error);
    }
  };

  chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { message } = req.body;
      if (!message?.trim()) {
        res.status(400).json({ message: 'Message requis' });
        return;
      }
      const lang = await this.langueEcole(req.user!.schoolId);
      const systemPrompt = `Tu es l'assistant pédagogique d'ZekoulABia pour les établissements scolaires camerounais (système MINESEC). Réponds de façon concise et pratique. Pour les questions simples, 1 à 4 phrases. Pour les procédures, 3 à 5 étapes maximum. ${instructionLangue(lang)}`;
      const response = await generateWithGroq(message, systemPrompt);
      res.json({ success: true, response, timestamp: new Date() });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/assistant/chat — Assistant ZekoulABia contextualisé (dashboard admin)
  // Injecte la structure réelle de l'établissement dans le prompt pour des réponses pertinentes.
  assistantChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { message } = req.body as { message?: string };
      if (!message?.trim()) {
        res.status(400).json({ success: false, message: 'Message requis' });
        return;
      }

      const [school, classes, subjects, departments, periods] = await Promise.all([
        this.contextRepo.findSchoolById(schoolId),
        this.contextRepo.findClassesBySchool(schoolId),
        this.contextRepo.findSubjectsBySchool(schoolId),
        this.contextRepo.findDepartmentsBySchool(schoolId),
        this.contextRepo.findCurrentPeriods(schoolId),
      ]);

      const classList = classes.map((c) => c.name).join(', ') || 'aucune classe';
      const subjectList = subjects.map((s) => `${s.name} (coeff ${s.coefficient})`).join(', ') || 'aucune matière';
      const deptList = departments.map((d) => d.name).join(', ') || 'aucun département';
      const periodList = periods.map((p) => p.name).join(', ') || 'non configurées';

      const contexte =
        `Établissement : ${school?.name ?? 'N/A'} (sous-système ${school?.subsystem ?? 'N/A'}, type ${school?.educationType ?? 'N/A'}, template ${school?.templateCode ?? 'N/A'}).\n` +
        `Classes (${classes.length}) : ${classList}.\n` +
        `Matières (${subjects.length}) : ${subjectList}.\n` +
        `Départements : ${deptList}.\n` +
        `Périodes de l'année en cours : ${periodList}.`;

      const systemPrompt =
        `Tu es l'Assistant ZekoulABia, intégré au tableau de bord d'un administrateur scolaire camerounais (système MINESEC). ` +
        `Tu connais la configuration réelle de SON établissement (ci-dessous) et tu t'appuies dessus pour répondre de façon précise et contextualisée. ` +
        `Aide-le à utiliser la plateforme, à affiner sa configuration (ajouter une classe, une matière…), et à démarrer ses premières opérations. ` +
        `${instructionLangue(resolveLanguage(school?.subsystem))} Réponds de façon concise et pratique (1 à 5 phrases, ou 3 à 5 étapes pour une procédure). ` +
        `Ne fabrique jamais de données : si une information n'est pas dans le contexte, dis-le.\n\n` +
        `── Contexte de l'établissement ──\n${contexte}`;

      const response = await generateWithGroq(message, systemPrompt);
      res.json({ success: true, response, timestamp: new Date() });
    } catch (error) {
      next(error);
    }
  };

  detectRisk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const studentId = req.params.studentId as string;
      const since30d = new Date(Date.now() - 30 * 86400000);

      if (!(await this.estAutoriseAVoirRisqueEleve(req.user!, studentId))) {
        res.status(403).json({ message: 'Vous n\'avez pas accès aux données de cet élève' });
        return;
      }

      const [grades, attendance, studentProfile] = await Promise.all([
        this.contextRepo.findGradesByStudent(schoolId, studentId),
        this.contextRepo.findAttendanceStatuses(schoolId, studentId, since30d),
        this.contextRepo.findStudentProfile(studentId, schoolId),
      ]);

      if (!studentProfile) { res.status(404).json({ message: 'Élève introuvable' }); return; }

      // ponytail: simple avg, stdlib 1-liner — centralize when weighted coeffs diverge
      const avgGrade = grades.length ? grades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / grades.length : 0;
      const absentCount = attendance.filter((a) => a.status === 'ABSENT').length;
      const attendanceRate = attendance.length ? ((attendance.length - absentCount) / attendance.length) * 100 : 100;
      const weakSubjects = grades.filter((g) => (g.sequenceAverage ?? 0) < 10).map((g) => g.subjectName);

      let riskScore = 0;
      if (avgGrade < 10) riskScore += 40; else if (avgGrade < 12) riskScore += 20;
      if (attendanceRate < 70) riskScore += 35; else if (attendanceRate < 85) riskScore += 15;
      riskScore += Math.min(25, weakSubjects.length * 5);

      const prompt = `Élève : ${studentProfile.firstName} ${studentProfile.lastName}\nMoyenne : ${avgGrade.toFixed(1)}/20\nPrésence : ${attendanceRate.toFixed(1)}%\nMatières difficiles : ${weakSubjects.slice(0, 3).join(', ') || 'aucune'}\nScore risque : ${riskScore}/100\n\nAnalyse en 3 parties : 1. Diagnostic (1 phrase) 2. Facteurs de risque (2-3 points) 3. Recommandations concrètes (2-3 actions)`;
      const lang = await this.langueEcole(schoolId);
      const analysis = await generateWithGroq(prompt, `Tu es un expert en psychologie scolaire pour lycées camerounais. Sois bienveillant mais honnête. ${instructionLangue(lang)}`);

      res.json({
        studentName: `${studentProfile.firstName} ${studentProfile.lastName}`,
        riskScore,
        riskLevel: riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low',
        avgGrade: avgGrade.toFixed(1),
        attendanceRate: attendanceRate.toFixed(1),
        weakSubjects: weakSubjects.slice(0, 5),
        analysis,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/ai/compare-risk-predictions/:studentId — ADMIN uniquement, outil interne
  // (Partie B du plan, B.6.6) : compare la prédiction RULES (production) à TABPFN (expérimental)
  // sur les données courantes du même élève. Ne pilote rien — lecture seule à but d'observation.
  comparerRisquePredictions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.compareRisquePredictions) {
        res.status(503).json({ message: 'Outil de comparaison non configuré' });
        return;
      }
      const schoolId = req.user!.schoolId;
      const studentId = req.params.studentId as string;

      const anneeCourante = await this.contextRepo.findCurrentAcademicYear(schoolId);
      if (!anneeCourante) { res.status(404).json({ message: 'Aucune année académique courante' }); return; }

      const resultat = await this.compareRisquePredictions.execute({
        studentId, schoolId, academicYearId: anneeCourante.id,
      });
      res.json(resultat);
    } catch (error) {
      next(error);
    }
  };
}
