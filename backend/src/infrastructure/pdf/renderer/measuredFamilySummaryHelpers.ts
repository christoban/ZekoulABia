import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { BulletinAppreciationScaleConfig } from '@domain/types/bulletinTemplateSpec';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import { deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import {
  buildCoteLegendLines,
  resolveEffectiveCoteScale,
} from '@domain/services/bulletin/bulletinAppreciationScales';
import { formatAbsenceHoursDisplay } from '@application/reportCard/bulletinEnrichmentHelpers';
import type { FontSet, MeasuredPdfDoc } from './measuredHeaderHelpers';
import { formatRankLabel, resolveApcCote } from './measuredSubjectTableHelpers';
import {
  formatLocalizedNumber,
  formatLocalizedPercent,
  resolvePeriodEvaluationLabels,
} from './measuredFormatHelpers';

function mark(flag: boolean | undefined): string {
  return flag ? '[X]' : '[ ]';
}

function ensureFooterSpace(doc: MeasuredPdfDoc, neededHeight: number): void {
  if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function drawQrBlockAt(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  qx: number,
  qy: number,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
  size = 60,
): void {
  if (!qrBuffer) return;
  doc.image(qrBuffer, qx, qy, { fit: [size, size] });
  const displayCode = options.shortVerifyCode || (options.verifyToken ? deriveShortVerifyCode(options.verifyToken) : undefined);
  if (displayCode) {
    doc.font(fonts.regular).fontSize(7).fillColor('#334155')
      .text(displayCode, qx - 6, qy + size + 1.5, { width: size + 12, align: 'center' });
  }
}

function formatPlaceDateLine(options: BulletinRenderOptions, isEn: boolean): string {
  const city = options.school.city?.trim();
  const dStr = (options.issuedAt ?? new Date()).toLocaleDateString(isEn ? 'en-GB' : 'fr-FR');
  return city
    ? (isEn ? `${city}, on ${dStr}` : `${city}, le ${dStr}`)
    : (isEn ? `On ${dStr}` : `Le ${dStr}`);
}

function drawBoxTitle(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  x: number,
  y: number,
  w: number,
  title: string,
): void {
  doc.rect(x, y, w, 13).fillAndStroke('#e2e8f0', '#334155');
  doc.font(fonts.bold).fontSize(7).fillColor('#0f172a').text(title, x + 3, y + 3, { width: w - 6, align: 'center' });
}

export function drawAnnualBilingualSummary(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  snapshot: StudentBulletinSnapshot,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
): void {
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const num = (v: number | undefined | null) => formatLocalizedNumber(v, false, 2);
  const cp = snapshot.classProfile;
  const seqs = snapshot.sequenceAverages ?? [];
  const terms = snapshot.termAverages;
  const sStr = (i: number) => num(seqs[i]?.average);
  const rStr = (i: number) => (seqs[i]?.rank ? `${seqs[i]!.rank}/${snapshot.totalStudents}` : '—');
  const tRk = (r: number | undefined) => (r ? `${r}/${snapshot.totalStudents}` : '—');

  // Petit tableau structuré : lignes Moyenne et Rang, colonnes Tri 1, Éval 1..6, Tri 2, Tri 3, Annuel + Profil classe
  const tableHeaderH = 13;
  const tableRowH = 13;
  const tableTotalH = 13 + tableHeaderH + tableRowH * 2;
  const botH = 122;
  ensureFooterSpace(doc, tableTotalH + 5 + botH);
  const gy = doc.y;
  drawBoxTitle(doc, fonts, left, gy, usableW, 'RÉCAPITULATIF ANNUEL & PROFIL DE LA CLASSE');

  const lblColW = 48;
  const profColW = 120;
  const periodColW = (usableW - lblColW - profColW) / 10;
  const recapHeaders = ['Période', 'Tri 1', 'Éval 1', 'Éval 2', 'Tri 2', 'Éval 3', 'Éval 4', 'Tri 3', 'Éval 5', 'Éval 6', 'Annuel', 'Profil classe'];
  const recapMeans = [
    'Moyenne',
    num(terms?.trim1), sStr(0), sStr(1),
    num(terms?.trim2), sStr(2), sStr(3),
    num(terms?.trim3), sStr(4), sStr(5),
    num(snapshot.generalAverage),
    cp ? `Prem. ${num(cp.topAverage)} | Dern. ${num(cp.lowAverage)}` : '—',
  ];
  const recapRanks = [
    'Rang',
    tRk(snapshot.rankTrimestre1), rStr(0), rStr(1),
    tRk(snapshot.rankTrimestre2), rStr(2), rStr(3),
    tRk(snapshot.rankTrimestre3), rStr(4), rStr(5),
    `${snapshot.rank}/${snapshot.totalStudents}`,
    cp ? `Moy. ${num(cp.classAverage)} | Adm. ${cp.passCount}/${cp.classSize}` : '—',
  ];
  const colWidths = [lblColW, ...Array.from({ length: 10 }, () => periodColW), profColW];
  const drawRecapGridRow = (rowY: number, rowH: number, cells: string[], bg: string, boldAll: boolean) => {
    doc.rect(left, rowY, usableW, rowH).fillAndStroke(bg, '#334155');
    let cx = left;
    cells.forEach((cell, idx) => {
      const w = colWidths[idx]!;
      if (idx > 0) doc.moveTo(cx, rowY).lineTo(cx, rowY + rowH).strokeColor('#94a3b8').lineWidth(0.4).stroke();
      const isBold = boldAll || idx === 0 || idx === 10;
      doc.font(isBold ? fonts.bold : fonts.regular).fontSize(7).fillColor('#0f172a')
        .text(cell, cx + 1.5, rowY + 2.8, { width: Math.max(6, w - 3), align: idx === 0 ? 'left' : 'center' });
      cx += w;
    });
  };
  drawRecapGridRow(gy + 13, tableHeaderH, recapHeaders, '#f1f5f9', true);
  drawRecapGridRow(gy + 13 + tableHeaderH, tableRowH, recapMeans, '#ffffff', false);
  drawRecapGridRow(gy + 13 + tableHeaderH + tableRowH, tableRowH, recapRanks, '#f8fafc', false);

  // Bas 2 colonnes : SANCTIONS (gauche) + OBSERVATIONS DU CHEF D'ETABLISSEMENT & QR (droite)
  const botY = gy + tableTotalH + 4;
  const colW = (usableW - 6) * 0.56;
  const rightW = usableW - colW - 6;

  doc.rect(left, botY, colW, botH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, left, botY, colW, 'SANCTIONS (DÉCISION DU CONSEIL DE CLASSE)');
  const c = snapshot.conduct;
  const tr = c?.trimesterAbsences;
  const dec = snapshot.councilDecision;
  const exc = dec?.exclusionReasons;

  const discLines = [
    `Absences (h) J/NJ : T1 ${formatAbsenceHoursDisplay(tr?.t1?.j, 'fr')}/${formatAbsenceHoursDisplay(tr?.t1?.nj, 'fr')} | T2 ${formatAbsenceHoursDisplay(tr?.t2?.j, 'fr')}/${formatAbsenceHoursDisplay(tr?.t2?.nj, 'fr')} | T3 ${formatAbsenceHoursDisplay(tr?.t3?.j, 'fr')}/${formatAbsenceHoursDisplay(tr?.t3?.nj, 'fr')}`,
    `Annuel J/NJ : ${formatAbsenceHoursDisplay(c?.justifiedAbsenceHours, 'fr')} / ${formatAbsenceHoursDisplay(c?.unjustifiedAbsenceHours, 'fr')}  |  Exclusions : ${c?.exclusionsCount ?? 0} j`,
    `TRAVAIL : ${mark(dec?.honorRoll)} T.H.  ${mark(dec?.encouragements)} Encourag.  ${mark(dec?.congratulations)} Félicitations`,
    `DÉCISION : ${mark(dec?.decision === 'PASS')} PROMU(E) EN : ${dec?.promotedToClass ?? '—'}  ${mark(dec?.decision === 'REPEAT')} REDOUBLE : ${dec?.repeatClass ?? '—'}`,
    `${mark(dec?.excluded)} EXCLU(E) POUR : ${mark(exc?.insufficientAverage)} Moy.  ${mark(exc?.alreadyRepeated)} Redoubl.  ${mark(exc?.deplorableConduct)} Cond.  ${mark(exc?.tooManyAbsences)} Abs.  ${mark(exc?.tooOld)} Âge`,
  ];
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a');
  let dy = botY + 16;
  for (const dl of discLines) {
    doc.text(dl, left + 4, dy, { width: colW - 8 });
    dy = doc.y + 1.5;
  }

  const rx = left + colW + 6;
  doc.rect(rx, botY, rightW, botH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, rx, botY, rightW, "OBSERVATIONS DU CHEF D'ÉTABLISSEMENT");
  const textAreaW = qrBuffer ? rightW - 70 : rightW - 8;
  const obsLines = [
    `Appréciation : ${options.mention !== '—' ? options.mention : '—'}`,
    `Conseil : ${dec?.observations ?? '—'}`,
    formatPlaceDateLine(options, false),
    'LE PROVISEUR',
  ];
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a').text(obsLines.join('\n'), rx + 4, botY + 16, { width: textAreaW, lineGap: 1.8 });
  if (options.school.stampBuffer) {
    try { doc.image(options.school.stampBuffer, rx + 6, botY + 70, { fit: [50, 40] }); } catch { /* ignore */ }
  }
  if (options.school.principalSignatureBuffer) {
    try { doc.image(options.school.principalSignatureBuffer, rx + 60, botY + 72, { fit: [62, 36] }); } catch { /* ignore */ }
  }
  drawQrBlockAt(doc, fonts, rx + rightW - 64, botY + 28, options, qrBuffer, 60);
  doc.y = botY + botH + 4;
}

export function drawTechnicalGroupedSummary(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  snapshot: StudentBulletinSnapshot,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
): void {
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const num = (v: number | undefined | null) => formatLocalizedNumber(v, false, 2);
  const cp = snapshot.classProfile;
  const c = snapshot.conduct;
  const dec = snapshot.councilDecision;
  ensureFooterSpace(doc, 122);
  const y = doc.y;
  const gap = 5;
  const w1 = usableW * 0.34;
  const w2 = usableW * 0.34;
  const w3 = usableW - w1 - w2 - gap * 2;
  const h = 128;

  // Colonne 1 : Conduite & Visa PP
  doc.rect(left, y, w1, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, left, y, w1, 'ASSIDUITÉ & CONDUITE');
  const cLines = [
    `Abs. Justifiées : ${formatAbsenceHoursDisplay(c?.justifiedAbsenceHours, 'fr')}`,
    `Abs. Non Justifiées : ${formatAbsenceHoursDisplay(c?.unjustifiedAbsenceHours, 'fr')}`,
    `Exclusion Temp. : ${c?.exclusionsCount ?? 0} j`,
    `Avert. Conduite : ${c?.warningsCount ?? 0}  |  Blâme : ${c?.blamesCount ?? 0}`,
    `Corvée (en jrs) : ${c?.workDayPenaltyDays ?? '—'}`,
    '',
    'VISA DU PROFESSEUR PRINCIPAL :',
    options.classMasterComment?.trim() || '—',
  ];
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a').text(cLines.join('\n'), left + 4, y + 16, { width: w1 - 8, lineGap: 1.2 });

  // Colonne 2 : Moyenne/Rang + Décisions Conseil + Visa Parent
  const x2 = left + w1 + gap;
  doc.rect(x2, y, w2, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x2, y, w2, 'RÉSULTATS & DÉCISIONS DU CONSEIL');
  const mLines = [
    `MOYENNE TRIM. : ${num(snapshot.generalAverage)} / 20`,
    `RANG TRIMESTRE : ${formatRankLabel(snapshot.rank, false)} / ${snapshot.totalStudents}`,
    `${mark(dec?.honorRoll)} T.H.   ${mark(dec?.congratulations)} Félicitations`,
    `${mark(dec?.encouragements)} Encouragements`,
    `${mark(dec?.workWarning)} Avert. Travail   ${mark(dec?.workBlame)} Blâme`,
    '',
    'VISA DU PARENT OU TUTEUR :',
  ];
  doc.font(fonts.bold).fontSize(7).fillColor('#0f172a').text(mLines.join('\n'), x2 + 4, y + 16, { width: w2 - 8, lineGap: 1.4 });

  // Colonne 3 : Stats Classe + Appréciations + Proviseur + QR
  const x3 = x2 + w2 + gap;
  doc.rect(x3, y, w3, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x3, y, w3, 'CLASSE & PROVISEUR');
  const rLines = [
    `Moy. classe : ${cp ? num(cp.classAverage) : '—'} / 20`,
    `% Réussite : ${cp ? formatLocalizedPercent(cp.passRate, false, 2) : '—'}`,
    `Appréciation : ${options.mention}`,
    formatPlaceDateLine(options, false),
    'Le Proviseur',
  ];
  const rwText = qrBuffer ? w3 - 68 : w3 - 8;
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a').text(rLines.join('\n'), x3 + 4, y + 16, { width: rwText, lineGap: 1.5 });
  if (options.school.stampBuffer) {
    try { doc.image(options.school.stampBuffer, x3 + 6, y + 82, { fit: [48, 36] }); } catch { /* ignore */ }
  }
  drawQrBlockAt(doc, fonts, x3 + w3 - 64, y + 32, options, qrBuffer, 60);
  doc.y = y + h + 4;
}

export function drawBilingualApcSummary(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  snapshot: StudentBulletinSnapshot,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
): void {
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const num = (v: number | undefined | null) => formatLocalizedNumber(v, false, 2);
  const cp = snapshot.classProfile;
  const seqs = snapshot.sequenceAverages ?? [];
  ensureFooterSpace(doc, 168);
  const gy = doc.y;

  drawBoxTitle(doc, fonts, left, gy, usableW, 'RÉCAPITULATIF & PROFIL DE LA CLASSE');
  const s0 = seqs[0];
  const s1 = seqs[1];
  const [eval1Label, eval2Label] = resolvePeriodEvaluationLabels(snapshot, options, false);
  const recap = `MOY TRIM : ${num(snapshot.generalAverage)}/20  |  RANG : ${formatRankLabel(snapshot.rank, false)}/${snapshot.totalStudents}  |  MOY ${eval1Label} : ${num(s0?.average)} (${s0?.rank ? `${s0.rank}/${snapshot.totalStudents}` : '—'})  |  MOY ${eval2Label} : ${num(s1?.average)} (${s1?.rank ? `${s1.rank}/${snapshot.totalStudents}` : '—'})`;
  const profile = `APPRÉCIATION DU TRAVAIL : ${options.mention}  |  PREMIER : ${cp ? num(cp.topAverage) : '—'}  |  DERNIER : ${cp ? num(cp.lowAverage) : '—'}  |  MOY. CLASSE : ${cp ? num(cp.classAverage) : '—'}/20`;
  doc.rect(left, gy + 13, usableW, 27).fillAndStroke('#f8fafc', '#334155');
  doc.font(fonts.bold).fontSize(7).fillColor('#0f172a').text(recap, left + 4, gy + 15.5, { width: usableW - 8 });
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a').text(profile, left + 4, gy + 26.5, { width: usableW - 8 });

  const botY = gy + 44;
  const gap = 5;
  const w1 = usableW * 0.45;
  const w2 = usableW * 0.24;
  const w3 = usableW - w1 - w2 - gap * 2;
  const h = 122;
  const c = snapshot.conduct;
  const dec = snapshot.councilDecision;
  const apc = dec?.apcObservations;

  doc.rect(left, botY, w1, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, left, botY, w1, 'SANCTIONS (DÉCISION DU CONSEIL DE CLASSE)');
  const sLines = [
    `DISCIPLINE : Abs. J ${formatAbsenceHoursDisplay(c?.justifiedAbsenceHours, 'fr')} | NJ ${formatAbsenceHoursDisplay(c?.unjustifiedAbsenceHours, 'fr')} | Aver. ${c?.warningsCount ?? 0} | Blâme ${c?.blamesCount ?? 0} | Excl. ${c?.exclusionsCount ?? 0} j`,
    `TRAVAIL : ${mark(dec?.honorRoll)} T.H.  ${mark(dec?.encouragements)} Encourag.  ${mark(dec?.congratulations)} Félicitations`,
    `${mark(dec?.workWarning)} Aver. travail   ${mark(dec?.workBlame)} Blâme travail`,
    `APPRÉCIATIONS : ${mark(apc?.makingProgress)} En progrès  ${mark(apc?.declining)} En baisse  ${mark(apc?.conductWarning)} Conduite`,
    `${mark(apc?.tooManyAbsences)} Trop d'absences  ${mark(apc?.riskOfExpulsion)} Risque excl.  Effort : ${apc?.effortRequiredIn ?? '—'}`,
  ];
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a').text(sLines.join('\n'), left + 4, botY + 16, { width: w1 - 8, lineGap: 1.4 });

  const x2 = left + w1 + gap;
  doc.rect(x2, botY, w2, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x2, botY, w2, 'OBSERVATION & VISA DES PARENTS');
  // Cadre volontairement laissé vide pour la mention manuscrite et la signature des parents

  const x3 = x2 + w2 + gap;
  doc.rect(x3, botY, w3, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x3, botY, w3, "OBSERVATIONS DU CHEF D'ÉTABLISSEMENT");
  const rwText = qrBuffer ? w3 - 68 : w3 - 8;
  const principalObsLines: string[] = [];
  if (dec?.observations && dec.observations.trim().length > 0) {
    principalObsLines.push(dec.observations.trim());
  }
  principalObsLines.push(formatPlaceDateLine(options, false), 'LE PROVISEUR');
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a')
    .text(principalObsLines.join('\n'), x3 + 4, botY + 16, { width: rwText, lineGap: 2 });
  drawQrBlockAt(doc, fonts, x3 + w3 - 64, botY + 26, options, qrBuffer, 60);
  doc.y = botY + h + 4;
}

export function drawPrimaryPointsRatioSummary(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  snapshot: StudentBulletinSnapshot,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
  specScaleConfig?: BulletinAppreciationScaleConfig,
): void {
  const isEn = options.language === 'en';
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const num = (v: number | undefined | null) => formatLocalizedNumber(v, isEn, 2);
  const cp = snapshot.classProfile;
  const coteScale = resolveEffectiveCoteScale(options.gradingPolicy?.scaleConfig, specScaleConfig);
  ensureFooterSpace(doc, 162);
  const y = doc.y;
  const gap = 5;
  const wBox = (usableW - gap * 2) / 3;
  const boxH = 74;

  // Boîte 1 : Legend (générée dynamiquement depuis les seuils configurés)
  doc.rect(left, y, wBox, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, left, y, wBox, isEn ? 'LEGEND' : 'LÉGENDE DES COTES');
  const legend = buildCoteLegendLines(isEn, coteScale);
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a').text(legend, left + 4, y + 15.5, { width: wBox - 8, lineGap: 1.4 });

  // Boîte 2 : Monthly Result
  const x2 = left + wBox + gap;
  doc.rect(x2, y, wBox, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x2, y, wBox, isEn ? 'MONTHLY RESULT' : 'RÉSULTAT MENSUEL');
  const cote = resolveApcCote(snapshot.generalAverage, coteScale);
  const mRes = isEn
    ? `Total Marks : ${num(snapshot.totalRawMarks)}  |  On : ${formatLocalizedNumber(snapshot.totalMaxMarks, true, 0)}\nAverage : ${num(snapshot.generalAverage)} / 20\nPosition : ${formatRankLabel(snapshot.rank, true)} / ${snapshot.totalStudents}\nRemarks : ${options.mention} // ${cote}`
    : `Total Notes : ${num(snapshot.totalRawMarks)}  |  Sur : ${formatLocalizedNumber(snapshot.totalMaxMarks, false, 0)}\nMoyenne : ${num(snapshot.generalAverage)} / 20\nRang : ${formatRankLabel(snapshot.rank, false)} / ${snapshot.totalStudents}\nAppréciation : ${options.mention} // ${cote}`;
  doc.font(fonts.bold).fontSize(7).fillColor('#0f172a').text(mRes, x2 + 4, y + 15.5, { width: wBox - 8, lineGap: 1.4 });

  // Boîte 3 : Class performance
  const x3 = x2 + wBox + gap;
  doc.rect(x3, y, wBox, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x3, y, wBox, isEn ? 'CLASS PERFORMANCE' : 'PROFIL DE LA CLASSE');
  const cPerf = isEn
    ? `Highest Av. : ${cp ? num(cp.topAverage) : '—'}\nLowest Av. : ${cp ? num(cp.lowAverage) : '—'}\nNb passed : ${cp ? `${cp.passCount}/${cp.classSize}` : '—'}\nRate : ${cp ? formatLocalizedPercent(cp.passRate, true, 2) : '—'} | Class : ${cp ? num(cp.classAverage) : '—'}`
    : `Moy. Premier : ${cp ? num(cp.topAverage) : '—'}\nMoy. Dernier : ${cp ? num(cp.lowAverage) : '—'}\nAdmis : ${cp ? `${cp.passCount}/${cp.classSize}` : '—'}\nTaux : ${cp ? formatLocalizedPercent(cp.passRate, false, 2) : '—'} | Moy. : ${cp ? num(cp.classAverage) : '—'}`;
  doc.font(fonts.regular).fontSize(7).fillColor('#0f172a').text(cPerf, x3 + 4, y + 15.5, { width: wBox - 8, lineGap: 1.4 });

  // Bandeau Signatures + QR >= 20 mm
  const sy = y + boxH + 4;
  const sigH = 70;
  const qrSize = qrBuffer ? 60 : 0;
  const sigAreaW = qrBuffer ? usableW - qrSize - 8 : usableW;
  const sW = (sigAreaW - gap * 2) / 3;
  const titles = isEn
    ? ["Parent's name and visa", "Teacher's Signature", "Head Teacher's Signature"]
    : ['Nom et visa du parent', "Signature de l'enseignant", 'Signature du Directeur'];
  titles.forEach((t, idx) => {
    const sx = left + idx * (sW + gap);
    doc.rect(sx, sy, sW, sigH).strokeColor('#334155').lineWidth(0.7).stroke();
    drawBoxTitle(doc, fonts, sx, sy, sW, t);
  });
  drawQrBlockAt(doc, fonts, left + usableW - qrSize, sy, options, qrBuffer, 60);

  const footY = sy + sigH + 3;
  const printedDate = (options.issuedAt ?? new Date()).toLocaleDateString(isEn ? 'en-GB' : 'fr-FR');
  const printedLine = isEn ? `Printed on ${printedDate}` : `Imprimé le ${printedDate}`;
  doc.font(fonts.italic).fontSize(7).fillColor('#475569')
    .text(isEn ? 'NB: You can keep this document as long as possible' : 'NB : Conservez précieusement ce bulletin officiel', left, footY, { width: usableW * 0.55 });
  doc.text(printedLine, left + usableW * 0.55, footY, { width: usableW * 0.45, align: 'right' });
  doc.y = footY + 10;
}
