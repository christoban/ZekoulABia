import { existsSync } from 'node:fs';
import path from 'node:path';
import type PDFDocument from 'pdfkit';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type {
  OfficialHeaderBlockSpec,
  StudentCardBlockSpec,
} from '@domain/types/bulletinTemplateSpec';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import { formatPeriodBannerTitle } from './measuredFormatHelpers';

export type MeasuredPdfDoc = InstanceType<typeof PDFDocument>;

export const DEFAULT_EMBEDDED_FONT_DIR = path.resolve(import.meta.dir, '../../../../assets/fonts');

export interface EmbeddedFontPaths {
  regular: string;
  bold: string;
  italic: string;
}

export interface FontSet {
  regular: string;
  bold: string;
  italic: string;
}

export function resolveEmbeddedFontPaths(baseDir = DEFAULT_EMBEDDED_FONT_DIR): EmbeddedFontPaths {
  return {
    regular: path.join(baseDir, 'LiberationSans-Regular.ttf'),
    bold: path.join(baseDir, 'LiberationSans-Bold.ttf'),
    italic: path.join(baseDir, 'LiberationSans-Italic.ttf'),
  };
}

export function verifyEmbeddedFontsExist(paths = resolveEmbeddedFontPaths()): void {
  const missing = [paths.regular, paths.bold, paths.italic].filter((p) => !existsSync(p));
  if (missing.length > 0) {
    throw new Error(`Police TTF embarquée introuvable : ${missing.join(', ')}`);
  }
}

export function registerEmbeddedFonts(
  doc: MeasuredPdfDoc,
  fontDir = DEFAULT_EMBEDDED_FONT_DIR,
): FontSet {
  const paths = resolveEmbeddedFontPaths(fontDir);
  verifyEmbeddedFontsExist(paths);
  doc.registerFont('LibSans', paths.regular);
  doc.registerFont('LibSans-Bold', paths.bold);
  doc.registerFont('LibSans-Italic', paths.italic);
  return { regular: 'LibSans', bold: 'LibSans-Bold', italic: 'LibSans-Italic' };
}

function formatBirthDate(isoOrRaw: string | null | undefined): string {
  if (!isoOrRaw) return '—';
  const ymd = isoOrRaw.slice(0, 10);
  const parts = ymd.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return ymd;
}

export function drawOfficialHeaderBlock(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  spec: OfficialHeaderBlockSpec,
  options: BulletinRenderOptions,
): void {
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const y0 = doc.y;
  const isEn = options.language === 'en';

  if (spec.bilingual) {
    const colW = (usableW - 64) / 2;
    doc.font(fonts.bold).fontSize(6.8).fillColor('#0f172a')
      .text('RÉPUBLIQUE DU CAMEROUN', left, y0, { width: colW, align: 'center' })
      .font(fonts.italic).fontSize(6.2)
      .text('Paix — Travail — Patrie', left, y0 + 8.5, { width: colW, align: 'center' })
      .font(fonts.regular).fontSize(6)
      .text('MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES', left, y0 + 16.5, { width: colW, align: 'center' });

    const rightX = left + usableW - colW;
    doc.font(fonts.bold).fontSize(6.8)
      .text('REPUBLIC OF CAMEROON', rightX, y0, { width: colW, align: 'center' })
      .font(fonts.italic).fontSize(6.2)
      .text('Peace — Work — Fatherland', rightX, y0 + 8.5, { width: colW, align: 'center' })
      .font(fonts.regular).fontSize(6)
      .text('MINISTRY OF SECONDARY EDUCATION', rightX, y0 + 16.5, { width: colW, align: 'center' });
  }

  const hasLogo = spec.showLogo && Boolean(options.school.logoBuffer);
  const hasCoat = spec.showCoatOfArms && Boolean(options.school.coatOfArmsEnabled) && Boolean(options.school.coatOfArmsBuffer);

  if (hasLogo && hasCoat) {
    try { doc.image(options.school.logoBuffer!, left + usableW / 2 - 28, y0, { fit: [26, 26] }); } catch { /* ignore invalid image */ }
    try { doc.image(options.school.coatOfArmsBuffer!, left + usableW / 2 + 2, y0, { fit: [26, 26] }); } catch { /* ignore invalid image */ }
  } else if (hasLogo) {
    try { doc.image(options.school.logoBuffer!, left + usableW / 2 - 20, y0, { fit: [40, 34] }); } catch { /* ignore invalid image */ }
  } else if (hasCoat) {
    try { doc.image(options.school.coatOfArmsBuffer!, left + usableW / 2 - 20, y0, { fit: [40, 34] }); } catch { /* ignore invalid image */ }
  }

  let cursorY = y0 + 29;
  const delParts = [
    options.school.regionalDelegation?.trim(),
    options.school.departmentalDelegation?.trim(),
  ].filter((v): v is string => Boolean(v && v.length > 0));
  if (spec.showDelegations && delParts.length > 0) {
    doc.font(fonts.regular).fontSize(6.5).fillColor('#334155').text(delParts.join(' • '), left, cursorY, { width: usableW, align: 'center' });
    cursorY = doc.y + 1;
  }

  doc.font(fonts.bold).fontSize(11.5).fillColor('#0f172a').text(options.school.schoolName.toUpperCase(), left, cursorY, { width: usableW, align: 'center' });
  cursorY = doc.y;

  const subMeta: string[] = [];
  if (spec.showMotto && options.school.schoolMotto && options.school.schoolMotto.trim().length > 0) {
    subMeta.push(options.school.schoolMotto.trim());
  }
  const contactParts = [
    options.school.city?.trim(),
    options.school.bp?.trim() ? `BP ${options.school.bp.trim()}` : null,
    options.school.phone?.trim() ? `${isEn ? 'Tel' : 'Tél'} : ${options.school.phone.trim()}` : null,
    options.school.foundingYear ? `${isEn ? 'Est.' : 'Fondé en'} ${options.school.foundingYear}` : null,
    options.school.authorizationNumber?.trim() ? `${isEn ? 'Auth.' : 'Aut. n°'} ${options.school.authorizationNumber.trim()}` : null,
  ].filter((v): v is string => Boolean(v && v.length > 0));
  if (contactParts.length > 0) subMeta.push(contactParts.join(' • '));

  if (subMeta.length > 0) {
    doc.font(fonts.italic).fontSize(7.2).fillColor('#334155').text(subMeta.join('   —   '), left, cursorY, { width: usableW, align: 'center' });
    cursorY = doc.y;
  }

  const titleLabel = formatPeriodBannerTitle(
    options.periodName,
    options.yearName,
    isEn,
    spec.periodLabelMode,
    options.isAnnual,
  );
  const bannerColor = options.school.accentColor?.trim() || '#e2e8f0';
  doc.rect(left, cursorY + 3, usableW, 17).fillAndStroke(bannerColor, '#0f172a');
  doc.font(fonts.bold).fontSize(9).fillColor('#0f172a').text(titleLabel, left + 4, cursorY + 6.5, { width: usableW - (options.isDuplicate ? 105 : 8), align: 'center' });

  if (options.isDuplicate) {
    const dupNum = options.reprintCount && options.reprintCount > 0 ? options.reprintCount : 1;
    const dupLabel = isEn ? `DUPLICATE #${dupNum}` : `DUPLICATA n° ${dupNum}`;
    doc.font(fonts.bold).fontSize(7.5).fillColor('#0f172a').text(dupLabel, left, cursorY + 7, { width: usableW - 6, align: 'right' });
  }
  doc.y = cursorY + 23;
}

export function drawStudentCardBlock(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  spec: StudentCardBlockSpec,
  snapshot: StudentBulletinSnapshot,
  options: BulletinRenderOptions,
): void {
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const isEn = options.language === 'en';
  const id = snapshot.studentIdentity;
  const hasPhoto = spec.fields.includes('photo');
  const boxW = hasPhoto ? usableW - 56 : usableW;
  const startY = doc.y;

  const lines: string[] = [];
  lines.push(`${isEn ? 'Student' : 'Élève'} : ${id?.fullName ?? snapshot.studentId}   |   ${isEn ? 'Class' : 'Classe'} : ${options.className}`);
  const metaParts: string[] = [];
  if (spec.fields.includes('matricule')) metaParts.push(`Matricule : ${id?.matricule ?? '—'}`);
  if (spec.fields.includes('sex')) metaParts.push(`${isEn ? 'Sex' : 'Sexe'} : ${id?.gender ?? '—'}`);
  if (spec.fields.includes('repeater')) metaParts.push(`${isEn ? 'Repeater' : 'Redoublant'} : ${id?.isRepeater ? (isEn ? 'Yes' : 'Oui') : (isEn ? 'No' : 'Non')}`);
  if (metaParts.length > 0) lines.push(metaParts.join('   |   '));

  const extraParts: string[] = [];
  if (spec.fields.includes('birth')) {
    extraParts.push(`${isEn ? 'Born' : 'Né(e) le'} : ${formatBirthDate(id?.dateOfBirth)} (${id?.placeOfBirth ?? '—'})`);
  }
  if (spec.fields.includes('classSize')) extraParts.push(`${isEn ? 'Roll' : 'Effectif'} : ${snapshot.totalStudents}`);
  if (spec.fields.includes('mainTeacher')) extraParts.push(`${isEn ? 'Class Master' : 'Prof. Principal'} : ${snapshot.mainTeacherName ?? '—'}`);
  if (extraParts.length > 0) lines.push(extraParts.join('   |   '));

  doc.font(fonts.regular).fontSize(7.5);
  const textH = lines.reduce((sum, l) => sum + doc.heightOfString(l, { width: boxW - 12 }) + 1.5, 7);
  const boxH = Math.max(hasPhoto ? 48 : 36, textH);

  doc.rect(left, startY, boxW, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
  let ty = startY + 4;
  lines.forEach((line, idx) => {
    doc.font(idx === 0 ? fonts.bold : fonts.regular).fontSize(idx === 0 ? 8.2 : 7.4).fillColor('#0f172a')
      .text(line, left + 6, ty, { width: boxW - 12 });
    ty = doc.y + 1;
  });

  if (hasPhoto) {
    const px = left + usableW - 50;
    doc.rect(px, startY, 50, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
    if (options.studentPhotoBuffer) {
      try {
        doc.image(options.studentPhotoBuffer, px + 2, startY + 2, { fit: [46, boxH - 4], align: 'center', valign: 'center' });
      } catch {
        doc.font(fonts.regular).fontSize(6).fillColor('#64748b').text('PHOTO', px + 4, startY + boxH / 2 - 4, { width: 42, align: 'center' });
      }
    } else {
      doc.font(fonts.regular).fontSize(6.5).fillColor('#64748b').text('PHOTO', px + 4, startY + boxH / 2 - 4, { width: 42, align: 'center' });
    }
  }
  doc.y = startY + boxH + 5;
}

