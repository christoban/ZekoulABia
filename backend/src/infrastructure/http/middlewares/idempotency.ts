import { type Request, type Response, type NextFunction } from 'express';
import { messageErreur } from '@application/shared/messageErreur';
import type { PrismaClient, Prisma } from '@prisma/client';

/**
 * Idempotence des requêtes rejouées par la file de synchronisation offline (Plan offline-first
 * V1 §4, pattern Outbox — voir `frontend/src/hooks/useSyncQueue.ts`). Le client envoie
 * `Idempotency-Key` UNIQUEMENT quand il rejoue une action depuis sa file d'attente locale ;
 * une requête normale (usage en ligne direct) n'a jamais cet en-tête, donc ce middleware est un
 * pur no-op pour tout le reste de l'app — safe à monter globalement plutôt que sur chaque route
 * une par une (9+ endpoints concernés, répartis dans autant de fichiers de routes différents).
 *
 * Ne mémorise QUE les traitements réussis (2xx) : un échec ne doit jamais "empoisonner" la clé
 * — une vraie retentative doit pouvoir réessayer normalement après un vrai échec serveur.
 */
export function idempotency(prisma: PrismaClient) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = req.header('Idempotency-Key');
    if (!key) { next(); return; }

    try {
      const existant = await prisma.idempotencyRecord.findUnique({ where: { key } });
      if (existant) {
        res.status(existant.statusCode).json(existant.responseBody);
        return;
      }
    } catch {
      // Échec de la vérification d'idempotence (DB indisponible, etc.) — on laisse la requête
      // continuer normalement plutôt que de bloquer une action légitime sur un souci annexe.
    }

    // Intercepte la réponse pour l'enregistrer si (et seulement si) le traitement réussit.
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.userId) {
        prisma.idempotencyRecord
          .create({
            data: {
              key,
              userId: req.user.userId,
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              // body est ce qui vient d'être passé à res.json() juste après — déjà JSON-safe
              // par construction, ce n'est qu'une réécriture du même objet vers Prisma.
              responseBody: body as Prisma.InputJsonValue,
            },
          })
          .catch((e) => console.error('[Idempotency] Échec enregistrement:', messageErreur(e)));
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  };
}
