import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const OUT_DIR = path.resolve('docs/prospectus');
const CAPTURES_DIR = path.join(OUT_DIR, 'captures');

// Couleurs V5 plus sobres & élégantes
const C_DARK = '#0f172a';
const C_TEXT = '#1e293b';
const C_MUTED = '#475569';
const C_LIGHT_MUTED = '#64748b';
const C_PRIMARY = '#059669'; // Vert émeraude sobre
const C_PRIMARY_LIGHT = '#ecfdf5';
const C_GOLD = '#d97706';
const C_GOLD_LIGHT = '#fffbeb';
const C_SURFACE = '#ffffff';
const C_BG = '#fafaf9';
const C_BORDER = '#e2e8f0';

function buildProspectusV5(destPdf: string) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 28, bottom: 28, left: 32, right: 32 },
    bufferPages: true,
  });

  doc.pipe(fs.createWriteStream(destPdf));
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - 64;

  // ═════════════════════════════════════════════════════════════
  // PAGE 1 : PROBLÈMES RÉGLÉS, BÉNÉFICES CLIENT & CRÉDIBILITÉ
  // ═════════════════════════════════════════════════════════════
  doc.rect(0, 0, pageWidth, pageHeight).fill(C_BG);

  // 1. EN-TÊTE BLANC SOBRE (comme recommandé)
  const logoPath = path.resolve('docs/prospectus/logo.png');
  if (fs.existsSync(logoPath)) {
    doc.roundedRect(32, 28, 44, 44, 8).fill(C_SURFACE);
    doc.roundedRect(32, 28, 44, 44, 8).lineWidth(1).stroke(C_BORDER);
    doc.image(logoPath, 36, 32, { width: 36, height: 36 });
  }

  // Titre en grand gris foncé sobre
  doc.font('Helvetica-Bold').fontSize(24).fillColor(C_DARK).text('ZekoulA', 84, 28, { continued: true });
  doc.font('Helvetica-Bold').fillColor(C_PRIMARY).text('Bia');

  // Phrase d'accroche sous le titre
  doc.font('Helvetica').fontSize(9.5).fillColor(C_MUTED)
     .text('Plateforme Intégrée de Gestion Scolaire Nouvelle Génération · Conçue pour le Cameroun', 84, 55);

  // Simple trait vert sobre
  doc.rect(32, 78, contentWidth, 2.5).fill(C_PRIMARY);

  // 2. PREUVE DE CRÉDIBILITÉ (Soutenance Licence Pro) & PROFILS CONCERNÉS
  const credY = 88;
  doc.roundedRect(32, credY, contentWidth, 32, 6).fill(C_SURFACE);
  doc.roundedRect(32, credY, contentWidth, 32, 6).lineWidth(1).stroke('#cbd5e1');

  doc.font('Helvetica-Bold').fontSize(8.2).fillColor(C_PRIMARY)
     .text('🎓 Crédibilité académique & technique :', 42, credY + 6, { continued: true });
  doc.font('Helvetica').fillColor(C_TEXT)
     .text(' Projet présenté et validé avec succès en soutenance de Licence Professionnelle (Octobre 2026).');

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_MUTED)
     .text('Pour qui ? ', 42, credY + 18, { continued: true });
  doc.font('Helvetica').fillColor(C_MUTED)
     .text('Direction générale, Censeurs, Intendants, Secrétariat, Enseignants, Parents d\'élèves.');

  // 3. LES BÉNÉFICES AVANT LES FONCTIONS (Ce que ça règle concrètement)
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C_DARK)
     .text('Ce que ZekoulABia règle définitivement dans votre établissement', 32, 130);
  doc.font('Helvetica').fontSize(8.5).fillColor(C_MUTED)
     .text('Les 4 blocages majeurs qui épuisent vos équipes chaque année, transformés en processus simples et automatiques :', 32, 146);

  // Fonction carte de bénéfice
  function drawBenefitCard(
    y: number,
    icon: string,
    benefitTitle: string,
    tag: string,
    painPoints: string,
    solution: string
  ): number {
    const cardH = 112;
    doc.roundedRect(32, y, contentWidth, cardH, 8).fill(C_SURFACE);
    doc.roundedRect(32, y, contentWidth, cardH, 8).lineWidth(1).stroke(C_BORDER);
    doc.roundedRect(32, y, 4, cardH, 2).fill(C_PRIMARY);

    // Titre bénéfice
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C_DARK).text(`${icon}  ${benefitTitle}`, 44, y + 10, { width: contentWidth - 140 });

    // Badge
    const tagW = 100;
    doc.roundedRect(pageWidth - 32 - tagW - 12, y + 9, tagW, 16, 8).fill(C_PRIMARY_LIGHT);
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor(C_PRIMARY)
       .text(tag, pageWidth - 32 - tagW - 12, y + 13, { width: tagW, align: 'center' });

    // Le problème résolu (en rouge doux)
    doc.roundedRect(44, y + 28, contentWidth - 24, 16, 4).fill('#fef2f2');
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#b91c1c')
       .text(`Fini : ${painPoints}`, 48, y + 32, { width: contentWidth - 32 });

    // La solution concrète
    doc.font('Helvetica').fontSize(8).fillColor(C_TEXT)
       .text(solution, 44, y + 49, { width: contentWidth - 24, lineGap: 1.5 });

    return y + cardH + 10;
  }

  let bY = 164;

  // Bénéfice 1 : Emplois du temps
  bY = drawBenefitCard(
    bY,
    '🗓️',
    'Fini les conflits de salles et les semaines perdues à la rentrée',
    'ZÉRO CONFLIT GARANTI',
    'Casse-tête du censeur, enseignants programmés dans deux classes à la fois, indisponibilités des vacataires.',
    'L\'algorithme génère en 1 clic un emploi du temps équilibré et sans collision. Il intègre automatiquement les quotas officiels MINESEC, les blocs de TP de sciences, l\'EPS et le couplage des langues (Allemand/Espagnol) sans double réservation.'
  );

  // Bénéfice 2 : Photos d'identité & cartes scolaires
  bY = drawBenefitCard(
    bY,
    '📸',
    'Fini le calvaire des photos 4x4 en retard et non conformes',
    'FOND BLANC STUDIO AUTO',
    'Attente interminable des photos chez le photographe de quartier, fonds multicolores, découpage aux ciseaux.',
    'Votre secrétariat prend l\'élève en photo directement sur smartphone ou PC. L\'application supprime instantanément le décor pour poser le fond blanc officiel MINESEC et recadrer au format 4x4. Vos badges et cartes scolaires sont imprimés le jour même !'
  );

  // Bénéfice 3 : Bulletins & Calculs
  bY = drawBenefitCard(
    bY,
    '📊',
    'Fini les nuits blanches de fin de trimestre et les erreurs de moyennes',
    'CONFORME MINESEC 100%',
    'Calculs manuels interminables, formules Excel faussées, ratures et contestations de notes par les parents.',
    'Moyennes pondérées exactes par groupes de matières (Groupes 1, 2, 3), rangs, mentions et tableaux d\'honneur générés automatiquement. Impression en masse des bulletins PDF avec QR Code officiel anti-fraude infalsifiable.'
  );

  // Bénéfice 4 : Finances & Recouvrement
  bY = drawBenefitCard(
    bY,
    '💳',
    'Fini les fuites de caisse et les longues files d\'attente à l\'intendance',
    'MTN MOMO & ORANGE',
    'Parents qui perdent des heures pour payer, manipulation d\'espèces à risque, impayés mal tracés.',
    'Les parents paient les tranches de scolarité directement depuis leur téléphone portable (MTN Mobile Money ou Orange Money). Reçu SMS officiel immédiat, rapprochement comptable automatique et tableau de bord des impayés en temps réel.'
  );

  // 4. CE QUI DISTINGUE ZEKOULABIA
  const diffY = 654;
  doc.roundedRect(32, diffY, contentWidth, 74, 8).fill('#f1f5f9');
  doc.roundedRect(32, diffY, contentWidth, 74, 8).lineWidth(1).stroke('#cbd5e1');

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_DARK)
     .text('⚡ Ce qui distingue ZekoulABia de toute autre solution au Cameroun', 44, diffY + 8);

  const colDiffW = (contentWidth - 28) / 3;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C_PRIMARY).text('📶 Mode 100% Hors-Ligne (PWA)', 44, diffY + 24);
  doc.font('Helvetica').fontSize(7.2).fillColor(C_MUTED)
     .text('L\'application continue de fonctionner même en cas de coupure Internet ou réseau faible.', 44, diffY + 36, { width: colDiffW - 8 });

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C_PRIMARY).text('🗣️ Bilinguisme Intégral (FR / EN)', 44 + colDiffW, diffY + 24);
  doc.font('Helvetica').fontSize(7.2).fillColor(C_MUTED)
     .text('Parité parfaite pour lycées francophones, anglophones et bilingues (GCE Board & OBC).', 44 + colDiffW, diffY + 36, { width: colDiffW - 8 });

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C_PRIMARY).text('📲 SMS Instantanés aux Familles', 44 + colDiffW * 2, diffY + 24);
  doc.font('Helvetica').fontSize(7.2).fillColor(C_MUTED)
     .text('Alertes immédiates aux parents en cas d\'absence injustifiée ou de retard en classe.', 44 + colDiffW * 2, diffY + 36, { width: colDiffW - 8 });

  // Footer Page 1
  doc.rect(32, 744, contentWidth, 0.8).fill(C_BORDER);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_DARK).text('ZekoulABia · L\'Excellence Scolaire Numérique', 32, 752);
  doc.font('Helvetica').fontSize(7.5).fillColor(C_LIGHT_MUTED).text('Page 1 / 2 · Présentation & Bénéfices', pageWidth - 32 - 160, 752, { width: 160, align: 'right' });


  // ═════════════════════════════════════════════════════════════
  // PAGE 2 : CAPTURES D'ÉCRAN RÉELLES, APPEL À L'ACTION & CONTACT
  // ═════════════════════════════════════════════════════════════
  doc.addPage();
  doc.rect(0, 0, pageWidth, pageHeight).fill(C_BG);

  // En-tête Page 2
  doc.font('Helvetica-Bold').fontSize(14).fillColor(C_DARK).text('La Plateforme en Action : Des Outils Clairs et Éprouvés', 32, 28);
  doc.font('Helvetica').fontSize(8.5).fillColor(C_MUTED).text('Aperçu des interfaces réelles utilisées quotidiennement par nos établissements partenaires', 32, 45);
  doc.rect(32, 58, contentWidth, 1.5).fill(C_PRIMARY);

  // 4 CAPTURES D'ÉCRAN RÉELLES (Grille 2 colonnes x 2 lignes)
  const capW = (contentWidth - 14) / 2; // ~258px
  const capH = 158; // hauteur par capture
  const row1Y = 68;
  const row2Y = row1Y + capH + 16;

  // Capture 1 : Bulletin Officiel MINESEC
  const pBulletin = path.join(CAPTURES_DIR, 'capture_bulletin_officiel.png');
  doc.roundedRect(32, row1Y, capW, capH, 6).fill(C_SURFACE);
  doc.roundedRect(32, row1Y, capW, capH, 6).lineWidth(1).stroke(C_BORDER);
  if (fs.existsSync(pBulletin)) {
    doc.image(pBulletin, 34, row1Y + 2, { fit: [capW - 4, capH - 26], align: 'center' });
  }
  doc.rect(32, row1Y + capH - 22, capW, 22).fill('#f8fafc');
  doc.rect(32, row1Y + capH - 22, capW, 1).fill(C_BORDER);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_DARK)
     .text('1. Bulletin Officiel MINESEC avec QR Code anti-fraude', 38, row1Y + capH - 16);

  // Capture 2 : Emploi du Temps Hebdomadaire
  const pTimetable = path.join(CAPTURES_DIR, 'capture_emploi_du_temps.png');
  const cap2X = 32 + capW + 14;
  doc.roundedRect(cap2X, row1Y, capW, capH, 6).fill(C_SURFACE);
  doc.roundedRect(cap2X, row1Y, capW, capH, 6).lineWidth(1).stroke(C_BORDER);
  if (fs.existsSync(pTimetable)) {
    doc.image(pTimetable, cap2X + 2, row1Y + 2, { fit: [capW - 4, capH - 26], align: 'center' });
  }
  doc.rect(cap2X, row1Y + capH - 22, capW, 22).fill('#f8fafc');
  doc.rect(cap2X, row1Y + capH - 22, capW, 1).fill(C_BORDER);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_DARK)
     .text('2. Emploi du Temps Hebdomadaire sans conflit (IA)', cap2X + 6, row1Y + capH - 16);

  // Capture 3 : Tableau de Bord Direction & Recouvrement
  const pDashboard = path.join(CAPTURES_DIR, 'capture_tableau_de_bord.png');
  doc.roundedRect(32, row2Y, capW, capH, 6).fill(C_SURFACE);
  doc.roundedRect(32, row2Y, capW, capH, 6).lineWidth(1).stroke(C_BORDER);
  if (fs.existsSync(pDashboard)) {
    doc.image(pDashboard, 34, row2Y + 2, { fit: [capW - 4, capH - 26], align: 'center' });
  }
  doc.rect(32, row2Y + capH - 22, capW, 22).fill('#f8fafc');
  doc.rect(32, row2Y + capH - 22, capW, 1).fill(C_BORDER);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_DARK)
     .text('3. Tableau de Bord Proviseur & Suivi Mobile Money', 38, row2Y + capH - 16);

  // Capture 4 : Studio Photo d'Identité Fond Blanc
  const pStudio = path.join(CAPTURES_DIR, 'capture_studio_photo.png');
  doc.roundedRect(cap2X, row2Y, capW, capH, 6).fill(C_SURFACE);
  doc.roundedRect(cap2X, row2Y, capW, capH, 6).lineWidth(1).stroke(C_BORDER);
  if (fs.existsSync(pStudio)) {
    doc.image(pStudio, cap2X + 2, row2Y + 2, { fit: [capW - 4, capH - 26], align: 'center' });
  }
  doc.rect(cap2X, row2Y + capH - 22, capW, 22).fill('#f8fafc');
  doc.rect(cap2X, row2Y + capH - 22, capW, 1).fill(C_BORDER);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_DARK)
     .text('4. Studio Photo avec détourage fond blanc automatique', cap2X + 6, row2Y + capH - 16);

  // APPEL À L'ACTION NET & ENCADRÉ DE CONTACT (sur fond vert sobre et professionnel)
  const ctaY = row2Y + capH + 20;
  const ctaH = 125;

  doc.roundedRect(32, ctaY, contentWidth, ctaH, 10).fill(C_SURFACE);
  doc.roundedRect(32, ctaY, contentWidth, ctaH, 10).lineWidth(1.5).stroke(C_PRIMARY);

  // Bandeau supérieur vert dans le cadre contact
  doc.roundedRect(32, ctaY, contentWidth, 32, 8).fill(C_PRIMARY);
  doc.rect(32, ctaY + 20, contentWidth, 12).fill(C_PRIMARY); // aplatir le bas
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#ffffff')
     .text('👉 Contactez-moi pour fixer une démonstration gratuite de 30 minutes', 32, ctaY + 9, { width: contentWidth, align: 'center' });

  // Contenu du cadre contact
  const colCY = ctaY + 40;
  // Colonne Gauche : Votre interlocuteur
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C_DARK).text('Ndzana Christophe', 48, colCY + 2);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_PRIMARY).text('Conseiller Déploiement & Partenariats Éducatifs', 48, colCY + 18);
  doc.font('Helvetica').fontSize(8).fillColor(C_MUTED)
     .text('Disponible pour une présentation personnalisée au sein de votre établissement ou en visioconférence.', 48, colCY + 32, { width: contentWidth / 2 - 30, lineGap: 1.5 });

  // Séparateur vertical
  const sepX = 32 + contentWidth / 2;
  doc.rect(sepX, colCY, 1, 46).fill(C_BORDER);

  // Colonne Droite : Coordonnées directes
  const rX = sepX + 24;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_MUTED).text('TÉLÉPHONE / WHATSAPP :', rX, colCY);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C_DARK).text('+237 695 55 78 91', rX, colCY + 10);

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_MUTED).text('COURRIER ÉLECTRONIQUE :', rX, colCY + 26);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_DARK).text('ndzanachristophe12@gmail.com', rX, colCY + 36);

  // Footer Page 2
  doc.rect(32, 744, contentWidth, 0.8).fill(C_BORDER);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_DARK).text('ZekoulABia · Cameroun · Tous droits réservés', 32, 752);
  doc.font('Helvetica').fontSize(7.5).fillColor(C_LIGHT_MUTED).text('Page 2 / 2 · Prospectus Officiel Établissements', pageWidth - 32 - 180, 752, { width: 180, align: 'right' });

  doc.end();
}

const v5Path = path.resolve('docs/prospectus/Prospectus_ZekoulABia_V5_Ndzana_Christophe.pdf');
buildProspectusV5(v5Path);
console.log(`Prospectus V5 généré à : ${v5Path}`);

