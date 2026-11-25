import PDFDocument from 'pdfkit';

type Language = 'fr' | 'en';

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
  return new Intl.DateTimeFormat('fr-CM', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateEN(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTimeFR(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CM', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateTimeEN(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function drawHeader(doc: InstanceType<typeof PDFDocument>, title: string, subtitle: string): void {
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a2e1e').text('ZekoulABia', { align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor('#6b5c45').text(subtitle, { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#1a2e1e').lineWidth(1).stroke();
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(title, { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#111827');
}

function drawLabelValue(doc: InstanceType<typeof PDFDocument>, label: string, value: string): void {
  doc.font('Helvetica-Bold').fontSize(10).text(`${label} : `, { continued: true });
  doc.font('Helvetica').text(value);
}

function drawSignature(doc: InstanceType<typeof PDFDocument>, lang: Language, signataire: string): void {
  doc.moveDown(1.2);
  const faitA = lang === 'en' ? 'Done at Douala,' : 'Fait à Douala,';
  doc.text(`${faitA} ${lang === 'en' ? formatDateEN(new Date()) : formatDateFR(new Date())}`, { align: 'right' });
  doc.moveDown(2);
  const signatureLabel = lang === 'en' ? 'Signature and stamp' : 'Signature et cachet';
  doc.text(signatureLabel, { align: 'right' });
  doc.moveDown(2.5);
  doc.text(signataire || 'Le Chef d\'établissement', { align: 'right' });
}

export type AttestationTravailInput = {
  schoolName: string;
  employeeName: string;
  roleLabel: string;
  roleLabelEn?: string;
  dateEmbauche?: Date | string | null;
  dateNaissance?: Date | string | null;
  numeroCNPS?: string | null;
  typeContrat?: string | null;
  echelonActuel?: string | null;
  signataire?: string | null;
  language?: Language;
};

export type CertificatTravailInput = {
  schoolName: string;
  employeeName: string;
  roleLabel: string;
  roleLabelEn?: string;
  dateEmbauche?: Date | string | null;
  dateNaissance?: Date | string | null;
  numeroCNPS?: string | null;
  typeContrat?: string | null;
  echelonActuel?: string | null;
  signataire?: string | null;
  language?: Language;
};

export type MissionOrderInput = {
  schoolName: string;
  employeeName: string;
  motif: string;
  lieu: string;
  dateDebut: Date | string;
  dateFin: Date | string;
  signataire?: string | null;
  language?: Language;
};

export async function generateAttestationTravailPdf(input: AttestationTravailInput): Promise<Buffer> {
  const lang = input.language ?? 'fr';
  const labelRole = lang === 'en' ? (input.roleLabelEn ?? input.roleLabel) : input.roleLabel;

  return finalizePdf((doc) => {
    const title = lang === 'en' ? 'WORK CERTIFICATE' : 'ATTESTATION DE TRAVAIL';
    drawHeader(doc, title, input.schoolName);

    const intro = lang === 'en'
      ? `We, the undersigned, certify that ${input.employeeName}, ${labelRole}, has been working with our institution since ${formatDateEN(input.dateEmbauche)}.`
      : `Nous soussignés, attestons que ${input.employeeName}, ${input.roleLabel}, exerce au sein de notre établissement en qualité de collaborateur(trice) depuis le ${formatDateFR(input.dateEmbauche)}.`;
    doc.fontSize(11).text(intro, { align: 'justify' });
    doc.moveDown(0.8);

    const purpose = lang === 'en'
      ? 'This certificate is issued to serve and be used for all lawful purposes.'
      : 'La présente attestation est délivrée pour servir et valoir ce que de droit.';
    doc.text(purpose, { align: 'justify' });
    doc.moveDown(1.2);

    const fieldLabels: Record<string, string> = {
      name: lang === 'en' ? 'Full Name' : 'Nom et prénom',
      role: lang === 'en' ? 'Position' : 'Fonction',
      dob: lang === 'en' ? 'Date of Birth' : 'Date de naissance',
      hire: lang === 'en' ? 'Date of Hire' : 'Date d\'embauche',
      cnps: lang === 'en' ? 'CNPS Number' : 'Numéro CNPS',
      contract: lang === 'en' ? 'Contract Type' : 'Type de contrat',
      grade: lang === 'en' ? 'Grade' : 'Échelon',
    };
    const fmtDate = lang === 'en' ? formatDateEN : formatDateFR;

    drawLabelValue(doc, fieldLabels.name, input.employeeName);
    drawLabelValue(doc, fieldLabels.role, labelRole);
    drawLabelValue(doc, fieldLabels.dob, fmtDate(input.dateNaissance));
    drawLabelValue(doc, fieldLabels.hire, fmtDate(input.dateEmbauche));
    drawLabelValue(doc, fieldLabels.cnps, input.numeroCNPS || '—');
    drawLabelValue(doc, fieldLabels.contract, input.typeContrat || '—');
    drawLabelValue(doc, fieldLabels.grade, input.echelonActuel || '—');
    drawSignature(doc, lang, input.signataire || 'Le Chef d\'établissement');
  });
}

export async function generateCertificatTravailPdf(input: CertificatTravailInput): Promise<Buffer> {
  const lang = input.language ?? 'fr';
  const labelRole = lang === 'en' ? (input.roleLabelEn ?? input.roleLabel) : input.roleLabel;

  return finalizePdf((doc) => {
    const title = lang === 'en' ? 'CERTIFICATE OF EMPLOYMENT' : 'CERTIFICAT DE TRAVAIL';
    drawHeader(doc, title, input.schoolName);

    const intro = lang === 'en'
      ? `We certify that ${input.employeeName}, ${labelRole}, has been employed by our institution since ${formatDateEN(input.dateEmbauche)} and has an administrative record consistent with our archives.`
      : `Nous certifions que ${input.employeeName}, ${input.roleLabel}, a travaillé dans notre établissement depuis le ${formatDateFR(input.dateEmbauche)} et présente un dossier administratif conforme à nos archives.`;
    doc.fontSize(11).text(intro, { align: 'justify' });
    doc.moveDown(0.8);

    const purpose = lang === 'en'
      ? 'This certificate is issued at the request of the employee for all lawful purposes.'
      : 'Ce certificat est établi à la demande de l\'intéressé(e) pour faire valoir ce que de droit.';
    doc.text(purpose, { align: 'justify' });
    doc.moveDown(1.2);

    const fieldLabels: Record<string, string> = {
      name: lang === 'en' ? 'Full Name' : 'Nom et prénom',
      role: lang === 'en' ? 'Position' : 'Fonction',
      dob: lang === 'en' ? 'Date of Birth' : 'Date de naissance',
      hire: lang === 'en' ? 'Date of Hire' : 'Date d\'embauche',
      cnps: lang === 'en' ? 'CNPS Number' : 'Numéro CNPS',
      contract: lang === 'en' ? 'Contract Type' : 'Type de contrat',
      grade: lang === 'en' ? 'Grade' : 'Échelon',
    };
    const fmtDate = lang === 'en' ? formatDateEN : formatDateFR;

    drawLabelValue(doc, fieldLabels.name, input.employeeName);
    drawLabelValue(doc, fieldLabels.role, labelRole);
    drawLabelValue(doc, fieldLabels.dob, fmtDate(input.dateNaissance));
    drawLabelValue(doc, fieldLabels.hire, fmtDate(input.dateEmbauche));
    drawLabelValue(doc, fieldLabels.cnps, input.numeroCNPS || '—');
    drawLabelValue(doc, fieldLabels.contract, input.typeContrat || '—');
    drawLabelValue(doc, fieldLabels.grade, input.echelonActuel || '—');
    drawSignature(doc, lang, input.signataire || 'Le Chef d\'établissement');
  });
}

export async function generateMissionOrderPdf(input: MissionOrderInput): Promise<Buffer> {
  const lang = input.language ?? 'fr';
  const fmtDate = lang === 'en' ? formatDateEN : formatDateFR;
  const fmtDateTime = lang === 'en' ? formatDateTimeEN : formatDateTimeFR;

  return finalizePdf((doc) => {
    const title = lang === 'en' ? 'MISSION ORDER' : 'ORDRE DE MISSION';
    drawHeader(doc, title, input.schoolName);

    const intro = lang === 'en'
      ? `By this order, ${input.employeeName} is authorized to travel to ${input.lieu} from ${fmtDate(input.dateDebut)} to ${fmtDate(input.dateFin)} for the following mission:`
      : `Par la présente, ${input.employeeName} est autorisé(e) à se rendre à ${input.lieu} du ${fmtDate(input.dateDebut)} au ${fmtDate(input.dateFin)} dans le cadre de la mission suivante :`;
    doc.fontSize(11).text(intro, { align: 'justify' });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').text(input.motif);
    doc.moveDown(1);

    const fieldLabels: Record<string, string> = {
      beneficiary: lang === 'en' ? 'Beneficiary' : 'Bénéficiaire',
      destination: lang === 'en' ? 'Destination' : 'Lieu',
      start: lang === 'en' ? 'Start Date' : 'Date de début',
      end: lang === 'en' ? 'End Date' : 'Date de fin',
      generated: lang === 'en' ? 'Generation Date' : 'Date de génération',
    };

    drawLabelValue(doc, fieldLabels.beneficiary, input.employeeName);
    drawLabelValue(doc, fieldLabels.destination, input.lieu);
    drawLabelValue(doc, fieldLabels.start, fmtDate(input.dateDebut));
    drawLabelValue(doc, fieldLabels.end, fmtDate(input.dateFin));
    drawLabelValue(doc, fieldLabels.generated, fmtDateTime(new Date()));
    drawSignature(doc, lang, input.signataire || 'Le Chef d\'établissement');
  });
}
