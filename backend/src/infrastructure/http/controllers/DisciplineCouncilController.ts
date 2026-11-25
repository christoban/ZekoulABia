import type { Request, Response, NextFunction } from 'express';
import type { DisciplineRepository } from '@domain/ports/repositories/DisciplineRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import { ConvoquerConseilDisciplineUseCase, type CompositionConseil } from '@application/discipline/ConvoquerConseilDisciplineUseCase';
import { TenirConseilDisciplineUseCase } from '@application/discipline/TenirConseilDisciplineUseCase';
import { generatePVConseilDisciplinePdf } from '../../pdf/discipline/DisciplineCouncilMinutesPdfRenderer';

/**
 * Préfixe /api/v2/discipline-council (MODULE 13/17, Art. 30 — chantier Juillet 2026).
 * Voir aussi POST /api/v2/discipline (hexagonal.bootstrap.ts), qui refuse désormais la
 * création directe des types COUNCIL_DECISION/PERMANENT_EXCLUSION et redirige vers ce workflow.
 */
export class DisciplineCouncilController {
  private readonly convoquer: ConvoquerConseilDisciplineUseCase;
  private readonly tenir: TenirConseilDisciplineUseCase;

  constructor(
    private readonly disciplineRepo: DisciplineRepository,
    private readonly schoolRepository: SchoolRepository,
  ) {
    this.convoquer = new ConvoquerConseilDisciplineUseCase(disciplineRepo);
    this.tenir = new TenirConseilDisciplineUseCase(disciplineRepo);
  }

  // POST /api/v2/discipline-council/convoquer
  convoquerConseil = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const body = req.body as { studentId?: string; motif?: string; composition?: CompositionConseil; scheduledAt?: string };

      if (!body.studentId || !body.motif || !body.composition || !body.scheduledAt) {
        res.status(400).json({ success: false, message: 'studentId, motif, composition et scheduledAt sont requis' });
        return;
      }

      const session = await this.convoquer.execute({
        schoolId,
        studentId: body.studentId,
        presidedById: req.user!.userId,
        motif: body.motif,
        composition: body.composition,
        scheduledAt: new Date(body.scheduledAt),
      });

      res.status(201).json({ success: true, data: session });
    } catch (error) {
      if (error instanceof Error) { res.status(400).json({ success: false, message: error.message }); return; }
      next(error);
    }
  };

  // POST /api/v2/discipline-council/:id/tenir
  tenirConseil = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);
      const body = req.body as { decision?: 'COUNCIL_DECISION' | 'PERMANENT_EXCLUSION'; pv?: string; startDate?: string; endDate?: string };

      if (!body.decision || !['COUNCIL_DECISION', 'PERMANENT_EXCLUSION'].includes(body.decision) || !body.pv) {
        res.status(400).json({ success: false, message: 'decision (COUNCIL_DECISION ou PERMANENT_EXCLUSION) et pv sont requis' });
        return;
      }

      const session = await this.tenir.execute({
        schoolId,
        sessionId,
        decision: body.decision,
        pv: body.pv,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      });

      res.json({ success: true, data: session });
    } catch (error) {
      if (error instanceof Error) { res.status(400).json({ success: false, message: error.message }); return; }
      next(error);
    }
  };

  // GET /api/v2/discipline-council
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { status } = req.query as Record<string, string>;

      const sessions = await this.disciplineRepo.listerSessions(schoolId, status);

      res.json({ success: true, data: sessions });
    } catch (error) { next(error); }
  };

  // GET /api/v2/discipline-council/:id/pv.pdf
  pvPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const sessionId = String(req.params['id']);

      const session = await this.disciplineRepo.trouverSession(sessionId, schoolId);
      if (!session || session.status !== 'TENU') {
        res.status(404).json({ success: false, message: 'PV indisponible — le conseil n\'a pas encore été tenu' });
        return;
      }

      const school = await this.schoolRepository.findById(schoolId);

      const pdf = await generatePVConseilDisciplinePdf({
        schoolName: school?.name ?? 'ZekoulABia',
        studentName: `${session.student.firstName} ${session.student.lastName}`,
        motif: session.motif,
        // Écrite via ConvoquerConseilDisciplineUseCase, qui valide les 6 rôles obligatoires
        // avant écriture (ROLES_OBLIGATOIRES) — round-trip sûr, même cast que côté écriture.
        composition: session.composition as unknown as CompositionConseil,
        parentNotifiedAt: session.parentNotifiedAt,
        scheduledAt: session.scheduledAt,
        heldAt: session.heldAt,
        decision: session.decision,
        pv: session.pv,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="pv-conseil-discipline.pdf"');
      res.send(pdf);
    } catch (error) { next(error); }
  };
}
