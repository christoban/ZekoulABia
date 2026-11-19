/**
 * INFRASTRUCTURE LAYER — Adaptateur MeasuredPdfKitBulletinRenderer
 *
 * Implémente BulletinRendererPort avec PDFKit + polices TTF embarquées + calcul strict
 * des hauteurs de chaque cellule avant dessin (0 chevauchement, lisible en N&B).
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type {
  BulletinTemplateSpec,
  SignaturesBlockSpec,
  VerifyQrBlockSpec,
} from '@domain/types/bulletinTemplateSpec';
import type {
  BulletinRendererPort,
  BulletinRenderOptions,
} from '@domain/ports/services/BulletinRendererPort';
import {
  drawOfficialHeaderBlock,
  drawStudentCardBlock,
  registerEmbeddedFonts,
} from './measuredHeaderHelpers';
import { drawMeasuredSubjectTable } from './measuredSubjectTableHelpers';
import {
  drawClassProfileBlock,
  drawConductSummaryBlock,
  drawCouncilDecisionBlock,
  drawSignaturesAndQrBlock,
} from './measuredSummaryHelpers';
import {
  drawAnnualBilingualSummary,
  drawBilingualApcSummary,
  drawPrimaryPointsRatioSummary,
  drawTechnicalGroupedSummary,
} from './measuredFamilySummaryHelpers';

function collectPdfBuffer(
  doc: InstanceType<typeof PDFDocument>,
  build: () => void,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      build();
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function resolveTableFontSize(snapshot: StudentBulletinSnapshot, templateSpec: BulletinTemplateSpec): number {
  const count = snapshot.subjectLines.length;
  if (templateSpec.layoutVariant === 'ANNUAL_BILINGUAL') return count >= 14 ? 5.9 : 6.2;
  if (templateSpec.layoutVariant === 'PRIMARY_POINTS_RATIO') return count >= 20 ? 5.9 : 6.4;
  return count >= 18 ? 6.7 : count >= 14 ? 7.1 : 7.6;
}

async function generateQrPng(verifyUrl?: string): Promise<Buffer | null> {
  if (!verifyUrl) return null;
  return QRCode.toBuffer(verifyUrl, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 6,
  }).catch(() => null);
}

function drawBulletinPageOnDoc(
  doc: InstanceType<typeof PDFDocument>,
  fonts: ReturnType<typeof registerEmbeddedFonts>,
  snapshot: StudentBulletinSnapshot,
  templateSpec: BulletinTemplateSpec,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
): void {
  const sigBlock = templateSpec.blocks.find((b): b is SignaturesBlockSpec => b.type === 'signatures');
  const qrBlock = templateSpec.blocks.find((b): b is VerifyQrBlockSpec => b.type === 'verifyQr');
  const baseFontSize = resolveTableFontSize(snapshot, templateSpec);
  const variant = templateSpec.layoutVariant;
  const usesFamilyFooter =
    variant === 'ANNUAL_BILINGUAL' ||
    variant === 'TECHNICAL_GROUPED' ||
    variant === 'BILINGUAL_APC' ||
    variant === 'PRIMARY_POINTS_RATIO';

  for (const block of templateSpec.blocks) {
    switch (block.type) {
      case 'officialHeader':
        drawOfficialHeaderBlock(doc, fonts, block, options);
        break;
      case 'studentCard':
        drawStudentCardBlock(doc, fonts, block, snapshot, options);
        break;
      case 'subjectTable':
        drawMeasuredSubjectTable(doc, fonts, block, snapshot, options.language, baseFontSize, options, templateSpec);
        break;
      case 'classProfile':
        if (!usesFamilyFooter) drawClassProfileBlock(doc, fonts, block, snapshot, options.language, options);
        break;
      case 'councilDecision':
        if (!usesFamilyFooter) drawCouncilDecisionBlock(doc, fonts, block, snapshot, options);
        break;
      case 'conductSummary':
        if (!usesFamilyFooter) drawConductSummaryBlock(doc, fonts, block, snapshot, options.language);
        break;
      case 'signatures':
      case 'verifyQr':
        break;
    }
  }

  if (variant === 'ANNUAL_BILINGUAL') {
    drawAnnualBilingualSummary(doc, fonts, snapshot, options, qrBuffer);
  } else if (variant === 'TECHNICAL_GROUPED') {
    drawTechnicalGroupedSummary(doc, fonts, snapshot, options, qrBuffer);
  } else if (variant === 'BILINGUAL_APC') {
    drawBilingualApcSummary(doc, fonts, snapshot, options, qrBuffer);
  } else if (variant === 'PRIMARY_POINTS_RATIO') {
    drawPrimaryPointsRatioSummary(doc, fonts, snapshot, options, qrBuffer);
  } else if (sigBlock || qrBlock) {
    drawSignaturesAndQrBlock(doc, fonts, sigBlock, qrBlock, options, qrBuffer);
  }

  if (templateSpec.validationNotice) {
    const left = doc.page.margins.left;
    const usableW = doc.page.width - left - doc.page.margins.right;
    const yNotice = Math.min(doc.y + 1, doc.page.height - doc.page.margins.bottom - 9);
    doc.font(fonts.italic).fontSize(5.8).fillColor('#64748b')
      .text(`[${templateSpec.validationNotice}]`, left, yNotice, { width: usableW, align: 'right' });
  }
}

export class MeasuredPdfKitBulletinRenderer implements BulletinRendererPort {
  readonly engineName = 'measured-pdfkit';

  async render(
    snapshot: StudentBulletinSnapshot,
    templateSpec: BulletinTemplateSpec,
    options: BulletinRenderOptions,
  ): Promise<Buffer> {
    const qrBlock = templateSpec.blocks.find((b): b is VerifyQrBlockSpec => b.type === 'verifyQr');
    const qrBuffer = qrBlock ? await generateQrPng(options.verifyUrl) : null;

    const doc = new PDFDocument({
      size: templateSpec.page.size,
      layout: templateSpec.page.orientation,
      margin: templateSpec.page.margin,
      bufferPages: true,
    });

    return collectPdfBuffer(doc, () => {
      const fonts = registerEmbeddedFonts(doc);
      drawBulletinPageOnDoc(doc, fonts, snapshot, templateSpec, options, qrBuffer);
    });
  }

  async renderBatch(
    items: Array<{ snapshot: StudentBulletinSnapshot; options: BulletinRenderOptions }>,
    templateSpec: BulletinTemplateSpec,
  ): Promise<Buffer[]> {
    const out: Buffer[] = [];
    for (const item of items) {
      out.push(await this.render(item.snapshot, templateSpec, item.options));
    }
    return out;
  }

  async renderMergedClassPdf(
    items: Array<{
      snapshot: StudentBulletinSnapshot;
      templateSpec: BulletinTemplateSpec;
      options: BulletinRenderOptions;
    }>,
  ): Promise<Buffer> {
    if (items.length === 0) {
      throw new Error('Aucun bulletin à fusionner dans le PDF de classe.');
    }
    const firstSpec = items[0]!.templateSpec;
    const qrBuffers = await Promise.all(
      items.map((item) => {
        const qrBlock = item.templateSpec.blocks.find((b): b is VerifyQrBlockSpec => b.type === 'verifyQr');
        return qrBlock ? generateQrPng(item.options.verifyUrl) : Promise.resolve(null);
      }),
    );

    const doc = new PDFDocument({
      size: firstSpec.page.size,
      layout: firstSpec.page.orientation,
      margin: firstSpec.page.margin,
      bufferPages: true,
    });

    return collectPdfBuffer(doc, () => {
      const fonts = registerEmbeddedFonts(doc);
      items.forEach((item, idx) => {
        if (idx > 0) {
          doc.addPage({
            size: item.templateSpec.page.size,
            layout: item.templateSpec.page.orientation,
            margin: item.templateSpec.page.margin,
          });
        }
        drawBulletinPageOnDoc(doc, fonts, item.snapshot, item.templateSpec, item.options, qrBuffers[idx] ?? null);
      });
    });
  }
}
