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

export const HEADER_EMBLEM_GAP = 5;

/** Boîte réservée au logo / aux armoiries en haut d'en-tête (hauteur 0 si aucun emblème). */
export function resolveHeaderEmblemBox(hasLogo: boolean, hasCoat: boolean): { width: number; height: number } {
  if (hasLogo && hasCoat) return { width: 28, height: 28 };
  if (hasLogo || hasCoat) return { width: 38, height: 34 };
  return { width: 0, height: 0 };
}

function pickBannerTextColor(bgHex: string): string {
  const clean = bgHex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#0f172a';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.52 ? '#ffffff' : '#0f172a';
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
  const isMinedub = spec.ministry === 'MINEDUB';
  const ministryFr = isMinedub ? "MINISTÈRE DE L'ÉDUCATION DE BASE" : 'MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES';
  const ministryEn = isMinedub ? 'MINISTRY OF BASIC EDUCATION' : 'MINISTRY OF SECONDARY EDUCATION';

  let ministryTextBottom = y0;
  if (spec.bilingual) {
    const colW = (usableW - 72) / 2;
    doc.font(fonts.bold).fontSize(7.2).fillColor('#0f172a')
      .text('RÉPUBLIQUE DU CAMEROUN', left, y0, { width: colW, align: 'center' })
      .font(fonts.italic).fontSize(7)
      .text('Paix — Travail — Patrie', left, y0 + 9, { width: colW, align: 'center' })
      .font(fonts.regular).fontSize(7)
      .text(ministryFr, left, y0 + 18, { width: colW, align: 'center' });
    const leftBottom = doc.y;

    const rightX = left + usableW - colW;
    doc.font(fonts.bold).fontSize(7.2)
      .text('REPUBLIC OF CAMEROON', rightX, y0, { width: colW, align: 'center' })
      .font(fonts.italic).fontSize(7)
      .text('Peace — Work — Fatherland', rightX, y0 + 9, { width: colW, align: 'center' })
      .font(fonts.regular).fontSize(7)
      .text(ministryEn, rightX, y0 + 18, { width: colW, align: 'center' });
    const rightBottom = doc.y;
    ministryTextBottom = Math.max(leftBottom, rightBottom);
  } else if (spec.ministry) {
    doc.font(fonts.bold).fontSize(7.2).fillColor('#0f172a')
      .text(isEn ? 'REPUBLIC OF CAMEROON' : 'RÉPUBLIQUE DU CAMEROUN', left, y0, { width: usableW, align: 'center' })
      .font(fonts.italic).fontSize(7)
      .text(isEn ? 'Peace — Work — Fatherland' : 'Paix — Travail — Patrie', left, y0 + 9, { width: usableW, align: 'center' })
      .font(fonts.regular).fontSize(7)
      .text(isEn ? ministryEn : ministryFr, left, y0 + 18, { width: usableW, align: 'center' });
    ministryTextBottom = doc.y;
  }

  const hasLogo = spec.showLogo && Boolean(options.school.logoBuffer);
  const hasCoat = spec.showCoatOfArms && Boolean(options.school.coatOfArmsEnabled) && Boolean(options.school.coatOfArmsBuffer);
  const emblemBox = resolveHeaderEmblemBox(hasLogo, hasCoat);
  const emblemTopY = !spec.bilingual && spec.ministry ? ministryTextBottom + 2 : y0;

  if (hasLogo && hasCoat) {
    try {
      doc.image(options.school.logoBuffer!, left + usableW / 2 - emblemBox.width - 2, emblemTopY, {
        fit: [emblemBox.width, emblemBox.height],
        align: 'center',
        valign: 'center',
      });
    } catch { /* ignore invalid image */ }
    try {
      doc.image(options.school.coatOfArmsBuffer!, left + usableW / 2 + 2, emblemTopY, {
        fit: [emblemBox.width, emblemBox.height],
        align: 'center',
        valign: 'center',
      });
    } catch { /* ignore invalid image */ }
  } else if (hasLogo) {
    try {
      doc.image(options.school.logoBuffer!, left + usableW / 2 - emblemBox.width / 2, emblemTopY, {
        fit: [emblemBox.width, emblemBox.height],
        align: 'center',
        valign: 'center',
      });
    } catch { /* ignore invalid image */ }
  } else if (hasCoat) {
    try {
      doc.image(options.school.coatOfArmsBuffer!, left + usableW / 2 - emblemBox.width / 2, emblemTopY, {
        fit: [emblemBox.width, emblemBox.height],
        align: 'center',
        valign: 'center',
      });
    } catch { /* ignore invalid image */ }
  }

  // Le texte (délégations, nom de l'établissement) démarre STRICTEMENT SOUS le bas réel des colonnes ministérielles et du logo/armoiries.
  const emblemBottom = emblemBox.height > 0 ? emblemTopY + emblemBox.height : y0;
  let cursorY = Math.max(ministryTextBottom, emblemBottom) + HEADER_EMBLEM_GAP;
  const delParts = [
    options.school.regionalDelegation?.trim(),
    options.school.departmentalDelegation?.trim(),
  ].filter((v): v is string => Boolean(v && v.length > 0));
  if (spec.showDelegations && delParts.length > 0) {
    doc.font(fonts.regular).fontSize(7).fillColor('#334155').text(delParts.join(' • '), left, cursorY, { width: usableW, align: 'center' });
    cursorY = doc.y + 1.5;
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
  const bannerTextColor = pickBannerTextColor(bannerColor);
  doc.rect(left, cursorY + 3, usableW, 17).fillAndStroke(bannerColor, '#0f172a');
  doc.font(fonts.bold).fontSize(9).fillColor(bannerTextColor).text(titleLabel, left + 4, cursorY + 6.5, { width: usableW - (options.isDuplicate ? 105 : 8), align: 'center' });

  if (options.isDuplicate) {
    const dupNum = options.reprintCount && options.reprintCount > 0 ? options.reprintCount : 1;
    const dupLabel = isEn ? `DUPLICATE #${dupNum}` : `DUPLICATA n° ${dupNum}`;
    doc.font(fonts.bold).fontSize(7.5).fillColor(bannerTextColor).text(dupLabel, left, cursorY + 7, { width: usableW - 6, align: 'right' });
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
        doc.font(fonts.regular).fontSize(7).fillColor('#64748b').text('PHOTO', px + 4, startY + boxH / 2 - 4, { width: 42, align: 'center' });
      }
    } else {
      doc.font(fonts.regular).fontSize(7).fillColor('#64748b').text('PHOTO', px + 4, startY + boxH / 2 - 4, { width: 42, align: 'center' });
    }
  }
  doc.y = startY + boxH + 5;
}

