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

function formatDateFR(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CM', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function formatXAF(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount) + ' XAF';
}

export interface RapportAPEETransactionLigne {
  type: 'COLLECTE' | 'DEPENSE';
  montant: number;
  categorie: string | null;
  description: string | null;
  date: Date | string;
  valide: boolean;
}

export interface RapportAPEEInput {
  schoolName: string;
  periodeLabel: string;
  transactions: RapportAPEETransactionLigne[];
  totalCollectes: number;
  totalDepenses: number;
  solde: number;
}

export async function generateRapportAPEEPdf(input: RapportAPEEInput): Promise<Buffer> {
  return finalizePdf((doc) => {
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a2e1e').text('ZekoulABia', { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#6b5c45').text(input.schoolName, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#1a2e1e').lineWidth(1).stroke();
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('RAPPORT DE TRANSPARENCE FINANCIÈRE APEE', { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#6b5c45').text(input.periodeLabel, { align: 'center' });
    doc.moveDown(1.2);
    doc.fillColor('#111827');

    doc.font('Helvetica-Bold').fontSize(11).text(`Total collectes : `, { continued: true });
    doc.font('Helvetica').text(formatXAF(input.totalCollectes));
    doc.font('Helvetica-Bold').text(`Total dépenses : `, { continued: true });
    doc.font('Helvetica').text(formatXAF(input.totalDepenses));
    doc.font('Helvetica-Bold').text(`Solde APEE : `, { continued: true });
    doc.font('Helvetica').text(formatXAF(input.solde));
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(10);
    const colX = { date: 42, type: 110, categorie: 170, description: 280, montant: 460, statut: 520 };
    doc.text('Date', colX.date, doc.y, { width: 60 });
    doc.text('Type', colX.type, doc.y - 12, { width: 55 });
    doc.text('Catégorie', colX.categorie, doc.y - 12, { width: 105 });
    doc.text('Description', colX.description, doc.y - 12, { width: 175 });
    doc.text('Montant', colX.montant, doc.y - 12, { width: 60 });
    doc.moveDown(0.3);
    doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#d1d5db').lineWidth(0.5).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(9);
    for (const tx of input.transactions) {
      const y = doc.y;
      doc.text(formatDateFR(tx.date), colX.date, y, { width: 60 });
      doc.text(tx.type === 'COLLECTE' ? 'Collecte' : 'Dépense', colX.type, y, { width: 55 });
      doc.text(tx.categorie || '—', colX.categorie, y, { width: 105 });
      doc.text(tx.description || '—', colX.description, y, { width: 175 });
      doc.text(formatXAF(tx.montant), colX.montant, y, { width: 90 });
      doc.moveDown(0.6);
    }

    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#6b5c45').text(
      `Document généré le ${formatDateFR(new Date())} — pour l'Assemblée Générale des parents.`,
      { align: 'center' },
    );
  });
}
