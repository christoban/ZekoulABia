import PDFDocument from "pdfkit";
import type { CertificatData, LettreTransfertData } from "./schoolDocumentPdfTypes";
import {
  dataRow,
  drawDocumentFooterWithQr,
  drawHeader,
  drawSignatureBlock,
  finalizePdf,
  formatDocumentDate,
} from "./schoolDocumentPdfHelpers";

export async function generateCertificatPdf(data: CertificatData): Promise<Buffer> {
  const lang = data.language ?? "fr";
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  return finalizePdf(doc, async (d) => {
    drawHeader(d, data.school, lang === "en" ? "ENROLLMENT CERTIFICATE" : "CERTIFICAT DE SCOLARITÉ");

    // Ne jamais deviner : un genre non renseigné (data.gender null/undefined) ne doit PAS
    // se transformer silencieusement en "M." — ça mégenrerait toute élève dont le profil
    // n'a pas encore été complété. On affiche les deux civilités plutôt qu'un défaut faux.
    const civilite = data.gender === "F" ? "Mme/Mlle" : data.gender === "M" ? "M." : "M./Mme";
    const artDefini = data.gender === "F" ? "la" : data.gender === "M" ? "le" : "le/la";

    d.y = 150;
    const intro = lang === "en"
      ? `We, the Principal/Head of ${data.school.name}, hereby certify that ${civilite}:`
      : `Nous soussignés, Proviseur/Directeur de l'établissement ${data.school.name}, certifions par la présente que ${civilite} :`;
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(intro, 60, d.y, { width: 475, align: "justify" });

    d.y += 25;

    const fieldLabels: Record<string, string> = {
      name: lang === "en" ? "Full Name" : "Nom et Prénoms",
      matricule: "Matricule",
      dob: lang === "en" ? "Date of Birth" : "Date de naissance",
      class: lang === "en" ? "Class" : "Classe",
      year: lang === "en" ? "Academic Year" : "Année scolaire",
      status: lang === "en" ? "Status" : "Statut",
    };
    const statusValue = data.status === "ACTIVE"
      ? (lang === "en" ? "Regularly enrolled" : "Régulièrement inscrit(e)")
      : data.status;

    const rows: [string, string][] = [
      [fieldLabels.name, data.studentName.toUpperCase()],
      [fieldLabels.matricule, data.matricule || "—"],
      [fieldLabels.dob, data.dateOfBirth || "—"],
      [fieldLabels.class, data.className],
      [fieldLabels.year, data.yearName],
      [fieldLabels.status, statusValue],
    ];

    rows.forEach(([label, value], i) => {
      dataRow(d, label, value, d.y + i * 22);
    });

    d.y += rows.length * 22 + 20;

    const pronounVerb = artDefini === "la" ? "she is" : artDefini === "le" ? "he is" : "they are";
    const bodyLine = lang === "en"
      ? `is duly enrolled in our institution for the academic year ${data.yearName} and ${pronounVerb} in good standing with the school administration.`
      : `est bien inscrit(e) dans notre établissement pour l'année scolaire ${data.yearName} et que ${artDefini} dit(e) élève est en règle vis-à-vis de l'administration scolaire.`;
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(bodyLine, 60, d.y, { width: 475, align: "justify" });

    d.y += 40;

    const legalClause = lang === "en"
      ? "In witness whereof, this certificate is issued to serve and be used for all lawful purposes."
      : "En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.";
    d
      .fontSize(9)
      .font("Helvetica-Oblique")
      .fillColor("#475569")
      .text(legalClause, 60, d.y, { width: 475, align: "center" });

    d.y += 30;

    const dateStr = formatDocumentDate(data.generatedAt, lang);
    const faitA = lang === "en" ? "Done at" : "Fait à";
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(`${faitA} ${data.school.ville || "___________"}, ${dateStr}`, 60, d.y, {
        align: "right",
        width: 475,
      });

    d.y += 50;
    drawSignatureBlock(d, lang);
    await drawDocumentFooterWithQr(d, data.documentId, data.verifyUrl, lang);
  });
}

export async function generateLettreTransfertPdf(data: LettreTransfertData): Promise<Buffer> {
  const lang = data.language ?? "fr";
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  return finalizePdf(doc, async (d) => {
    const title = lang === "en" ? "TRANSFER LETTER / FINAL DEPARTURE" : "LETTRE DE TRANSFERT / SORTIE DÉFINITIVE";
    drawHeader(d, data.school, title);

    d.y = 150;

    const dateStr = formatDocumentDate(data.generatedAt, lang);
    const faitA = lang === "en" ? "Done at" : "Fait à";
    d
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#475569")
      .text(`${faitA} ${data.school.ville || "___________"}, ${dateStr}`, 60, d.y, {
        align: "right",
        width: 475,
      });

    d.y += 30;

    const objet = lang === "en" ? "Subject: Student Transfer / Departure" : "Objet : Transfert / Sortie d'élève";
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(objet, 60, d.y);

    d.y += 25;

    const intro = lang === "en"
      ? `We, the Principal/Head of ${data.school.name}, hereby certify the final departure of the following student:`
      : `Nous soussignés, Proviseur/Directeur de l'établissement ${data.school.name}, attestons par la présente la sortie définitive de l'élève suivant(e) :`;
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(intro, 60, d.y, { width: 475, align: "justify" });

    d.y += 35;

    const fieldLabels: Record<string, string> = {
      name: lang === "en" ? "Full Name" : "Nom et Prénoms",
      matricule: "Matricule",
      lastClass: lang === "en" ? "Last class attended" : "Dernière classe fréquentée",
      year: lang === "en" ? "Academic Year" : "Année scolaire",
      reason: lang === "en" ? "Reason for departure" : "Motif de sortie",
      avg: lang === "en" ? "General average (last term)" : "Moyenne générale (dernier trimestre)",
    };

    const rows: [string, string][] = [
      [fieldLabels.name, data.studentName.toUpperCase()],
      [fieldLabels.matricule, data.matricule || "—"],
      [fieldLabels.lastClass, data.className],
      [fieldLabels.year, data.yearName],
      [fieldLabels.reason, data.motif],
      ...(data.lastAverage !== undefined
        ? [[fieldLabels.avg, `${data.lastAverage.toFixed(2)} / 20`] as [string, string]]
        : []),
    ];

    rows.forEach(([label, value], i) => {
      dataRow(d, label, value, d.y + i * 22);
    });

    d.y += rows.length * 22 + 25;

    const certLine = lang === "en"
      ? "We certify that this student has fulfilled all obligations towards our school administration as of the date of departure."
      : "Nous certifions que cet(te) élève a satisfait à toutes les obligations vis-à-vis de l'administration de notre établissement à la date de sa sortie.";
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(certLine, 60, d.y, { width: 475, align: "justify" });

    d.y += 40;

    const legalClause = lang === "en"
      ? "This letter is issued to the student for all lawful purposes."
      : "La présente lettre est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.";
    d
      .fontSize(9)
      .font("Helvetica-Oblique")
      .fillColor("#475569")
      .text(legalClause, 60, d.y, { width: 475, align: "center" });

    d.y += 40;
    drawSignatureBlock(d, lang);
    await drawDocumentFooterWithQr(d, data.documentId, data.verifyUrl, lang);
  });
}
