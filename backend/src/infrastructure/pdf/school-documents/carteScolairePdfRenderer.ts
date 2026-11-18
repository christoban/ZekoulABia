import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { CarteData } from "./schoolDocumentPdfTypes";
import { finalizePdf } from "./schoolDocumentPdfHelpers";

export async function generateCarteScolairepdf(data: CarteData): Promise<Buffer> {
  const lang = data.language ?? "fr";
  const W = 420;
  const H = 298;
  const doc = new PDFDocument({ size: [W, H], margin: 0 });

  return finalizePdf(doc, async (d) => {
    d.rect(0, 0, W, 50).fill("#1e3a5f");
    d
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text(lang === "en" ? "SCHOOL IDENTITY CARD" : "CARTE D'IDENTITÉ SCOLAIRE", 0, 10, { align: "center", width: W });
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#cbd5e1")
      .text(data.school.name.toUpperCase(), 0, 25, { align: "center", width: W });
    d
      .fontSize(6)
      .fillColor("#94a3b8")
      .text(data.yearName, 0, 38, { align: "center", width: W });

    const photoX = 18;
    const photoY = 60;
    const photoW = 75;
    const photoH = 90;

    if (data.photoUrl && data.photoUrl.startsWith("data:")) {
      const base64 = data.photoUrl.split(",")[1];
      if (base64) {
        const imgBuf = Buffer.from(base64, "base64");
        d.image(imgBuf, photoX, photoY, { width: photoW, height: photoH });
      }
    } else {
      d.rect(photoX, photoY, photoW, photoH).fillAndStroke("#e2e8f0", "#94a3b8");
      d
        .fontSize(6)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text("PHOTO", photoX, photoY + photoH / 2 - 3, { width: photoW, align: "center" });
    }

    const infoX = 108;
    d.fillColor("#0f172a");

    const infoItems: [string, string][] = [
      [lang === "en" ? "Name" : "Nom & Prénoms", data.studentName.toUpperCase()],
      ["Matricule", data.matricule || "—"],
      [lang === "en" ? "Class" : "Classe", data.className],
    ];

    infoItems.forEach(([label, val], i) => {
      const y = 65 + i * 32;
      d.fontSize(7).font("Helvetica-Bold").fillColor("#64748b").text(label, infoX, y);
      d.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text(val, infoX, y + 10, { width: W - infoX - 20 });
      d.moveTo(infoX, y + 28).lineTo(W - 20, y + 28).strokeColor("#e2e8f0").stroke();
    });

    d.fontSize(7).font("Helvetica-Bold").fillColor("#64748b")
      .text(lang === "en" ? "Valid for" : "Valable pour", infoX, 163);
    d.fontSize(8).font("Helvetica-Bold").fillColor("#1e3a5f")
      .text(`${lang === "en" ? "Academic Year" : "Année scolaire"} ${data.yearName}`, infoX, 173);

    const qrBuf = await QRCode.toBuffer(data.verifyUrl, { type: "png", margin: 1, width: 120 });
    d.image(qrBuf, W - 80, 60, { fit: [65, 65] });
    d.fontSize(5).font("Helvetica").fillColor("#94a3b8")
      .text(lang === "en" ? "Verify" : "Vérifier", W - 80, 128, { width: 65, align: "center" });

    d.rect(0, H - 22, W, 22).fill("#f0f4f8");
    const rectoFooter = lang === "en"
      ? "This card must be worn at all times within the school premises."
      : "Cette carte doit être portée à tout moment dans l'enceinte de l'établissement.";
    d
      .fontSize(6)
      .font("Helvetica-Oblique")
      .fillColor("#94a3b8")
      .text(rectoFooter, 10, H - 14, { align: "center", width: W - 20 });

    d.addPage({ size: [W, H], margin: 0 });

    d.rect(0, 0, W, 50).fill("#1e3a5f");
    d
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text(lang === "en" ? "RULES & EMERGENCY CONTACT" : "RÈGLEMENT & CONTACT D'URGENCE", 0, 18, { align: "center", width: W });

    const regles = lang === "en"
      ? [
          "• Punctuality and regular attendance are mandatory.",
          "• Students must wear the prescribed uniform.",
          "• Mobile phones and electronic devices are prohibited.",
          "• Any misconduct may result in disciplinary action.",
          "• Report loss immediately to the administration.",
        ]
      : [
          "• La ponctualité et l'assiduité sont obligatoires.",
          "• L'élève doit se présenter en tenue réglementaire.",
          "• Il est interdit d'apporter téléphone ou appareil électronique.",
          "• Tout manquement peut entraîner une sanction disciplinaire.",
          "• En cas de perte, déclarer immédiatement à l'administration.",
        ];

    d.y = 60;
    regles.forEach((r) => {
      d.fontSize(7).font("Helvetica").fillColor("#334155").text(r, 20, d.y, { width: W - 40 });
      d.y += 16;
    });

    d.y += 5;
    d.rect(15, d.y, W - 30, 1).fill("#e2e8f0");
    d.y += 8;
    d.fontSize(7).font("Helvetica-Bold").fillColor("#1e3a5f")
      .text(lang === "en" ? "EMERGENCY CONTACT" : "CONTACT D'URGENCE", 20, d.y);
    d.y += 12;
    const parentLabel = lang === "en" ? "Parent/Guardian name" : "Nom parent/tuteur";
    d
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(data.emergencyContact || `${parentLabel} : ________________________________`, 20, d.y);
    d.y += 14;
    d
      .fontSize(8)
      .text(data.emergencyPhone ? `Tel : ${data.emergencyPhone}` : "Tel : ________________________________", 20, d.y);

    d.rect(0, H - 22, W, 22).fill("#1e3a5f");
    d
      .fontSize(6)
      .font("Helvetica")
      .fillColor("white")
      .text("ZekoulABia — School Management System", 0, H - 14, { align: "center", width: W });
  });
}
