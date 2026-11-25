import type { Request, Response, NextFunction } from 'express';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type {
  LibraryLoanStatus,
  LibraryRepository,
  UpdateBookInput,
} from '@domain/ports/repositories/LibraryRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';

/**
 * Préfixe /api/v2/library — gestion du catalogue et des emprunts de la bibliothèque.
 */
export class LibraryController {
  constructor(
    private readonly libraryRepository: LibraryRepository,
    private readonly parentRepository: ParentRepository,
    private readonly audit: AIActionAuditPort,
  ) {}

  // GET /api/v2/library/books — catalogue
  listBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { search, category, page = '1', limit = '50' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const { total, books } = await this.libraryRepository.listBooks(schoolId, {
        search,
        category,
        page: pageNum,
        limit: limitNum,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'livres_disponibles',
        targetType: 'Book',
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { search, category },
      });
      res.json({
        success: true,
        data: books,
        pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      this.audit.journaliser({
        actorUserId: req.user?.userId,
        actorRole: req.user?.role,
        schoolId: req.user?.schoolId,
        actionName: 'livres_disponibles',
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  };

  // POST /api/v2/library/books — ajouter un ouvrage
  createBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { title, author, isbn, quantity, category } = req.body as Record<string, string>;
      if (!title) {
        res.status(400).json({ success: false, message: 'title requis' });
        return;
      }
      const qty = Math.max(1, parseInt(String(quantity ?? '1')) || 1);
      const book = await this.libraryRepository.createBook({
        schoolId,
        title,
        author: author ?? null,
        isbn: isbn ?? null,
        quantity: qty,
        available: qty,
        category: category ?? null,
      });
      res.status(201).json({ success: true, data: book });
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/v2/library/books/:id — modifier un ouvrage
  updateBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const book = await this.libraryRepository.findBookByIdAndSchool(req.params.id as string, schoolId);
      if (!book) {
        res.status(404).json({ success: false, message: 'Ouvrage introuvable' });
        return;
      }
      const body = req.body as UpdateBookInput;
      const data: UpdateBookInput = {};
      if (body.title !== undefined) data.title = body.title;
      if (body.author !== undefined) data.author = body.author;
      if (body.isbn !== undefined) data.isbn = body.isbn;
      if (body.quantity !== undefined) data.quantity = body.quantity;
      if (body.available !== undefined) data.available = body.available;
      if (body.category !== undefined) data.category = body.category;

      const updated = await this.libraryRepository.updateBook(book.id, data);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  // DELETE /api/v2/library/books/:id — supprimer un ouvrage
  deleteBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const book = await this.libraryRepository.findBookByIdAndSchool(req.params.id as string, schoolId);
      if (!book) {
        res.status(404).json({ success: false, message: 'Ouvrage introuvable' });
        return;
      }
      const activeCount = await this.libraryRepository.countActiveLoansForBook(book.id);
      if (activeCount > 0) {
        res.status(409).json({
          success: false,
          message: `Impossible de supprimer : ${activeCount} exemplaire(s) actuellement emprunté(s)`,
        });
        return;
      }
      await this.libraryRepository.deleteBook(book.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/library/loans — emprunts actifs
  listLoans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { status = 'ACTIVE', page = '1', limit = '30' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const { total, loans } = await this.libraryRepository.listLoans(schoolId, {
        status: status ? (status as LibraryLoanStatus) : undefined,
        page: pageNum,
        limit: limitNum,
      });

      res.json({
        success: true,
        data: loans,
        pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
      });
    } catch (err) {
      next(err);
    }
  };

  // POST /api/v2/library/loans — enregistrer un emprunt
  createLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { bookId, studentId, dueDate } = req.body as Record<string, string>;
      if (!bookId || !studentId) {
        res.status(400).json({ success: false, message: 'bookId et studentId requis' });
        return;
      }
      const book = await this.libraryRepository.findBookByIdAndSchool(bookId, schoolId);
      if (!book) {
        res.status(404).json({ success: false, message: 'Ouvrage introuvable' });
        return;
      }
      if (book.available <= 0) {
        res.status(409).json({ success: false, message: 'Aucun exemplaire disponible' });
        return;
      }
      const student = await this.libraryRepository.findStudentInSchool(studentId, schoolId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }
      const loan = await this.libraryRepository.createLoanWithDecrement({
        schoolId,
        bookId,
        studentId,
        dueDate: dueDate ? new Date(dueDate) : null,
      });
      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'emprunter_livre',
        targetType: 'BookLoan',
        targetId: loan.id,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { bookId, studentId, dueDate },
      });
      res.status(201).json({ success: true, data: loan });
    } catch (err) {
      this.audit.journaliser({
        actorUserId: req.user?.userId,
        actorRole: req.user?.role,
        schoolId: req.user?.schoolId,
        actionName: 'emprunter_livre',
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
        parametersSummary: req.body,
      });
      next(err);
    }
  };

  // PATCH /api/v2/library/loans/:id/return — retour d'un livre
  returnLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const loan = await this.libraryRepository.findLoanByIdAndSchool(req.params.id as string, schoolId);
      if (!loan) {
        res.status(404).json({ success: false, message: 'Emprunt introuvable' });
        return;
      }
      if (loan.status === 'RETURNED') {
        res.status(409).json({ success: false, message: 'Livre déjà retourné' });
        return;
      }
      const updated = await this.libraryRepository.returnLoanWithIncrement(loan.id, loan.bookId);
      this.audit.journaliser({
        actorUserId: req.user!.userId,
        actorRole: req.user!.role,
        schoolId,
        actionName: 'retourner_livre',
        targetType: 'BookLoan',
        targetId: loan.id,
        origin: 'UI_DIRECT',
        outcome: 'SUCCES',
        parametersSummary: { loanId: loan.id },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      this.audit.journaliser({
        actorUserId: req.user?.userId,
        actorRole: req.user?.role,
        schoolId: req.user?.schoolId,
        actionName: 'retourner_livre',
        targetType: 'BookLoan',
        targetId: req.params.id as string,
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  };

  // PATCH /api/v2/library/loans/:id/renew — prolonger la date limite d'un emprunt actif
  renewLoan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { dueDate } = req.body as Record<string, string>;
      if (!dueDate) {
        res.status(400).json({ success: false, message: 'dueDate requis' });
        return;
      }
      const newDueDate = new Date(dueDate);
      if (Number.isNaN(newDueDate.getTime()) || newDueDate <= new Date()) {
        res.status(400).json({ success: false, message: 'dueDate doit être une date future valide' });
        return;
      }
      const loan = await this.libraryRepository.findLoanByIdAndSchool(req.params.id as string, schoolId);
      if (!loan) {
        res.status(404).json({ success: false, message: 'Emprunt introuvable' });
        return;
      }
      if (loan.status === 'RETURNED') {
        res.status(409).json({
          success: false,
          message: 'Livre déjà retourné — impossible de renouveler',
        });
        return;
      }
      const updated = await this.libraryRepository.renewLoan(loan.id, newDueDate);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  };

  // GET /api/v2/library/my-loans — emprunts de l'élève connecté ou des enfants du parent
  getMyLoans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, role, schoolId } = req.user!;
      const { studentId } = req.query as Record<string, string>;

      if (role === 'STUDENT') {
        const loans = await this.libraryRepository.listLoansForStudent(schoolId, userId);
        res.json({ success: true, data: loans });
        return;
      }

      if (role === 'PARENT') {
        const childUserIds = await this.parentRepository.findStudentIdsByParent(userId);

        if (studentId && !childUserIds.includes(studentId)) {
          res.status(403).json({ success: false, message: 'Accès refusé' });
          return;
        }

        const targetIds = studentId ? [studentId] : childUserIds;
        const loans = await this.libraryRepository.listLoansForStudents(schoolId, targetIds);
        res.json({ success: true, data: loans });
        return;
      }

      res.status(403).json({ success: false, message: 'Accès refusé' });
    } catch (err) {
      next(err);
    }
  };
}
