import PDFDocument from 'pdfkit';

type PdfBuilder = (doc: InstanceType<typeof PDFDocument>) => void;

function finalizePdf(build: PdfBuilder): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

function formatDateTimeFR(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CM', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function drawLabelValue(doc: InstanceType<typeof PDFDocument>, label: string, value: string): void {
  doc.font('Helvetica-Bold').fontSize(10).text(`${label} : `, { continued: true });
  doc.font('Helvetica').text(value);
}

const DECISION_LABEL: Record<string, string> = {
  COUNCIL_DECISION: 'Décision du Conseil de Discipline',
  PERMANENT_EXCLUSION: 'Exclusion définitive',
};

export interface PVConseilDisciplineInput {
  schoolName: string;
  studentName: string;
  motif: string;
  composition: {
    chefEtablissement: string;
    censeur: string;
    sg: string;
    pp: string;
    representantParents: string;
    representantEleves: string;
  };
  parentNotifiedAt: Date | string;
  scheduledAt: Date | string;
  heldAt: Date | string;
  decision: string;
  pv: string;
}

export async function generatePVConseilDisciplinePdf(input: PVConseilDisciplineInput): Promise<Buffer> {
  return finalizePdf((doc) => {
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a2e1e').text('ZekoulABia', { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#6b5c45').text(input.schoolName, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#1a2e1e').lineWidth(1).stroke();
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('PROCÈS-VERBAL DU CONSEIL DE DISCIPLINE', { align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor('#6b5c45').text('Établi conformément à l\'article 30 du décret régissant les établissements secondaires', { align: 'center' });
    doc.moveDown(1.2);
    doc.fillColor('#111827');

    drawLabelValue(doc, 'Élève concerné', input.studentName);
    drawLabelValue(doc, 'Motif de convocation', input.motif);
    drawLabelValue(doc, 'Parents notifiés le', formatDateTimeFR(input.parentNotifiedAt));
    drawLabelValue(doc, 'Conseil prévu le', formatDateTimeFR(input.scheduledAt));
    drawLabelValue(doc, 'Conseil tenu le', formatDateTimeFR(input.heldAt));
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).text('Composition du conseil (Art. 30)');
    doc.moveDown(0.3);
    drawLabelValue(doc, 'Président (Chef d\'établissement)', input.composition.chefEtablissement);
    drawLabelValue(doc, 'Censeur', input.composition.censeur);
    drawLabelValue(doc, 'Surveillant Général', input.composition.sg);
    drawLabelValue(doc, 'Professeur Principal', input.composition.pp);
    drawLabelValue(doc, 'Représentant des parents', input.composition.representantParents);
    drawLabelValue(doc, 'Représentant des élèves', input.composition.representantEleves);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(11).text('Décision');
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#dc2626').text(DECISION_LABEL[input.decision] ?? input.decision);
    doc.fillColor('#111827');
    doc.moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(11).text('Compte-rendu');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).text(input.pv, { align: 'justify' });

    doc.moveDown(2);
    const faitA = `Fait à Douala, ${formatDateTimeFR(new Date())}`;
    doc.font('Helvetica').fontSize(10).text(faitA, { align: 'right' });
    doc.moveDown(2);
    doc.text('Signature du Président du Conseil', { align: 'right' });
    doc.moveDown(2.5);
    doc.text(input.composition.chefEtablissement, { align: 'right' });
  });
}
