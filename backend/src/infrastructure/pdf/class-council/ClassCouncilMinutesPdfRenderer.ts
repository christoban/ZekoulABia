import PDFDocument from 'pdfkit';
import type { ProcesVerbalData } from '@application/classCouncil/dto/ProcesVerbalData';
import { DECISION_LABEL, DECISION_COLOR } from '@domain/policies/ClassCouncilDecisionPolicy';

export function renderClassCouncilMinutesPdf(data: ProcesVerbalData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => buffers.push(chunk));

  const lineY = doc.y;
  doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
  doc.text('République du Cameroun\nPaix – Travail – Patrie', 40, lineY, { width: 180, align: 'center' });
  doc.text('Republic of Cameroon\nPeace – Work – Fatherland', 375, lineY, { width: 180, align: 'center' });
  doc.moveDown(0.2);

  const lineAfterHeader = doc.y;
  doc.moveTo(40, lineAfterHeader).lineTo(555, lineAfterHeader).strokeColor('#1e293b').lineWidth(0.5).stroke();
  doc.moveDown(0.3);

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b').text(data.school.name.toUpperCase(), { align: 'center' });
  if (data.school.city) doc.fontSize(9).font('Helvetica').text(data.school.city, { align: 'center' });
  doc.moveDown(0.5);

  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b')
    .text('PROCÈS-VERBAL DU CONSEIL DE CLASSE', { align: 'center' });
  doc.moveDown(0.15);
  doc.fontSize(10).font('Helvetica').fillColor('#334155')
    .text(`Année scolaire ${data.academicYear}  —  ${data.academicPeriod}`, { align: 'center' });
  doc.moveDown(0.6);

  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
  doc.moveDown(0.4);

  doc.fontSize(10).font('Helvetica');
  const infoStart = doc.y;
  doc.text(`Classe :`, 40, infoStart, { continued: true }).font('Helvetica-Bold').text(` ${data.className}`, { continued: false });
  doc.font('Helvetica').text(`Date du conseil :`, { continued: true }).font('Helvetica-Bold').text(` ${data.date}`);
  doc.font('Helvetica').text(`Président de séance :`, { continued: true }).font('Helvetica-Bold').text(` ${data.presidedBy}`);
  doc.font('Helvetica').text(`Effectif total :`, { continued: true }).font('Helvetica-Bold').text(` ${data.statistics.totalStudents} élève(s)`);
  doc.moveDown(0.6);

  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.4).stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold').text('DÉLIBÉRATIONS PAR ÉLÈVE', { underline: true });
  doc.moveDown(0.3);

  const colX = { nom: 40, moy: 270, decision: 340, obs: 430 };
  const tableHeaderY = doc.y;
  doc.rect(40, tableHeaderY, 515, 16).fill('#1e293b');
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor('white');
  doc.text('NOM ET PRÉNOM', colX.nom + 4, tableHeaderY + 4, { width: 226 });
  doc.text('MOY.', colX.moy + 2, tableHeaderY + 4, { width: 66, align: 'center' });
  doc.text('DÉCISION', colX.decision, tableHeaderY + 4, { width: 86, align: 'center' });
  doc.text('OBSERVATIONS', colX.obs, tableHeaderY + 4, { width: 121 });
  doc.fillColor('black');
  doc.y = tableHeaderY + 18;

  data.students.forEach((d, i) => {
    if (doc.y > 720) { doc.addPage(); doc.y = 40; }
    const rowY = doc.y;
    const avgText = d.average != null ? d.average.toFixed(2) : '—';

    if (i % 2 === 0) doc.rect(40, rowY, 515, 15).fill('#f8fafc');
    doc.rect(40, rowY, 515, 15).strokeColor('#e2e8f0').lineWidth(0.3).stroke();

    doc.fillColor('#1e293b').fontSize(8.5).font('Helvetica');
    doc.text(`${d.lastName} ${d.firstName}`, colX.nom + 4, rowY + 3, { width: 222, ellipsis: true });
    doc.text(avgText, colX.moy + 2, rowY + 3, { width: 66, align: 'center' });
    doc.fillColor(DECISION_COLOR[d.decision as keyof typeof DECISION_COLOR] ?? '#1e293b').font('Helvetica-Bold');
    doc.text(DECISION_LABEL[d.decision as keyof typeof DECISION_LABEL] ?? d.decision, colX.decision, rowY + 3, { width: 86, align: 'center' });
    doc.fillColor('#334155').font('Helvetica');
    doc.text(d.observations ?? '', colX.obs, rowY + 3, { width: 119, ellipsis: true });
    doc.y = rowY + 16;
  });

  doc.moveDown(0.7);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.4).stroke();
  doc.moveDown(0.3);

  doc.fontSize(9).font('Helvetica-Bold').text('BILAN DE LA DÉLIBÉRATION', { underline: true });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9);
  doc.text(`Admis(es) (PASS) : ${data.statistics.passCount}   |   En délibération : ${data.statistics.deliberationCount}   |   Redoublants : ${data.statistics.repeatCount}   |   Taux de réussite : ${data.statistics.successRate}%`);
  doc.moveDown(0.8);

  if (doc.y > 680) doc.addPage();
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.4).stroke();
  doc.moveDown(0.4);
  doc.fontSize(9).font('Helvetica-Bold').text('SIGNATURES', { underline: true });
  doc.moveDown(0.5);

  const sigY = doc.y;
  const sigCols = [40, 210, 390];
  const sigLabels = ['Le Président de séance', 'Le Secrétaire', 'Le Chef d\'Établissement'];
  sigLabels.forEach((label, i) => {
    const x = sigCols[i] ?? 40;
    doc.fontSize(8.5).font('Helvetica').fillColor('#334155').text(label, x, sigY, { width: 150, align: 'center' });
    doc.moveTo(x, sigY + 38).lineTo(x + 150, sigY + 38).strokeColor('#94a3b8').lineWidth(0.5).stroke();
  });

  doc.end();
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
}
