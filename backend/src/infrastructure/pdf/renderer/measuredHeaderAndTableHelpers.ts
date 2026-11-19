import { existsSync } from 'node:fs';
import type PDFDocument from 'pdfkit';
import type {
  BulletinGroupSummary,
  BulletinSubjectSnapshotLine,
  StudentBulletinSnapshot,
} from '@domain/types/bulletinSnapshot';
import type {
  OfficialHeaderBlockSpec,
  StudentCardBlockSpec,
  SubjectTableBlockSpec,
  SubjectTableColumnKey,
  SubjectTableColumnSpec,
} from '@domain/types/bulletinTemplateSpec';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';

export type MeasuredPdfDoc = InstanceType<typeof PDFDocument>;

const TTF_REGULAR = '/usr/share/fonts/liberation-sans-fonts/LiberationSans-Regular.ttf';
const TTF_BOLD = '/usr/share/fonts/liberation-sans-fonts/LiberationSans-Bold.ttf';
const TTF_ITALIC = '/usr/share/fonts/liberation-sans-fonts/LiberationSans-Italic.ttf';

export interface FontSet {
  regular: string;
  bold: string;
  italic: string;
}

export function registerEmbeddedFonts(doc: MeasuredPdfDoc): FontSet {
  if (existsSync(TTF_REGULAR) && existsSync(TTF_BOLD) && existsSync(TTF_ITALIC)) {
    doc.registerFont('LibSans', TTF_REGULAR);
    doc.registerFont('LibSans-Bold', TTF_BOLD);
    doc.registerFont('LibSans-Italic', TTF_ITALIC);
    return { regular: 'LibSans', bold: 'LibSans-Bold', italic: 'LibSans-Italic' };
  }
  return { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };
}

export function resolveApcCote(average: number): 'A+' | 'A' | 'ECA' | 'NA' {
  if (average >= 18) return 'A+';
  if (average >= 15) return 'A';
  if (average >= 11) return 'ECA';
  return 'NA';
}

export function formatSubjectCell(line: BulletinSubjectSnapshotLine, key: SubjectTableColumnKey): string {
  const num = (v: number | undefined): string => (v === undefined ? '—' : v.toFixed(2));
  switch (key) {
    case 'subjectName': return line.subjectName;
    case 'coefficient': return String(line.coefficient);
    case 'seq1Score': return num(line.seq1Score);
    case 'seq2Score': return num(line.seq2Score);
    case 'seq3Score': return num(line.seq3Score);
    case 'seq4Score': return num(line.seq4Score);
    case 'seq5Score': return num(line.seq5Score);
    case 'seq6Score': return num(line.seq6Score);
    case 'classTestScore': return num(line.classTestScore);
    case 'terminalExamScore': return num(line.terminalExamScore);
    case 'theoreticalScore': return num(line.theoreticalScore);
    case 'practicalScore': return num(line.practicalScore);
    case 'oralScore': return num(line.oralScore);
    case 'selfDevelopmentScore': return num(line.selfDevelopmentScore);
    case 'subjectAverage': return line.subjectAverage.toFixed(2);
    case 'weightedScore': return line.weightedScore.toFixed(2);
    case 'subjectRank': return `${line.subjectRank}e`;
    case 'cote': return resolveApcCote(line.subjectAverage);
    case 'classSubjectAverage': return line.classSubjectAverage.toFixed(2);
    case 'teacherComment': return line.teacherComment ?? '—';
    case 'teacherName': return line.teacherName ?? '—';
    case 'competenceLabel': return line.competenceLabel ?? '—';
  }
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
    const colW = (usableW - 70) / 2;
    doc.font(fonts.bold).fontSize(7).fillColor('#0f172a')
      .text('RÉPUBLIQUE DU CAMEROUN', left, y0, { width: colW, align: 'center' })
      .font(fonts.italic).fontSize(6.5)
      .text('Paix — Travail — Patrie', left, y0 + 9, { width: colW, align: 'center' })
      .font(fonts.regular).fontSize(6.5)
      .text('MINISTÈRE DES ENSEIGNEMENTS SECONDAIRES', left, y0 + 18, { width: colW, align: 'center' });

    const rightX = left + usableW - colW;
    doc.font(fonts.bold).fontSize(7)
      .text('REPUBLIC OF CAMEROON', rightX, y0, { width: colW, align: 'center' })
      .font(fonts.italic).fontSize(6.5)
      .text('Peace — Work — Fatherland', rightX, y0 + 9, { width: colW, align: 'center' })
      .font(fonts.regular).fontSize(6.5)
      .text('MINISTRY OF SECONDARY EDUCATION', rightX, y0 + 18, { width: colW, align: 'center' });
  }

  if (spec.showLogo && options.school.logoBuffer) {
    try { doc.image(options.school.logoBuffer, left + usableW / 2 - 20, y0, { fit: [40, 36] }); } catch { /* ignore invalid image */ }
  }

  let cursorY = y0 + 38;
  if (spec.showDelegations && (options.school.regionalDelegation || options.school.departmentalDelegation)) {
    const delText = [options.school.regionalDelegation, options.school.departmentalDelegation].filter(Boolean).join(' • ');
    doc.font(fonts.regular).fontSize(7).fillColor('#334155').text(delText, left, cursorY, { width: usableW, align: 'center' });
    cursorY = doc.y + 1;
  }

  doc.font(fonts.bold).fontSize(12).fillColor('#0f172a').text(options.school.schoolName.toUpperCase(), left, cursorY, { width: usableW, align: 'center' });
  cursorY = doc.y;

  if (spec.showMotto && options.school.schoolMotto && options.school.schoolMotto.trim().length > 0) {
    doc.font(fonts.italic).fontSize(8).fillColor('#334155').text(options.school.schoolMotto.trim(), left, cursorY, { width: usableW, align: 'center' });
    cursorY = doc.y;
  }

  const titleLabel = isEn
    ? `REPORT CARD — ${options.periodName} (${options.yearName})`
    : `BULLETIN SCOLAIRE — ${options.periodName} (${options.yearName})`;
  doc.rect(left, cursorY + 3, usableW, 18).fillAndStroke('#e2e8f0', '#0f172a');
  doc.font(fonts.bold).fontSize(9.5).fillColor('#0f172a').text(titleLabel, left + 4, cursorY + 7, { width: usableW - 8, align: 'center' });

  if (options.isDuplicate) {
    const dupLabel = `DUPLICATA #${options.reprintCount ?? 1}`;
    doc.font(fonts.bold).fontSize(8).fillColor('#0f172a').text(dupLabel, left, cursorY + 7, { width: usableW - 6, align: 'right' });
  }
  doc.y = cursorY + 26;
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
    const dob = id?.dateOfBirth ? id.dateOfBirth.slice(0, 10) : '—';
    const pob = id?.placeOfBirth ?? '—';
    extraParts.push(`${isEn ? 'Born' : 'Né(e) le'} : ${dob} (${pob})`);
  }
  if (spec.fields.includes('classSize')) extraParts.push(`${isEn ? 'Roll' : 'Effectif'} : ${snapshot.totalStudents}`);
  if (spec.fields.includes('mainTeacher')) extraParts.push(`${isEn ? 'Class Master' : 'Prof. Principal'} : ${snapshot.mainTeacherName ?? '—'}`);
  if (extraParts.length > 0) lines.push(extraParts.join('   |   '));

  doc.font(fonts.regular).fontSize(8);
  const textH = lines.reduce((sum, l) => sum + doc.heightOfString(l, { width: boxW - 12 }) + 2, 8);
  const boxH = Math.max(hasPhoto ? 50 : 38, textH);

  doc.rect(left, startY, boxW, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
  let ty = startY + 5;
  lines.forEach((line, idx) => {
    doc.font(idx === 0 ? fonts.bold : fonts.regular).fontSize(idx === 0 ? 8.5 : 7.8).fillColor('#0f172a')
      .text(line, left + 6, ty, { width: boxW - 12 });
    ty = doc.y + 1;
  });

  if (hasPhoto) {
    const px = left + usableW - 50;
    doc.rect(px, startY, 50, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
    if (options.studentPhotoBuffer) {
      try { doc.image(options.studentPhotoBuffer, px + 2, startY + 2, { fit: [46, boxH - 4] }); } catch { /* fallback label */ }
    } else {
      doc.font(fonts.regular).fontSize(6.5).fillColor('#64748b').text('PHOTO', px + 4, startY + boxH / 2 - 4, { width: 42, align: 'center' });
    }
  }
  doc.y = startY + boxH + 6;
}

function drawTableHeaderRow(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  cols: SubjectTableColumnSpec[],
  colWidths: number[],
  left: number,
  isEn: boolean,
  fontSize: number,
): void {
  const headerH = 18;
  const y = doc.y;
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  doc.rect(left, y, totalW, headerH).fillAndStroke('#1e293b', '#0f172a');
  let x = left;
  cols.forEach((col, i) => {
    const w = colWidths[i]!;
    doc.font(fonts.bold).fontSize(Math.max(6.2, fontSize - 0.5)).fillColor('#ffffff')
      .text(isEn ? col.labelEn : col.labelFr, x + 2, y + 5, { width: w - 4, align: col.align ?? 'center' });
    x += w;
  });
  doc.y = y + headerH;
}

function measureRowHeight(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  line: BulletinSubjectSnapshotLine,
  cols: SubjectTableColumnSpec[],
  colWidths: number[],
  fontSize: number,
): number {
  doc.font(fonts.regular).fontSize(fontSize);
  let maxH = fontSize + 6;
  cols.forEach((col, idx) => {
    const val = formatSubjectCell(line, col.key);
    const h = doc.heightOfString(val, { width: Math.max(10, colWidths[idx]! - 6), lineGap: 0.8 });
    if (h + 6 > maxH) maxH = h + 6;
  });
  return Math.ceil(maxH);
}

function drawGroupSubtotalRow(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  grp: BulletinGroupSummary,
  left: number,
  totalW: number,
  isEn: boolean,
): void {
  const h = 15;
  const y = doc.y;
  doc.rect(left, y, totalW, h).fillAndStroke('#e2e8f0', '#334155');
  const text = isEn
    ? `Subtotal ${grp.groupLabel} — Coef: ${grp.totalCoefficient} | Total: ${grp.totalWeightedScore.toFixed(2)} | Avg: ${grp.groupAverage.toFixed(2)}/20 (Rank ${grp.groupRank}/${grp.groupTotalStudents})`
    : `Sous-total ${grp.groupLabel} — Coef : ${grp.totalCoefficient} | Total : ${grp.totalWeightedScore.toFixed(2)} | Moy : ${grp.groupAverage.toFixed(2)}/20 (Rang ${grp.groupRank}e/${grp.groupTotalStudents})`;
  doc.font(fonts.bold).fontSize(7.3).fillColor('#0f172a').text(text, left + 5, y + 4, { width: totalW - 10 });
  doc.y = y + h;
}

export function drawMeasuredSubjectTable(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  spec: SubjectTableBlockSpec,
  snapshot: StudentBulletinSnapshot,
  language: 'fr' | 'en',
  fontSize: number,
): void {
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const totalRatio = spec.columns.reduce((s, c) => s + c.ratio, 0) || 100;
  const colWidths = spec.columns.map((c) => Math.floor((usableW * c.ratio) / totalRatio));
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 18;
  const isEn = language === 'en';

  const ensureSpace = (needed: number) => {
    if (doc.y + needed > bottomLimit) {
      doc.addPage();
      drawTableHeaderRow(doc, fonts, spec.columns, colWidths, left, isEn, fontSize);
    }
  };

  drawTableHeaderRow(doc, fonts, spec.columns, colWidths, left, isEn, fontSize);

  const groupedKeys: Array<{ key: string; label: string; lines: BulletinSubjectSnapshotLine[]; summary?: BulletinGroupSummary }> = [];
  if (spec.grouping === 'byGroup') {
    const byKey = new Map<string, BulletinSubjectSnapshotLine[]>();
    for (const l of snapshot.subjectLines) {
      const arr = byKey.get(l.groupKey) ?? [];
      arr.push(l);
      byKey.set(l.groupKey, arr);
    }
    const summaryMap = new Map(snapshot.groupSummaries.map((g) => [g.groupKey, g]));
    for (const [key, lines] of byKey.entries()) {
      groupedKeys.push({ key, label: lines[0]?.groupLabel ?? key, lines, summary: summaryMap.get(key) });
    }
  } else {
    groupedKeys.push({ key: 'ALL', label: '', lines: snapshot.subjectLines });
  }

  let rowIdx = 0;
  for (const grp of groupedKeys) {
    if (spec.grouping === 'byGroup' && grp.label) {
      ensureSpace(32);
      const gy = doc.y;
      doc.rect(left, gy, totalW, 14).fillAndStroke('#cbd5e1', '#334155');
      doc.font(fonts.bold).fontSize(7.5).fillColor('#0f172a').text(grp.label.toUpperCase(), left + 5, gy + 3.5, { width: totalW - 10 });
      doc.y = gy + 14;
    }

    for (const line of grp.lines) {
      const rowH = measureRowHeight(doc, fonts, line, spec.columns, colWidths, fontSize);
      ensureSpace(rowH);
      const ry = doc.y;
      const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(left, ry, totalW, rowH).fillAndStroke(bg, '#94a3b8');

      let cx = left;
      spec.columns.forEach((col, i) => {
        const w = colWidths[i]!;
        if (i > 0) doc.moveTo(cx, ry).lineTo(cx, ry + rowH).strokeColor('#cbd5e1').lineWidth(0.4).stroke();
        const isBoldCol = col.key === 'subjectName' || col.key === 'subjectAverage' || col.key === 'cote';
        doc.font(isBoldCol ? fonts.bold : fonts.regular).fontSize(fontSize).fillColor('#0f172a')
          .text(formatSubjectCell(line, col.key), cx + 3, ry + 3, {
            width: Math.max(8, w - 6),
            align: col.align ?? (col.key === 'subjectName' || col.key === 'teacherComment' || col.key === 'teacherName' || col.key === 'competenceLabel' ? 'left' : 'center'),
            lineGap: 0.8,
          });
        cx += w;
      });
      doc.y = ry + rowH;
      rowIdx++;
    }

    if (spec.grouping === 'byGroup' && spec.showGroupSubtotals && grp.summary) {
      ensureSpace(16);
      drawGroupSubtotalRow(doc, fonts, grp.summary, left, totalW, isEn);
    }
  }
  doc.y += 6;
}

