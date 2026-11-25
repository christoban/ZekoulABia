/**
 * Script de génération de bulletins PDF de démonstration
 * Couvre les cas limites : nom très long, 15+ matières, appréciations longues, décimales
 * Usage : bun scripts/generate-sample-bulletins.ts
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { generateBulletinPdf } from "../src/infrastructure/pdf/report-card/BulletinTemplates.ts";

const OUT_DIR = join(import.meta.dir, "..", "..", "bulletins-demo");

// ─── Données de base ─────────────────────────────────────────

const SCHOOL = {
  schoolName: "Lycée Bilingue de Nkolanga",
  schoolMotto: "Excellence — Discipline — Citoyenneté",
};

// Matières lycée secondaire FR (15 matières — cas limite nombre de lignes)
const MATIERES_SECONDAIRE = [
  { subjectName: "Mathématiques",                coefficient: 4, seq1Score: 13.5,  seq2Score: 11.0,  compositionScore: 12.5,  subjectAverage: 12.33, teacherComment: "Des efforts sensibles depuis le dernier trimestre. Doit travailler les exercices de géométrie." },
  { subjectName: "Sciences Physiques et Chimie", coefficient: 3, seq1Score:  9.0,  seq2Score: 10.5,  compositionScore:  8.75, subjectAverage:  9.42, teacherComment: "Niveau insuffisant. Revoir les lois de Newton et les réactions chimiques." },
  { subjectName: "Sciences de la Vie et de la Terre", coefficient: 2, seq1Score: 15.0, seq2Score: 14.5, compositionScore: 16.0, subjectAverage: 15.17, teacherComment: "Très bonne maîtrise du programme. Continue ainsi." },
  { subjectName: "Français",                     coefficient: 4, seq1Score: 11.5,  seq2Score: 12.0,  compositionScore: 10.5,  subjectAverage: 11.33, teacherComment: "Expression correcte mais manque de profondeur dans l'argumentation." },
  { subjectName: "Anglais",                      coefficient: 3, seq1Score: 17.0,  seq2Score: 16.5,  compositionScore: 18.0,  subjectAverage: 17.17, teacherComment: "Excellent niveau oral et écrit. Félicitations." },
  { subjectName: "Histoire-Géographie",          coefficient: 2, seq1Score: 10.0,  seq2Score: 11.5,  compositionScore: 12.0,  subjectAverage: 11.17, teacherComment: "Passable." },
  { subjectName: "Éducation Civique et Morale",  coefficient: 1, seq1Score: 14.0,  seq2Score: 14.0,  compositionScore: 15.0,  subjectAverage: 14.33, teacherComment: "Bon travail." },
  { subjectName: "Philosophie",                  coefficient: 3, seq1Score:  8.5,  seq2Score:  7.0,  compositionScore:  9.0,  subjectAverage:  8.17, teacherComment: "Manque de rigueur dans la construction des arguments. Doit revoir la méthode de la dissertation." },
  { subjectName: "Économie & Organisation",      coefficient: 2, seq1Score: 12.0,  seq2Score: 13.5,  compositionScore: 11.5,  subjectAverage: 12.33, teacherComment: "Assez bien." },
  { subjectName: "Informatique et NTIC",         coefficient: 2, seq1Score: 18.0,  seq2Score: 17.5,  compositionScore: 19.0,  subjectAverage: 18.17, teacherComment: "Élève brillant en informatique. Résultats remarquables." },
  { subjectName: "Éducation Physique et Sportive", coefficient: 1, seq1Score: 16.0, seq2Score: 16.0, compositionScore: 14.0, subjectAverage: 15.33, teacherComment: "Très actif, bon esprit sportif." },
  { subjectName: "Arts Plastiques",              coefficient: 1, seq1Score:  null, seq2Score: null,  compositionScore: 13.0,  subjectAverage: 13.0,  teacherComment: "Créatif." },
  { subjectName: "Sciences Économiques",         coefficient: 2, seq1Score: 11.0,  seq2Score: 12.5,  compositionScore: 10.0,  subjectAverage: 11.17, teacherComment: "Peut mieux faire." },
  { subjectName: "Éducation Religieuse",         coefficient: 1, seq1Score: 15.5,  seq2Score: 16.0,  compositionScore: 15.0,  subjectAverage: 15.5,  teacherComment: "Très bien." },
  { subjectName: "Travaux Pratiques de Physique-Chimie", coefficient: 1, seq1Score: 10.0, seq2Score: 11.0, compositionScore: 12.0, subjectAverage: 11.0, teacherComment: "Amélioration notable." },
];

// Matières lycée technique (15 matières avec champs techniques)
const MATIERES_TECHNIQUE = [
  { subjectName: "Mathématiques appliquées",     coefficient: 3, seq1Score: 12.0, seq2Score: 13.5, theoreticalScore: 14.0, practicalScore: 13.0, subjectAverage: 13.13, teacherComment: "Bonne progression.", professionalAttitude: 15.0 },
  { subjectName: "Physique Technologique",       coefficient: 3, seq1Score:  9.5, seq2Score: 10.0, theoreticalScore: 10.5, practicalScore: 11.0, subjectAverage: 10.25, teacherComment: "Insuffisant en théorie." },
  { subjectName: "Dessin Industriel",            coefficient: 4, seq1Score: 16.0, seq2Score: 15.5, theoreticalScore: 14.0, practicalScore: 17.5, subjectAverage: 15.75, teacherComment: "Très belle maîtrise du dessin technique." },
  { subjectName: "Technologie de Construction",  coefficient: 4, seq1Score: 11.0, seq2Score: 12.0, theoreticalScore: 13.0, practicalScore: 12.5, subjectAverage: 12.13, teacherComment: "Assez bien." },
  { subjectName: "Électrotechnique",             coefficient: 4, seq1Score:  8.0, seq2Score:  9.5, theoreticalScore:  8.5, practicalScore: 10.0, subjectAverage:  9.0,  teacherComment: "Doit retravailler les circuits triphasés." },
  { subjectName: "Atelier de Soudure",           coefficient: 3, seq1Score: 14.5, seq2Score: 15.0, theoreticalScore: null, practicalScore: 16.0, subjectAverage: 15.17, teacherComment: "Bonne dextérité manuelle." },
  { subjectName: "Automatismes Industriels",     coefficient: 3, seq1Score: 13.0, seq2Score: 14.5, theoreticalScore: 15.0, practicalScore: 13.5, subjectAverage: 14.0,  teacherComment: "Bon niveau." },
  { subjectName: "Métrologie et Contrôle",       coefficient: 2, seq1Score: 17.0, seq2Score: 16.5, theoreticalScore: 18.0, practicalScore: 17.0, subjectAverage: 17.13, teacherComment: "Excellent." },
  { subjectName: "Gestion de Production",        coefficient: 2, seq1Score: 10.5, seq2Score: 11.0, theoreticalScore: 12.0, practicalScore: null, subjectAverage: 11.17, teacherComment: "Passable." },
  { subjectName: "Français Professionnel",       coefficient: 2, seq1Score: 12.0, seq2Score: 11.5, theoreticalScore: 13.0, practicalScore: null, subjectAverage: 12.17, teacherComment: "Rédaction technique correcte." },
  { subjectName: "Anglais Technique",            coefficient: 2, seq1Score: 14.0, seq2Score: 15.0, theoreticalScore: 16.0, practicalScore: null, subjectAverage: 15.0,  teacherComment: "Bonne compréhension des textes techniques." },
  { subjectName: "Thermodynamique Appliquée",    coefficient: 3, seq1Score:  7.5, seq2Score:  8.5, theoreticalScore:  9.0, practicalScore:  8.0, subjectAverage:  8.25, teacherComment: "Niveau très insuffisant. Travail urgent requis." },
  { subjectName: "Hydraulique et Pneumatique",   coefficient: 3, seq1Score: 11.5, seq2Score: 12.0, theoreticalScore: 13.5, practicalScore: 12.0, subjectAverage: 12.25, teacherComment: "Assez bien." },
  { subjectName: "Maintenance Industrielle",     coefficient: 3, seq1Score: 13.5, seq2Score: 14.0, theoreticalScore: 15.0, practicalScore: 14.5, subjectAverage: 14.25, teacherComment: "Bonne initiative en atelier." },
  { subjectName: "Éducation Physique",           coefficient: 1, seq1Score: 15.0, seq2Score: 15.0, theoreticalScore: null, practicalScore: 15.0, subjectAverage: 15.0,  teacherComment: "Très actif." },
];

// Matières primaire APC
const MATIERES_PRIMAIRE = [
  { subjectName: "Langage & Communication",  coefficient: 4, oralScore: 16.0, seq1Score: 15.0, seq2Score: 17.0, selfDevelopmentScore: 16.5, subjectAverage: 16.13, competenceLabel: "Acquis" },
  { subjectName: "Mathématiques",            coefficient: 4, oralScore: 12.0, seq1Score: 13.5, seq2Score: 11.0, selfDevelopmentScore: 14.0, subjectAverage: 12.63, competenceLabel: "ECA"   },
  { subjectName: "Sciences de la Nature",    coefficient: 2, oralScore: 17.5, seq1Score: 18.0, seq2Score: 16.5, selfDevelopmentScore: 18.0, subjectAverage: 17.5,  competenceLabel: "Acquis" },
  { subjectName: "Sciences Humaines",        coefficient: 2, oralScore: 14.0, seq1Score: 13.0, seq2Score: 15.0, selfDevelopmentScore: 14.5, subjectAverage: 14.13, competenceLabel: "Acquis" },
  { subjectName: "Éducation Physique",       coefficient: 1, oralScore: 18.0, seq1Score: null, seq2Score: 17.0, selfDevelopmentScore: 19.0, subjectAverage: 18.0,  competenceLabel: "Expert" },
  { subjectName: "Arts Plastiques & Dessin", coefficient: 1, oralScore: 15.0, seq1Score: 16.0, seq2Score: 14.5, selfDevelopmentScore: 15.5, subjectAverage: 15.25, competenceLabel: "Acquis" },
  { subjectName: "Activités d'Éveil",        coefficient: 1, oralScore:  9.5, seq1Score: 10.0, seq2Score:  8.5, selfDevelopmentScore: 11.0, subjectAverage:  9.75, competenceLabel: "NA"     },
];

// Matières bulletin annuel (6 séquences + 3 compositions)
const MATIERES_ANNUAL = MATIERES_SECONDAIRE.slice(0, 10).map((m) => ({
  ...m,
  seq3Score: m.seq1Score != null ? +(m.seq1Score - 1.5).toFixed(2) : null,
  seq4Score: m.seq2Score != null ? +(m.seq2Score + 1.0).toFixed(2) : null,
  classTestScore: m.compositionScore != null ? +(m.compositionScore - 0.5).toFixed(2) : null,
  seq5Score: m.seq1Score != null ? +(m.seq1Score + 0.5).toFixed(2) : null,
  seq6Score: m.seq2Score != null ? +(m.seq2Score - 0.25).toFixed(2) : null,
  terminalExamScore: m.compositionScore != null ? +(m.compositionScore + 1.0).toFixed(2) : null,
}));

// Matières bulletin mensuel (anglophone)
const MATIERES_MONTHLY = [
  { subjectName: "Mathematics",     coefficient: 4, seq1Score: 82,  seq2Score: 100, subjectAverage: 16.4, competenceLabel: "A",  teacherComment: "Outstanding performance this month." },
  { subjectName: "English Language",coefficient: 4, seq1Score: 75,  seq2Score: 100, subjectAverage: 15.0, competenceLabel: "B",  teacherComment: "Good." },
  { subjectName: "French Language", coefficient: 2, seq1Score: 60,  seq2Score: 100, subjectAverage: 12.0, competenceLabel: "C",  teacherComment: "Needs improvement in written expression." },
  { subjectName: "Biology",         coefficient: 2, seq1Score: 91,  seq2Score: 100, subjectAverage: 18.2, competenceLabel: "A+", teacherComment: "Excellent." },
  { subjectName: "Chemistry",       coefficient: 2, seq1Score: 44,  seq2Score: 100, subjectAverage:  8.8, competenceLabel: "F",  teacherComment: "Very weak. Must revisit all chapters." },
  { subjectName: "Physics",         coefficient: 2, seq1Score: 67,  seq2Score: 100, subjectAverage: 13.4, competenceLabel: "C",  teacherComment: "Average." },
  { subjectName: "History & Geo",   coefficient: 2, seq1Score: 78,  seq2Score: 100, subjectAverage: 15.6, competenceLabel: "B",  teacherComment: "Good understanding of historical events." },
  { subjectName: "ICT",             coefficient: 1, seq1Score: 95,  seq2Score: 100, subjectAverage: 19.0, competenceLabel: "A+", teacherComment: "Exceptional." },
  { subjectName: "Civic Education", coefficient: 1, seq1Score: 70,  seq2Score: 100, subjectAverage: 14.0, competenceLabel: "B",  teacherComment: "Good." },
  { subjectName: "Physical Education", coefficient: 1, seq1Score: 88, seq2Score: 100, subjectAverage: 17.6, competenceLabel: "A", teacherComment: "Very active." },
];

// ─── 6 bulletins de démo ─────────────────────────────────────

const DEMOS = [
  {
    filename: "bulletin_FR_SECONDARY.pdf",
    template: "FR_SECONDARY",
    data: {
      ...SCHOOL,
      // Cas limite : nom très long
      studentName: "MBOUOMBOUO KENMOGNE Jean-Baptiste Christophe",
      className: "Terminale D",
      periodName: "1er Trimestre",
      yearName: "2025 – 2026",
      generalAverage: 12.89,
      rank: 7,
      totalStudents: 52,
      absenceCount: 3,
      mention: "Assez Bien",
      classMasterComment: "Élève sérieux et assidu. Doit renforcer les sciences exactes pour viser le premier groupe.",
      isOfficial: true,
      subjectLines: MATIERES_SECONDAIRE,
    },
  },
  {
    filename: "bulletin_EN_SECONDARY.pdf",
    template: "EN_SECONDARY",
    data: {
      ...SCHOOL,
      studentName: "NGASSAM TCHOUAMBE Vanessa-Estelle Clarisse",
      className: "Lower Sixth Arts",
      periodName: "First Term",
      yearName: "2025 – 2026",
      generalAverage: 14.63,
      rank: 3,
      totalStudents: 45,
      absenceCount: 0,
      mention: "Good",
      classMasterComment: "Excellent student with strong analytical skills. Keep up the good work.",
      isOfficial: true,
      subjectLines: [
        { subjectName: "Literature in English", coefficient: 4, classTestScore: 15.5, terminalExamScore: 16.0, subjectAverage: 15.75, teacherComment: "Excellent literary analysis and essay writing." },
        { subjectName: "French Language",       coefficient: 3, classTestScore: 12.0, terminalExamScore: 13.5, subjectAverage: 12.75, teacherComment: "Good progress." },
        { subjectName: "History",               coefficient: 3, classTestScore: 14.0, terminalExamScore: 15.0, subjectAverage: 14.5,  teacherComment: "Very good understanding of African history." },
        { subjectName: "Geography",             coefficient: 3, classTestScore: 16.5, terminalExamScore: 17.0, subjectAverage: 16.75, teacherComment: "Outstanding spatial analysis." },
        { subjectName: "Economics",             coefficient: 3, classTestScore: 13.5, terminalExamScore: 14.0, subjectAverage: 13.75, teacherComment: "Good grasp of micro and macro concepts." },
        { subjectName: "Civic Education",       coefficient: 1, classTestScore: 18.0, terminalExamScore: 17.5, subjectAverage: 17.75, teacherComment: "Exceptional commitment to civic values." },
        { subjectName: "Mathematics",           coefficient: 2, classTestScore:  9.5, terminalExamScore: 10.5, subjectAverage: 10.0,  teacherComment: "Below average. Needs to focus on algebra." },
        { subjectName: "Information Technology",coefficient: 2, classTestScore: 19.0, terminalExamScore: 18.5, subjectAverage: 18.75, teacherComment: "Outstanding digital skills. Well done!" },
        { subjectName: "Physical Education",    coefficient: 1, classTestScore: 16.0, terminalExamScore: null, subjectAverage: 16.0,  teacherComment: "Very active and disciplined." },
        // Long teacher comment — cas limite texte
        { subjectName: "Religious Studies",     coefficient: 1, classTestScore: 15.0, terminalExamScore: 14.5, subjectAverage: 14.75, teacherComment: "Good work. Demonstrates deep understanding of core religious principles and their application in modern-day contexts. Highly commendable participation in group discussions." },
      ],
    },
  },
  {
    filename: "bulletin_TECHNICAL_FR.pdf",
    template: "TECHNICAL_FR",
    data: {
      ...SCHOOL,
      studentName: "ESSOMBA AKONO Paul-Rodrigue",
      className: "Tle F4 (Électrotechnique)",
      periodName: "2ème Séquence",
      yearName: "2025 – 2026",
      generalAverage: 12.74,
      rank: 12,
      totalStudents: 38,
      absenceCount: 5,
      mention: "Assez Bien",
      classMasterComment: "Des lacunes en thermodynamique à combler d'urgence. Bon comportement en atelier.",
      isOfficial: false,
      subjectLines: MATIERES_TECHNIQUE,
    },
  },
  {
    filename: "bulletin_PRIMARY.pdf",
    template: "PRIMARY",
    data: {
      ...SCHOOL,
      studentName: "FOTSO KAMDEM Raphaël Junior",
      className: "CM2 / Grade 6",
      periodName: "1er Trimestre",
      yearName: "2025 – 2026",
      generalAverage: 14.77,
      rank: 5,
      totalStudents: 40,
      absenceCount: 1,
      mention: "Acquis",
      classMasterComment: "Très bon élève. Participe activement en classe. À encourager.",
      isOfficial: true,
      subjectLines: MATIERES_PRIMAIRE,
    },
  },
  {
    filename: "bulletin_ANNUAL.pdf",
    template: "ANNUAL",
    data: {
      ...SCHOOL,
      // Cas limite paysage : beaucoup de colonnes + nom long
      studentName: "NGATCHOU WAMBA Stéphane-Armand Bertrand",
      className: "2nde C",
      periodName: "Bilan Annuel",
      yearName: "2025 – 2026",
      generalAverage: 11.54,
      rank: 18,
      totalStudents: 55,
      absenceCount: 12,
      mention: "Passable",
      classMasterComment: "Résultats en deçà du potentiel de l'élève. Manque de régularité dans le travail.",
      isOfficial: true,
      subjectLines: MATIERES_ANNUAL,
    },
  },
  {
    filename: "bulletin_MONTHLY.pdf",
    template: "MONTHLY",
    data: {
      ...SCHOOL,
      studentName: "MBEH-NGONG Christabel Adaeze-Favour",
      className: "Form 4 Science",
      periodName: "October 2025",
      yearName: "2025 – 2026",
      generalAverage: 14.18,
      rank: 8,
      totalStudents: 42,
      absenceCount: 2,
      mention: "Good",
      classMasterComment: "Hardworking student. Weakness in Chemistry must be addressed immediately.",
      isOfficial: false,
      subjectLines: MATIERES_MONTHLY,
    },
  },
];

// ─── Génération ───────────────────────────────────────────────

async function main() {
  try { mkdirSync(OUT_DIR, { recursive: true }); } catch { /* exists */ }

  console.log(`📁 Dossier de sortie : ${OUT_DIR}\n`);

  for (const demo of DEMOS) {
    process.stdout.write(`⏳ Génération de ${demo.filename} ...`);
    try {
      const buf = await generateBulletinPdf(demo.template, demo.data as Parameters<typeof generateBulletinPdf>[1]);
      const outPath = join(OUT_DIR, demo.filename);
      writeFileSync(outPath, buf);
      console.log(` ✅  (${(buf.length / 1024).toFixed(1)} Ko)`);
    } catch (err) {
      console.log(` ❌  ERREUR : ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n✅ Terminé. Ouvrez le dossier "bulletins-demo" à la racine du projet.`);
}

main();
