import type { Response, NextFunction } from 'express';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
import { ConseilBloqueError } from '@domain/errors/ConseilBloqueError';
import { NoteValideeSyncError } from '@domain/errors/NoteValideeSyncError';

export function gererErreurGrade(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof NoteValideeSyncError) {
    res.status(409).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof BulletinBloqueError) {
    res.status(422).json({ success: false, message: error.message, notesBloquantes: error.notesBloquantes });
    return;
  }
  if (error instanceof ConseilBloqueError) {
    res.status(422).json({ success: false, message: error.message, notesManquantes: error.notesManquantes });
    return;
  }
  if (error instanceof Error) {
    if (error.message.includes('Impossible de modifier')) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    if (error.message.startsWith('Données invalides')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes('Permission') || error.message.includes('n\'êtes pas assigné')) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error.message.includes('introuvable')) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
  }
  next(error);
}
