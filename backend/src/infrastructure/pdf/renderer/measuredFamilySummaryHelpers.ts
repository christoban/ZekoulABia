import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type { BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import { deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import { formatAbsenceHoursDisplay } from '@application/reportCard/bulletinEnrichmentHelpers';
import type { FontSet, MeasuredPdfDoc } from './measuredHeaderHelpers';
import { formatRankLabel, resolveApcCote } from './measuredSubjectTableHelpers';
import { formatLocalizedNumber, formatLocalizedPercent } from './measuredFormatHelpers';

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
    doc.font(fonts.regular).fontSize(5.4).fillColor('#334155')
      .text(displayCode, qx - 2, qy + size + 1.5, { width: size + 4, align: 'center' });
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
  doc.rect(x, y, w, 12).fillAndStroke('#e2e8f0', '#334155');
  doc.font(fonts.bold).fontSize(6.3).fillColor('#0f172a').text(title, x + 3, y + 3, { width: w - 6, align: 'center' });
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

  // Grille RECAPITULATIF, PROFIL DE LA CLASSE
  ensureFooterSpace(doc, 158);
  const gy = doc.y;
  drawBoxTitle(doc, fonts, left, gy, usableW, 'RÉCAPITULATIF, PROFIL DE LA CLASSE, APPRÉCIATIONS GÉNÉRALES ET OBSERVATIONS');
  const recapRow1 = `MOY.AN : ${num(snapshot.generalAverage)}/20  |  TRI1 : ${num(terms?.trim1)}  |  Ev1 : ${sStr(0)}  |  Ev2 : ${sStr(1)}  |  TRI2 : ${num(terms?.trim2)}  |  Ev3 : ${sStr(2)}  |  Ev4 : ${sStr(3)}  |  TRI3 : ${num(terms?.trim3)}  |  Ev5 : ${sStr(4)}  |  Ev6 : ${sStr(5)}  |  PREMIER : ${cp ? num(cp.topAverage) : '—'}`;
  const recapRow2 = `RANG AN : ${snapshot.rank}/${snapshot.totalStudents}  |  Tr1 : ${tRk(snapshot.rankTrimestre1)}  |  Ev1 : ${rStr(0)} | Ev2 : ${rStr(1)} | Tr2 : ${tRk(snapshot.rankTrimestre2)} | Ev3 : ${rStr(2)} | Ev4 : ${rStr(3)} | Tr3 : ${tRk(snapshot.rankTrimestre3)} | Ev5 : ${rStr(4)} | Ev6 : ${rStr(5)} | DERNIER : ${cp ? num(cp.lowAverage) : '—'} | MOY. CLASSE : ${cp ? num(cp.classAverage) : '—'}`;
  doc.rect(left, gy + 12, usableW, 25).fillAndStroke('#f8fafc', '#334155');
  doc.font(fonts.bold).fontSize(5.9).fillColor('#0f172a').text(recapRow1, left + 4, gy + 14.5, { width: usableW - 8 });
  doc.font(fonts.regular).fontSize(5.9).fillColor('#0f172a').text(recapRow2, left + 4, gy + 24.5, { width: usableW - 8 });

  // Bas 2 colonnes : SANCTIONS (gauche) + OBSERVATIONS DU CHEF D'ETABLISSEMENT & QR (droite)
  const botY = gy + 41;
  const colW = (usableW - 6) * 0.56;
  const rightW = usableW - colW - 6;
  const botH = 114;

  doc.rect(left, botY, colW, botH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, left, botY, colW, 'SANCTIONS (DÉCISION DU CONSEIL DE CLASSE)');
  const c = snapshot.conduct;
  const tr = c?.trimesterAbsences;
  const dec = snapshot.councilDecision;
  const exc = dec?.exclusionReasons;

  const discLines = [
    `DISCIPLINE — Absences (h) J/NJ : Trim1 ${formatAbsenceHoursDisplay(tr?.t1?.j, 'fr')}/${formatAbsenceHoursDisplay(tr?.t1?.nj, 'fr')}  |  Trim2 ${formatAbsenceHoursDisplay(tr?.t2?.j, 'fr')}/${formatAbsenceHoursDisplay(tr?.t2?.nj, 'fr')}  |  Trim3 ${formatAbsenceHoursDisplay(tr?.t3?.j, 'fr')}/${formatAbsenceHoursDisplay(tr?.t3?.nj, 'fr')}`,
    `Annuel J/NJ : ${formatAbsenceHoursDisplay(c?.justifiedAbsenceHours, 'fr')} / ${formatAbsenceHoursDisplay(c?.unjustifiedAbsenceHours, 'fr')}   |   Exclusions (j) : ${c?.exclusionsCount ?? 0}`,
    `TRAVAIL : ${mark(dec?.honorRoll)} Tableau d'honneur   ${mark(dec?.encouragements)} Encouragements   ${mark(dec?.congratulations)} Félicitations`,
    `DÉCISION ANNUELLE — ${mark(dec?.decision === 'PASS')} PROMU(E) EN : ${dec?.promotedToClass ?? '—'}   ${mark(dec?.decision === 'REPEAT')} REDOUBLE : ${dec?.repeatClass ?? '—'}`,
    `${mark(dec?.excluded)} EXCLU(E) POUR : ${mark(exc?.insufficientAverage)} Moy. insuffisante  ${mark(exc?.alreadyRepeated)} A déjà redoublé  ${mark(exc?.deplorableConduct)} Conduite  ${mark(exc?.tooManyAbsences)} Absences  ${mark(exc?.tooOld)} Trop âgé`,
  ];
  doc.font(fonts.regular).fontSize(5.9).fillColor('#0f172a');
  let dy = botY + 15;
  for (const dl of discLines) {
    doc.text(dl, left + 4, dy, { width: colW - 8 });
    dy = doc.y + 2;
  }

  const rx = left + colW + 6;
  doc.rect(rx, botY, rightW, botH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, rx, botY, rightW, "OBSERVATIONS DU CHEF D'ÉTABLISSEMENT");
  const textAreaW = qrBuffer ? rightW - 70 : rightW - 8;
  const obsLines = [
    `Appréciation travail : ${options.mention !== '—' ? options.mention : '—'}`,
    `Conseil : ${dec?.observations ?? '—'}`,
    formatPlaceDateLine(options, false),
    'LE PROVISEUR',
  ];
  doc.font(fonts.regular).fontSize(6.2).fillColor('#0f172a').text(obsLines.join('\n'), rx + 4, botY + 15, { width: textAreaW, lineGap: 2 });
  if (options.school.stampBuffer) {
    try { doc.image(options.school.stampBuffer, rx + 6, botY + 62, { fit: [52, 42] }); } catch { /* ignore */ }
  }
  if (options.school.principalSignatureBuffer) {
    try { doc.image(options.school.principalSignatureBuffer, rx + 62, botY + 64, { fit: [64, 38] }); } catch { /* ignore */ }
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
  const h = 118;

  // Colonne 1 : Conduite & Visa PP
  doc.rect(left, y, w1, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, left, y, w1, 'ASSIDUITÉ & CONDUITE');
  const cLines = [
    `Absences Justifiées : ${formatAbsenceHoursDisplay(c?.justifiedAbsenceHours, 'fr')}`,
    `Absences Non Justifiées : ${formatAbsenceHoursDisplay(c?.unjustifiedAbsenceHours, 'fr')}`,
    `Exclusion Temporaire : ${c?.exclusionsCount ?? 0} j`,
    `Avertissement Conduite : ${c?.warningsCount ?? 0}`,
    `Blâme Conduite : ${c?.blamesCount ?? 0}`,
    `Corvée (en jrs) : ${c?.workDayPenaltyDays ?? '—'}`,
    '',
    'VISA DU PROFESSEUR PRINCIPAL :',
    options.classMasterComment?.trim() || '—',
  ];
  doc.font(fonts.regular).fontSize(6.2).fillColor('#0f172a').text(cLines.join('\n'), left + 4, y + 15, { width: w1 - 8, lineGap: 1.3 });

  // Colonne 2 : Moyenne/Rang + Décisions Conseil + Visa Parent
  const x2 = left + w1 + gap;
  doc.rect(x2, y, w2, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x2, y, w2, 'RÉSULTATS & DÉCISIONS DU CONSEIL');
  const mLines = [
    `MOYENNE TRIM. : ${num(snapshot.generalAverage)} / 20`,
    `RANG TRIMESTRE : ${formatRankLabel(snapshot.rank, false)} / ${snapshot.totalStudents}`,
    `${mark(dec?.honorRoll)} Tableau d'Honneur   ${mark(dec?.congratulations)} Félicitations`,
    `${mark(dec?.encouragements)} Encouragements`,
    `${mark(dec?.workWarning)} Avert. Travail   ${mark(dec?.workBlame)} Blâme Travail`,
    '',
    'VISA DU PARENT OU TUTEUR :',
  ];
  doc.font(fonts.bold).fontSize(6.2).fillColor('#0f172a').text(mLines.join('\n'), x2 + 4, y + 15, { width: w2 - 8, lineGap: 1.5 });

  // Colonne 3 : Stats Classe + Appréciations + Proviseur + QR
  const x3 = x2 + w2 + gap;
  doc.rect(x3, y, w3, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x3, y, w3, 'CLASSE & PROVISEUR');
  const rLines = [
    `Moy. Générale classe : ${cp ? num(cp.classAverage) : '—'} / 20`,
    `% Réussite classe : ${cp ? formatLocalizedPercent(cp.passRate, false, 2) : '—'}`,
    `Appréciation : ${options.mention}`,
    formatPlaceDateLine(options, false),
    'Le Proviseur',
  ];
  const rwText = qrBuffer ? w3 - 68 : w3 - 8;
  doc.font(fonts.regular).fontSize(6.1).fillColor('#0f172a').text(rLines.join('\n'), x3 + 4, y + 15, { width: rwText, lineGap: 1.6 });
  if (options.school.stampBuffer) {
    try { doc.image(options.school.stampBuffer, x3 + 6, y + 74, { fit: [48, 36] }); } catch { /* ignore */ }
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
  ensureFooterSpace(doc, 155);
  const gy = doc.y;

  drawBoxTitle(doc, fonts, left, gy, usableW, 'RÉCAPITULATIF & PROFIL DE LA CLASSE');
  const s0 = seqs[0];
  const s1 = seqs[1];
  const recap = `MOY TRIM : ${num(snapshot.generalAverage)}/20   |   RANG TRIM : ${formatRankLabel(snapshot.rank, false)}/${snapshot.totalStudents}   |   MOY Eval a : ${num(s0?.average)} (Rang ${s0?.rank ? `${s0.rank}/${snapshot.totalStudents}` : '—'})   |   MOY Eval b : ${num(s1?.average)} (Rang ${s1?.rank ? `${s1.rank}/${snapshot.totalStudents}` : '—'})`;
  const profile = `APPRÉCIATION DU TRAVAIL : ${options.mention}   |   MOY DU PREMIER : ${cp ? num(cp.topAverage) : '—'}   |   MOY DU DERNIER : ${cp ? num(cp.lowAverage) : '—'}   |   MOY. GÉN. CLASSE : ${cp ? num(cp.classAverage) : '—'}/20`;
  doc.rect(left, gy + 12, usableW, 24).fillAndStroke('#f8fafc', '#334155');
  doc.font(fonts.bold).fontSize(6.2).fillColor('#0f172a').text(recap, left + 4, gy + 14.5, { width: usableW - 8 });
  doc.font(fonts.regular).fontSize(6.1).fillColor('#0f172a').text(profile, left + 4, gy + 24.5, { width: usableW - 8 });

  const botY = gy + 40;
  const gap = 5;
  const w1 = usableW * 0.45;
  const w2 = usableW * 0.24;
  const w3 = usableW - w1 - w2 - gap * 2;
  const h = 112;
  const c = snapshot.conduct;
  const dec = snapshot.councilDecision;
  const apc = dec?.apcObservations;

  doc.rect(left, botY, w1, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, left, botY, w1, 'SANCTIONS (DÉCISION DU CONSEIL DE CLASSE)');
  const sLines = [
    `DISCIPLINE : Abs. J ${formatAbsenceHoursDisplay(c?.justifiedAbsenceHours, 'fr')} | NJ ${formatAbsenceHoursDisplay(c?.unjustifiedAbsenceHours, 'fr')} | Aver. ${c?.warningsCount ?? 0} | Blâme ${c?.blamesCount ?? 0} | Excl. ${c?.exclusionsCount ?? 0} j`,
    `TRAVAIL : ${mark(dec?.honorRoll)} Tableau d'honneur  ${mark(dec?.encouragements)} Encouragements  ${mark(dec?.congratulations)} Félicitations`,
    `${mark(dec?.workWarning)} Aver. travail   ${mark(dec?.workBlame)} Blâme travail`,
    `APPRÉCIATIONS GÉNÉRALES : ${mark(apc?.makingProgress)} En progrès  ${mark(apc?.declining)} En baisse  ${mark(apc?.conductWarning)} Conduite`,
    `${mark(apc?.tooManyAbsences)} Trop d'absences   ${mark(apc?.riskOfExpulsion)} Risque exclusion   Effort en : ${apc?.effortRequiredIn ?? '—'}`,
  ];
  doc.font(fonts.regular).fontSize(5.9).fillColor('#0f172a').text(sLines.join('\n'), left + 4, botY + 15, { width: w1 - 8, lineGap: 1.6 });

  const x2 = left + w1 + gap;
  doc.rect(x2, botY, w2, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x2, botY, w2, 'OBSERVATION & VISA DES PARENTS');
  doc.font(fonts.regular).fontSize(6).fillColor('#475569').text(dec?.observations ?? '', x2 + 4, botY + 16, { width: w2 - 8 });

  const x3 = x2 + w2 + gap;
  doc.rect(x3, botY, w3, h).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x3, botY, w3, "OBSERVATIONS DU CHEF D'ÉTABLISSEMENT");
  const rwText = qrBuffer ? w3 - 68 : w3 - 8;
  doc.font(fonts.regular).fontSize(6.1).fillColor('#0f172a')
    .text(`${formatPlaceDateLine(options, false)}\nLE PROVISEUR`, x3 + 4, botY + 16, { width: rwText, lineGap: 2 });
  drawQrBlockAt(doc, fonts, x3 + w3 - 64, botY + 26, options, qrBuffer, 60);
  doc.y = botY + h + 4;
}

export function drawPrimaryPointsRatioSummary(
  doc: MeasuredPdfDoc,
  fonts: FontSet,
  snapshot: StudentBulletinSnapshot,
  options: BulletinRenderOptions,
  qrBuffer: Buffer | null,
): void {
  const isEn = options.language === 'en';
  const left = doc.page.margins.left;
  const usableW = doc.page.width - left - doc.page.margins.right;
  const num = (v: number | undefined | null) => formatLocalizedNumber(v, isEn, 2);
  const cp = snapshot.classProfile;
  ensureFooterSpace(doc, 145);
  const y = doc.y;
  const gap = 5;
  const wBox = (usableW - gap * 2) / 3;
  const boxH = 66;

  // Boîte 1 : Legend
  doc.rect(left, y, wBox, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, left, y, wBox, isEn ? 'LEGEND' : 'LÉGENDE DES COTES');
  const legend = isEn
    ? 'A+ : Expert [18-20]\nA : Acquired [15-17.99]\nECA : In course of acquisition [11-14.99]\nNA : Not Acquired [0-10.99]'
    : "A+ : Expert [18-20]\nA : Acquis [15-17,99]\nECA : En cours d'acquisition [11-14,99]\nNA : Non acquis [0-10,99]";
  doc.font(fonts.regular).fontSize(6).fillColor('#0f172a').text(legend, left + 4, y + 14.5, { width: wBox - 8, lineGap: 1.5 });

  // Boîte 2 : Monthly Result
  const x2 = left + wBox + gap;
  doc.rect(x2, y, wBox, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x2, y, wBox, isEn ? 'MONTHLY RESULT' : 'RÉSULTAT MENSUEL');
  const cote = resolveApcCote(snapshot.generalAverage);
  const mRes = isEn
    ? `Total Marks : ${num(snapshot.totalRawMarks)}   |   On : ${formatLocalizedNumber(snapshot.totalMaxMarks, true, 0)}\nAverage : ${num(snapshot.generalAverage)} / 20\nPosition : ${formatRankLabel(snapshot.rank, true)} / ${snapshot.totalStudents}\nGeneral Remarks : ${options.mention} // ${cote}`
    : `Total Notes : ${num(snapshot.totalRawMarks)}   |   Sur : ${formatLocalizedNumber(snapshot.totalMaxMarks, false, 0)}\nMoyenne : ${num(snapshot.generalAverage)} / 20\nRang : ${formatRankLabel(snapshot.rank, false)} / ${snapshot.totalStudents}\nAppréciation : ${options.mention} // ${cote}`;
  doc.font(fonts.bold).fontSize(6.2).fillColor('#0f172a').text(mRes, x2 + 4, y + 14.5, { width: wBox - 8, lineGap: 1.5 });

  // Boîte 3 : Class performance
  const x3 = x2 + wBox + gap;
  doc.rect(x3, y, wBox, boxH).strokeColor('#334155').lineWidth(0.7).stroke();
  drawBoxTitle(doc, fonts, x3, y, wBox, isEn ? 'CLASS PERFORMANCE' : 'PROFIL DE LA CLASSE');
  const cPerf = isEn
    ? `Highest Av. : ${cp ? num(cp.topAverage) : '—'}\nLowest Av. : ${cp ? num(cp.lowAverage) : '—'}\nNb passed : ${cp ? `${cp.passCount}/${cp.classSize}` : '—'}\nSuccess rate : ${cp ? formatLocalizedPercent(cp.passRate, true, 2) : '—'}  |  Class Av. : ${cp ? num(cp.classAverage) : '—'}`
    : `Moy. Premier : ${cp ? num(cp.topAverage) : '—'}\nMoy. Dernier : ${cp ? num(cp.lowAverage) : '—'}\nAdmis : ${cp ? `${cp.passCount}/${cp.classSize}` : '—'}\nTaux réussite : ${cp ? formatLocalizedPercent(cp.passRate, false, 2) : '—'}  |  Moy. : ${cp ? num(cp.classAverage) : '—'}`;
  doc.font(fonts.regular).fontSize(6).fillColor('#0f172a').text(cPerf, x3 + 4, y + 14.5, { width: wBox - 8, lineGap: 1.5 });

  // Bandeau Signatures + QR >= 20 mm
  const sy = y + boxH + 4;
  const sigH = 68;
  const qrSize = qrBuffer ? 60 : 0;
  const sigAreaW = qrBuffer ? usableW - qrSize - 8 : usableW;
  const sW = (sigAreaW - gap * 2) / 3;
  const titles = isEn
    ? ["Parent's name and visa", "Teacher's Signature", "Head Teacher's Remarks & Signature"]
    : ['Nom et visa du parent', "Signature de l'enseignant", 'Observations et signature du Directeur'];
  titles.forEach((t, idx) => {
    const sx = left + idx * (sW + gap);
    doc.rect(sx, sy, sW, sigH).strokeColor('#334155').lineWidth(0.7).stroke();
    drawBoxTitle(doc, fonts, sx, sy, sW, t);
  });
  drawQrBlockAt(doc, fonts, left + usableW - qrSize, sy, options, qrBuffer, 60);

  const footY = sy + sigH + 3;
  doc.font(fonts.italic).fontSize(5.8).fillColor('#475569')
    .text(isEn ? 'NB: You can keep this document as long as possible' : 'NB : Conservez précieusement ce bulletin officiel', left, footY, { width: usableW / 2 });
  doc.text(formatPlaceDateLine(options, isEn), left + usableW / 2, footY, { width: usableW / 2, align: 'right' });
  doc.y = footY + 10;
}
