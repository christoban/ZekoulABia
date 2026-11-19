import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type {
  ClassProfileBlockSpec,
  ConductSummaryBlockSpec,
  CouncilDecisionBlockSpec,
  SignaturesBlockSpec,
  VerifyQrBlockSpec,
} from '@domain/types/bulletinTemplateSpec';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import { formatAbsenceHoursDisplay } from '@application/reportCard/bulletinEnrichmentHelpers';
import type { FontSet, MeasuredPdfDoc } from './measuredHeaderAndTableHelpers';

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
): void {
  const cp = snapshot.classProfile;
  const isEn = language === 'en';
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const parts: string[] = [];

  if (spec.fields.includes('classAverage')) parts.push(`${isEn ? 'Class Avg' : 'Moy. classe'} : ${cp ? cp.classAverage.toFixed(2) : '—'}/20`);
  if (spec.fields.includes('topAverage')) parts.push(`${isEn ? 'Highest' : 'Premier'} : ${cp ? cp.topAverage.toFixed(2) : '—'}`);
  if (spec.fields.includes('lowAverage')) parts.push(`${isEn ? 'Lowest' : 'Dernier'} : ${cp ? cp.lowAverage.toFixed(2) : '—'}`);
  if (spec.fields.includes('passCount')) parts.push(`${isEn ? 'Passed' : 'Admis'} : ${cp ? `${cp.passCount}/${cp.classSize}` : '—'}`);
  if (spec.fields.includes('passRate')) parts.push(`${isEn ? 'Pass Rate' : 'Taux réussite'} : ${cp ? `${cp.passRate.toFixed(1)} %` : '—'}`);

  const summary = `${isEn ? 'CLASS RESULT' : 'RÉSULTAT & PROFIL DE CLASSE'} — ${isEn ? 'General Avg' : 'Moyenne générale'} : ${snapshot.generalAverage.toFixed(2)}/20 | ${isEn ? 'Rank' : 'Rang'} : ${snapshot.rank}e/${snapshot.totalStudents}`;
  const detail = parts.join('   |   ');
  doc.font(fonts.regular).fontSize(7.5);
  const h = Math.max(30, 18 + doc.heightOfString(detail, { width: usableW - 12 }));
  ensureBlockSpace(doc, h + 4);

  const y = doc.y;
  doc.rect(left, y, usableW, h).fillAndStroke('#f1f5f9', '#334155');
  doc.font(fonts.bold).fontSize(8.2).fillColor('#0f172a').text(summary, left + 6, y + 4, { width: usableW - 12 });
  doc.font(fonts.regular).fontSize(7.5).fillColor('#1e293b').text(detail, left + 6, y + 16, { width: usableW - 12 });
  doc.y = y + h + 5;
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

  const mark = (v: boolean | undefined) => (v ? '[X]' : '[ ]');
  const flags: string[] = [];
  if (spec.items.includes('honorRoll')) flags.push(`${mark(dec?.honorRoll)} ${isEn ? 'Honor Roll' : "Tableau d'honneur"}`);
  if (spec.items.includes('encouragements')) flags.push(`${mark(dec?.encouragements)} Encouragements`);
  if (spec.items.includes('congratulations')) flags.push(`${mark(dec?.congratulations)} ${isEn ? 'Congratulations' : 'Félicitations'}`);
  if (spec.items.includes('warning')) flags.push(`${mark((snapshot.conduct?.warningsCount ?? 0) > 0)} ${isEn ? 'Warning' : 'Avertissement'}`);
  if (spec.items.includes('blame')) flags.push(`${mark((snapshot.conduct?.blamesCount ?? 0) > 0)} ${isEn ? 'Blame' : 'Blâme'}`);

  const lines: string[] = [];
  lines.push(`${isEn ? 'COUNCIL DECISION' : 'DÉCISION DU CONSEIL'} (${options.mention}) : ${dec?.decision ?? '—'}`);
  if (flags.length > 0) lines.push(flags.join('   '));
  const obs = dec?.observations ?? options.classMasterComment;
  if (spec.items.includes('observations') && obs) lines.push(`${isEn ? 'Observations' : 'Appréciation générale'} : ${obs}`);

  doc.font(fonts.regular).fontSize(7.5);
  const textH = lines.reduce((sum, l) => sum + doc.heightOfString(l, { width: usableW - 12 }) + 2, 8);
  const h = Math.max(28, textH);
  ensureBlockSpace(doc, h + 4);

  const y = doc.y;
  doc.rect(left, y, usableW, h).strokeColor('#334155').lineWidth(0.7).stroke();
  let cy = y + 4;
  lines.forEach((line, idx) => {
    doc.font(idx === 0 ? fonts.bold : fonts.regular).fontSize(idx === 0 ? 8 : 7.5).fillColor('#0f172a')
      .text(line, left + 6, cy, { width: usableW - 12 });
    cy = doc.y + 1;
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

  if (spec.fields.includes('absJ')) items.push(`${isEn ? 'Justified Abs.' : 'Abs. justifiées'} : ${formatAbsenceHoursDisplay(c?.justifiedAbsenceHours)}`);
  if (spec.fields.includes('absNJ')) items.push(`${isEn ? 'Unjustified Abs.' : 'Abs. non justifiées'} : ${formatAbsenceHoursDisplay(c?.unjustifiedAbsenceHours)}`);
  if (spec.fields.includes('totalHours')) items.push(`${isEn ? 'Total Hours' : 'Total heures'} : ${formatAbsenceHoursDisplay(c?.totalAbsenceHours)}`);
  if (spec.fields.includes('days')) items.push(`${isEn ? 'Absent Days' : 'Jours absents'} : ${c?.totalAbsenceDays ?? 0}`);
  if (spec.fields.includes('late')) items.push(`${isEn ? 'Late' : 'Retards'} : ${c?.lateCount ?? 0}`);
  if (spec.fields.includes('warnings')) items.push(`${isEn ? 'Warnings' : 'Avertissements'} : ${c?.warningsCount ?? 0}`);
  if (spec.fields.includes('blames')) items.push(`${isEn ? 'Blames' : 'Blâmes'} : ${c?.blamesCount ?? 0}`);
  if (spec.fields.includes('exclusions')) items.push(`${isEn ? 'Exclusions' : 'Exclusions'} : ${c?.exclusionsCount ?? 0}`);

  const line = `${isEn ? 'CONDUCT & ATTENDANCE' : 'ASSIDUITÉ & CONDUITE'} — ${items.join('  |  ')}`;
  doc.font(fonts.regular).fontSize(7.5);
  const h = Math.max(20, doc.heightOfString(line, { width: usableW - 12 }) + 8);
  ensureBlockSpace(doc, h + 4);

  const y = doc.y;
  doc.rect(left, y, usableW, h).strokeColor('#334155').lineWidth(0.6).stroke();
  doc.font(fonts.regular).fontSize(7.5).fillColor('#0f172a').text(line, left + 6, y + 4, { width: usableW - 12 });
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
  const neededH = 68;
  ensureBlockSpace(doc, neededH);

  const y = doc.y;
  if (sigSpec?.showPlaceDate) {
    const city = options.school.city?.trim() || 'Cameroun';
    const dStr = (options.issuedAt ?? new Date()).toLocaleDateString(isEn ? 'en-GB' : 'fr-FR');
    doc.font(fonts.italic).fontSize(7.5).fillColor('#0f172a')
      .text(isEn ? `Issued at ${city}, on ${dStr}` : `Fait à ${city}, le ${dStr}`, left, y, { width: usableW, align: 'right' });
  }

  const qrSize = qrSpec && qrBuffer ? 48 : 0;
  const sigAreaW = qrSpec && qrBuffer ? usableW - qrSize - 10 : usableW;
  const slots = sigSpec?.slots ?? ['parent', 'mainTeacher', 'principal'];
  const labelsMap: Record<string, string> = {
    parent: isEn ? 'Parent / Guardian' : 'Visa Parent',
    mainTeacher: isEn ? 'Class Master' : 'Professeur Principal',
    vicePrincipal: isEn ? 'Vice-Principal' : 'Le Censeur',
    principal: isEn ? 'The Principal' : "Le Chef d'Établissement",
  };

  const slotW = sigAreaW / slots.length;
  const sigTop = y + 12;
  slots.forEach((slot, idx) => {
    const sx = left + idx * slotW;
    doc.font(fonts.bold).fontSize(7.5).fillColor('#0f172a').text(labelsMap[slot] ?? slot, sx + 2, sigTop, { width: slotW - 4, align: 'center' });
    doc.moveTo(sx + 8, sigTop + 34).lineTo(sx + slotW - 8, sigTop + 34).strokeColor('#64748b').lineWidth(0.5).stroke();
  });

  if (qrSpec && qrBuffer) {
    const qx = left + usableW - qrSize;
    doc.image(qrBuffer, qx, y + 10, { fit: [qrSize, qrSize] });
    if (qrSpec.showVerificationCode && options.verifyToken) {
      doc.font(fonts.regular).fontSize(5.5).fillColor('#334155')
        .text(options.verifyToken.slice(0, 12), qx - 4, y + 10 + qrSize + 2, { width: qrSize + 8, align: 'center' });
    }
  }
  doc.y = y + neededH;
}

