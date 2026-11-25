import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { ApeeRepository } from '@domain/ports/repositories/ApeeRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import { CreerTransactionAPEEUseCase } from '@application/apee/CreerTransactionAPEEUseCase';
import { ValiderDepenseAPEEUseCase } from '@application/apee/ValiderDepenseAPEEUseCase';
import { generateRapportAPEEPdf } from '../../pdf/apee/ApeeReportPdfRenderer';

const JUSTIFICATIFS_DIR = path.resolve(process.cwd(), 'storage', 'apee-justificatifs');

/**
 * Préfixe /api/v2/apee (MODULE 7/11, chantier Transparence APEE — Juillet 2026).
 */
export class APEEController {
  private readonly creerTransaction: CreerTransactionAPEEUseCase;
  private readonly validerDepense: ValiderDepenseAPEEUseCase;

  constructor(
    private readonly apeeRepository: ApeeRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly audit: AIActionAuditPort,
  ) {
    this.creerTransaction = new CreerTransactionAPEEUseCase(apeeRepository);
    this.validerDepense = new ValiderDepenseAPEEUseCase(apeeRepository);
  }

  // POST /api/v2/apee/transactions
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const body = req.body as { type?: 'COLLECTE' | 'DEPENSE'; montant?: number; categorie?: string; description?: string; date?: string };

      if (!body.type || !['COLLECTE', 'DEPENSE'].includes(body.type)) {
        res.status(400).json({ success: false, message: 'type doit être COLLECTE ou DEPENSE' });
        return;
      }
      if (typeof body.montant !== 'number' || body.montant <= 0) {
        res.status(400).json({ success: false, message: 'montant doit être un nombre strictement positif' });
        return;
      }

      const transaction = await this.creerTransaction.execute({
        schoolId,
        creeParId: req.user!.userId,
        type: body.type,
        montant: body.montant,
        categorie: body.categorie,
        description: body.description,
        date: body.date ? new Date(body.date) : undefined,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'enregistrer_transaction_apee', targetType: 'APEETransaction', targetId: transaction.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: body,
      });
      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'enregistrer_transaction_apee', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      next(error);
    }
  };

  // GET /api/v2/apee/transactions
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const isParent = req.user!.role === 'PARENT';

      const transactions = await this.apeeRepository.listerTransactions(schoolId, !isParent);

      // Vue parent anonymisée : jamais l'identité de qui a créé/validé, seulement l'opération.
      const data = isParent
        ? transactions.map((t) => ({
            id: t.id, type: t.type, montant: t.montant, categorie: t.categorie,
            description: t.description, date: t.date, valide: t.valide,
          }))
        : transactions;

      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/apee/transactions/:id/justificatif (multipart, champ "file")
  uploadJustificatif = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const transactionId = String(req.params['id']);
      const file = req.file as Express.Multer.File | undefined;

      if (!file) { res.status(400).json({ success: false, message: 'Aucun fichier reçu' }); return; }

      const transaction = await this.apeeRepository.trouverParId(transactionId, schoolId);
      if (!transaction) { res.status(404).json({ success: false, message: 'Transaction introuvable' }); return; }
      if (transaction.type !== 'DEPENSE') {
        res.status(400).json({ success: false, message: 'Seule une dépense peut recevoir un justificatif' });
        return;
      }

      const schoolDir = path.join(JUSTIFICATIFS_DIR, schoolId);
      fs.mkdirSync(schoolDir, { recursive: true });
      const safeExt = path.extname(file.originalname).toLowerCase();
      const fileName = `${transactionId}-${Date.now()}${safeExt}`;
      const filePath = path.join(schoolDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      const updated = await this.apeeRepository.attacherJustificatif(transactionId, filePath);

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/apee/transactions/:id/valider
  valider = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const transactionId = String(req.params['id']);

      const transaction = await this.validerDepense.execute({
        schoolId,
        transactionId,
        valideParId: req.user!.userId,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'valider_depense_apee', targetType: 'APEETransaction', targetId: transactionId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { transactionId },
      });
      res.json({ success: true, data: transaction });
    } catch (error) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'valider_depense_apee', targetType: 'APEETransaction', targetId: String(req.params['id']),
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.params,
      });
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  // GET /api/v2/apee/solde
  solde = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const solde = await this.apeeRepository.obtenirSolde(schoolId);

      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'solde_apee', origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: {},
      });
      res.json({
        success: true,
        data: {
          totalCollectes: solde.totalCollectes,
          totalDepenses: solde.totalDepenses,
          solde: solde.totalCollectes - solde.totalDepenses,
          depensesEnAttenteDeJustificatifOuValidation: solde.depensesEnAttente,
        },
      });
    } catch (error) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'solde_apee', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: {},
      });
      next(error);
    }
  };

  // GET /api/v2/apee/rapport.pdf
  rapportPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await this.schoolRepository.findById(schoolId);

      const transactions = await this.apeeRepository.listerTransactions(schoolId, false);

      const totalCollectes = transactions.filter((t) => t.type === 'COLLECTE').reduce((s, t) => s + t.montant, 0);
      const totalDepenses = transactions.filter((t) => t.type === 'DEPENSE' && t.valide).reduce((s, t) => s + t.montant, 0);

      const pdf = await generateRapportAPEEPdf({
        schoolName: school?.name ?? 'ZekoulABia',
        periodeLabel: `Année scolaire ${new Date().getFullYear()}`,
        transactions: transactions.map((t) => ({ type: t.type as 'COLLECTE' | 'DEPENSE', montant: t.montant, categorie: t.categorie, description: t.description, date: t.date, valide: t.valide })),
        totalCollectes,
        totalDepenses,
        solde: totalCollectes - totalDepenses,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="rapport-apee.pdf"');
      res.send(pdf);
    } catch (error) {
      next(error);
    }
  };
}
