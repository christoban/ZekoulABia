import type { Response } from 'express';
import type { StudentDocumentRepository } from '@domain/ports/repositories/StudentDocumentRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import {
  canonicalHashSnapshot,
  deriveShortVerifyCode,
  maskStudentPublicName,
} from '@domain/policies/BulletinVerifyCrypto';
import { isStudentBulletinSnapshot } from '@application/reportCard/bulletinPdfLifecycle';

export interface VerifyPublicResult {
  statusCode: number;
  body: Record<string, unknown>;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  CERTIFICATE: 'Certificat de scolarité',
  STUDENT_CARD: "Carte d'identité scolaire",
  TRANSFER_LETTER: 'Lettre de transfert',
  REPORT_CARD: 'Bulletin de notes',
};

export function setVerifyNoIndexHeaders(res: Response): void {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store');
}

export async function verifyPublicDocumentOp(params: {
  documentId: string;
  queryToken?: string;
  documentRepository: StudentDocumentRepository;
  bulletinRepository: BulletinRepository;
  schoolRepository: SchoolRepository;
}): Promise<VerifyPublicResult> {
  const tokenCandidate = params.queryToken?.trim() ?? '';
  const pathCandidate = params.documentId.trim();
  const primaryKey = tokenCandidate || pathCandidate;

  if (!primaryKey) {
    return {
      statusCode: 400,
      body: {
        success: false,
        status: 'NOT_FOUND',
        authentic: false,
        message: 'Code de vérification manquant.',
      },
    };
  }

  // 1. Documents scolaires vérifiables (certificat, carte, lettre de transfert)
  const doc = await params.documentRepository.findById(primaryKey);
  if (doc) {
    const school = await params.schoolRepository.findById(doc.schoolId);
    return {
      statusCode: 200,
      body: {
        success: true,
        document: {
          id: doc.id.slice(0, 8).toUpperCase(),
          status: 'AUTHENTIC',
          type: DOC_TYPE_LABELS[doc.type] ?? doc.type,
          school: school?.name ?? '—',
          generatedAt: doc.generatedAt,
          data: doc.dataSnapshot,
          authentic: true,
        },
      },
    };
  }

  // 2. Bulletin actif (par verifyToken, shortVerifyCode ZK-XXXX-XXXX ou ID)
  let record = await params.bulletinRepository.findPublicVerifyRecord(primaryKey);
  if (!record && tokenCandidate && pathCandidate && tokenCandidate !== pathCandidate) {
    record = await params.bulletinRepository.findPublicVerifyRecord(pathCandidate);
  }

  if (record && record.revokedAt === null && record.validationStatus !== 'REVOKED') {
    const isLegacy = record.computationVersion === 1 || !record.snapshotData;
    const isTampered =
      !isLegacy &&
      Boolean(record.contentHash) &&
      isStudentBulletinSnapshot(record.snapshotData) &&
      canonicalHashSnapshot(record.snapshotData) !== record.contentHash;

    const studentMaskedName = maskStudentPublicName(record.studentFirstName, record.studentLastName);
    const shortVerifyCode =
      record.shortVerifyCode ?? deriveShortVerifyCode(record.verifyToken ?? record.id);

    if (isTampered) {
      return {
        statusCode: 200,
        body: {
          success: true,
          document: {
            id: shortVerifyCode,
            shortVerifyCode,
            status: 'TAMPERED',
            authentic: false,
            type: 'Bulletin de notes',
            school: record.schoolName,
            studentMaskedName,
            message: 'Empreinte d’intégrité non concordante : ce document ne peut pas être authentifié.',
          },
        },
      };
    }

    return {
      statusCode: 200,
      body: {
        success: true,
        document: {
          id: shortVerifyCode,
          shortVerifyCode,
          status: 'AUTHENTIC',
          authentic: true,
          type: 'Bulletin de notes',
          school: record.schoolName,
          yearName: record.academicYearName ?? '—',
          periodName: record.academicPeriodName ?? '—',
          className: record.className ?? '—',
          classLevel: record.classLevel ?? null,
          studentMaskedName,
          issuedAt: record.issuedAt.toISOString(),
          reprintCount: record.reprintCount,
          isDuplicate: record.reprintCount > 0,
          computationVersion: record.computationVersion,
          legacyFormat: isLegacy,
          formatNotice: isLegacy ? 'Ancien format (v1)' : null,
          // Aucune note, moyenne, rang, mention, conduite, matricule ou contact divulgué publiquement.
          data: {
            studentName: studentMaskedName,
            className: record.className ?? '—',
            yearName: record.academicYearName ?? '—',
            periodName: record.academicPeriodName ?? '—',
          },
          generatedAt: record.issuedAt.toISOString(),
        },
      },
    };
  }

  // 3. Bulletin révoqué / remplacé (archive BulletinRevocationArchive ou statut REVOKED)
  const revocation =
    (await params.bulletinRepository.findRevocationByTokenOrId(primaryKey)) ??
    (tokenCandidate && pathCandidate && tokenCandidate !== pathCandidate
      ? await params.bulletinRepository.findRevocationByTokenOrId(pathCandidate)
      : null);

  if (revocation || (record && (record.revokedAt !== null || record.validationStatus === 'REVOKED'))) {
    const revDate = revocation?.revokedAt ?? record?.revokedAt ?? new Date();
    const schoolName = revocation?.schoolName ?? record?.schoolName ?? '—';
    const masked =
      revocation?.studentLastName
        ? maskStudentPublicName(revocation.studentFirstName, revocation.studentLastName)
        : record
          ? maskStudentPublicName(record.studentFirstName, record.studentLastName)
          : undefined;
    const shortCode =
      revocation?.shortVerifyCode ??
      record?.shortVerifyCode ??
      (revocation?.verifyToken ? deriveShortVerifyCode(revocation.verifyToken) : undefined);

    return {
      statusCode: 200,
      body: {
        success: true,
        document: {
          id: shortCode ?? 'RÉVOQUÉ',
          shortVerifyCode: shortCode,
          status: 'REVOKED',
          authentic: false,
          type: 'Bulletin de notes',
          school: schoolName,
          yearName: revocation?.academicYearName ?? record?.academicYearName ?? undefined,
          periodName: revocation?.academicPeriodName ?? record?.academicPeriodName ?? undefined,
          studentMaskedName: masked,
          revokedAt: revDate.toISOString(),
          message: 'Ce bulletin a été annulé et remplacé par une nouvelle version officielle émise par l’établissement.',
        },
      },
    };
  }

  // 4. Introuvable
  return {
    statusCode: 404,
    body: {
      success: false,
      status: 'NOT_FOUND',
      authentic: false,
      message: 'Document introuvable ou code de vérification invalide.',
    },
  };
}
