import PDFDocument from 'pdfkit';
import type { RapportConseilData } from '@application/classCouncil/dto/RapportConseilData';

export function renderClassCouncilReportPdf(data: RapportConseilData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  doc.fontSize(16).font('Helvetica-Bold').text('RAPPORT DE CONSEIL DE CLASSE', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(`${data.school.name}  —  Année scolaire ${data.academicYear}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
  doc.moveDown(0.5);

  doc.fontSize(11).font('Helvetica-Bold').text('INFORMATIONS GÉNÉRALES');
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Classe : ${data.className}`);
  doc.text(`Période : ${data.academicPeriod}`);
  doc.text(`Date du conseil : ${data.date}`);
  doc.text(`Présidé par : ${data.presidedBy}`);
  doc.text(`Statut : ${data.status}`);
  doc.moveDown(0.5);

  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica-Bold').text('SITUATION PÉDAGOGIQUE');
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Effectif total : ${data.statistics.totalStudents} élève(s)`);
  doc.text(`Admis (Passage) : ${data.statistics.passCount} élève(s)`);
  doc.text(`En délibération : ${data.statistics.deliberationCount} élève(s)`);
  doc.text(`Redoublants : ${data.statistics.repeatCount} élève(s)`);
  doc.text(`Taux de réussite : ${data.statistics.successRate}%`);
  doc.moveDown(0.3);
  doc.text(`Moyenne de classe : ${data.statistics.classAverage.toFixed(2)} / 20`);
  doc.text(`Plus haute moyenne : ${data.statistics.highestAverage.toFixed(2)} / 20`);
  doc.text(`Plus basse moyenne : ${data.statistics.lowestAverage.toFixed(2)} / 20`);
  doc.moveDown(0.5);

  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica-Bold').text('DÉCISIONS PAR ÉLÈVE');
  doc.moveDown(0.3);

  const tableY = doc.y;
  doc.rect(40, tableY, 515, 16).fill('#1e293b');
  doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
  doc.text('NOM ET PRÉNOM', 44, tableY + 4, { width: 200 });
  doc.text('MOYENNE', 244, tableY + 4, { width: 70, align: 'center' });
  doc.text('DÉCISION', 314, tableY + 4, { width: 100, align: 'center' });
  doc.text('OBSERVATIONS', 414, tableY + 4, { width: 141 });
  doc.fillColor('black');
  doc.y = tableY + 18;

  data.students.forEach((d, i) => {
    const rowY = doc.y;
    const avgText = d.average !== null ? d.average.toFixed(2) : '—';
    const decisionColor = d.decision === 'PASS' ? '#16a34a' : d.decision === 'REPEAT' ? '#dc2626' : '#d97706';

    if (i % 2 === 0) doc.rect(40, rowY, 515, 15).fill('#f8fafc').stroke('#e2e8f0');
    else doc.rect(40, rowY, 515, 15).stroke('#e2e8f0');

    doc.fillColor('black').fontSize(9).font('Helvetica');
    doc.text(`${d.lastName} ${d.firstName}`, 44, rowY + 3, { width: 196, ellipsis: true });
    doc.text(avgText, 244, rowY + 3, { width: 70, align: 'center' });
    doc.fillColor(decisionColor).font('Helvetica-Bold');
    doc.text(d.decision, 314, rowY + 3, { width: 100, align: 'center' });
    doc.fillColor('black').font('Helvetica');
    doc.text(d.observations ?? '', 414, rowY + 3, { width: 137, ellipsis: true });
    doc.y = rowY + 16;
  });

  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica-Bold').text('SIGNATURES');
  doc.moveDown(0.5);

  const sigY = doc.y;
  const sigCols = [40, 210, 390];
  const sigLabels = ['Professeur Principal', 'Censeur / VP', 'Proviseur / Principal'];
  sigLabels.forEach((label, i) => {
    const x = sigCols[i] ?? 40;
    doc.fontSize(9).font('Helvetica').text(label, x, sigY, { width: 140, align: 'center' });
    doc.moveTo(x, sigY + 35).lineTo(x + 140, sigY + 35).strokeColor('#94a3b8').lineWidth(0.5).stroke();
  });

  doc.end();
  return new Promise(resolve => {
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
}
