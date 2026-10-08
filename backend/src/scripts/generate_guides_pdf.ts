import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

// Couleurs professionnelles
const C_PRIMARY = '#B4532A'; // Terracotta ZekoulABia
const C_DARK = '#2A1A15';
const C_GRAY = '#5C4B44';
const C_LIGHT_GRAY = '#F4ECE3';
const C_BORDER = '#E5D8CC';
const C_BLUE = '#1D4ED8';
const C_GREEN = '#2F8F5B';
const C_BG_CODE = '#F8F6F2';

function createBasePdf(outputPath: string, title: string, subtitle: string) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 45, right: 45 },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  // En-tête de première page
  doc.rect(45, 35, doc.page.width - 90, 4).fill(C_PRIMARY);
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C_DARK).text(title, { align: 'left' });
  doc.font('Helvetica').fontSize(11).fillColor(C_GRAY).text(subtitle, { align: 'left' });
  doc.moveDown(0.5);
  doc.rect(45, doc.y, doc.page.width - 90, 1).fill(C_BORDER);
  doc.moveDown(0.8);

  return { doc, stream };
}

function addSectionTitle(doc: any, title: string, color = C_PRIMARY) {
  if (doc.y > doc.page.height - 100) doc.addPage();
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(color).text(title);
  doc.rect(45, doc.y + 2, doc.page.width - 90, 0.8).fill(C_BORDER);
  doc.moveDown(0.4);
}

function addSubTitle(doc: any, title: string) {
  if (doc.y > doc.page.height - 80) doc.addPage();
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C_DARK).text(title);
  doc.moveDown(0.2);
}

function addParagraph(doc: any, text: string) {
  if (doc.y > doc.page.height - 60) doc.addPage();
  doc.font('Helvetica').fontSize(9.5).fillColor(C_DARK).text(text, { lineGap: 2 });
  doc.moveDown(0.3);
}

function addBullet(doc: any, title: string, desc: string) {
  if (doc.y > doc.page.height - 60) doc.addPage();
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_PRIMARY).text('• ', { continued: true });
  doc.font('Helvetica-Bold').fillColor(C_DARK).text(`${title} : `, { continued: true });
  doc.font('Helvetica').fillColor(C_GRAY).text(desc, { lineGap: 1.5 });
  doc.moveDown(0.2);
}

function addCodeBlock(doc: any, code: string, lang = 'SQL') {
  const lines = code.trim().split('\n');
  const height = lines.length * 12 + 14;
  if (doc.y + height > doc.page.height - 40) doc.addPage();

  const startY = doc.y;
  const width = doc.page.width - 90;

  doc.rect(45, startY, width, height).fill(C_BG_CODE);
  doc.rect(45, startY, width, height).stroke(C_BORDER);
  doc.rect(45, startY, 4, height).fill(C_PRIMARY);

  doc.font('Courier').fontSize(8.5).fillColor('#1E293B');
  lines.forEach((line, idx) => {
    doc.text(line, 55, startY + 7 + idx * 12, { lineBreak: false });
  });

  doc.y = startY + height + 6;
}

function addTable(doc: any, headers: string[], rows: string[][], colWidths: number[]) {
  const rowHeight = 16;
  const totalHeight = (rows.length + 1) * rowHeight + 10;
  if (doc.y + totalHeight > doc.page.height - 50) doc.addPage();

  const startX = 45;
  let currentY = doc.y;

  // Header
  doc.rect(startX, currentY, doc.page.width - 90, rowHeight).fill(C_LIGHT_GRAY);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_DARK);
  let curX = startX + 6;
  headers.forEach((h, i) => {
    doc.text(h, curX, currentY + 4, { width: colWidths[i] - 10, lineBreak: false });
    curX += colWidths[i];
  });
  currentY += rowHeight;

  // Rows
  doc.font('Helvetica').fontSize(8.5);
  rows.forEach((row, rIdx) => {
    if (rIdx % 2 === 1) {
      doc.rect(startX, currentY, doc.page.width - 90, rowHeight).fill('#FCFBF9');
    }
    curX = startX + 6;
    row.forEach((cell, cIdx) => {
      doc.fillColor(cIdx === 0 ? C_PRIMARY : C_DARK).text(cell, curX, currentY + 4, {
        width: colWidths[cIdx] - 10,
        lineBreak: false,
      });
      curX += colWidths[cIdx];
    });
    doc.rect(startX, currentY + rowHeight - 0.5, doc.page.width - 90, 0.5).fill(C_BORDER);
    currentY += rowHeight;
  });

  doc.y = currentY + 6;
}

function finalizePdf(doc: any, stream: any): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#9E8C84');
      doc.text(
        `ZekoulABia — Fiche Technique de Soutenance | Page ${i + 1} sur ${range.count}`,
        45,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width - 90 }
      );
    }
    doc.end();
  });
}

// ─────────────────────────────────────────────────────────────
// 1. GÉNÉRATION GUIDE BASE DE DONNÉES POSTGRESQL
// ─────────────────────────────────────────────────────────────
export async function generateDatabasePdf(destPath: string) {
  const { doc, stream } = createBasePdf(
    destPath,
    'ZEKOULABIA — GUIDE BASE DE DONNÉES POSTGRESQL & REQUÊTES SQL',
    'Fiche pratique pour répondre aux questions du jury : connexion psql, tables clés, sélections & jointures'
  );

  addSectionTitle(doc, '1. Connexion à la Base de Données avec PSQL');
  addParagraph(doc, 'Pour interroger votre base PostgreSQL locale en ligne de commande durant la présentation, ouvrez un terminal et utilisez l\'une des commandes suivantes :');

  addCodeBlock(doc, `# Connexion standard à la base locale :
psql -U postgres -d zekoulabia_dev -h localhost -p 5432

# Si mot de passe demandé, tapez votre mot de passe (ex: 2005)
# Connexion rapide en 1 ligne avec URI :
psql "postgresql://postgres:2005@localhost:5432/zekoulabia_dev?schema=public"`, 'BASH');

  addParagraph(doc, 'Alternative visuelle immédiate pour le jury (Recommandé) : tapez "npx prisma studio" dans le dossier backend. Une interface web ultra-claire s\'ouvre sur http://localhost:5555 pour explorer toutes les tables et données en direct !');

  addSectionTitle(doc, '2. Les Métacommandes PSQL Indispensables');
  addParagraph(doc, 'Ces raccourcis permettent de naviguer et d\'afficher la structure sans écrire de requêtes complexes :');

  addTable(doc,
    ['Commande', 'Description / Action'],
    [
      ['\\l', 'Lister toutes les bases de données du serveur'],
      ['\\c zekoulabia_dev', 'Se connecter à la base zekoulabia_dev'],
      ['\\dt', 'Lister toutes les tables du schéma public (User, Class, Grade...)'],
      ['\\d "User"', 'Afficher la structure et les colonnes de la table "User"'],
      ['\\d "Grade"', 'Afficher les colonnes et types de la table "Grade" (Notes)'],
      ['\\x auto', 'Activer le mode affichage étendu (pratique si beaucoup de colonnes)'],
      ['\\q', 'Quitter psql et revenir au terminal bash'],
    ],
    [160, 345]
  );

  addSubTitle(doc, '⚠️ PIÈGE MAJEUR DEVANT LE JURY : Les guillemets doubles sur les tables !');
  addParagraph(doc, 'Prisma nomme les tables PostgreSQL avec une majuscule (PascalCase) : "User", "Class", "Grade", "StudentProfile". De plus, "user" est un mot réservé en SQL. Vous DEVEZ TOUJOURS entourer le nom de la table de guillemets doubles dans vos requêtes !');
  addCodeBlock(doc, `-- ❌ ERREUR : SELECT * FROM user;        -> syntax error at or near "user"
-- ✅ CORRECT : SELECT * FROM "User";      -> fonctionne parfaitement !
-- ✅ CORRECT : SELECT * FROM "Class";     -> fonctionne parfaitement !`, 'SQL');

  addSectionTitle(doc, '3. Les Tables Clés de ZekoulABia et leurs Relations');
  addTable(doc,
    ['Table', 'Rôle métier', 'Clés & Relations'],
    [
      ['"User"', 'Personnes (Élèves, Parents, Enseignants, Staff)', 'id, email, firstName, lastName, role'],
      ['"StudentProfile"', 'Profil scolaire de l\'élève', 'userId -> "User".id, matricule, healthScore'],
      ['"Class"', 'Classes de l\'établissement', 'id, name, level, serie, schoolId'],
      ['"Enrollment"', 'Inscription de l\'élève dans une classe', 'studentId -> "User", classId -> "Class"'],
      ['"Subject"', 'Matières enseignées', 'id, name, coefficient, subjectType'],
      ['"Grade"', 'Notes séquentielles de l\'élève', 'studentId, subjectId, sequenceAverage'],
      ['"Invoice"', 'Factures de scolarité', 'id, studentId, amount, status, dueDate'],
      ['"Payment"', 'Paiements Mobile Money / Espèces', 'id, invoiceId, amount, method, status'],
      ['"Attendance"', 'Pointages et présences journalières', 'studentId, classId, date, status'],
    ],
    [95, 235, 175]
  );

  addSectionTitle(doc, '4. Requêtes SQL Simples (Sélections & Filtres)');
  addParagraph(doc, 'Le jury peut vous demander d\'afficher rapidement une liste ou de compter des enregistrements :');

  addSubTitle(doc, 'A. Afficher les 10 premiers utilisateurs avec leur rôle :');
  addCodeBlock(doc, `SELECT id, "firstName", "lastName", role, email 
FROM "User" 
ORDER BY "createdAt" DESC 
LIMIT 10;`, 'SQL');

  addSubTitle(doc, 'B. Compter le nombre d\'utilisateurs par rôle (Élèves, Enseignants, Parents, Staff) :');
  addCodeBlock(doc, `SELECT role, COUNT(*) AS total 
FROM "User" 
GROUP BY role 
ORDER BY total DESC;`, 'SQL');

  addSubTitle(doc, 'C. Afficher les classes avec leur niveau et leur série :');
  addCodeBlock(doc, `SELECT name, level, serie, capacity 
FROM "Class" 
ORDER BY level, name;`, 'SQL');

  addSectionTitle(doc, '5. Requêtes SQL avec Jointures (JOIN) — Les plus demandées !');
  addParagraph(doc, 'Voici exactement les jointures relationnelles que les examinateurs adorent poser lors d\'une soutenance :');

  addSubTitle(doc, 'Jointure 1 : Lister les élèves avec leur classe et leur matricule (3 tables)');
  addParagraph(doc, 'Relie "User" (nom/prénom) $\\rightarrow$ "StudentProfile" (matricule) $\\rightarrow$ "Enrollment" $\\rightarrow$ "Class" (nom de classe) :');
  addCodeBlock(doc, `SELECT 
    u."firstName", 
    u."lastName", 
    sp.matricule, 
    c.name AS classe_nom, 
    c.level AS niveau
FROM "User" u
JOIN "StudentProfile" sp ON sp."userId" = u.id
JOIN "Enrollment" e ON e."studentId" = u.id
JOIN "Class" c ON c.id = e."classId"
WHERE u.role = 'STUDENT'
LIMIT 15;`, 'SQL');

  addSubTitle(doc, 'Jointure 2 : Afficher les notes d\'un élève avec le nom de la matière (3 tables)');
  addParagraph(doc, 'Relie "Grade" (note) $\\rightarrow$ "Subject" (nom matière) $\\rightarrow$ "User" (nom élève) :');
  addCodeBlock(doc, `SELECT 
    u."firstName" || ' ' || u."lastName" AS eleve,
    s.name AS matiere,
    s.coefficient,
    g."sequenceAverage" AS note_sur_20,
    g."validationStatus"
FROM "Grade" g
JOIN "Subject" s ON s.id = g."subjectId"
JOIN "User" u ON u.id = g."studentId"
WHERE g."sequenceAverage" IS NOT NULL
ORDER BY s.name
LIMIT 10;`, 'SQL');

  addSubTitle(doc, 'Jointure 3 : Calculer la moyenne générale d\'un élève par matière :');
  addCodeBlock(doc, `SELECT 
    s.name AS matiere,
    ROUND(AVG(g."sequenceAverage")::numeric, 2) AS moyenne_matiere
FROM "Grade" g
JOIN "Subject" s ON s.id = g."subjectId"
WHERE g."studentId" = 'ID_ELEVE'
GROUP BY s.name;`, 'SQL');

  addSubTitle(doc, 'Jointure 4 : Lister les factures de scolarité avec le nom de l\'élève et le parent :');
  addCodeBlock(doc, `SELECT 
    i.id AS facture_id,
    u."firstName" || ' ' || u."lastName" AS eleve,
    i.amount AS montant_du,
    i.status AS statut_facture,
    i."dueDate" AS date_echeance
FROM "Invoice" i
JOIN "User" u ON u.id = i."studentId"
ORDER BY i."createdAt" DESC
LIMIT 10;`, 'SQL');

  addSubTitle(doc, 'Jointure 5 : Somme totale des paiements encaissés par méthode (MTN MoMo, Orange, Espèces) :');
  addCodeBlock(doc, `SELECT 
    method AS methode_paiement,
    status AS statut,
    COUNT(*) AS nombre_transactions,
    SUM(amount) AS total_fcfa
FROM "Payment"
GROUP BY method, status;`, 'SQL');

  addSectionTitle(doc, '6. Récapitulatif : Les 3 réponses parfaites devant le jury');
  addBullet(doc, '« Pourquoi PostgreSQL plutôt que MySQL ou MongoDB ? »', '« PostgreSQL offre une intégrité transactionnelle ACID stricte indispensable pour les notes et les paiements scolaires, ainsi qu\'une isolation multi-tenant native et une excellente gestion des contraintes d\'intégrité référentielle. »');
  addBullet(doc, '« Pourquoi Prisma ORM ? »', '« Prisma garantit la sécurité des types (type-safety) de bout en bout entre TypeScript et PostgreSQL, éliminant les erreurs de schéma à l\'exécution et automatisant les migrations de manière déclarative. »');
  addBullet(doc, '« Comment gérez-vous l\'intégrité des paiements ? »', '« Toutes les écritures financières multi-tables (mise à jour facture + enregistrement paiement) sont exécutées dans une transaction atomique Prisma unique (tout ou rien), évitant toute discordance comptable. »');

  return finalizePdf(doc, stream);
}

// ─────────────────────────────────────────────────────────────
// 2. GÉNÉRATION GUIDE FRONTEND EN PDF
// ─────────────────────────────────────────────────────────────
export async function generateFrontendPdf(destPath: string) {
  const { doc, stream } = createBasePdf(
    destPath,
    'ZEKOULABIA — GUIDE DE MODIFICATIONS FRONTEND EN DIRECT',
    'Fiche pratique soutenance : changer une couleur, un texte, une taille et retrouver n\'importe quel écran'
  );

  addSectionTitle(doc, '1. L\'Astuce d\'Or pour retrouver n\'importe quel élément en 5 secondes');
  addParagraph(doc, 'Si un membre du jury pointe l\'écran et vous demande de modifier quelque chose en direct :');
  addBullet(doc, 'Étape 1', 'Faites un clic droit sur l\'élément dans le navigateur -> "Inspecter" (F12) pour repérer le texte ou la classe.');
  addBullet(doc, 'Étape 2', 'Dans votre terminal, cherchez le texte ou mot clé avec grep : grep -rn "Texte affiché" frontend/src/');
  addBullet(doc, 'Étape 3', 'Modifiez le code et sauvegardez (Ctrl + S). Grâce au Hot Reload de Next.js, la page se met à jour instantanément sans rechargement !');

  addSectionTitle(doc, '2. Changer les Couleurs en Direct (Effet Démo)');
  addParagraph(doc, 'Toutes les couleurs de ZekoulABia sont pilotées par les tokens CSS dans frontend/src/app/globals.css (lignes 13 à 120) :');

  addTable(doc,
    ['Variable CSS', 'Rôle dans l\'application', 'Valeur actuelle'],
    [
      ['--primary', 'Couleur principale (boutons, actions, liens)', '#B4532A (Terracotta)'],
      ['--sidebar-bg', 'Fond de la barre latérale gauche', '#3A2419 (Cacao)'],
      ['--accent', 'Couleur d\'accentuation et éléments actifs', '#E3B04B (Or)'],
      ['--surface', 'Fond des cartes et tableaux', '#FFFFFF (Blanc)'],
      ['--bg', 'Fond général de l\'application', '#FBF7F2 (Crème)'],
      ['--green', 'Statuts validés, succès, reçus soldés', '#2F8F5B (Vert)'],
      ['--red', 'Alertes critiques, factures impayées', '#D9481F (Rouge)'],
      ['--amber', 'Alertes moyennes, paiements en attente', '#D97706 (Ambre)'],
    ],
    [105, 235, 165]
  );

  addSubTitle(doc, 'Exemple : Passer toute l\'application en Bleu en 1 seconde :');
  addCodeBlock(doc, `/* Dans frontend/src/app/globals.css (ligne 45) */
--primary: #2563EB;        /* Ancien : #B4532A */
--primary-hover: #1D4ED8;`, 'CSS');

  addSectionTitle(doc, '3. Modifier les Textes et Libellés (i18n)');
  addParagraph(doc, 'ZekoulABia est bilingue. Tous les textes sont centralisés dans frontend/src/locales/fr/ :');
  addBullet(doc, 'navigation.json', 'Menus de la barre latérale de chaque dashboard.');
  addBullet(doc, 'parent.json', 'Textes de l\'espace parent ("Mes enfants", "Factures & Règlements").');
  addBullet(doc, 'student.json', 'Textes de l\'espace élève ("Mon orientation", "Mes notes").');
  addBullet(doc, 'teacher.json', 'Textes de l\'espace enseignant ("Élèves à risque", "Cahier de texte").');
  addBullet(doc, 'staff.json', 'Textes du personnel administratif ("Suivi des élèves", "Conseils").');
  addBullet(doc, 'admin.json', 'Textes de l\'administrateur ("IA & Santé", "Configuration").');

  addSectionTitle(doc, '4. Modifier Tailles, Polices et Boutons');
  addBullet(doc, 'Agrandir un texte', 'Tailwind : text-xs -> text-sm -> text-base -> text-lg. Style inline : fontSize: 13 -> fontSize: 16.');
  addBullet(doc, 'Agrandir un bouton', 'Tailwind : h-9 px-3 -> h-11 px-5. Style inline : padding: "6px 12px" -> padding: "10px 20px".');
  addBullet(doc, 'Changer une police', 'font-nunito (interface moderne) ou font-spectral / var(--font-spectral) (titres officiels académiques).');
  addBullet(doc, 'Changer une icône', 'Toutes les icônes viennent de lucide-react. Exemple : import { Sparkles, Trophy } from "lucide-react";');

  addSectionTitle(doc, '5. Table d\'Orientation Express : Où trouver chaque Écran ?');
  addTable(doc,
    ['Dashboard', 'Fonctionnalité recherchée', 'Fichier source exact'],
    [
      ['Parent', 'Note de santé sur 100 & Enfants', 'SectionParentChildren.tsx'],
      ['Parent', 'Factures & Paiements MoMo', 'SectionParentPayments.tsx'],
      ['Parent', 'Dossier de l\'élève (Modal)', 'ChildProfileModal.tsx'],
      ['Élève', 'Accueil (Moyenne, rang, santé)', 'SectionStudentDashboard.tsx'],
      ['Élève', 'Orientation (Séries C, D, A, TI)', 'SectionStudentOrientation.tsx'],
      ['Élève', 'Choix de LV2 (Espagnol, Allemand)', 'Lv2ChoiceBanner.tsx'],
      ['Enseignant', 'Élèves à risque & Chutes notes', 'SectionTeacherAtRisk.tsx'],
      ['Enseignant', 'Boutons entretien / signalement', 'StudentFollowUpButtons.tsx'],
      ['Enseignant', 'Classe PP & Tableau d\'honneur', 'SectionProfesseurPrincipal.tsx'],
      ['Enseignant', 'Conseil de classe & Avis IA', 'SectionAppreciationsPP.tsx'],
      ['Staff', 'Suivi élèves & Vigilance Censeur', 'SectionSuiviElevesStaff.tsx'],
      ['Staff', 'Orientation & Tests Conseiller', 'SectionOrientation.tsx'],
      ['Admin', 'Supervision IA & Santé de l\'école', 'SectionAdminAI.tsx'],
      ['Admin', 'Bulletins officiels MINESEC QR', 'SectionBulletins.tsx'],
      ['Tous', 'Babillard officiel de l\'école', 'BabillardBoard.tsx'],
      ['Tous', 'Messagerie instantanée', 'ListeConversations.tsx'],
    ],
    [70, 200, 235]
  );

  addSectionTitle(doc, '6. Réponses aux Questions Techniques du Jury');
  addBullet(doc, '« Pourquoi Next.js ? »', '« Pour le rendu hybride optimisé, le routage modulaire par sous-système et la compilation instantanée en développement. »');
  addBullet(doc, '« Comment fonctionne le mode hors-ligne ? »', '« Nous utilisons IndexedDB chiffré (Dexie) avec le hook useCachedFetch : chaque écran se charge en 0 milliseconde depuis le cache local avant toute requête réseau. »');
  addBullet(doc, '« Pourquoi l\'interface est-elle aussi fluide sur mobile ? »', '« L\'application est pensée Mobile-First : les tableaux se transforment en cartes tactiles aérées et chaque bouton bénéficie de micro-animations de retour tactile (active:scale-95). »');

  return finalizePdf(doc, stream);
}

export async function generateBackendPdf(destPath: string) {
  const { doc, stream } = createBasePdf(
    destPath,
    'ZEKOULABIA — GUIDE ARCHITECTURE & BACKEND SPÉCIAL SOUTENANCE',
    'Maîtrise technique : Architecture Hexagonale, Bun, Prisma, Sécurité Multi-Tenant, Transactions, Campay & IA'
  );

  addSectionTitle(doc, '1. Vue d\'Ensemble & Choix Technologiques');
  addParagraph(doc, 'Le backend de ZekoulABia est conçu comme un Monolithe Modulaire robuste et découplé, prêt pour la haute concurrence :');
  addBullet(doc, 'Runtime Bun', 'Exécution native de TypeScript sans transpilation, démarrage instantané, gestionnaire de paquets 25x plus rapide que npm.');
  addBullet(doc, 'Framework Express', 'Routage RESTful, middlewares de sécurité (CORS, Helmet, Rate Limiter) et gestion prédictible des requêtes.');
  addBullet(doc, 'Architecture Hexagonale', 'Domain (règles pures) -> Application (Use Cases) -> Infrastructure (Adapters Prisma, Campay, Groq).');
  addBullet(doc, 'Prisma ORM & PostgreSQL', 'Transactions ACID atomiques, Prepared Statements anti-injections SQL, typage de bout en bout.');

  addSectionTitle(doc, '2. L\'Architecture Hexagonale (Clean Architecture)');
  addParagraph(doc, 'Pour répondre au jury sur la structure du code :');
  addBullet(doc, 'src/domain/', 'Entités métier et Ports (interfaces TypeScript pures). Zéro dépendance vers Prisma, Express ou des SDKs tiers.');
  addBullet(doc, 'src/application/', 'Use Cases orchestrant les flux métier (ex: InscrireEleveUseCase, CalculBulletinTrimestreUseCase).');
  addBullet(doc, 'src/infrastructure/', 'Adaptateurs concrets : PrismaStudentRepository, CampayPaiementService, GroqClient.');
  addBullet(doc, 'Contrôleurs HTTP', 'Coquilles légères : validation d\'entrée -> appel du Use Case -> retour du code de statut HTTP (200, 201, 400, 403). Aucune règle métier dans les contrôleurs !');

  addSectionTitle(doc, '3. Le Conteneur d\'Injection de Dépendances (container.ts)');
  addParagraph(doc, 'Le fichier backend/src/infrastructure/config/container.ts instancie et relie tous les composants :');
  addCodeBlock(doc, `// Inversion de Dépendance (DIP) : Le Use Case ne connaît que des interfaces
const studentRepo = new PrismaStudentRepository(prisma);
const auditService = new DatabaseAuditTrailService(prisma);
const useCase = new InscrireEleveUseCase(studentRepo, auditService);
const controller = new StudentController(useCase);`, 'TS');
  addParagraph(doc, 'Avantage majeur pour la soutenance : permet de tester unitairement 100% de la logique métier avec des mocks en mémoire, sans aucune base de données.');

  addSectionTitle(doc, '4. Sécurité & Étanchéité Multi-Tenant');
  addBullet(doc, 'JWT & schoolId', 'Chaque utilisateur connecté possède son schoolId dans son token JWT signé. Impossible d\'usurper l\'établissement.');
  addBullet(doc, 'Isolation stricte', 'Toute requête Prisma filtre obligatoirement par where: { schoolId: req.user.schoolId }.');
  addBullet(doc, 'RBAC granulaire', 'Middleware requireRole(["ADMIN", "COMPTABLE"]) bloquant toute tentative d\'accès non autorisée avec statut 403.');
  addBullet(doc, 'Anti-Injection SQL', 'Prepared statements automatiques dans Prisma ORM : les paramètres ne sont jamais concaténés.');

  addSectionTitle(doc, '5. Transactions Atomiques (ACID) & Concurrence');
  addParagraph(doc, 'Exemple : Enregistrement d\'un paiement de scolarité :');
  addCodeBlock(doc, `await prisma.$transaction(async (tx) => {
  // 1. Enregistrer le paiement
  const p = await tx.paiement.create({ data: { eleveId, montant, mode: 'MOMO' } });
  // 2. Décrémenter la tranche due
  await tx.trancheEcheancier.update({ where: { id: tId }, data: { montantPaye: { increment: montant } } });
  // 3. Générer le reçu numéroté
  await tx.recu.create({ data: { paiementId: p.id, numeroRecu: genererNumero() } });
});`, 'TS');
  addParagraph(doc, 'Si le moindre incident survient (coupure, timeout, erreur), PostgreSQL annule tout (ROLLBACK). L\'intégrité financière reste garantie à 100%.');

  addSectionTitle(doc, '6. Patterns Métier Clés : Propose/Apply & Idempotence');
  addBullet(doc, 'Propose / Apply', 'Actions critiques (clôture d\'année, emploi du temps) : /propose simule sans écrire ; /apply exécute dans une transaction atomique après confirmation.');
  addBullet(doc, 'Idempotence', 'En-tête Idempotency-Key pour empêcher les doubles débits de paiement en cas de double-clic ou coupure réseau.');
  addBullet(doc, 'Verrouillage optimiste', 'Champ conflitVersion incrémenté pour détecter et résoudre les modifications concurrentes hors-ligne.');

  addSectionTitle(doc, '7. Intégrations Externes Clés');
  addBullet(doc, 'Campay (Mobile Money)', 'Intégration push USSD MTN/Orange Cameroun + Webhook asynchrone sécurisé avec signature.');
  addBullet(doc, 'Groq IA LPU', 'Modèles Llama 3.3 / Mixtral pour appréciations automatiques de bulletins et détection du décrochage, avec repli heuristique.');
  addBullet(doc, 'Inngest', 'Orchestration asynchrone d\'arrière-plan (génération de 500 bulletins PDF, alertes SMS matinales, recalculs).');

  addSectionTitle(doc, '8. Table d\'Orientation Express : Fichiers Clés du Backend');
  addTable(doc,
    ['Composant / Rôle', 'Fichier source exact', 'Ce qu\'il faut montrer au jury'],
    [
      ['Conteneur IoC', 'src/infrastructure/config/container.ts', 'L\'injection de dépendances centrale'],
      ['Point d\'entrée HTTP', 'src/server.ts', 'Middlewares CORS, Helmet, routes API'],
      ['Sécurité & RBAC', 'src/interfaces/http/middlewares/auth.ts', 'Vérification JWT & requireRole'],
      ['Paiement Campay', 'src/infrastructure/services/payment/CampayPaiementService.ts', 'Appel API MoMo & validation statut'],
      ['Moteur IA Groq', 'src/infrastructure/services/ai/GroqClient.ts', 'Inférence rapide LLM & prompt'],
      ['Schéma Prisma', 'prisma/schema.prisma', 'Relations, contraintes, index & schoolId'],
      ['Calculs Bulletins', 'src/application/academic/CalculBulletinTrimestreUseCase.ts', 'Règles officielles MINESEC & QR code'],
      ['Gestion Concurrence', 'src/infrastructure/web/middlewares/idempotency.ts', 'Protection contre les doubles paiements'],
    ],
    [95, 205, 205]
  );

  addSectionTitle(doc, '9. Questions Pièges du Jury & Réponses en Or');
  addBullet(doc, '« Pourquoi pas des Microservices ? »', '« Pour garantir des transactions ACID strictes dans la gestion des notes et finances scolaires sans la complexité inutile d\'un pattern Saga. Un Monolithe Modulaire Hexagonal offre le meilleur équilibre entre robustesse et vélocité. »');
  addBullet(doc, '« Si 500 parents paient en même temps ? »', '« Bun gère les connexions I/O en asynchrone non-bloquant, le pool de connexions Prisma protège la base PostgreSQL, et les tâches lourdes (PDF/SMS) sont déléguées à Inngest en tâche de fond. »');
  addBullet(doc, '« Où est le code métier ? »', '« Exclusivement dans la couche Domaine et Application (Use Cases). Nos contrôleurs sont de simples aiguilleurs HTTP, ce qui rend notre code testable, maintenable et indépendant de tout framework. »');

  return finalizePdf(doc, stream);
}

