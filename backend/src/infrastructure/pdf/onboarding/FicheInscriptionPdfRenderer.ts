/**
 * INFRASTRUCTURE — Renderer PDF pour la Fiche d'inscription / Dossier d'admission v2.
 *
 * Intègre :
 * - Les informations de l'école et de l'élève
 * - Le QR code pointant vers l'URL du token d'onboarding pour suivi / saisie mobile
 * - La liste des pièces justificatives avec case à cocher (reçue / manquante)
 * - Le profil d'accès numérique et les contacts
 * - La zone de visa et cachet de l'établissement
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type {
  FicheInscriptionPdfPort,
  FicheInscriptionPdfData,
  PieceDossierFichePdf,
} from '@domain/ports/services/FicheInscriptionPdfPort';

export type PieceDossierPdf = PieceDossierFichePdf;
export type FicheInscriptionPdfInput = FicheInscriptionPdfData;

export class PdfKitFicheInscriptionAdapter implements FicheInscriptionPdfPort {
  async generer(data: FicheInscriptionPdfData): Promise<Buffer> {
    return renderFicheInscriptionPdf(data);
  }
}

export async function renderFicheInscriptionPdf(input: FicheInscriptionPdfInput): Promise<Buffer> {
  const qrBuffer = await QRCode.toBuffer(input.formUrl, {
    type: 'png',
    margin: 1,
    width: 100,
    color: { dark: '#0f766e', light: '#ffffff' },
  });

  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── En-tête ──
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f766e').text('RÉPUBLIQUE DU CAMEROUN', { align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text('Paix — Travail — Patrie / Peace — Work — Fatherland', { align: 'center' });
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(input.schoolName.toUpperCase(), { align: 'center' });
    doc.moveDown(0.2);
    doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor('#0f766e').lineWidth(1.5).stroke();
    doc.moveDown(0.6);

    // ── Titre + QR Code ──
    const startY = doc.y;

    // Colonne gauche : Titre et métadonnées
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f766e').text("FICHE OFFICIELLE D'INSCRIPTION", 36, startY);
    doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
    doc.text(`Dossier N° : ${input.onboardingId.slice(0, 8)}... | Statut : ${input.status}`);
    if (input.numeroInterne) {
      doc.font('Helvetica-Bold').fillColor('#0369a1').text(`N° Interne : ${input.numeroInterne}`);
    }
    if (input.completenessScore !== null && input.completenessScore !== undefined) {
      doc.font('Helvetica').fillColor('#374151').text(
        `Complétude du dossier : ${input.completenessScore}% ${input.validableSousReserve ? '(Validable sous réserve)' : ''}`,
      );
    }

    // Colonne droite : QR code
    doc.image(qrBuffer, 460, startY, { width: 85 });
    doc.fontSize(7).fillColor('#6b7280').text('Scannez pour suivre', 460, startY + 88, { width: 85, align: 'center' });

    doc.y = Math.max(doc.y, startY + 98);
    doc.moveDown(0.5);

    // ── Section 1 : État civil de l'élève ──
    drawSectionHeader(doc, "1. RENSEIGNEMENTS SUR L'ÉLÈVE");
    doc.font('Helvetica').fontSize(9).fillColor('#111827');

    const nomComplet = `${input.nom} ${input.prenom ?? ''}`.trim();
    drawRow(doc, 'Nom et prénom(s) :', nomComplet || 'Non renseigné');
    drawRow(doc, 'Date de naissance :', input.dateNaissance || 'Non renseignée');
    drawRow(doc, 'Sexe :', input.gender === 'M' ? 'Masculin (M)' : input.gender === 'F' ? 'Féminin (F)' : 'Non renseigné');
    drawRow(doc, 'Classe demandée / assignée :', input.classeNom || 'Non affectée');
    drawRow(doc, 'Téléphone élève :', input.contactTelephone || 'Aucun (sans dispositif)');
    drawRow(doc, 'Email élève :', input.contactEmail || 'Aucun');

    doc.moveDown(0.4);

    // ── Section 2 : Coordonnées du parent / tuteur ──
    drawSectionHeader(doc, '2. COORDONNÉES DES PARENTS / RESPONSABLES');
    drawRow(doc, 'Téléphone parent (SMS / WhatsApp) :', input.parentContactTelephone || input.contactTelephone || 'Non renseigné');
    drawRow(doc, 'Email parent :', input.parentContactEmail || 'Non renseigné');

    doc.moveDown(0.4);

    // ── Section 3 : Pièces justificatives ──
    drawSectionHeader(doc, '3. CONTRÔLE DES PIÈCES JUSTIFICATIVES');
    if (input.pieces.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280').text('Aucune exigence de pièce enregistrée.');
    } else {
      for (const piece of input.pieces) {
        const checkMark = piece.received ? '[X]' : '[  ]';
        const color = piece.received ? '#15803d' : piece.obligatoire ? '#b91c1c' : '#4b5563';
        const obligStr = piece.obligatoire ? '(Obligatoire)' : '(Facultative)';
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(color).text(`${checkMark} ${piece.libelle} `, { continued: true });
        doc.font('Helvetica').fontSize(7.5).fillColor('#6b7280').text(obligStr);
        doc.moveDown(0.15);
      }
    }

    doc.moveDown(0.6);

    // ── Section 4 : Cadre réservé à l'administration ──
    drawSectionHeader(doc, "4. CADRE RÉSERVÉ À L'ADMINISTRATION");
    doc.rect(36, doc.y, 523, 60).strokeColor('#d1d5db').lineWidth(0.8).stroke();

    const boxY = doc.y + 6;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#374151');
    doc.text('Date de vérification : ____ / ____ / 20___', 45, boxY);
    doc.text('Décision :  ☐ Validé     ☐ Validé sous réserve     ☐ Renvoyé', 45, boxY + 16);
    doc.text('Signature et cachet du Chef d’Établissement / Censeur :', 320, boxY);

    // Pied de page
    doc.fontSize(7).fillColor('#9ca3af').text(
      'Document généré par ZekoulABia — Système intégré de gestion scolaire camerounais.',
      36,
      790,
      { align: 'center', width: 523 },
    );

    doc.end();
  });
}

function drawSectionHeader(doc: InstanceType<typeof PDFDocument>, title: string): void {
  const y = doc.y;
  doc.rect(36, y, 523, 16).fillColor('#f0fdfa').fill();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f766e').text(title, 42, y + 4);
  doc.y = y + 20;
}

function drawRow(doc: InstanceType<typeof PDFDocument>, label: string, value: string): void {
  const y = doc.y;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#4b5563').text(label, 42, y, { width: 170 });
  doc.font('Helvetica').fontSize(8.5).fillColor('#111827').text(value, 215, y, { width: 340 });
  doc.y = y + 13;
}
