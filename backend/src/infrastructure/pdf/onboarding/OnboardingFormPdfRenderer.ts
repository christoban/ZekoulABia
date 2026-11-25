/**
 * UTILS — Export PDF du formulaire d'onboarding auto-service élèves (Axe 2, Plan
 * Diversité Numérique). Même contenu que le formulaire en ligne
 * (frontend/src/app/eleve-onboarding/[token]/page.tsx) — source unique de vérité, pas de
 * schéma de formulaire papier parallèle à maintenir. Destiné aux familles sans aucun accès
 * numérique (candidats CONCOURS notamment) : le staff imprime ce PDF, le remet à la famille,
 * puis ressaisit les réponses dans le même formulaire en ligne (avec le token) une fois rempli.
 */
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

function drawBlankField(doc: InstanceType<typeof PDFDocument>, label: string): void {
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(label);
  doc.moveDown(0.15);
  const y = doc.y;
  doc.moveTo(42, y + 18).lineTo(553, y + 18).strokeColor('#9ca3af').lineWidth(0.75).stroke();
  doc.moveDown(1.6);
}

export interface OnboardingFormPdfInput {
  schoolName: string;
  nomProvisoire: string;
  classeSuggeree: string | null;
  recipientType: 'ELEVE' | 'PARENT' | 'LES_DEUX';
  formUrl: string;
}

export async function generateOnboardingFormPdf(input: OnboardingFormPdfInput): Promise<Buffer> {
  return finalizePdf((doc) => {
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f766e').text('ZEKOULABIA', { align: 'center' });
    doc.font('Helvetica').fontSize(11).fillColor('#6b7280').text(input.schoolName, { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#0f766e').lineWidth(1).stroke();
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827').text("FORMULAIRE D'INSCRIPTION", { align: 'center' });
    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(
      "À remplir à la main par la famille, puis à remettre à l'établissement pour ressaisie dans le dossier en ligne.",
      { align: 'center' },
    );
    doc.moveDown(1.2);
    doc.fillColor('#111827');

    doc.font('Helvetica-Bold').fontSize(10).text('Dossier : ', { continued: true });
    doc.font('Helvetica').text(input.nomProvisoire);
    if (input.classeSuggeree) {
      doc.font('Helvetica-Bold').fontSize(10).text('Classe suggérée : ', { continued: true });
      doc.font('Helvetica').text(input.classeSuggeree);
    }
    doc.moveDown(1);

    drawBlankField(doc, 'Nom');
    drawBlankField(doc, 'Prénom');
    drawBlankField(doc, 'Date de naissance (JJ/MM/AAAA)');

    doc.font('Helvetica-Bold').fontSize(10).text('Sexe :  ☐ Masculin     ☐ Féminin');
    doc.moveDown(1.2);

    drawBlankField(doc, "École d'origine (si transfert ou fin du primaire)");

    doc.moveDown(0.6);
    doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#e5e7eb').lineWidth(0.75).stroke();
    doc.moveDown(0.8);

    doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(
      `Ce formulaire correspond exactement au formulaire en ligne accessible à l'adresse suivante (pour saisie directe si un dispositif est disponible) : ${input.formUrl}`,
      { align: 'left' },
    );
  });
}
