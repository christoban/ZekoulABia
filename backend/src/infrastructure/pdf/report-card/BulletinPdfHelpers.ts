import type PDFDocument from "pdfkit";

// ─── MENTIONS MINESEC FR ────────────────────────────────────────
export const getMentionFr = (average: number): string => {
  if (average >= 18) return "Excellent";
  if (average >= 16) return "Très Bien";
  if (average >= 14) return "Bien";
  if (average >= 12) return "Assez Bien";
  if (average >= 10) return "Passable";
  if (average >= 8) return "Insuffisant";
  if (average >= 6) return "Très Insuffisant";
  return "Médiocre";
};

export const getMentionEn = (average: number): string => {
  if (average >= 18) return "Excellent";
  if (average >= 16) return "Very Good";
  if (average >= 14) return "Good";
  if (average >= 12) return "Fair";
  if (average >= 10) return "Pass";
  return "Poor";
};

export const getMentionApc = (average: number): string => {
  if (average >= 18) return "Expert";
  if (average >= 15) return "Acquis";
  if (average >= 11) return "ECA";
  return "NA";
};

export const getMention = (average: number, template: string, language: "fr" | "en" = "fr"): string => {
  if (template === "EN_SECONDARY") return getMentionEn(average);
  if (template === "MONTHLY") return getMentionApc(average);
  // Templates partagés entre sous-systèmes : la langue décide.
  if (template === "PRIMARY") return language === "en" ? getMentionEn(average) : getMentionApc(average);
  if (template === "ANNUAL") return language === "en" ? getMentionEn(average) : getMentionFr(average);
  // FR_SECONDARY, TECHNICAL_FR
  return getMentionFr(average);
};

export const getAverageColor = (average: number): string => {
  if (average >= 14) return "#16a34a";
  if (average >= 10) return "#d97706";
  return "#dc2626";
};

// ─── TABLE ENGINE ───────────────────────────────────────────────
//
// Remplace le positionnement cellule-par-cellule par un moteur qui :
//   1. Calcule les largeurs proportionnellement (ratio) à la largeur réelle de la page
//   2. Calcule la hauteur de chaque ligne via doc.heightOfString() — fini les 15px fixes
//   3. Détecte les sauts de page et réaffiche l'en-tête du tableau
//   4. Distingue text vs score vs average vs competence (corrige le bug NaN)
//
export type TableColumnType = "subject" | "score" | "average" | "text" | "competence";

export type TableColumnDef = {
  label: string;
  /** Unité relative de largeur — les colonnes sont réparties proportionnellement */
  ratio: number;
  key: string;
  type?: TableColumnType;
  align?: "left" | "center";
};

type AnyRecord = Record<string, unknown>;

const CELL_PAD_H  = 2;   // px par côté (horizontal)
const CELL_PAD_V  = 3;   // px par côté (vertical)
const HEADER_H    = 17;
const MIN_ROW_H   = 16;
const BODY_SIZE   = 8;
const FOOTER_RESERVE = 90; // espace minimal à conserver pour le footer

function pageBounds(doc: InstanceType<typeof PDFDocument>) {
  const m = doc.page.margins as { top: number; left: number; bottom: number; right: number };
  return {
    left:   m.left,
    right:  doc.page.width  - m.right,
    top:    m.top,
    bottom: doc.page.height - m.bottom,
    width:  doc.page.width  - m.left - m.right,
  };
}

function resolveCell(
  row: AnyRecord,
  key: string,
  type: TableColumnType | undefined,
): { text: string; bold: boolean; color: string | null; wrap: boolean } {
  const val = row[key];

  if (type === "subject") {
    return { text: val != null ? String(val) : "—", bold: false, color: null, wrap: true };
  }

  // string columns — NE PAS appliquer Number()
  if (type === "text" || type === "competence") {
    const s = val != null && String(val).trim() !== "" ? String(val) : "—";
    return { text: s, bold: false, color: null, wrap: type === "text" };
  }

  if (type === "average") {
    if (val == null) return { text: "—", bold: true, color: "#94a3b8", wrap: false };
    const n = Number(val);
    if (isNaN(n))  return { text: "—", bold: true, color: "#94a3b8", wrap: false };
    return { text: n.toFixed(2), bold: true, color: getAverageColor(n), wrap: false };
  }

  // coefficient ou score numérique
  if (val == null || String(val).trim() === "") return { text: "—", bold: false, color: null, wrap: false };
  const n = Number(val);
  if (isNaN(n)) return { text: "—", bold: false, color: null, wrap: false };
  return { text: n.toFixed(2), bold: false, color: null, wrap: false };
}

function measureRow(
  doc: InstanceType<typeof PDFDocument>,
  row: AnyRecord,
  columns: TableColumnDef[],
  colWidths: number[],
): number {
  let h = MIN_ROW_H;
  columns.forEach((col, i) => {
    if (col.type !== "subject" && col.type !== "text") return;
    const { text } = resolveCell(row, col.key, col.type);
    if (!text || text === "—") return;
    const innerW = Math.max(1, colWidths[i]! - CELL_PAD_H * 2);
    const measured = doc.heightOfString(text, { width: innerW });
    h = Math.max(h, Math.ceil(measured) + CELL_PAD_V * 2);
  });
  return h;
}

function paintHeader(
  doc: InstanceType<typeof PDFDocument>,
  columns: TableColumnDef[],
  colX: number[],
  colWidths: number[],
  startX: number,
  tableWidth: number,
  y: number,
): number {
  doc.rect(startX, y, tableWidth, HEADER_H).fill("#1e293b");
  columns.forEach((col, i) => {
    doc.fontSize(7).font("Helvetica-Bold").fillColor("white").text(
      col.label,
      colX[i]! + CELL_PAD_H,
      y + 4,
      { width: colWidths[i]! - CELL_PAD_H * 2, align: "center", lineBreak: false },
    );
  });
  doc.fillColor("black");
  return y + HEADER_H;
}

export const drawTable = (
  doc: InstanceType<typeof PDFDocument>,
  columns: TableColumnDef[],
  rows: AnyRecord[],
): void => {
  if (rows.length === 0) return;

  const b = pageBounds(doc);
  const startX    = b.left;
  const tableWidth = b.width;

  // Largeurs proportionnelles
  const totalRatio = columns.reduce((s, c) => s + c.ratio, 0);
  const colWidths  = columns.map(c => Math.floor((c.ratio / totalRatio) * tableWidth));
  // distribuer l'arrondi sur la dernière colonne
  colWidths[colWidths.length - 1]! += tableWidth - colWidths.reduce((s, w) => s + w, 0);

  const colX: number[] = [];
  let cx = startX;
  colWidths.forEach(w => { colX.push(cx); cx += w; });

  // Fixer la police avant de mesurer
  doc.fontSize(BODY_SIZE).font("Helvetica");

  let curY = paintHeader(doc, columns, colX, colWidths, startX, tableWidth, doc.y);

  rows.forEach((row, idx) => {
    const rowH = measureRow(doc, row, columns, colWidths);

    // Saut de page si débordement
    if (curY + rowH > b.bottom - FOOTER_RESERVE) {
      doc.addPage();
      curY = paintHeader(doc, columns, colX, colWidths, startX, tableWidth, doc.y);
    }

    // Fond de ligne alterné
    if (idx % 2 === 0) {
      doc.rect(startX, curY, tableWidth, rowH).fill("#f8fafc").strokeColor("#e2e8f0").stroke();
    } else {
      doc.rect(startX, curY, tableWidth, rowH).strokeColor("#e2e8f0").stroke();
    }
    doc.fillColor("black");

    // Cellules
    columns.forEach((col, i) => {
      const x = colX[i]!;
      const w = colWidths[i]!;
      const cellY = curY + CELL_PAD_V;
      const { text, bold, color, wrap } = resolveCell(row, col.key, col.type);
      const align = col.align ?? (col.type === "subject" || col.type === "text" ? "left" : "center");

      doc
        .fontSize(BODY_SIZE)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fillColor(color ?? "black")
        .text(text, x + CELL_PAD_H, cellY, {
          width: Math.max(1, w - CELL_PAD_H * 2),
          align,
          lineBreak: wrap,
          ellipsis: !wrap,
        });
      doc.fillColor("black");
    });

    curY += rowH;
  });

  doc.y = curY + 4;
};

// ─── EN-TÊTE COMMUN ────────────────────────────────────────────
export const drawBulletinHeader = (
  doc: InstanceType<typeof PDFDocument>,
  options: {
    schoolName: string;
    schoolMotto?: string;
    logoUrl?: string;
    studentName: string;
    className: string;
    periodName: string;
    yearName: string;
    rank?: number | null;
    totalStudents?: number | null;
    absenceCount?: number;
    template: string;
    language?: "fr" | "en";
  },
) => {
  const {
    schoolName, schoolMotto, logoUrl, studentName, className,
    periodName, yearName, rank, totalStudents, absenceCount, template,
    language = "fr",
  } = options;
  const isEn = language === "en";
  const b = pageBounds(doc);

  if (logoUrl) {
    try { doc.image(logoUrl, b.left, 28, { fit: [56, 56] }); } catch { /* ignore */ }
  }

  doc.fontSize(16).font("Helvetica-Bold").text(schoolName, { align: "center" });
  if (schoolMotto) {
    doc.fontSize(9).font("Helvetica-Oblique").text(schoolMotto, { align: "center" });
  }
  doc.moveDown(0.3);

  const LABELS_FR: Record<string, string> = {
    FR_SECONDARY: "BULLETIN DE NOTES",
    EN_SECONDARY: "REPORT CARD",
    TECHNICAL_FR: "BULLETIN TECHNIQUE",
    PRIMARY:      "BULLETIN PRIMAIRE",
    ANNUAL:       "BULLETIN ANNUEL",
    MONTHLY:      "BULLETIN MENSUEL",
  };
  const LABELS_EN: Record<string, string> = {
    FR_SECONDARY: "REPORT CARD",
    EN_SECONDARY: "REPORT CARD",
    TECHNICAL_FR: "TECHNICAL REPORT CARD",
    PRIMARY:      "PRIMARY REPORT CARD",
    ANNUAL:       "ANNUAL REPORT CARD",
    MONTHLY:      "MONTHLY REPORT CARD",
  };
  const title = (isEn ? LABELS_EN[template] : LABELS_FR[template]) ?? "BULLETIN";
  doc.fontSize(13).font("Helvetica-Bold").text(title, { align: "center" });
  doc.fontSize(10).font("Helvetica")
    .text(
      isEn
        ? `Academic Year : ${yearName}   |   Term : ${periodName}`
        : `Année scolaire : ${yearName}   |   Période : ${periodName}`,
      { align: "center" },
    );
  doc.moveDown(0.5);

  doc.moveTo(b.left, doc.y).lineTo(b.right, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
  doc.moveDown(0.3);

  doc.fontSize(10).font("Helvetica-Bold").text("Élève / Student : ", { continued: true });
  doc.font("Helvetica").text(studentName);
  if (rank && totalStudents) {
    doc.text(isEn ? `Class : ${className}   Rank : ${rank} / ${totalStudents}` : `Classe : ${className}   Rang : ${rank} / ${totalStudents}`);
  } else {
    doc.text(isEn ? `Class : ${className}` : `Classe : ${className}`);
  }
  if (absenceCount !== undefined) {
    doc.text(`Absences : ${absenceCount}`);
  }
  doc.moveDown(0.5);
  doc.moveTo(b.left, doc.y).lineTo(b.right, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
  doc.moveDown(0.3);
};

// ─── PIED DE PAGE COMMUN ───────────────────────────────────────
export const drawBulletinFooter = (
  doc: InstanceType<typeof PDFDocument>,
  options: {
    generalAverage: number;
    mention: string;
    classMasterComment?: string | null;
    isOfficial?: boolean;
    language?: "fr" | "en";
    qrBuffer?: Buffer | null;
    verifyUrl?: string;
  },
) => {
  const { generalAverage, mention, classMasterComment, isOfficial, language = "fr", qrBuffer } = options;
  const b = pageBounds(doc);

  doc.moveDown(0.5);
  doc.moveTo(b.left, doc.y).lineTo(b.right, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
  doc.moveDown(0.3);

  const avgLabel     = language === "fr" ? "Moyenne générale" : "General Average";
  const mentionLabel = language === "fr" ? "Mention"          : "Grade";

  doc.fontSize(11).font("Helvetica-Bold")
    .text(`${avgLabel} : `, { continued: true })
    .fillColor(getAverageColor(generalAverage))
    .text(`${generalAverage.toFixed(2)} / 20`, { continued: true })
    .fillColor("black")
    .text(`   ${mentionLabel} : ${mention}`);

  if (classMasterComment) {
    doc.fontSize(9).font("Helvetica-Oblique")
      .text(`Appréciation : ${classMasterComment}`);
  }

  doc.moveDown(0.5);

  // Blocs de signature — répartis uniformément sur la largeur réelle de la page
  const sigY = doc.y;
  const sigLabels = language === "fr"
    ? ["Professeur Principal", "Censeur", "Proviseur", "Visa Parent"]
    : ["Class Master",         "Vice-Principal", "Principal", "Parent Signature"];

  const colW = Math.floor(b.width / sigLabels.length);
  sigLabels.forEach((label, i) => {
    const x = b.left + i * colW;
    doc.fontSize(8).font("Helvetica").text(label, x, sigY, { width: colW, align: "center" });
    doc.moveTo(x + 4, sigY + 32).lineTo(x + colW - 4, sigY + 32)
      .strokeColor("#94a3b8").lineWidth(0.5).stroke();
  });

  if (isOfficial) {
    if (qrBuffer) {
      // QR Code anti-falsification en bas à droite
      const qrSize = 46;
      const qrX = b.right - qrSize - 4;
      const qrY = sigY + 38;
      try {
        doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize] });
        doc.fontSize(5.5).font("Helvetica").fillColor("#64748b")
          .text(language === "en" ? "Scan to verify" : "Scannez pour vérifier", qrX - 4, qrY + qrSize + 2, { width: qrSize + 8, align: "center" });
      } catch { /* ignore */ }

      // Mention d'authenticité et avertissement légal à gauche du QR code
      const textW = b.width - qrSize - 20;
      doc.y = sigY + 40;
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#1e293b")
        .text(
          language === "en"
            ? "Official document issued by the school. Verified authenticity."
            : "Document officiel délivré par l'établissement. Authenticité certifiée.",
          b.left,
          sigY + 40,
          { width: textW }
        );
      doc.fontSize(6.5).font("Helvetica-Oblique").fillColor("#64748b")
        .text(
          language === "en"
            ? "Any falsification or alteration exposes to judicial prosecution. Scan the QR code to verify."
            : "Toute falsification ou altération expose à des poursuites judiciaires. Scannez le QR code pour vérification.",
          b.left,
          sigY + 50,
          { width: textW }
        );
    } else {
      doc.y = sigY + 38;
      doc.fontSize(7).font("Helvetica-Oblique").fillColor("#475569")
        .text(
          "Ce bulletin est un document officiel. Toute modification est passible de sanctions.",
          { align: "center" },
        );
    }
  }
};

