export type {
  Language,
  SchoolInfo,
  CertificatData,
  CarteData,
  LettreTransfertData,
} from "./schoolDocumentPdfTypes";

export {
  generateCertificatPdf,
  generateLettreTransfertPdf,
} from "./a4SchoolDocumentRenderers";

export { generateCarteScolairepdf } from "./carteScolairePdfRenderer";
