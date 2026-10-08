import type { Request, Response, NextFunction } from 'express';
import { generateWithGroq } from '../../services/ai/GroqClient.ts';
import { resolveLanguage, type Language } from '../../../domain/policies/LanguagePolicy';
import { instructionLangue } from '../../services/ai/prompts/LanguagePrompt';
import type { CompareRisquePredictionsUseCase } from '@application/ai/CompareRisquePredictionsUseCase';
import type { CalculerIndiceSanteUseCase } from '@application/ai/CalculerIndiceSanteUseCase';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import type { AIContextQueryRepository } from '@domain/ports/repositories/AIContextQueryRepository';
import type { PrismaClient } from '@prisma/client';
import { getClassIdActuelEleve } from '@application/shared/studentEnrollment';

export class AIController {
  constructor(
    private readonly contextRepo: AIContextQueryRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly compareRisquePredictions?: CompareRisquePredictionsUseCase,
    private readonly calculerIndiceSante?: CalculerIndiceSanteUseCase,
    private readonly prisma?: PrismaClient,
  ) {}

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

  /**
   * Gate pour les vues "tous les élèves d'une classe/école" (pas un élève précis) : seuls ADMIN
   * et STAFF avec VALIDATE_GRADES (censeur) ont un motif légitime de parcourir une liste — les
   * autres rôles ont leurs propres routes déjà scopées (getAtRiskStudentsForTeacher,
   * getHealthTracking), jamais besoin de la vue large.
   */
  private peutVoirVueEnsembleSante(user: { role: string; permissions?: string[] }): boolean {
    const role = user.role.toUpperCase();
    if (role === 'ADMIN') return true;
    if (role === 'STAFF') return Array.isArray(user.permissions) && user.permissions.includes('VALIDATE_GRADES');
    return false;
  }

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

  getStudentsHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;

      if (!this.peutVoirVueEnsembleSante(req.user!)) {
        res.status(403).json({ message: 'Accès réservé à la direction et au personnel habilité' });
        return;
      }

      let students = await this.contextRepo.findStudentsByClass(schoolId, classId);

      // Recalcul à la demande (ex: clic sur "Actualiser les scores" sur le dashboard)
      if (req.query.recalculate === 'true' && this.calculerIndiceSante && this.prisma) {
        try {
          const currentYear = await this.prisma.academicYear.findFirst({
            where: { schoolId, isCurrent: true },
            select: { id: true },
          });
          if (currentYear) {
            for (const s of students) {
              try {
                await this.calculerIndiceSante.calculerScoreSeulement(s.userId, schoolId, currentYear.id);
              } catch {
                // Best-effort par élève
              }
            }
            students = await this.contextRepo.findStudentsByClass(schoolId, classId);
          }
        } catch {
          // Repli gracieux
        }
      }

      const categorized = students.map((s) => {
        const score = s.healthScore ?? 75;
        const alertLevel =
          score <= 30 ? 'critical' : score <= 50 ? 'warning' : score <= 70 ? 'recommendation' : score <= 85 ? 'good' : 'excellent';
        return { studentId: s.userId, name: `${s.firstName} ${s.lastName}`, className: s.className ?? '—', healthScore: score, alertLevel };
      });

      res.json({
        students: categorized,
        summary: {
          critical: categorized.filter((s) => s.alertLevel === 'critical').length,
          warning: categorized.filter((s) => s.alertLevel === 'warning').length,
          recommendation: categorized.filter((s) => s.alertLevel === 'recommendation').length,
          good: categorized.filter((s) => s.alertLevel === 'good').length,
          excellent: categorized.filter((s) => s.alertLevel === 'excellent').length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/ai/at-risk-students — vue enseignant : élèves à risque dans SES classes/matières
  // uniquement (TeachingAssignment + classe(s) dont il est professeur principal), avec le conseil
  // IA déjà généré et persisté pour lui (StudentRecommendation, recipientRole=TEACHER) — jamais
  // de nouvel appel Groq ici, uniquement de la lecture.
  getAtRiskStudentsForTeacher = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const teacherId = req.user!.userId;

      const [assignments, ppClasses] = await Promise.all([
        this.contextRepo.findTeachingAssignmentsByTeacher(teacherId, schoolId),
        this.contextRepo.findClassesByProfesseurPrincipal(teacherId, schoolId),
      ]);
      const classIds = Array.from(new Set([...assignments.map((a) => a.classId), ...ppClasses.map((c) => c.id)]));
      if (classIds.length === 0) { res.json({ students: [], summary: { critical: 0, warning: 0 } }); return; }

      const ppClassIds = new Set(ppClasses.map((c) => c.id));
      // Matières enseignées par CE professeur, par classe — pour distinguer "professeur principal"
      // (autorité pleine, voir CreerActionSuiviEleveUseCase) de "enseignant de matière" (observation
      // seulement, restreinte à sa propre matière) sans jamais coder de rôle en dur.
      const mesMatieresParClasse = new Map<string, { id: string; name: string }[]>();
      for (const a of assignments) {
        const liste = mesMatieresParClasse.get(a.classId) ?? [];
        liste.push({ id: a.subjectId, name: a.subjectName });
        mesMatieresParClasse.set(a.classId, liste);
      }

      const config = await this.contextRepo.getSchoolConfig(schoolId);
      const warningThreshold = config?.aiRiskThreshold ?? 50;
      const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

      // Conseiller pédagogique présent dans ~15% des établissements secondaires publics
      // camerounais uniquement — le frontend masque "Signaler au conseiller" quand c'est absent,
      // plutôt que d'offrir une option qui ne mène nulle part (relecture juillet 2026).
      const conseillerPedagogiqueDisponible = (await this.contextRepo.countStaffWithPermission(
        schoolId,
        ['MANAGE_ORIENTATION', 'MANAGE_PEDAGOGICAL_BRIEF'],
      )) > 0;

      interface AtRiskEntry {
        studentId: string; name: string; classId: string | null; className: string;
        source: 'COMPOSITE' | 'SUBJECT_DROP';
        healthScore: number | null; alertLevel: 'critical' | 'warning' | null; subjectName: string | null;
        conseil: string | null; conseilDate: Date | null; recommendationId: string | null;
        isProfesseurPrincipal: boolean; mesMatieres: { id: string; name: string }[];
      }

      // Score composite — UNIQUEMENT sur les classes où l'enseignant est professeur principal
      // ("tout ce qui concerne les élèves de sa classe"). Un enseignant de matière ne doit jamais
      // voir le score général (absences, discipline, paiement ne le concernent pas) — relecture
      // juillet 2026.
      const ppClassIdList = Array.from(ppClassIds);
      const studentsComposite = ppClassIdList.length
        ? await this.contextRepo.findStudentsByClasses(ppClassIdList, { healthScoreLte: warningThreshold })
        : [];

      const studentIds = studentsComposite.map((s) => s.userId);
      const recommendations = studentIds.length
        ? await this.contextRepo.findStudentRecommendations({ studentIds, recipientRole: 'TEACHER' })
        : [];
      const dernierConseilParEleve = new Map<string, (typeof recommendations)[number]>();
      for (const r of recommendations) if (!dernierConseilParEleve.has(r.studentId)) dernierConseilParEleve.set(r.studentId, r);

      const resultComposite: AtRiskEntry[] = studentsComposite.map((s) => {
        const score: number = s.healthScore ?? 75;
        const alertLevel = score <= criticalThreshold ? 'critical' : 'warning';
        const conseil = dernierConseilParEleve.get(s.userId);
        return {
          studentId: s.userId,
          name: `${s.firstName} ${s.lastName}`,
          classId: s.classId,
          className: s.className ?? '—',
          source: 'COMPOSITE' as const,
          healthScore: score,
          alertLevel,
          subjectName: null as string | null,
          conseil: conseil?.content ?? null,
          conseilDate: conseil?.createdAt ?? null,
          recommendationId: conseil?.id ?? null,
          // Autorité pour le suivi (Partie B) : PP = pleine autorité, sinon liste de ses propres
          // matières dans cette classe = observation seulement, restreinte à l'une d'elles.
          isProfesseurPrincipal: s.classId !== null && ppClassIds.has(s.classId),
          mesMatieres: s.classId ? (mesMatieresParClasse.get(s.classId) ?? []) : [],
        };
      });

      // Chutes de matière — pour les classes où l'enseignant n'est QUE enseignant de matière
      // (jamais le score général, seulement ses propres chutes détectées dans sa propre matière).
      // Source : StudentRecommendation persistée par detecterChutePourNote (inngest/functions.ts),
      // fenêtre de 30 jours (choix raisonnable, non confirmé explicitement par l'utilisateur).
      const classIdsMatiereSeule = classIds.filter((id) => !ppClassIds.has(id));
      let resultSubjectDrop: AtRiskEntry[] = [];
      if (classIdsMatiereSeule.length > 0) {
        const elevesMatiereSeule = await this.contextRepo.findStudentsByClasses(classIdsMatiereSeule);
        const profilParEleve = new Map(elevesMatiereSeule.map((e) => [e.userId, e]));

        const depuis = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const chutes = profilParEleve.size
          ? await this.contextRepo.findStudentRecommendations({
              schoolId,
              studentIds: Array.from(profilParEleve.keys()),
              recipientRole: 'TEACHER',
              contextTypes: ['SUBJECT_DROP'],
              since: depuis,
            })
          : [];

        const vueParEleveMatiere = new Map<string, (typeof chutes)[number]>();
        for (const c of chutes) {
          const profil = profilParEleve.get(c.studentId);
          if (!profil || !c.subjectId) continue;
          // Ne garder que si CE professeur enseigne bien CETTE matière dans CETTE classe — pas la
          // chute d'un élève détectée pour un autre enseignant partageant la même classe.
          const classIdProfil = profil.classId;
          if (!classIdProfil) continue;
          const mesMatieresIci = mesMatieresParClasse.get(classIdProfil) ?? [];
          if (!mesMatieresIci.some((m) => m.id === c.subjectId)) continue;
          const cle = `${c.studentId}__${c.subjectId}`;
          if (!vueParEleveMatiere.has(cle)) vueParEleveMatiere.set(cle, c);
        }

        resultSubjectDrop = Array.from(vueParEleveMatiere.values()).map((c): AtRiskEntry => {
          const profil = profilParEleve.get(c.studentId)!;
          const classIdProfil = profil.classId;
          const matiere = (classIdProfil ? mesMatieresParClasse.get(classIdProfil) ?? [] : []).find((m) => m.id === c.subjectId);
          return {
            studentId: c.studentId,
            name: `${profil.firstName} ${profil.lastName}`,
            classId: classIdProfil ?? null,
            className: profil.className ?? '—',
            source: 'SUBJECT_DROP' as const,
            healthScore: null,
            alertLevel: null,
            subjectName: matiere?.name ?? null,
            conseil: c.content,
            conseilDate: c.createdAt,
            recommendationId: c.id,
            isProfesseurPrincipal: false,
            mesMatieres: classIdProfil ? mesMatieresParClasse.get(classIdProfil) ?? [] : [],
          };
        });
      }

      const result = [...resultComposite, ...resultSubjectDrop];

      res.json({
        students: result,
        summary: {
          critical: result.filter((r) => r.alertLevel === 'critical').length,
          warning: result.filter((r) => r.alertLevel === 'warning').length,
        },
        conseillerPedagogiqueDisponible,
      });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/ai/health-tracking — vue Parent (tous ses enfants) ou Élève (lui-même) du suivi
  // de santé scolaire : indice + dernier conseil IA persisté qui LEUR est destiné (recipientRole
  // PARENT ou STUDENT selon l'appelant — jamais le conseil destiné à l'enseignant). Même principe
  // de lecture seule que getAtRiskStudentsForTeacher : aucun appel Groq ici.
  getHealthTracking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const schoolId = user.schoolId;
      const role = user.role.toUpperCase();

      let cibles: { studentId: string; name: string; className: string }[] = [];

      if (role === 'STUDENT') {
        const profile = await this.contextRepo.findStudentProfile(user.userId, schoolId);
        if (!profile) { res.json({ children: [] }); return; }
        cibles = [{ studentId: user.userId, name: `${profile.firstName} ${profile.lastName}`, className: profile.className ?? '—' }];
      } else if (role === 'PARENT') {
        const children = await this.contextRepo.findParentChildren(user.userId);
        cibles = children.map((c) => ({
          studentId: c.studentId,
          name: `${c.firstName} ${c.lastName}`,
          className: c.className ?? '—',
        }));
      } else {
        res.status(403).json({ success: false, message: 'Accès réservé aux parents et élèves' });
        return;
      }

      if (cibles.length === 0) { res.json({ children: [] }); return; }

      const config = await this.contextRepo.getSchoolConfig(schoolId);
      const warningThreshold = config?.aiRiskThreshold ?? 50;
      const criticalThreshold = config?.aiRiskThresholdCritical ?? 30;

      const studentIds = cibles.map((c) => c.studentId);
      // contextType explicitement restreint aux conseils santé — sans ce filtre, une convocation
      // élève (StudentRecommendation contextType CONVOCATION, recipientRole STUDENT, voir
      // StudentFollowUpController.creer) plus récente qu'une vraie alerte santé écrasait le
      // "dernier conseil" affiché ici, masquant le conseil pédagogique tant qu'aucune nouvelle
      // alerte santé n'était générée (trouvé en revue de code). La convocation a désormais son
      // propre champ ci-dessous, distinct, jamais mélangé au conseil santé.
      const CONTEXT_TYPES_CONSEIL_SANTE = ['HEALTH_CRITICAL', 'HEALTH_WARNING', 'HEALTH_POSITIVE'];
      const depuisConvocation = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [scores, recommendations, convocations] = await Promise.all([
        this.contextRepo.findStudentHealthScores(studentIds),
        this.contextRepo.findStudentRecommendations({
          studentIds,
          recipientRole: role === 'STUDENT' ? 'STUDENT' : 'PARENT',
          contextTypes: CONTEXT_TYPES_CONSEIL_SANTE,
        }),
        // Convocations — élève uniquement, jamais destinées au parent (voir
        // StudentFollowUpController.creer). Fenêtre de 30 jours pour éviter d'afficher
        // indéfiniment une convocation dont la date est probablement déjà passée.
        role === 'STUDENT'
          ? this.contextRepo.findStudentRecommendations({
              studentIds,
              recipientRole: 'STUDENT',
              contextTypes: ['CONVOCATION'],
              since: depuisConvocation,
            })
          : Promise.resolve([]),
      ]);
      const scoreParEleve = new Map(scores.map((s) => [s.userId, s.healthScore ?? 75]));
      const dernierConseilParEleve = new Map<string, (typeof recommendations)[number]>();
      for (const r of recommendations) if (!dernierConseilParEleve.has(r.studentId)) dernierConseilParEleve.set(r.studentId, r);
      const derniereConvocationParEleve = new Map<string, (typeof convocations)[number]>();
      for (const c of convocations) if (!derniereConvocationParEleve.has(c.studentId)) derniereConvocationParEleve.set(c.studentId, c);

      const enfants = cibles.map((c) => {
        const score = scoreParEleve.get(c.studentId) ?? 75;
        const alertLevel = score <= criticalThreshold ? 'critical' : score <= warningThreshold ? 'warning' : 'good';
        const conseil = dernierConseilParEleve.get(c.studentId);
        const convocation = derniereConvocationParEleve.get(c.studentId);
        return {
          studentId: c.studentId,
          name: c.name,
          className: c.className,
          healthScore: score,
          alertLevel,
          conseil: conseil?.content ?? null,
          conseilDate: conseil?.createdAt ?? null,
          convocation: convocation ? { message: convocation.content, date: convocation.createdAt } : null,
        };
      });

      res.json({ children: enfants });
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
      const weakSubjects = (subjectLines || []).filter((s: any) => (s.subjectAverage ?? 0) < 10).map((s: any) => s.subjectName).slice(0, 3);
      const strongSubjects = (subjectLines || []).filter((s: any) => (s.subjectAverage ?? 0) >= 14).map((s: any) => s.subjectName).slice(0, 3);
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
