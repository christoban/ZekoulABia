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

export class MeasuredPdfKitBulletinRenderer implements BulletinRendererPort {
  readonly engineName = 'measured-pdfkit';

  async render(
    snapshot: StudentBulletinSnapshot,
    templateSpec: BulletinTemplateSpec,
    options: BulletinRenderOptions,
  ): Promise<Buffer> {
    const qrBlock = templateSpec.blocks.find((b): b is VerifyQrBlockSpec => b.type === 'verifyQr');
    const sigBlock = templateSpec.blocks.find((b): b is SignaturesBlockSpec => b.type === 'signatures');
    const qrBuffer =
      qrBlock && options.verifyUrl
        ? await QRCode.toBuffer(options.verifyUrl, {
            type: 'png',
            errorCorrectionLevel: 'M',
            margin: 2,
            scale: 6,
          }).catch(() => null)
        : null;

    const subjectCount = snapshot.subjectLines.length;
    const baseFontSize = subjectCount >= 18 ? 6.8 : subjectCount >= 14 ? 7.2 : 7.8;

    const doc = new PDFDocument({
      size: templateSpec.page.size,
      layout: templateSpec.page.orientation,
      margin: templateSpec.page.margin,
      bufferPages: true,
    });

    return collectPdfBuffer(doc, () => {
      const fonts = registerEmbeddedFonts(doc);

      for (const block of templateSpec.blocks) {
        switch (block.type) {
          case 'officialHeader':
            drawOfficialHeaderBlock(doc, fonts, block, options);
            break;
          case 'studentCard':
            drawStudentCardBlock(doc, fonts, block, snapshot, options);
            break;
          case 'subjectTable':
            drawMeasuredSubjectTable(doc, fonts, block, snapshot, options.language, baseFontSize, options);
            break;
          case 'classProfile':
            drawClassProfileBlock(doc, fonts, block, snapshot, options.language, options);
            break;
          case 'councilDecision':
            drawCouncilDecisionBlock(doc, fonts, block, snapshot, options);
            break;
          case 'conductSummary':
            drawConductSummaryBlock(doc, fonts, block, snapshot, options.language);
            break;
          case 'signatures':
          case 'verifyQr':
            break;
        }
      }

      if (sigBlock || qrBlock) {
        drawSignaturesAndQrBlock(doc, fonts, sigBlock, qrBlock, options, qrBuffer);
      }
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
}

