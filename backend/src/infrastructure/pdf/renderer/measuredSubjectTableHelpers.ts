import type {
  BulletinGroupSummary,
  BulletinSubjectSnapshotLine,
  StudentBulletinSnapshot,
} from '@domain/types/bulletinSnapshot';
import type {
  BulletinAppreciationScaleConfig,
  BulletinLayoutVariant,
  BulletinTemplateSpec,
  SubjectTableBlockSpec,
  SubjectTableColumnKey,
  SubjectTableColumnSpec,
} from '@domain/types/bulletinTemplateSpec';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import {
  resolveApcCompetenceLevel,
  resolveApcCote,
} from '@domain/services/bulletin/bulletinSnapshotMath';
import {
  resolveEffectiveCompetenceScale,
  resolveEffectiveCoteScale,
} from '@domain/services/bulletin/bulletinAppreciationScales';
import type { FontSet, MeasuredPdfDoc } from './measuredHeaderHelpers';
import {
  buildDynamicFormulaHint,
  formatCoteLegend,
  formatLocalizedNumber,
} from './measuredFormatHelpers';

export { resolveApcCote };

export function formatRankLabel(rank: number, isEn: boolean): string {
  if (!isEn) return rank === 1 ? '1er' : `${rank}e`;
  if (rank % 100 >= 11 && rank % 100 <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

export function formatSubjectCell(
  line: BulletinSubjectSnapshotLine,
  key: SubjectTableColumnKey,
  isEn = false,
  layoutVariant?: BulletinLayoutVariant,
  scaleConfig?: BulletinAppreciationScaleConfig,
): string {
  const num = (v: number | undefined): string => formatLocalizedNumber(v, isEn, 2);
  const coteScale = resolveEffectiveCoteScale(scaleConfig);
  const compScale = resolveEffectiveCompetenceScale(scaleConfig);
  switch (key) {
    case 'subjectName': return line.subjectName;
    case 'coefficient': return String(line.coefficient);
    case 'rawMark': return num(line.rawMark ?? line.subjectAverage);
    case 'maxMark': return num(line.maxMark ?? 20);
    case 'learningUnit': return line.learningUnit ?? '—';
    case 'seq1Score': return num(line.seq1Score);
    case 'seq2Score': return num(line.seq2Score);
    case 'seq3Score': return num(line.seq3Score);
    case 'seq4Score': return num(line.seq4Score);
    case 'seq5Score': return num(line.seq5Score);
    case 'seq6Score': return num(line.seq6Score);
    case 'trim1Average': return num(line.trim1Average);
    case 'trim2Average': return num(line.trim2Average);
    case 'trim3Average': return num(line.trim3Average);
    case 'classTestScore': return num(line.classTestScore);
    case 'terminalExamScore': return num(line.terminalExamScore);
    case 'theoreticalScore': return num(line.theoreticalScore);
    case 'practicalScore': return num(line.practicalScore);
    case 'oralScore': return num(line.oralScore);
    case 'selfDevelopmentScore': return num(line.selfDevelopmentScore);
    case 'subjectAverage': return num(line.subjectAverage);
    case 'weightedScore': return num(line.weightedScore);
    case 'subjectRank': return formatRankLabel(line.subjectRank, isEn);
    case 'cote': return scaleConfig?.cote ? resolveApcCote(line.subjectAverage, coteScale) : (line.competenceCote ?? resolveApcCote(line.subjectAverage, coteScale));
    case 'classSubjectAverage': return num(line.classSubjectAverage);
    case 'teacherVisa': return '';
    case 'competenceLabel': return line.competenceLabel ?? '—';
    case 'competenceLevel': return scaleConfig?.competence
      ? resolveApcCompetenceLevel(line.subjectAverage, compScale, isEn ? 'en' : 'fr')
      : (line.competenceLevelLabel ?? resolveApcCompetenceLevel(line.subjectAverage, compScale, isEn ? 'en' : 'fr'));
    case 'teacherName': return line.teacherName ?? '—';
    case 'teacherComment': {
      if (layoutVariant === 'BILINGUAL_APC' || layoutVariant === 'ANNUAL_BILINGUAL') {
        const computedComp = resolveApcCompetenceLevel(line.subjectAverage, compScale, 'bilingual');
        const base = line.teacherComment ?? (scaleConfig?.competence ? computedComp : (line.competenceLevelLabel ?? computedComp));
        return line.teacherName ? `${base} — ${line.teacherName}` : base;
      }
      return line.teacherComment ?? '—';
    }
  }
}

function isBoldSubjectColumn(key: SubjectTableColumnKey): boolean {
  return (
    key === 'subjectName' ||
    key === 'subjectAverage' ||
    key === 'weightedScore' ||
    key === 'rawMark' ||
    key === 'cote'
  );
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
  const hdrFontSize = Math.max(5.5, fontSize - 0.5);
  doc.font(fonts.bold).fontSize(hdrFontSize);
  let headerH = cols.length >= 12 ? 15 : 17;
  cols.forEach((col, i) => {
    const label = isEn ? col.labelEn : col.labelFr;
    const h = doc.heightOfString(label, { width: Math.max(6, colWidths[i]! - 3) });
    if (h + 6 > headerH) headerH = Math.ceil(h + 6);
  });
  const y = doc.y;
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  doc.rect(left, y, totalW, headerH).fillAndStroke('#1e293b', '#0f172a');
  let x = left;
  cols.forEach((col, i) => {
    const w = colWidths[i]!;
    if (i > 0) doc.moveTo(x, y).lineTo(x, y + headerH).strokeColor('#475569').lineWidth(0.4).stroke();
    doc.font(fonts.bold).fontSize(hdrFontSize).fillColor('#ffffff')
      .text(isEn ? col.labelEn : col.labelFr, x + 1.5, y + 3, { width: Math.max(6, w - 3), align: col.align ?? 'center' });
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
  layoutVariant?: BulletinLayoutVariant,
  scaleConfig?: BulletinAppreciationScaleConfig,
): number {
  const pad = layoutVariant === 'PRIMARY_POINTS_RATIO' || layoutVariant === 'ANNUAL_BILINGUAL' ? 3 : 4.5;
  let maxH = fontSize + pad;
  cols.forEach((col, idx) => {
    doc.font(isBoldSubjectColumn(col.key) ? fonts.bold : fonts.regular).fontSize(fontSize);
    const val = formatSubjectCell(line, col.key, isEn, layoutVariant, scaleConfig);
    const h = doc.heightOfString(val, { width: Math.max(6, colWidths[idx]! - 4), lineGap: 0.35 });
    if (h + pad > maxH) maxH = h + pad;
  });
  return Math.ceil(maxH);
}

function drawGroupSubtotalRow(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  grp: BulletinGroupSummary,
  snapshot: StudentBulletinSnapshot,
  left: number,
  totalW: number,
  isEn: boolean,
  layoutVariant?: BulletinLayoutVariant,
): void {
  const num = (v: number | undefined) => formatLocalizedNumber(v, isEn, 2);
  const bd = snapshot.groupBreakdowns?.[grp.groupKey];
  let text: string;

  if (layoutVariant === 'TECHNICAL_GROUPED') {
    const rk = `${formatRankLabel(grp.groupRank, isEn)}/${grp.groupTotalStudents}`;
    const comp = bd?.groupCompetenceLabel ?? '—';
    text = `RÉCAP. ${grp.groupLabel.toUpperCase()} — Moy. : ${num(grp.groupAverage)}/20  |  Coef : ${grp.totalCoefficient}  |  N × C : ${num(grp.totalWeightedScore)}  |  Rang : ${rk}  |  ${comp}`;
  } else if (layoutVariant === 'ANNUAL_BILINGUAL') {
    text = `Moy. groupe (${grp.groupLabel}) — Tri.1 : ${num(bd?.trim1Average)} | Ev1 : ${num(bd?.seq1Average)} | Ev2 : ${num(bd?.seq2Average)} | Tri.2 : ${num(bd?.trim2Average)} | Ev3 : ${num(bd?.seq3Average)} | Ev4 : ${num(bd?.seq4Average)} | Tri.3 : ${num(bd?.trim3Average)} | Ev5 : ${num(bd?.seq5Average)} | Ev6 : ${num(bd?.seq6Average)} | Coef : ${grp.totalCoefficient} | Moy.AN : ${num(grp.groupAverage)}/20`;
  } else if (layoutVariant === 'BILINGUAL_APC') {
    text = `Moyenne groupe (${grp.groupLabel}) : ${num(grp.groupAverage)}/20  |  Eval a : ${num(bd?.seq1Average)}  |  Eval b : ${num(bd?.seq2Average)}  |  Coef : ${grp.totalCoefficient}  |  Total groupe : ${num(grp.totalWeightedScore)}`;
  } else {
    text = isEn
      ? `Subtotal ${grp.groupLabel} — Coef: ${grp.totalCoefficient}  |  Total: ${num(grp.totalWeightedScore)}  |  Group Avg: ${num(grp.groupAverage)}/20`
      : `Sous-total ${grp.groupLabel} — Coef : ${grp.totalCoefficient}  |  Total : ${num(grp.totalWeightedScore)}  |  Moyenne du groupe : ${num(grp.groupAverage)}/20`;
  }

  const subFontSize = layoutVariant === 'ANNUAL_BILINGUAL' ? 5.8 : 6.7;
  doc.font(fonts.bold).fontSize(subFontSize);
  const h = Math.max(13, Math.ceil(doc.heightOfString(text, { width: totalW - 8 }) + 5));
  const y = doc.y;
  doc.rect(left, y, totalW, h).fillAndStroke('#e2e8f0', '#334155');
  doc.fillColor('#0f172a').text(text, left + 4, y + 2.8, { width: totalW - 8 });
  doc.y = y + h;
}

function drawSubjectTableTotalBar(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  snapshot: StudentBulletinSnapshot,
  left: number,
  totalW: number,
  isEn: boolean,
  layoutVariant?: BulletinLayoutVariant,
): void {
  const h = 13.5;
  const y = doc.y;
  doc.rect(left, y, totalW, h).fillAndStroke('#cbd5e1', '#0f172a');
  const num = (v: number | undefined) => formatLocalizedNumber(v, isEn, 2);
  const cp = snapshot.classProfile;
  const text =
    layoutVariant === 'ANNUAL_BILINGUAL'
      ? `Moyenne de l'élève : ${num(snapshot.generalAverage)}/20   |   Total Coef : ${snapshot.totalCoefficient}   |   Moy. gén. classe : ${cp ? num(cp.classAverage) : '—'}/20   |   Premier : ${cp ? num(cp.topAverage) : '—'}/20   |   Dernier : ${cp ? num(cp.lowAverage) : '—'}/20`
      : layoutVariant === 'TECHNICAL_GROUPED'
        ? `TOTAL TRIMESTRE — Coef : ${snapshot.totalCoefficient}   |   Total N × C : ${num(snapshot.totalWeightedScore)}   |   Moyenne Premier : ${cp ? num(cp.topAverage) : '—'}/20   |   Moyenne Dernier : ${cp ? num(cp.lowAverage) : '—'}/20`
        : `TOTAL — Coef : ${snapshot.totalCoefficient}   |   Total Points (N × C) : ${num(snapshot.totalWeightedScore)}   |   Moyenne Trim. : ${num(snapshot.generalAverage)}/20`;
  doc.font(fonts.bold).fontSize(6.7).fillColor('#0f172a').text(text, left + 5, y + 3.2, { width: totalW - 10 });
  doc.y = y + h;
}

export function drawMeasuredSubjectTable(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  spec: SubjectTableBlockSpec,
  snapshot: StudentBulletinSnapshot,
  language: 'fr' | 'en',
  fontSize: number,
  options?: BulletinRenderOptions,
  templateSpec?: BulletinTemplateSpec,
): void {
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const totalRatio = spec.columns.reduce((s, c) => s + c.ratio, 0) || 100;
  const colWidths = spec.columns.map((c) => Math.floor((usableW * c.ratio) / totalRatio));
  const widthDiff = usableW - colWidths.reduce((s, w) => s + w, 0);
  if (colWidths.length > 0 && widthDiff !== 0) colWidths[0]! += widthDiff;
  const totalW = colWidths.reduce((s, w) => s + w, 0);
  const bottomLimit = doc.page.height - doc.page.margins.bottom - 16;
  const isEn = language === 'en';
  const layoutVariant = templateSpec?.layoutVariant;

  const effectiveScaleConfig: BulletinAppreciationScaleConfig = {
    cote: resolveEffectiveCoteScale(options?.gradingPolicy?.scaleConfig, spec.scaleConfig),
    competence: resolveEffectiveCompetenceScale(options?.gradingPolicy?.scaleConfig, spec.scaleConfig),
  };

  const resolvedFormulaHint =
    spec.formulaHint && spec.formulaHint.trim().length > 0
      ? spec.formulaHint.trim()
      : templateSpec?.calculationMode === 'POINTS_RATIO'
        ? (isEn
            ? `Formula: Average/20 = (Total Marks / Total On) × 20   |   Grades: ${formatCoteLegend(true, effectiveScaleConfig.cote)}`
            : `Règle de calcul : Moyenne/20 = (Total Notes / Total Sur) × 20   |   Cotes : ${formatCoteLegend(false, effectiveScaleConfig.cote)}`)
        : buildDynamicFormulaHint(options?.gradingPolicy, isEn, spec.appreciationScale, spec.scaleConfig);

  if (resolvedFormulaHint.length > 0) {
    const hy = doc.y;
    doc.font(fonts.italic).fontSize(6.2);
    const hintH = Math.max(12, Math.ceil(doc.heightOfString(resolvedFormulaHint, { width: totalW - 8 }) + 4));
    doc.rect(left, hy, totalW, hintH).fillAndStroke('#f8fafc', '#94a3b8');
    doc.fillColor('#334155').text(resolvedFormulaHint, left + 4, hy + 2.5, { width: totalW - 8, align: 'center' });
    doc.y = hy + hintH + 1;
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
  } else if (spec.groupByDomain) {
    const byDomain = new Map<string, BulletinSubjectSnapshotLine[]>();
    for (const l of snapshot.subjectLines) {
      const dom = l.learningDomain ?? (isEn ? 'GENERAL DOMAIN' : 'DOMAINE GÉNÉRAL');
      const arr = byDomain.get(dom) ?? [];
      arr.push(l);
      byDomain.set(dom, arr);
    }
    for (const [dom, lines] of byDomain.entries()) {
      groupedKeys.push({ key: dom, label: dom, lines });
    }
  } else {
    groupedKeys.push({ key: 'ALL', label: '', lines: snapshot.subjectLines });
  }

  let rowIdx = 0;
  for (const grp of groupedKeys) {
    if ((spec.grouping === 'byGroup' || spec.groupByDomain) && grp.label) {
      const bannerH = spec.groupByDomain ? 9.5 : 11.5;
      ensureSpace(bannerH + 12);
      const gy = doc.y;
      doc.rect(left, gy, totalW, bannerH).fillAndStroke('#cbd5e1', '#334155');
      doc.font(fonts.bold).fontSize(spec.groupByDomain ? 6.0 : 6.8).fillColor('#0f172a')
        .text(grp.label.toUpperCase(), left + 4, gy + 1.8, { width: totalW - 8 });
      doc.y = gy + bannerH;
    }

    for (const line of grp.lines) {
      const rowH = measureRowHeight(doc, fonts, line, spec.columns, colWidths, fontSize, isEn, layoutVariant, effectiveScaleConfig);
      ensureSpace(rowH);
      const ry = doc.y;
      const bg = rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc';
      doc.rect(left, ry, totalW, rowH).fillAndStroke(bg, '#94a3b8');

      let cx = left;
      spec.columns.forEach((col, i) => {
        const w = colWidths[i]!;
        if (i > 0) doc.moveTo(cx, ry).lineTo(cx, ry + rowH).strokeColor('#cbd5e1').lineWidth(0.4).stroke();
        const isBoldCol = isBoldSubjectColumn(col.key);
        doc.font(isBoldCol ? fonts.bold : fonts.regular).fontSize(fontSize).fillColor('#0f172a')
          .text(formatSubjectCell(line, col.key, isEn, layoutVariant, effectiveScaleConfig), cx + 2, ry + 1.5, {
            width: Math.max(6, w - 4),
            align: col.align ?? (col.key === 'subjectName' || col.key === 'teacherComment' || col.key === 'teacherName' || col.key === 'competenceLabel' ? 'left' : 'center'),
            lineGap: 0.35,
          });
        cx += w;
      });
      doc.y = ry + rowH;
      rowIdx++;
    }

    if (spec.grouping === 'byGroup' && spec.showGroupSubtotals && grp.summary) {
      ensureSpace(14);
      drawGroupSubtotalRow(doc, fonts, grp.summary, snapshot, left, totalW, isEn, layoutVariant);
    }
  }

  if (spec.showTotalBar) {
    ensureSpace(14);
    drawSubjectTableTotalBar(doc, fonts, snapshot, left, totalW, isEn, layoutVariant);
  }
  doc.y += 3;
}
