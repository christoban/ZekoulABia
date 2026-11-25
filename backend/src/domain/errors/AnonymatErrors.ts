export class AnonymatDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AnonymatDomainError';
  }
}

export class ForbiddenAnonymatError extends AnonymatDomainError {
  constructor() {
    super('Action réservée au Censeur / Vice-Principal / Admin', 'FORBIDDEN_MANAGE_ANONYMAT');
  }
}

export class SessionNotFoundError extends AnonymatDomainError {
  constructor() {
    super('Session introuvable', 'SESSION_NOT_FOUND');
  }
}

export class SessionNotAnonymizedError extends AnonymatDomainError {
  constructor() {
    super('Session non anonymisée', 'SESSION_NOT_ANONYMIZED');
  }
}

export class InvalidAnonymatStateError extends AnonymatDomainError {
  constructor(detail: string) {
    super(detail, 'INVALID_ANONYMAT_STATE');
  }
}

export class NoStudentsInSessionError extends AnonymatDomainError {
  constructor() {
    super('Aucun élève pour cette session', 'NO_STUDENTS_IN_SESSION');
  }
}

export class InvalidMagicTokenError extends AnonymatDomainError {
  constructor(code: 'TOKEN_INVALID' | 'TOKEN_EXPIRED' | 'ALREADY_DONE' = 'TOKEN_INVALID') {
    const messages = {
      TOKEN_INVALID: 'Lien invalide',
      TOKEN_EXPIRED: 'Lien expiré',
      ALREADY_DONE: 'Liste déjà clôturée',
    } as const;
    super(messages[code], code);
  }
}

export class NotAssignedCorrectorError extends AnonymatDomainError {
  constructor() {
    super('Le correcteur n\'est pas assigné à cette session', 'NOT_ASSIGNED_CORRECTOR');
  }
}

export class NotesAlreadySubmittedError extends AnonymatDomainError {
  constructor() {
    super('Les notes ont déjà été soumises', 'NOTES_ALREADY_SUBMITTED');
  }
}

export class InvalidCodeForAssignmentError extends AnonymatDomainError {
  constructor() {
    super('Le code ne correspond pas à une classe assignée au correcteur', 'INVALID_CODE_FOR_ASSIGNMENT');
  }
}

export class CorrectionNotReadyError extends AnonymatDomainError {
  constructor() {
    super('La correction n\'est pas encore prête', 'CORRECTION_NOT_READY');
  }
}

export class SequenceRequiredError extends AnonymatDomainError {
  constructor() {
    super('Une séquence académique est requise pour la réconciliation', 'SEQUENCE_REQUIRED');
  }
}

export class ReconcileForbiddenError extends AnonymatDomainError {
  constructor() {
    super('La réconciliation est interdite dans cet état', 'RECONCILE_FORBIDDEN');
  }
}