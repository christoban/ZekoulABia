import type {
  BulletinGroupSummary,
  BulletinSubjectSnapshotLine,
  StudentBulletinSnapshot,
} from '@domain/types/bulletinSnapshot';
import type {
  SubjectTableBlockSpec,
  SubjectTableColumnKey,
  SubjectTableColumnSpec,
} from '@domain/types/bulletinTemplateSpec';
import type { FontSet, MeasuredPdfDoc } from './measuredHeaderHelpers';

export function resolveApcCote(average: number): 'A+' | 'A' | 'ECA' | 'NA' {
  if (average >= 18) return 'A+';
  if (average >= 15) return 'A';
  if (average >= 11) return 'ECA';
  return 'NA';
}

export function formatRankLabel(rank: number, isEn: boolean): string {
  if (!isEn) return rank === 1 ? '1er' : `${rank}e`;
  if (rank % 100 >= 11 && rank % 100 <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

export function formatSubjectCell(line: BulletinSubjectSnapshotLine, key: SubjectTableColumnKey, isEn = false): string {
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
    case 'subjectRank': return formatRankLabel(line.subjectRank, isEn);
    case 'cote': return resolveApcCote(line.subjectAverage);
    case 'classSubjectAverage': return line.classSubjectAverage.toFixed(2);
    case 'teacherComment': return line.teacherComment ?? '—';
    case 'teacherName': return line.teacherName ?? '—';
    case 'competenceLabel': return line.competenceLabel ?? '—';
  }
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
  const headerH = 17;
  const y = doc.y;
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  doc.rect(left, y, totalW, headerH).fillAndStroke('#1e293b', '#0f172a');
  let x = left;
  cols.forEach((col, i) => {
    const w = colWidths[i]!;
    if (i > 0) doc.moveTo(x, y).lineTo(x, y + headerH).strokeColor('#475569').lineWidth(0.4).stroke();
    doc.font(fonts.bold).fontSize(Math.max(6, fontSize - 0.6)).fillColor('#ffffff')
      .text(isEn ? col.labelEn : col.labelFr, x + 2, y + 4.5, { width: Math.max(6, w - 4), align: col.align ?? 'center' });
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
  isEn: boolean,
): number {
  doc.font(fonts.regular).fontSize(fontSize);
  let maxH = fontSize + 5;
  cols.forEach((col, idx) => {
    const val = formatSubjectCell(line, col.key, isEn);
    const h = doc.heightOfString(val, { width: Math.max(10, colWidths[idx]! - 5), lineGap: 0.6 });
    if (h + 5 > maxH) maxH = h + 5;
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
  const h = 14;
  const y = doc.y;
  doc.rect(left, y, totalW, h).fillAndStroke('#e2e8f0', '#334155');
  const rk = formatRankLabel(grp.groupRank, isEn);
  const text = isEn
    ? `Subtotal ${grp.groupLabel} — Coef: ${grp.totalCoefficient}  |  Total: ${grp.totalWeightedScore.toFixed(2)}  |  Group Avg: ${grp.groupAverage.toFixed(2)}/20 (Rank ${rk}/${grp.groupTotalStudents})`
    : `Sous-total ${grp.groupLabel} — Coef : ${grp.totalCoefficient}  |  Total : ${grp.totalWeightedScore.toFixed(2)}  |  Moyenne : ${grp.groupAverage.toFixed(2)}/20 (Rang ${rk}/${grp.groupTotalStudents})`;
  doc.font(fonts.bold).fontSize(7).fillColor('#0f172a').text(text, left + 5, y + 3.5, { width: totalW - 10 });
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
  const widthDiff = usableW - colWidths.reduce((s, w) => s + w, 0);
  if (colWidths.length > 0 && widthDiff !== 0) colWidths[0]! += widthDiff;
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 18;
  const isEn = language === 'en';

  if (spec.formulaHint && spec.formulaHint.trim().length > 0) {
    const hy = doc.y;
    doc.rect(left, hy, totalW, 13).fillAndStroke('#f8fafc', '#94a3b8');
    doc.font(fonts.italic).fontSize(6.5).fillColor('#334155')
      .text(spec.formulaHint, left + 4, hy + 3, { width: totalW - 8, align: 'center' });
    doc.y = hy + 14;
  }

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
      ensureSpace(28);
      const gy = doc.y;
      doc.rect(left, gy, totalW, 13).fillAndStroke('#cbd5e1', '#334155');
      doc.font(fonts.bold).fontSize(7.2).fillColor('#0f172a').text(grp.label.toUpperCase(), left + 5, gy + 3, { width: totalW - 10 });
      doc.y = gy + 13;
    }

    for (const line of grp.lines) {
      const rowH = measureRowHeight(doc, fonts, line, spec.columns, colWidths, fontSize, isEn);
      ensureSpace(rowH);
      const ry = doc.y;
      const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(left, ry, totalW, rowH).fillAndStroke(bg, '#94a3b8');

      let cx = left;
      spec.columns.forEach((col, i) => {
        const w = colWidths[i]!;
        if (i > 0) doc.moveTo(cx, ry).lineTo(cx, ry + rowH).strokeColor('#cbd5e1').lineWidth(0.4).stroke();
        const isBoldCol = col.key === 'subjectName' || col.key === 'subjectAverage' || col.key === 'weightedScore' || col.key === 'cote';
        doc.font(isBoldCol ? fonts.bold : fonts.regular).fontSize(fontSize).fillColor('#0f172a')
          .text(formatSubjectCell(line, col.key, isEn), cx + 2.5, ry + 2.5, {
            width: Math.max(8, w - 5),
            align: col.align ?? (col.key === 'subjectName' || col.key === 'teacherComment' || col.key === 'teacherName' || col.key === 'competenceLabel' ? 'left' : 'center'),
            lineGap: 0.6,
          });
        cx += w;
      });
      doc.y = ry + rowH;
      rowIdx++;
    }

    if (spec.grouping === 'byGroup' && spec.showGroupSubtotals && grp.summary) {
      ensureSpace(15);
      drawGroupSubtotalRow(doc, fonts, grp.summary, left, totalW, isEn);
    }
  }

  ensureSpace(18);
  const sy = doc.y;
  doc.rect(left, sy, totalW, 15).fillAndStroke('#1e293b', '#0f172a');
  const totalRk = formatRankLabel(snapshot.rank, isEn);
  const seqText = isEn
    ? `PERIOD RESULT — Total Coef: ${snapshot.totalCoefficient}  |  Total Weighted: ${snapshot.totalWeightedScore.toFixed(2)}  |  General Avg: ${snapshot.generalAverage.toFixed(2)}/20  |  Rank: ${totalRk}/${snapshot.totalStudents}  |  Grade: ${resolveApcCote(snapshot.generalAverage)}`
    : `RÉSULTAT PÉRIODIQUE — Total Coef : ${snapshot.totalCoefficient}  |  Total Points : ${snapshot.totalWeightedScore.toFixed(2)}  |  Moyenne Générale : ${snapshot.generalAverage.toFixed(2)}/20  |  Rang : ${totalRk}/${snapshot.totalStudents}  |  Cote : ${resolveApcCote(snapshot.generalAverage)}`;
  doc.font(fonts.bold).fontSize(7.2).fillColor('#ffffff').text(seqText, left + 5, sy + 4, { width: totalW - 10, align: 'center' });
  doc.y = sy + 20;
}
