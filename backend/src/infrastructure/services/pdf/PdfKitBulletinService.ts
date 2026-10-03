import PDFDocument from 'pdfkit';
import type { PdfService, ContexteBulletin, TableauHonneurLigne, TableauHonneurAnnuelLigne } from '@domain/ports/services/PdfService';
import type { LigneMatiereProps } from '@domain/entities/Bulletin';
import { generateBulletinPdf } from '../../pdf/report-card/BulletinTemplates.ts';

export class PdfKitBulletinService implements PdfService {
  async genererBulletin(contexte: ContexteBulletin): Promise<Buffer> {
    return generateBulletinPdf(contexte.bulletin.template, this.mapperContexte(contexte));
  }

  async genererBulletinsEnMasse(
    contextes: ContexteBulletin[]
  ): Promise<{ bulletinId: string; pdf: Buffer }[]> {
    return Promise.all(
      contextes.map(async (contexte) => ({
        bulletinId: contexte.bulletin.id,
        pdf: await generateBulletinPdf(contexte.bulletin.template, this.mapperContexte(contexte)),
      }))
    );
  }

  async genererTableauHonneur(params: {
    className: string;
    periodName: string;
    yearName: string;
    schoolName: string;
    schoolCity?: string;
    reportCards: TableauHonneurLigne[];
  }): Promise<Buffer> {
    return this.buildTableauHonneurPdf(params);
  }

  async genererTableauHonneurAnnuel(params: {
    className: string;
    yearName: string;
    schoolName: string;
    schoolCity?: string;
    ranked: TableauHonneurAnnuelLigne[];
  }): Promise<Buffer> {
    return this.buildTableauHonneurAnnuelPdf(params);
  }

  private buildTableauHonneurPdf(params: {
    className: string;
    periodName: string;
    yearName: string;
    schoolName: string;
    schoolCity?: string;
    reportCards: TableauHonneurLigne[];
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const mentionLabel = (avg: number | null) => {
        if (avg == null) return '—';
        if (avg >= 16) return 'Très Bien';
        if (avg >= 14) return 'Bien';
        if (avg >= 12) return 'Assez Bien';
        if (avg >= 10) return 'Passable';
        return 'Insuffisant';
      };

      const lineY = doc.y;
      doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
      doc.text('République du Cameroun\nPaix – Travail – Patrie', 40, lineY, { width: 180, align: 'center' });
      doc.text('Republic of Cameroon\nPeace – Work – Fatherland', 375, lineY, { width: 180, align: 'center' });
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#1e293b').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text(params.schoolName.toUpperCase(), { align: 'center' });
      if (params.schoolCity) doc.fontSize(9).font('Helvetica').text(params.schoolCity, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#b45309').text("TABLEAU D'HONNEUR", { align: 'center' });
      doc.moveDown(0.15);
      doc.fontSize(10).font('Helvetica').fillColor('#334155')
        .text(`${params.className}  —  ${params.periodName}  —  Année scolaire ${params.yearName}`, { align: 'center' });
      doc.fontSize(9).text(`Établi le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, { align: 'center' });
      doc.moveDown(0.7);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      const colX2 = { rang: 40, nom: 95, moy: 360, mention: 435 };
      const tableHeaderY = doc.y;
      doc.rect(40, tableHeaderY, 515, 18).fill('#92400e');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
      doc.text('RANG', colX2.rang + 4, tableHeaderY + 5, { width: 51, align: 'center' });
      doc.text('NOM ET PRÉNOM', colX2.nom, tableHeaderY + 5, { width: 261 });
      doc.text('MOYENNE', colX2.moy, tableHeaderY + 5, { width: 71, align: 'center' });
      doc.text('MENTION', colX2.mention, tableHeaderY + 5, { width: 116, align: 'center' });
      doc.fillColor('black');
      doc.y = tableHeaderY + 20;

      params.reportCards.forEach((rc, i) => {
        const rowY = doc.y;
        const avg = rc.generalAverage ?? 0;
        const avgStr = avg.toFixed(2);
        const mention = rc.mention ?? mentionLabel(avg);
        const isGold = i === 0;
        const isSilver = i === 1;
        const isBronze = i === 2;
        const rowBg = isGold ? '#fef9c3' : isSilver ? '#f1f5f9' : isBronze ? '#fef3c7' : (i % 2 === 0 ? '#fafaf8' : 'white');
        doc.rect(40, rowY, 515, 18).fill(rowBg);
        doc.rect(40, rowY, 515, 18).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
        const medal = isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : `${i + 1}`;
        const rankColor = isGold ? '#b45309' : isSilver ? '#475569' : isBronze ? '#92400e' : '#334155';
        doc.fillColor(rankColor).font('Helvetica-Bold').fontSize(9);
        doc.text(medal, colX2.rang + 4, rowY + 5, { width: 51, align: 'center' });
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(`${rc.lastName} ${rc.firstName}`, colX2.nom, rowY + 5, { width: 261, ellipsis: true });
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(avgStr, colX2.moy, rowY + 5, { width: 71, align: 'center' });
        const mentionColor = avg >= 14 ? '#15803d' : avg >= 12 ? '#065f46' : avg >= 10 ? '#334155' : '#b91c1c';
        doc.fillColor(mentionColor).font('Helvetica');
        doc.text(mention, colX2.mention, rowY + 5, { width: 116, align: 'center' });
        doc.y = rowY + 19;
      });

      doc.moveDown(1.2);
      const sigY = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
        .text("Le Chef d'Établissement", 375, sigY, { width: 180, align: 'center' });
      doc.moveTo(375, sigY + 40).lineTo(555, sigY + 40).strokeColor('#94a3b8').lineWidth(0.5).stroke();

      doc.end();
    });
  }

  private buildTableauHonneurAnnuelPdf(params: {
    className: string;
    yearName: string;
    schoolName: string;
    schoolCity?: string;
    ranked: TableauHonneurAnnuelLigne[];
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const mentionLabel = (avg: number) => {
        if (avg >= 16) return 'Très Bien';
        if (avg >= 14) return 'Bien';
        if (avg >= 12) return 'Assez Bien';
        if (avg >= 10) return 'Passable';
        return 'Insuffisant';
      };

      const lineY = doc.y;
      doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b');
      doc.text('République du Cameroun\nPaix – Travail – Patrie', 40, lineY, { width: 180, align: 'center' });
      doc.text('Republic of Cameroon\nPeace – Work – Fatherland', 375, lineY, { width: 180, align: 'center' });
      doc.moveDown(0.2);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#1e293b').lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica-Bold').text(params.schoolName.toUpperCase(), { align: 'center' });
      if (params.schoolCity) doc.fontSize(9).font('Helvetica').text(params.schoolCity, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica-Bold').fillColor('#b45309').text("TABLEAU D'HONNEUR ANNUEL", { align: 'center' });
      doc.moveDown(0.15);
      doc.fontSize(10).font('Helvetica').fillColor('#334155')
        .text(`${params.className}  —  Année scolaire ${params.yearName}`, { align: 'center' });
      doc.fontSize(9).text(`Établi le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`, { align: 'center' });
      doc.moveDown(0.7);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#334155').lineWidth(0.5).stroke();
      doc.moveDown(0.5);

      const colX2 = { rang: 40, nom: 95, moy: 360, mention: 435 };
      const tableHeaderY = doc.y;
      doc.rect(40, tableHeaderY, 515, 18).fill('#92400e');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
      doc.text('RANG', colX2.rang + 4, tableHeaderY + 5, { width: 51, align: 'center' });
      doc.text('NOM ET PRÉNOM', colX2.nom, tableHeaderY + 5, { width: 261 });
      doc.text('MOY. ANNUELLE', colX2.moy, tableHeaderY + 5, { width: 71, align: 'center' });
      doc.text('MENTION', colX2.mention, tableHeaderY + 5, { width: 116, align: 'center' });
      doc.fillColor('black');
      doc.y = tableHeaderY + 20;

      params.ranked.forEach((r, i) => {
        const rowY = doc.y;
        const isGold = i === 0; const isSilver = i === 1; const isBronze = i === 2;
        const rowBg = isGold ? '#fef9c3' : isSilver ? '#f1f5f9' : isBronze ? '#fef3c7' : (i % 2 === 0 ? '#fafaf8' : 'white');
        doc.rect(40, rowY, 515, 18).fill(rowBg);
        doc.rect(40, rowY, 515, 18).strokeColor('#e5e7eb').lineWidth(0.3).stroke();
        const medal = isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : `${i + 1}`;
        const rankColor = isGold ? '#b45309' : isSilver ? '#475569' : '#334155';
        doc.fillColor(rankColor).font('Helvetica-Bold').fontSize(9);
        doc.text(medal, colX2.rang + 4, rowY + 5, { width: 51, align: 'center' });
        doc.fillColor('#1e293b').font('Helvetica-Bold');
        doc.text(r.name, colX2.nom, rowY + 5, { width: 261, ellipsis: true });
        doc.text(r.annualAvg.toFixed(2), colX2.moy, rowY + 5, { width: 71, align: 'center' });
        const mentionColor = r.annualAvg >= 14 ? '#15803d' : r.annualAvg >= 10 ? '#334155' : '#b91c1c';
        doc.fillColor(mentionColor).font('Helvetica');
        doc.text(mentionLabel(r.annualAvg), colX2.mention, rowY + 5, { width: 116, align: 'center' });
        doc.y = rowY + 19;
      });

      doc.moveDown(1.2);
      const sigY = doc.y;
      doc.fontSize(9).font('Helvetica').fillColor('#334155')
        .text("Le Chef d'Établissement", 375, sigY, { width: 180, align: 'center' });
      doc.moveTo(375, sigY + 40).lineTo(555, sigY + 40).strokeColor('#94a3b8').lineWidth(0.5).stroke();

      doc.end();
    });
  }

  private mapperContexte(contexte: ContexteBulletin) {
    return {
      schoolName: contexte.nomEtablissement,
      logoUrl: contexte.logoUrl,
      studentName: contexte.nomEleve,
      className: contexte.nomClasse,
      periodName: contexte.nomPeriode,
      yearName: contexte.anneeAcademique,
      generalAverage: contexte.bulletin.generalAverage ?? 0,
      rank: contexte.bulletin.rank ?? null,
      totalStudents: contexte.bulletin.totalStudents ?? null,
      absenceCount: contexte.bulletin.absenceCount,
      mention: contexte.bulletin.mention ?? '',
      classMasterComment: contexte.bulletin.classMasterComment ?? null,
      isOfficial: contexte.bulletin.validationStatus === 'GENERATED',
      language: contexte.langue ?? 'fr',
      verifyUrl: contexte.verifyUrl,
      seq1Label: contexte.seq1Label,
      seq2Label: contexte.seq2Label,
      subjectLines: contexte.bulletin.lignesMatiere.map(this.mapperLigne),
    };
  }

  private mapperLigne(ligne: LigneMatiereProps) {
    return {
      subjectName: ligne.subjectName,
      coefficient: ligne.coefficient,
      seq1Score: ligne.seq1Score,
      seq2Score: ligne.seq2Score,
      compositionScore: ligne.compositionScore,
      seq3Score: ligne.seq3Score,
      seq4Score: ligne.seq4Score,
      seq5Score: ligne.seq5Score,
      seq6Score: ligne.seq6Score,
      classTestScore: ligne.classTestScore,
      terminalExamScore: ligne.terminalExamScore,
      theoreticalScore: ligne.theoreticalScore,
      practicalScore: ligne.practicalScore,
      professionalAttitude: ligne.professionalAttitude,
      oralScore: ligne.oralScore,
      selfDevelopmentScore: ligne.selfDevelopmentScore,
      subjectAverage: ligne.subjectAverage,
      weightedScore: ligne.weightedScore,
      teacherComment: ligne.teacherComment,
      competenceLabel: ligne.competenceLabel,
    };
  }
}
