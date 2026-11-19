import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type {
  ClassProfileBlockSpec,
  ConductSummaryBlockSpec,
  CouncilDecisionBlockSpec,
  CouncilDecisionSpecItem,
  SignaturesBlockSpec,
  VerifyQrBlockSpec,
} from '@domain/types/bulletinTemplateSpec';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import { deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import { formatAbsenceHoursDisplay } from '@application/reportCard/bulletinEnrichmentHelpers';
import type { FontSet, MeasuredPdfDoc } from './measuredHeaderHelpers';
import { formatRankLabel, resolveApcCote } from './measuredSubjectTableHelpers';
import { formatLocalizedNumber, formatLocalizedPercent } from './measuredFormatHelpers';

function translateAnnualDecisionLabel(decision: string | undefined, isEn: boolean): string {
  switch (decision) {
    case 'PASS': return isEn ? 'Promoted to next class' : 'Admis(e) en classe supérieure';
    case 'REPEAT': return isEn ? 'Repeat Advised' : 'Redoublement conseillé';
    case 'DELIBERATION': return isEn ? 'Under Deliberation' : 'À délibérer en conseil';
    default: return '—';
  }
}

function ensureBlockSpace(doc: MeasuredPdfDoc, neededHeight: number): void {
  const limit = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > limit) {
    doc.addPage();
  }
}

export function drawClassProfileBlock(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  spec: ClassProfileBlockSpec,
  snapshot: StudentBulletinSnapshot,
  language: 'fr' | 'en',
  options?: BulletinRenderOptions,
): void {
  const cp = snapshot.classProfile;
  const isEn = language === 'en';
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const parts: string[] = [];

  if (spec.fields.includes('classAverage')) {
    parts.push(`${isEn ? 'Class Avg' : 'Moy. classe'} : ${cp ? `${formatLocalizedNumber(cp.classAverage, isEn)}/20` : '—'}`);
  }
  if (spec.fields.includes('topAverage')) {
    parts.push(`${isEn ? 'Highest' : 'Premier'} : ${cp ? `${formatLocalizedNumber(cp.topAverage, isEn)}/20` : '—'}`);
  }
  if (spec.fields.includes('lowAverage')) {
    parts.push(`${isEn ? 'Lowest' : 'Dernier'} : ${cp ? `${formatLocalizedNumber(cp.lowAverage, isEn)}/20` : '—'}`);
  }
  if (spec.fields.includes('passCount')) {
    parts.push(`${isEn ? 'Passed' : 'Admis'} : ${cp ? `${cp.passCount}/${cp.classSize}` : '—'}`);
  }
  if (spec.fields.includes('passRate')) {
    parts.push(`${isEn ? 'Pass Rate' : 'Taux réussite'} : ${cp ? formatLocalizedPercent(cp.passRate, isEn, 2) : '—'}`);
  }

  const sectionLabel = options?.isAnnual
    ? (isEn ? 'ANNUAL RESULT & CLASS PROFILE' : 'RÉSULTAT ANNUEL & PROFIL DE LA CLASSE')
    : (isEn ? 'PERIOD RESULT & CLASS PROFILE' : 'RÉSULTAT PÉRIODIQUE & PROFIL DE LA CLASSE');
  const rk = formatRankLabel(snapshot.rank, isEn);
  const cote = resolveApcCote(snapshot.generalAverage);
  const mentionPart = options?.mention && options.mention !== '—' ? `  |  Mention : ${options.mention}` : '';

  const studentLine = isEn
    ? `${sectionLabel} — Total Coef: ${snapshot.totalCoefficient}  |  Total Weighted: ${formatLocalizedNumber(snapshot.totalWeightedScore, true)}  |  General Avg: ${formatLocalizedNumber(snapshot.generalAverage, true)}/20  |  Rank: ${rk}/${snapshot.totalStudents}  |  Grade: ${cote}${mentionPart}`
    : `${sectionLabel} — Total Coef : ${snapshot.totalCoefficient}  |  Total Points : ${formatLocalizedNumber(snapshot.totalWeightedScore, false)}  |  Moyenne Générale : ${formatLocalizedNumber(snapshot.generalAverage, false)}/20  |  Rang : ${rk}/${snapshot.totalStudents}  |  Cote : ${cote}${mentionPart}`;

  const detail = parts.join('   |   ');
  doc.font(fonts.bold).fontSize(7.6);
  const hStudent = doc.heightOfString(studentLine, { width: usableW - 12 });
  doc.font(fonts.regular).fontSize(7.4);
  const hDetail = doc.heightOfString(detail, { width: usableW - 12 });
  const h = Math.max(32, Math.ceil(hStudent + hDetail + 12));
  ensureBlockSpace(doc, h + 4);

  const y = doc.y;
  doc.rect(left, y, usableW, h).fillAndStroke('#f1f5f9', '#334155');
  doc.font(fonts.bold).fontSize(7.6).fillColor('#0f172a').text(studentLine, left + 6, y + 4, { width: usableW - 12 });
  doc.font(fonts.regular).fontSize(7.4).fillColor('#1e293b').text(detail, left + 6, y + 6 + hStudent, { width: usableW - 12 });
  doc.y = y + h + 5;
}

function buildCouncilItemLabel(
  item: CouncilDecisionSpecItem,
  snapshot: StudentBulletinSnapshot,
  isEn: boolean,
): string | null {
  const dec = snapshot.councilDecision;
  const conduct = snapshot.conduct;
  const mark = (v: boolean | undefined) => (v ? '[X]' : '[ ]');

  switch (item) {
    case 'honorRoll': return `${mark(dec?.honorRoll)} ${isEn ? 'Honor Roll' : "Tableau d'honneur"}`;
    case 'encouragements': return `${mark(dec?.encouragements)} Encouragements`;
    case 'congratulations': return `${mark(dec?.congratulations)} ${isEn ? 'Congratulations' : 'Félicitations'}`;
    case 'workWarning': return `[ ] ${isEn ? 'Work Warning' : 'Avertissement travail'}`;
    case 'conductWarning': return `${mark((conduct?.warningsCount ?? 0) > 0)} ${isEn ? 'Conduct Warning' : 'Avertissement conduite'}`;
    case 'warning': return `${mark((conduct?.warningsCount ?? 0) > 0)} ${isEn ? 'Warning' : 'Avertissement'}`;
    case 'blame': return `${mark((conduct?.blamesCount ?? 0) > 0)} ${isEn ? 'Blame' : 'Blâme'}`;
    case 'disciplinaryCouncil': return `[ ] ${isEn ? 'Disciplinary Council' : 'Conseil de discipline'}`;
    case 'exclusion': return `${mark((conduct?.exclusionsCount ?? 0) > 0)} ${isEn ? 'Exclusion' : 'Exclusion'}`;
    case 'decision':
    case 'observations':
      return null;
  }
}

export function drawCouncilDecisionBlock(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  spec: CouncilDecisionBlockSpec,
  snapshot: StudentBulletinSnapshot,
  options: BulletinRenderOptions,
): void {
  const dec = snapshot.councilDecision;
  const isEn = options.language === 'en';
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;

  const flags: string[] = [];
  for (const item of spec.items) {
    const label = buildCouncilItemLabel(item, snapshot, isEn);
    if (label) flags.push(label);
  }

  const lines: string[] = [];
  if (options.isAnnual && spec.items.includes('decision')) {
    lines.push(`${isEn ? 'COUNCIL DECISION' : 'DÉCISION DU CONSEIL'} (${options.mention}) : ${translateAnnualDecisionLabel(dec?.decision, isEn)}`);
  } else {
    const mentionSuffix = options.mention && options.mention !== '—' ? ` — Mention : ${options.mention}` : '';
    lines.push(`${isEn ? 'CLASS COUNCIL DECISION' : 'DÉCISION DU CONSEIL DE CLASSE'}${mentionSuffix}`);
  }
  if (flags.length > 0) lines.push(flags.join('   •   '));
  if (spec.items.includes('observations') && dec?.observations) {
    lines.push(`${isEn ? 'Council Remarks' : 'Observations du conseil'} : ${dec.observations}`);
  }

  doc.font(fonts.regular).fontSize(7.4);
  const textH = lines.reduce((sum, l) => sum + doc.heightOfString(l, { width: usableW - 12 }) + 2, 8);
  const h = Math.max(28, textH);
  ensureBlockSpace(doc, h + 4);

  const y = doc.y;
  doc.rect(left, y, usableW, h).strokeColor('#334155').lineWidth(0.7).stroke();
  let cy = y + 4;
  lines.forEach((line, idx) => {
    doc.font(idx === 0 ? fonts.bold : fonts.regular).fontSize(idx === 0 ? 7.8 : 7.3).fillColor('#0f172a')
      .text(line, left + 6, cy, { width: usableW - 12 });
    cy = doc.y + 1.5;
  });
  doc.y = y + h + 5;
}

export function drawConductSummaryBlock(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  spec: ConductSummaryBlockSpec,
  snapshot: StudentBulletinSnapshot,
  language: 'fr' | 'en',
): void {
  const c = snapshot.conduct;
  const isEn = language === 'en';
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const items: string[] = [];

  if (spec.fields.includes('absJ')) items.push(`${isEn ? 'Justified Abs.' : 'Abs. justifiées'} : ${formatAbsenceHoursDisplay(c?.justifiedAbsenceHours, language)}`);
  if (spec.fields.includes('absNJ')) items.push(`${isEn ? 'Unjustified Abs.' : 'Abs. non justifiées'} : ${formatAbsenceHoursDisplay(c?.unjustifiedAbsenceHours, language)}`);
  if (spec.fields.includes('totalHours')) items.push(`${isEn ? 'Total Hours' : 'Total heures'} : ${formatAbsenceHoursDisplay(c?.totalAbsenceHours, language)}`);
  if (spec.fields.includes('days')) items.push(`${isEn ? 'Absent Days' : 'Jours absents'} : ${c?.totalAbsenceDays ?? 0}`);
  if (spec.fields.includes('late')) items.push(`${isEn ? 'Late' : 'Retards'} : ${c?.lateCount ?? 0}`);
  if (spec.fields.includes('consignes')) items.push(`${isEn ? 'Detentions' : 'Consignes'} : ${c?.consignesCount ?? 0}`);
  if (spec.fields.includes('warnings')) items.push(`${isEn ? 'Warnings' : 'Avertissements'} : ${c?.warningsCount ?? 0}`);
  if (spec.fields.includes('blames')) items.push(`${isEn ? 'Blames' : 'Blâmes'} : ${c?.blamesCount ?? 0}`);
  if (spec.fields.includes('exclusions')) items.push(`${isEn ? 'Exclusions' : 'Exclusions'} : ${c?.exclusionsCount ?? 0}`);

  const line = `${isEn ? 'CONDUCT & ATTENDANCE' : 'ASSIDUITÉ & CONDUITE'} — ${items.join('  |  ')}`;
  doc.font(fonts.regular).fontSize(7.4);
  const h = Math.max(22, Math.ceil(doc.heightOfString(line, { width: usableW - 12 }) + 10));
  ensureBlockSpace(doc, h + 4);

  const y = doc.y;
  doc.rect(left, y, usableW, h).strokeColor('#334155').lineWidth(0.6).stroke();
  doc.font(fonts.regular).fontSize(7.4).fillColor('#0f172a').text(line, left + 6, y + 6, { width: usableW - 12 });
  doc.y = y + h + 5;
}

export function drawSignaturesAndQrBlock(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  sigSpec: SignaturesBlockSpec | undefined,
  qrSpec: VerifyQrBlockSpec | undefined,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
): void {
  const isEn = options.language === 'en';
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const boxH = 66;
  const neededH = boxH + 20;
  ensureBlockSpace(doc, neededH);

  const y = doc.y;
  if (sigSpec?.showPlaceDate) {
    const city = options.school.city?.trim();
    const dStr = (options.issuedAt ?? new Date()).toLocaleDateString(isEn ? 'en-GB' : 'fr-FR');
    const dateLine = city
      ? (isEn ? `Issued at ${city}, on ${dStr}` : `Fait à ${city}, le ${dStr}`)
      : (isEn ? `Issued on ${dStr}` : `Fait le ${dStr}`);
    doc.font(fonts.italic).fontSize(7.3).fillColor('#0f172a')
      .text(dateLine, left, y, { width: usableW, align: 'right' });
  }

  const qrSize = qrSpec && qrBuffer ? 60 : 0;
  const sigAreaW = qrSpec && qrBuffer ? usableW - qrSize - 10 : usableW;
  const slots = sigSpec?.slots ?? ['mainTeacher', 'parent', 'principal'];
  const labelsMap: Record<string, string> = {
    mainTeacher: isEn ? 'Class Master Remarks & Visa' : 'Appréciation du professeur titulaire',
    parent: isEn ? 'Parent / Guardian Remarks & Signature' : 'Observations et signature des parents',
    vicePrincipal: isEn ? 'Vice-Principal Remarks & Visa' : 'Observations et visa du censeur',
    principal: isEn ? 'Principal Remarks & Visa' : "Observations et visa du chef d'établissement",
  };

  const gap = 6;
  const boxW = (sigAreaW - gap * (slots.length - 1)) / slots.length;
  const boxTop = y + 12;

  slots.forEach((slot, idx) => {
    const sx = left + idx * (boxW + gap);
    doc.rect(sx, boxTop, boxW, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
    doc.rect(sx, boxTop, boxW, 13).fillAndStroke('#e2e8f0', '#334155');
    doc.font(fonts.bold).fontSize(6.6).fillColor('#0f172a')
      .text(labelsMap[slot] ?? slot, sx + 3, boxTop + 3.5, { width: boxW - 6, align: 'center' });

    if (slot === 'mainTeacher' && options.classMasterComment && options.classMasterComment.trim().length > 0) {
      doc.font(fonts.regular).fontSize(6.8).fillColor('#0f172a')
        .text(options.classMasterComment.trim(), sx + 4, boxTop + 16, { width: boxW - 8, height: boxH - 20 });
    } else if (slot === 'vicePrincipal' && options.school.censorSignatureBuffer) {
      try { doc.image(options.school.censorSignatureBuffer, sx + 8, boxTop + 15, { fit: [boxW - 16, boxH - 18] }); } catch { /* ignore */ }
    } else if (slot === 'principal') {
      const innerY = boxTop + 15;
      const innerH = boxH - 18;
      if (options.school.stampBuffer) {
        try { doc.image(options.school.stampBuffer, sx + 6, innerY, { fit: [boxW * 0.45, innerH] }); } catch { /* ignore */ }
      }
      if (options.school.principalSignatureBuffer) {
        try { doc.image(options.school.principalSignatureBuffer, sx + boxW * 0.48, innerY, { fit: [boxW * 0.46, innerH] }); } catch { /* ignore */ }
      }
      if (!options.school.stampBuffer && !options.school.principalSignatureBuffer && sigSpec?.showStamp && sigSpec?.showPlaceholder) {
        doc.font(fonts.italic).fontSize(6.2).fillColor('#64748b')
          .text(isEn ? 'Stamp & Signature' : 'Cachet & Signature', sx + 6, boxTop + 34, { width: boxW - 12, align: 'center' });
      }
    }
  });

  if (qrSpec && qrBuffer) {
    const qx = left + usableW - qrSize;
    doc.image(qrBuffer, qx, boxTop, { fit: [qrSize, qrSize] });
    const displayCode = options.shortVerifyCode || (options.verifyToken ? deriveShortVerifyCode(options.verifyToken) : undefined);
    if (qrSpec.showVerificationCode && displayCode) {
      doc.font(fonts.regular).fontSize(5.5).fillColor('#334155')
        .text(displayCode, qx - 2, boxTop + qrSize + 2, { width: qrSize + 4, align: 'center' });
    }
  }
  doc.y = y + neededH;
}
