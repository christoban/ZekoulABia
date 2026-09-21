/**
 * INFRASTRUCTURE — Adaptateur PDFKit pour Convocations et Listes d'émargement de Concours
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type {
  EntranceExamPdfPort,
  ConvocationPdfData,
  EmargementRoomPdfData,
} from '@domain/ports/services/EntranceExamPdfPort';

export class PdfKitEntranceExamAdapter implements EntranceExamPdfPort {
  async genererConvocationPdf(data: ConvocationPdfData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });

    // Générer QR code
    const qrUrl = data.verificationUrl || `https://zekoulabia.com/verifier/candidat/${encodeURIComponent(data.candidateNumber)}`;
    const qrBuffer = await QRCode.toBuffer(qrUrl, {
      type: 'png',
      margin: 1,
      width: 100,
      color: { dark: '#1e3a8a', light: '#ffffff' },
    });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // En-tête officiel
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e3a8a').text('RÉPUBLIQUE DU CAMEROUN', { align: 'center' });
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Paix — Travail — Patrie', { align: 'center' });
      doc.moveDown(0.3);

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(data.schoolName.toUpperCase(), { align: 'center' });
      doc.moveTo(36, doc.y + 4).lineTo(559, doc.y + 4).strokeColor('#1e3a8a').lineWidth(1.5).stroke();
      doc.moveDown(0.8);

      // Titre
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#1e3a8a').text('CARTE DE CONVOCATION DU CANDIDAT', { align: 'center' });
      doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text(data.sessionName, { align: 'center' });
      doc.moveDown(0.8);

      // Cadre d'identité avec QR code
      const boxY = doc.y;
      doc.roundedRect(36, boxY, 523, 130, 6).fillAndStroke('#f8fafc', '#cbd5e1');

      // QR Code à droite
      doc.image(qrBuffer, 440, boxY + 15, { width: 100 });

      // Informations candidat à gauche
      doc.fillColor('#111827');
      doc.font('Helvetica-Bold').fontSize(11).text('Code Candidat :', 50, boxY + 15);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e3a8a').text(data.candidateNumber, 155, boxY + 14);

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151').text('Nom & Prénom :', 50, boxY + 38);
      doc.font('Helvetica').fontSize(10).fillColor('#111827').text(data.candidateFullName, 155, boxY + 38);

      const dobStr = data.dateOfBirth
        ? new Date(data.dateOfBirth).toLocaleDateString('fr-FR')
        : 'Non renseignée';
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151').text('Né(e) le :', 50, boxY + 58);
      doc.font('Helvetica').fontSize(10).fillColor('#111827').text(dobStr, 155, boxY + 58);

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#374151').text('École d\'origine :', 50, boxY + 78);
      doc.font('Helvetica').fontSize(10).fillColor('#111827').text(data.originSchool || 'Non précisée', 155, boxY + 78);

      // Salle & Place en valeur
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e3a8a').text('SALLE D\'EXAMEN :', 50, boxY + 102);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(data.roomName || 'À préciser', 155, boxY + 102);

      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e3a8a').text('N° DE TABLE :', 280, boxY + 102);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(data.deskNumber ? `${data.deskNumber}` : 'Libre', 365, boxY + 102);

      doc.y = boxY + 145;

      // Épreuves
      if (data.subjects && data.subjects.length > 0) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a8a').text('ÉPREUVES AU PROGRAMME :');
        doc.moveDown(0.3);
        data.subjects.forEach((s) => {
          doc.font('Helvetica').fontSize(9).fillColor('#374151')
            .text(`• ${s.name} (Coefficient ${s.coefficient}, Notée sur ${s.maxScore})`);
        });
        doc.moveDown(0.5);
      }

      // Consignes
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#dc2626').text('CONSIGNES STRICTES AUX CANDIDATS :');
      doc.moveDown(0.2);
      const instructions = data.instructions || [
        '1. Être présent 30 minutes avant le début de la première épreuve muni de cette convocation.',
        '2. Présenter une pièce d\'identité (carte scolaire ou acte de naissance original).',
        '3. L\'usage de téléphone portable et calculatrice programmable est strictement interdit.',
        '4. Les copies doivent être remplies uniquement avec le numéro anonyme du candidat.',
      ];
      instructions.forEach((inst) => {
        doc.font('Helvetica').fontSize(8.5).fillColor('#4b5563').text(inst);
      });

      // Cadre signature et cachet
      doc.moveDown(1.5);
      const sealY = doc.y;
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280')
        .text(`Date d'examen : ${new Date(data.examDate).toLocaleDateString('fr-FR')}`, 50, sealY);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827')
        .text('Signature et cachet du Chef d\'établissement', 320, sealY, { align: 'center' });

      doc.end();
    });
  }

  async genererListeEmargementPdf(data: EmargementRoomPdfData): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Titre paysage
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#1e3a8a')
        .text(`${data.schoolName.toUpperCase()} — LISTE D'ÉMARGEMENT DU CONCOURS`, { align: 'center' });
      doc.font('Helvetica').fontSize(9).fillColor('#4b5563')
        .text(`Session : ${data.sessionName} | Salle : ${data.roomName} | Date : ${new Date(data.examDate).toLocaleDateString('fr-FR')}`, { align: 'center' });
      doc.moveDown(0.6);

      // En-tête tableau
      const startY = doc.y;
      const colX = [36, 75, 150, 370, 470, 590, 710];
      const headers = ['N° Table', 'Code', 'Nom & Prénom', 'Né(e) le', 'École d\'origine', 'Émargement', 'Présence'];

      doc.rect(36, startY, 760, 20).fill('#e2e8f0');
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(9);
      headers.forEach((h, idx) => {
        doc.text(h, colX[idx] + 2, startY + 5);
      });

      let currentY = startY + 22;
      const rowHeight = 22;

      data.candidates.forEach((cand, index) => {
        if (currentY > 530) {
          doc.addPage({ size: 'A4', margin: 36, layout: 'landscape' });
          currentY = 40;
        }

        // Alternance de couleur
        if (index % 2 === 1) {
          doc.rect(36, currentY, 760, rowHeight).fill('#f8fafc');
        }

        doc.fillColor('#1e293b').font('Helvetica').fontSize(8.5);
        doc.text(cand.deskNumber ? `${cand.deskNumber}` : '-', colX[0] + 5, currentY + 6);
        doc.font('Helvetica-Bold').text(cand.candidateNumber, colX[1] + 2, currentY + 6);
        doc.font('Helvetica').text(cand.fullName, colX[2] + 2, currentY + 6, { width: 215 });

        const dob = cand.dateOfBirth ? new Date(cand.dateOfBirth).toLocaleDateString('fr-FR') : '-';
        doc.text(dob, colX[3] + 2, currentY + 6);
        doc.text(cand.originSchool || '-', colX[4] + 2, currentY + 6, { width: 115 });

        // Ligne séparatrice
        doc.moveTo(36, currentY + rowHeight).lineTo(796, currentY + rowHeight).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        currentY += rowHeight;
      });

      // Cadre bas de page
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1e293b')
        .text(`Total candidats en salle : ${data.candidates.length}`, 36, doc.y + 10);
      doc.text('Visa des surveillants de salle (Nom & Signature) :', 450, doc.y);

      doc.end();
    });
  }
}
