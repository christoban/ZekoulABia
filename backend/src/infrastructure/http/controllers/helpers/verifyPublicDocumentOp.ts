import type { Response } from 'express';
import type { StudentDocumentRepository } from '@domain/ports/repositories/StudentDocumentRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import {
  canonicalHashSnapshot,
  deriveShortVerifyCode,
  isShortVerifyCode,
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

function formatPublicAverage(avg: number | null | undefined): string {
  if (avg === null || avg === undefined || Number.isNaN(avg)) return '—';
  return `${avg.toFixed(2).replace('.', ',')} / 20`;
}

function formatPublicRank(rank: number | null | undefined, total: number | null | undefined): string {
  if (rank === null || rank === undefined) return '—';
  const rk = rank === 1 ? '1er' : `${rank}e`;
  return total ? `${rk} / ${total}` : rk;
}

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

  const isShortLookup = isShortVerifyCode(primaryKey);
  const lookupMode = isShortLookup ? 'SHORT_CODE' : 'LONG_TOKEN';

  // 1. Documents scolaires vérifiables (certificat, carte, lettre de transfert)
  if (!isShortLookup) {
    const doc = await params.documentRepository.findById(primaryKey);
    if (doc) {
      const school = await params.schoolRepository.findById(doc.schoolId);
      return {
        statusCode: 200,
        body: {
          success: true,
          document: {
            id: doc.id.slice(0, 8).toUpperCase(),
            lookupMode: 'LONG_TOKEN',
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
  }

  // 2. Bulletin actif (par verifyToken long, shortVerifyCode ZK-XXXX-XXXX ou ID)
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
            lookupMode,
            status: 'TAMPERED',
            authentic: false,
            type: 'Bulletin de notes',
            message: 'Empreinte d’intégrité non concordante : ce document ne peut pas être authentifié.',
          },
        },
      };
    }

    // Point 2 (5 bis) : recherche manuelle par code court -> STATUT uniquement (jamais de chiffres)
    if (isShortLookup) {
      return {
        statusCode: 200,
        body: {
          success: true,
          document: {
            id: shortVerifyCode,
            shortVerifyCode,
            lookupMode: 'SHORT_CODE',
            status: 'AUTHENTIC',
            authentic: true,
            type: 'Bulletin de notes',
            legacyFormat: isLegacy,
            formatNotice: isLegacy ? 'Ancien format (v1)' : null,
            message:
              'Référence reconnue authentique dans le registre officiel. Scannez le QR code du bulletin pour comparer la moyenne générale et le rang.',
          },
        },
      };
    }

    // Jeton long (QR) -> affiche établissement, classe, période, nom masqué, MOYENNE GÉNÉRALE, RANG, date
    // (toujours sans notes par matière, matricule, conduite ni contacts).
    return {
      statusCode: 200,
      body: {
        success: true,
        document: {
          id: shortVerifyCode,
          shortVerifyCode,
          lookupMode: 'LONG_TOKEN',
          status: 'AUTHENTIC',
          authentic: true,
          type: 'Bulletin de notes',
          school: record.schoolName,
          yearName: record.academicYearName ?? '—',
          periodName: record.academicPeriodName ?? '—',
          className: record.className ?? '—',
          classLevel: record.classLevel ?? null,
          studentMaskedName,
          generalAverage: record.generalAverage,
          generalAverageDisplay: formatPublicAverage(record.generalAverage),
          rank: record.rank,
          totalStudents: record.totalStudents,
          rankDisplay: formatPublicRank(record.rank, record.totalStudents),
          issuedAt: record.issuedAt.toISOString(),
          reprintCount: record.reprintCount,
          isDuplicate: record.reprintCount > 0,
          computationVersion: record.computationVersion,
          legacyFormat: isLegacy,
          formatNotice: isLegacy ? 'Ancien format (v1)' : null,
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

  // 3. Bulletin révoqué / remplacé
  const revocation =
    (await params.bulletinRepository.findRevocationByTokenOrId(primaryKey)) ??
    (tokenCandidate && pathCandidate && tokenCandidate !== pathCandidate
      ? await params.bulletinRepository.findRevocationByTokenOrId(pathCandidate)
      : null);

  if (revocation || (record && (record.revokedAt !== null || record.validationStatus === 'REVOKED'))) {
    const revDate = revocation?.revokedAt ?? record?.revokedAt ?? new Date();
    const shortCode =
      revocation?.shortVerifyCode ??
      record?.shortVerifyCode ??
      (revocation?.verifyToken ? deriveShortVerifyCode(revocation.verifyToken) : undefined);

    if (isShortLookup) {
      return {
        statusCode: 200,
        body: {
          success: true,
          document: {
            id: shortCode ?? 'RÉVOQUÉ',
            shortVerifyCode: shortCode,
            lookupMode: 'SHORT_CODE',
            status: 'REVOKED',
            authentic: false,
            type: 'Bulletin de notes',
            revokedAt: revDate.toISOString(),
            message: 'Ce bulletin a été annulé et remplacé par une nouvelle version officielle.',
          },
        },
      };
    }

    const schoolName = revocation?.schoolName ?? record?.schoolName ?? '—';
    const masked =
      revocation?.studentLastName
        ? maskStudentPublicName(revocation.studentFirstName, revocation.studentLastName)
        : record
          ? maskStudentPublicName(record.studentFirstName, record.studentLastName)
          : undefined;

    return {
      statusCode: 200,
      body: {
        success: true,
        document: {
          id: shortCode ?? 'RÉVOQUÉ',
          shortVerifyCode: shortCode,
          lookupMode: 'LONG_TOKEN',
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
      lookupMode,
      status: 'NOT_FOUND',
      authentic: false,
      message: 'Document introuvable ou code de vérification invalide.',
    },
  };
}
