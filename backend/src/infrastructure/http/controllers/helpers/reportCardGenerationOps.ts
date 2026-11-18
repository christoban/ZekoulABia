import type { Request, Response, NextFunction } from 'express';
import { ZipArchive } from 'archiver';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';
import type { BulletinTemplate } from '@domain/types/enums';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
import { resolveLanguage } from '../../../../domain/policies/LanguagePolicy';
import { getEffectiveSchoolSettings } from '../../../services/school-settings/SchoolSettingsService';
import { notifyBulletinSms } from '@infrastructure/services/sms/SmsNotificationService';
import { renderReportCardPdfBuffer } from './reportCardControllerHelpers';

export interface ResolvedGeneratePayload {
  classId: string;
  academicPeriodId: string;
  academicYearId: string;
  template: BulletinTemplate;
  nomEtablissement: string;
  logoUrl?: string;
  schoolMotto?: string;
  forceRegenerate: boolean;
  motifRegeneration?: string;
}

export interface ResolvedGenerateParams {
  error?: { status: number; message: string };
  data?: ResolvedGeneratePayload;
}

export async function resolveGenerateBulletinParams(params: {
  body: Request['body'];
  schoolId: string;
  anneeRepository: AnneeAcademiqueRepository;
  schoolRepository: SchoolRepository;
}): Promise<ResolvedGenerateParams> {
  const { body, schoolId, anneeRepository, schoolRepository } = params;
  const classId = body?.classId as string | undefined;
  if (!classId) return { error: { status: 400, message: 'classId requis' } };

  let academicYearId = body?.academicYearId as string | undefined;
  let academicPeriodId = body?.academicPeriodId as string | undefined;
  let template = body?.template as string | undefined;
  let nomEtablissement = body?.nomEtablissement as string | undefined;

  if (!academicPeriodId || !academicYearId) {
    const currentYear = await anneeRepository.findCourante(schoolId);
    if (!currentYear) return { error: { status: 400, message: 'Aucune année académique courante trouvée' } };
    academicYearId = academicYearId || currentYear.id;
    if (!academicPeriodId) {
      const periodes = await anneeRepository.findPeriodesByAnnee(currentYear.id);
      academicPeriodId = periodes[0]?.id;
    }
    if (!academicPeriodId) return { error: { status: 400, message: 'Aucune période académique trouvée' } };
  }

  if (!template) {
    const settings = await getEffectiveSchoolSettings(schoolId);
    template = settings.bulletinTemplate ?? 'FR_SECONDARY';
  }
  if (!nomEtablissement) {
    const school = await schoolRepository.findById(schoolId);
    nomEtablissement = school?.name ?? 'Établissement';
  }

  return {
    data: {
      classId,
      academicPeriodId,
      academicYearId,
      template: template as BulletinTemplate,
      nomEtablissement,
      logoUrl: body?.logoUrl as string | undefined,
      schoolMotto: body?.schoolMotto as string | undefined,
      forceRegenerate: Boolean(body?.forceRegenerate),
      motifRegeneration: body?.motifRegeneration as string | undefined,
    },
  };
}

export function triggerBulletinSmsFireAndForget(params: {
  schoolId: string;
  academicPeriodId: string;
  generationStartedAt: Date;
  anneeRepository: AnneeAcademiqueRepository;
  bulletinRepository: BulletinRepository;
}): void {
  void (async () => {
    try {
      const period = await params.anneeRepository.findPeriodeById(params.academicPeriodId, params.schoolId);
      const periodName = period?.name ?? 'Période';
      const bulletins = await params.bulletinRepository.findRecentSince(
        params.schoolId,
        params.academicPeriodId,
        params.generationStartedAt,
      );
      await Promise.all(
        bulletins.map((b) =>
          notifyBulletinSms({
            schoolId: params.schoolId,
            studentId: b.studentId,
            periodName,
            studentName: `${b.student.firstName ?? ''} ${b.student.lastName ?? ''}`.trim(),
          }),
        ),
      );
    } catch (err) {
      console.error('[SMS Bulletin fire-and-forget]', err);
    }
  })();
}

export function handleGenerateBulletinsError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof BulletinBloqueError) {
    res.status(422).json({
      success: false,
      code: 'NOTES_NON_VALIDEES',
      message: error.message,
      notesBloquantes: error.notesBloquantes,
    });
    return;
  }
  if (error instanceof Error && error.message.includes('Conseil de Classe')) {
    res.status(422).json({ success: false, code: 'CONSEIL_REQUIS', message: error.message });
    return;
  }
  if (error instanceof Error && error.message.includes('Seul un administrateur')) {
    res.status(403).json({ success: false, code: 'FORBIDDEN_REGENERATION', message: error.message });
    return;
  }
  if (error instanceof Error && error.message.includes('motif obligatoire')) {
    res.status(400).json({ success: false, code: 'MOTIF_REGENERATION_REQUIS', message: error.message });
    return;
  }
  next(error);
}

export interface ResolvedSendPayload {
  classId: string;
  academicPeriodId: string;
  nomEtablissement: string;
  nomPeriode: string;
  langue: 'fr' | 'en';
}

export interface ResolvedSendParams {
  error?: { status: number; message: string };
  data?: ResolvedSendPayload;
}

export async function resolveSendBulletinsParams(params: {
  body: Request['body'];
  schoolId: string;
  anneeRepository: AnneeAcademiqueRepository;
  schoolRepository: SchoolRepository;
  classeRepository: ClasseRepository;
  sectionRepository: SectionRepository;
}): Promise<ResolvedSendParams> {
  const { body, schoolId, anneeRepository, schoolRepository, classeRepository, sectionRepository } = params;
  const classId = body?.classId as string | undefined;
  if (!classId) return { error: { status: 400, message: 'classId requis' } };

  let academicPeriodId = body?.academicPeriodId as string | undefined;
  let nomPeriode = body?.nomPeriode as string | undefined;
  let nomEtablissement = body?.nomEtablissement as string | undefined;

  if (!academicPeriodId) {
    const currentYear = await anneeRepository.findCourante(schoolId);
    if (currentYear) {
      const periodes = await anneeRepository.findPeriodesByAnnee(currentYear.id);
      const currentPeriod = periodes.find((p) => p.isCurrent) || periodes[0];
      academicPeriodId = currentPeriod?.id;
      if (!nomPeriode && currentPeriod) nomPeriode = currentPeriod.name;
    }
  }
  if (!academicPeriodId) {
    return { error: { status: 400, message: 'academicPeriodId requis ou aucune période active trouvée' } };
  }

  const ecole = await schoolRepository.findById(schoolId);
  if (!nomEtablissement) nomEtablissement = ecole?.name ?? 'Établissement';
  if (!nomPeriode) {
    const periode = await anneeRepository.findPeriodeById(academicPeriodId, schoolId);
    nomPeriode = periode?.name ?? 'Trimestre';
  }

  let sectionCode: string | null = null;
  if (ecole?.subsystem === 'BILINGUAL') {
    const cls = await classeRepository.findById(classId);
    if (cls?.sectionId) {
      const section = await sectionRepository.findById(cls.sectionId);
      sectionCode = section?.code ?? null;
    }
  }
  const langue = resolveLanguage(ecole?.subsystem, sectionCode);
  return { data: { classId, academicPeriodId, nomEtablissement, nomPeriode, langue } };
}

export async function streamClassReportCardsZip(params: {
  res: Response;
  schoolId: string;
  classId: string;
  requestedPeriodId?: string;
  anneeRepository: AnneeAcademiqueRepository;
  bulletinRepository: BulletinRepository;
}): Promise<void> {
  const { res, schoolId, classId, anneeRepository, bulletinRepository } = params;
  let academicPeriodId = params.requestedPeriodId;

  if (!academicPeriodId) {
    const currentYear = await anneeRepository.findCourante(schoolId);
    if (currentYear) {
      const periodes = await anneeRepository.findPeriodesByAnnee(currentYear.id);
      const currentPeriod = periodes.find((p) => p.isCurrent) || periodes[0];
      academicPeriodId = currentPeriod?.id;
    }
  }
  if (!academicPeriodId) {
    res.status(400).json({ success: false, message: 'academicPeriodId requis ou aucune période active trouvée' });
    return;
  }

  const reportCards = await bulletinRepository.findForExport(schoolId, academicPeriodId, classId);
  if (!reportCards.length) {
    res.status(404).json({
      success: false,
      message: "Aucun bulletin trouvé pour cette classe et cette période. Veuillez d'abord générer les bulletins.",
    });
    return;
  }

  const settings = await getEffectiveSchoolSettings(schoolId);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="bulletins-${classId}-${academicPeriodId}.zip"`);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.pipe(res);
  for (const reportCard of reportCards) {
    const { pdfBuffer, studentName } = await renderReportCardPdfBuffer(reportCard, schoolId, 'ADMIN', settings);
    archive.append(pdfBuffer, { name: `bulletin-${studentName.replace(/\s+/g, '-')}.pdf` });
  }
  await archive.finalize();
}
