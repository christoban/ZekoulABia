import type { Request, Response, NextFunction } from 'express';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { ApeeRepository } from '@domain/ports/repositories/ApeeRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { FileStoragePort } from '@domain/ports/services/FileStoragePort';
import {
  buildScopedStorageKey,
  validateUploadedFileForDomain,
} from '@domain/services/storage/fileStorageValidation';
import { CreerTransactionAPEEUseCase } from '@application/apee/CreerTransactionAPEEUseCase';
import { ValiderDepenseAPEEUseCase } from '@application/apee/ValiderDepenseAPEEUseCase';
import { generateRapportAPEEPdf } from '../../pdf/apee/ApeeReportPdfRenderer';
import {
  resolveScopedStorageKeyOrRespond,
  respondFileStorageValidationError,
  sendStoredFileResponse,
} from '../helpers/fileStorageHttpHelper';

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
    private readonly fileStorage: FileStoragePort,
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

      const validated = validateUploadedFileForDomain({
        domain: 'apee-justificatifs',
        buffer: file.buffer,
        originalName: file.originalname,
        declaredMime: file.mimetype,
      });

      const storageKey = buildScopedStorageKey({
        schoolId,
        domain: 'apee-justificatifs',
        extension: validated.extension,
      });

      await this.fileStorage.put(storageKey, file.buffer, validated.mimeType, {
        originalName: validated.originalName,
        transactionId,
        uploadedBy: req.user!.userId,
      });

      const updated = await this.apeeRepository.attacherJustificatif(transactionId, storageKey);

      res.json({ success: true, data: updated });
    } catch (error) {
      if (
        respondFileStorageValidationError(res, error, {
          invalidFormatMessage: 'Format de fichier non supporté (PDF, JPG, PNG uniquement)',
          tooLargeMessage: 'Fichier trop volumineux (maximum 8 Mo)',
        })
      ) {
        return;
      }
      next(error);
    }
  };

  // GET /api/v2/apee/transactions/:id/justificatif
  downloadJustificatif = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const isParent = req.user!.role === 'PARENT';
      const transactionId = String(req.params['id']);

      const transaction = await this.apeeRepository.trouverParId(transactionId, schoolId);
      if (!transaction || !transaction.justificatifUrl) {
        res.status(404).json({ success: false, message: 'Justificatif introuvable' });
        return;
      }
      if (isParent && !transaction.valide) {
        res.status(403).json({ success: false, message: 'Accès refusé : dépense non encore validée' });
        return;
      }

      const validKey = resolveScopedStorageKeyOrRespond(
        res,
        transaction.justificatifUrl,
        schoolId,
        'Justificatif indisponible (fichier antérieur expiré ou non conservé).',
      );
      if (!validKey) return;

      const stored = await this.fileStorage.get(validKey);
      if (!stored) {
        res.status(404).json({ success: false, message: 'Justificatif introuvable sur le stockage' });
        return;
      }

      const ext = validKey.slice(validKey.lastIndexOf('.')).toLowerCase();
      const contentType =
        stored.contentType ??
        (ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg');
      const filename = stored.metadata?.originalName ?? `justificatif-${transactionId}${ext}`;

      sendStoredFileResponse(res, { buffer: stored.buffer, contentType, filename, disposition: 'inline' });
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
