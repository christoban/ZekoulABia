import path from 'path';
import { generateDatabasePdf, generateFrontendPdf, generateBackendPdf } from './generate_guides_pdf.ts';

const rootDir = path.resolve(__dirname, '../../..');

const dbPdfPath = path.join(rootDir, 'GUIDE_BASE_DE_DONNEES_POSTGRESQL_SOUTENANCE.pdf');
const frontPdfPath = path.join(rootDir, 'GUIDE_MODIFICATIONS_FRONTEND_SOUTENANCE.pdf');
const backendPdfPath = path.join(rootDir, 'GUIDE_BACKEND_ARCHITECTURE_SOUTENANCE.pdf');

console.info('Génération des PDFs en cours...');
console.info('1. Base de données :', dbPdfPath);
console.info('2. Frontend :', frontPdfPath);
console.info('3. Backend & Architecture :', backendPdfPath);

await generateDatabasePdf(dbPdfPath);
await generateFrontendPdf(frontPdfPath);
await generateBackendPdf(backendPdfPath);

console.info('✅ Les 3 guides PDF de soutenance ont été générés avec succès à la racine !');
process.exit(0);

