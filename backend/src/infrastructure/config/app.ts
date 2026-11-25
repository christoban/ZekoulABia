/**
 * INFRASTRUCTURE LAYER — Configuration Express
 * Branche le bootstrap hexagonal complet sur une instance Express.
 */
import express, { type Application } from 'express';
import { bootstrapHexagonal } from './hexagonal.bootstrap';

export function creerApp(): Application {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  bootstrapHexagonal(app);
  return app;
}
