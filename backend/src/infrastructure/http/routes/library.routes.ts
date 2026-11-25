import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth.ts';
import type { LibraryController } from '@infrastructure/http/controllers/LibraryController';

export function creerLibraryRoutes(controller: LibraryController): Router {
  const router = Router();
  const gestionnaires = ['ADMIN', 'STAFF'] as const;

  router.get('/books', requireAuth, requireRole(...gestionnaires), controller.listBooks);
  router.post('/books', requireAuth, requireRole(...gestionnaires), controller.createBook);
  router.patch('/books/:id', requireAuth, requireRole(...gestionnaires), controller.updateBook);
  router.delete('/books/:id', requireAuth, requireRole(...gestionnaires), controller.deleteBook);

  router.get('/loans', requireAuth, requireRole(...gestionnaires), controller.listLoans);
  router.post('/loans', requireAuth, requireRole(...gestionnaires), controller.createLoan);
  router.patch('/loans/:id/return', requireAuth, requireRole(...gestionnaires), controller.returnLoan);
  router.patch('/loans/:id/renew', requireAuth, requireRole(...gestionnaires), controller.renewLoan);

  router.get('/my-loans', requireAuth, controller.getMyLoans);

  return router;
}
