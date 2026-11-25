import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

type PdfDoc = InstanceType<typeof PDFDocument>;

// Charte graphique officielle ZekoulABia
const C_FOREST = '#1a2e1e';
const C_FOREST_DARK = '#0f1c12';
const C_PRIMARY = '#059669';
const C_PRIMARY_DARK = '#047857';
const C_PRIMARY_LIGHT = '#ecfdf5';
const C_GOLD = '#d97706';
const C_GOLD_LIGHT = '#fef3c7';
const C_TEXT = '#1a1209';
const C_TEXT_MUTED = '#5c5042';
const C_TEXT_LIGHT = '#8c7b68';
const C_BG_WARM = '#fcfaf6';
const C_SURFACE = '#ffffff';
const C_BORDER = '#e8e0d4';
const C_RED = '#b91c1c';
const C_RED_LIGHT = '#fee2e2';

function buildProspectusPdf(outputPath: string) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 32, bottom: 32, left: 36, right: 36 },
    bufferPages: true,
  });

  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - 72; // 36 margin on each side

  // ─────────────────────────────────────────────────────────────
  // PAGE 1 : EN-TÊTE, HERO, ET LES 3 PREMIERS PILIERS D'URGENCE
  // ─────────────────────────────────────────────────────────────

  // Fond chaud subtil de la page
  doc.rect(0, 0, pageWidth, pageHeight).fill(C_BG_WARM);

  // Logo + Titre Header
  const logoPath = path.resolve('docs/prospectus/logo.png');
  if (fs.existsSync(logoPath)) {
    // Fond blanc arrondi pour le logo
    doc.roundedRect(36, 30, 48, 48, 8).fill(C_SURFACE);
    doc.roundedRect(36, 30, 48, 48, 8).lineWidth(1).stroke(C_BORDER);
    doc.image(logoPath, 40, 34, { width: 40, height: 40 });
  }

  // Nom de la marque
  doc.font('Helvetica-Bold').fontSize(22).fillColor(C_FOREST).text('ZekoulA', 92, 33, { continued: true });
  doc.font('Helvetica-Bold').fillColor(C_PRIMARY).text('Bia');
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C_GOLD).text('L\'Excellence Scolaire Numérique · Cameroun', 92, 57);

  // Badge Cameroun à droite
  const badgeWidth = 185;
  const badgeX = pageWidth - 36 - badgeWidth;
  doc.roundedRect(badgeX, 32, badgeWidth, 38, 6).fill(C_PRIMARY_LIGHT);
  doc.roundedRect(badgeX, 32, badgeWidth, 38, 6).lineWidth(1).stroke(C_PRIMARY);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C_PRIMARY_DARK)
     .text('100% Conforme Système Cameroun', badgeX + 8, 38, { width: badgeWidth - 16, align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor(C_TEXT_MUTED)
     .text('MINESEC (Francophone & Anglophone)', badgeX + 8, 52, { width: badgeWidth - 16, align: 'center' });

  // Ligne de séparation
  doc.rect(36, 84, contentWidth, 1).fill(C_BORDER);

  // Hero Banner
  const heroY = 92;
  const heroHeight = 88;
  doc.roundedRect(36, heroY, contentWidth, heroHeight, 8).fill(C_FOREST);
  doc.roundedRect(36, heroY, contentWidth, heroHeight, 8).lineWidth(1).stroke(C_GOLD);

  // Badge Hero
  doc.roundedRect(48, heroY + 10, 190, 15, 3).fill('#2d4a34');
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#f4c475')
     .text('DOSSIER DE PRÉSENTATION AUX DÉCIDEURS', 52, heroY + 14, { width: 182, align: 'center' });

  // Titre Hero
  doc.font('Helvetica-Bold').fontSize(13.5).fillColor('#ffffff')
     .text('Modernisez votre établissement scolaire avec la solution de référence au Cameroun', 48, heroY + 30, { width: contentWidth - 24 });

  // Description Hero
  doc.font('Helvetica').fontSize(8.5).fillColor('#dcd4c8')
     .text('Éliminez les erreurs de calculs de bulletins, les conflits d’emplois du temps et les impayés de scolarité non maîtrisés. ZekoulABia libère votre administration pour vous concentrer sur la réussite éducative.', 48, heroY + 54, { width: contentWidth - 24, lineGap: 1.5 });

  // Fonction utilitaire pour dessiner une carte de fonctionnalité
  function drawFeatureCard(
    y: number,
    num: string,
    title: string,
    tag: string,
    pain: string,
    desc: string,
    bullets: string[],
    accentColor: string
  ): number {
    const cardHeight = 150;
    doc.roundedRect(36, y, contentWidth, cardHeight, 8).fill(C_SURFACE);
    doc.roundedRect(36, y, contentWidth, cardHeight, 8).lineWidth(1).stroke(C_BORDER);

    // Barre latérale colorée
    doc.roundedRect(36, y, 4, cardHeight, 2).fill(accentColor);

    // Numéro / icône badge
    doc.roundedRect(48, y + 12, 28, 28, 6).fill(C_PRIMARY_LIGHT);
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C_PRIMARY_DARK).text(num, 48, y + 19, { width: 28, align: 'center' });

    // Titre
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C_FOREST).text(title, 84, y + 13, { width: contentWidth - 175 });

    // Tag / Pill
    const tagWidth = 105;
    doc.roundedRect(pageWidth - 36 - tagWidth - 12, y + 12, tagWidth, 16, 8).fill(C_GOLD_LIGHT);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(C_GOLD)
       .text(tag, pageWidth - 36 - tagWidth - 12, y + 16, { width: tagWidth, align: 'center' });

    // Ligne "Problème résolu"
    doc.roundedRect(84, y + 33, contentWidth - 96, 17, 3).fill(C_RED_LIGHT);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_RED)
       .text(`⚠️ Problème résolu : ${pain}`, 88, y + 37, { width: contentWidth - 104, lineBreak: false });

    // Description
    doc.font('Helvetica').fontSize(8.2).fillColor(C_TEXT_MUTED)
       .text(desc, 84, y + 56, { width: contentWidth - 96, lineGap: 2 });

    // Puces d'avantages
    let bulletY = y + 96;
    bullets.forEach((b) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(C_PRIMARY).text('✓ ', 84, bulletY, { continued: true });
      doc.font('Helvetica-Bold').fillColor(C_FOREST).text(b.split(' : ')[0] + ' : ', { continued: true });
      doc.font('Helvetica').fillColor(C_TEXT_MUTED).text(b.split(' : ')[1] || '', { lineGap: 1 });
      bulletY += 14;
    });

    return y + cardHeight + 12;
  }

  // PILIER 1 : BULLETINS
  let curY = 190;
  curY = drawFeatureCard(
    curY,
    '1',
    'Bulletins MINESEC 100% Automatisés & Zéro Erreur',
    'FIN DES NUITS BLANCHES',
    'Calculs manuels interminables, erreurs de coefficients et litiges de moyennes.',
    'Calcul automatique certifié conforme aux instructions officielles du MINESEC : moyennes pondérées, rangs, mentions officielles, tableaux d’honneur et sanctions pour les systèmes Francophone (6 séquences) et Anglophone (Terms).',
    [
      'Génération en masse en 1 clic : Téléchargement instantané de tous les bulletins de classe en PDF.',
      'Authenticité anti-fraude : QR Code unique de vérification sur chaque bulletin imprimé.',
      'Procès-verbaux & Délibérations : Fiches récapitulatives prêtes pour les conseils de classe.',
    ],
    C_PRIMARY
  );

  // PILIER 2 : EMPLOIS DU TEMPS
  curY = drawFeatureCard(
    curY,
    '2',
    'Générateur Intelligent d\'Emplois du Temps (Zéro Conflit)',
    'GAIN : 2 SEMAINES',
    'Conflits de salles, professeurs affectés à deux classes à la même heure, vacataires mécontents.',
    'Moteur d’optimisation qui résout automatiquement l’emploi du temps en intégrant toutes les contraintes de votre collège/lycée : indisponibilités des vacataires, blocs de cours (TP, EPS), cours couplés (LV2 Allemand/Espagnol, PEBS).',
    [
      'Zéro chevauchement garanti : Détection et blocage automatique des doublons d\'affectation.',
      'Gestion des groupes & options : Regroupement parfait des matières à effectifs partagés.',
      'Exports prêts à l\'affichage : Grilles complètes par classe, par salle et par professeur.',
    ],
    C_GOLD
  );

  // PILIER 3 : FRAIS DE SCOLARITÉ & MOBILE MONEY
  curY = drawFeatureCard(
    curY,
    '3',
    'Frais de Scolarité & Mobile Money (MTN MoMo & Orange)',
    'ZÉRO FUITE DE CAISSE',
    'Files d’attente interminables à l’intendance, manipulations d’espèces et retards d’écolage.',
    'Paiement direct et sécurisé des tranches d’écolage par les parents depuis leur téléphone portable (MTN Mobile Money & Orange Money) ou au guichet avec délivrance instantanée d’un reçu numérique par SMS.',
    [
      'Rapprochement bancaire instantané : Chaque franc payé est immédiatement réconcilié en caisse.',
      'Tableau de bord financier : Visibilité temps réel sur le taux de recouvrement et le reste à payer.',
      'Relances automatiques : SMS de rappel envoyés aux parents avant chaque échéance de tranche.',
    ],
    C_PRIMARY_DARK
  );

  // Bandeau métriques en bas de page 1
  const metricsY = 676;
  doc.roundedRect(36, metricsY, contentWidth, 54, 6).fill(C_SURFACE);
  doc.roundedRect(36, metricsY, contentWidth, 54, 6).lineWidth(1).stroke(C_BORDER);

  const colW = contentWidth / 3;
  // Métrique 1
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C_PRIMARY).text('-90%', 36, metricsY + 8, { width: colW, align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor(C_TEXT_MUTED).text('De temps sur la clôture trimestrielle', 36, metricsY + 28, { width: colW, align: 'center' });

  // Métrique 2
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C_GOLD).text('100%', 36 + colW, metricsY + 8, { width: colW, align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor(C_TEXT_MUTED).text('Conforme maquettes MINESEC', 36 + colW, metricsY + 28, { width: colW, align: 'center' });

  // Métrique 3
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C_FOREST).text('0 Conflit', 36 + colW * 2, metricsY + 8, { width: colW, align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor(C_TEXT_MUTED).text('D\'enseignant ou de salle en classe', 36 + colW * 2, metricsY + 28, { width: colW, align: 'center' });

  // Footer Page 1
  doc.rect(36, 746, contentWidth, 0.8).fill(C_BORDER);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_FOREST).text('ZekoulABia · Solution Intégrée de Gestion Scolaire', 36, 754);
  doc.font('Helvetica').fontSize(7.5).fillColor(C_TEXT_LIGHT).text('Page 1 / 2 · Dossier de Présentation Officiel', pageWidth - 36 - 180, 754, { width: 180, align: 'right' });


  // ─────────────────────────────────────────────────────────────
  // PAGE 2 : SUITE DES FONCTIONNALITÉS, IA, CONTEXTE & CONTACTS
  // ─────────────────────────────────────────────────────────────
  doc.addPage();
  doc.rect(0, 0, pageWidth, pageHeight).fill(C_BG_WARM);

  // En-tête Page 2
  doc.font('Helvetica-Bold').fontSize(15).fillColor(C_FOREST).text('Une Suite Complète au Service de l\'Excellence Éducative', 36, 32);
  doc.font('Helvetica').fontSize(8.5).fillColor(C_TEXT_MUTED).text('Outils collaboratifs pour Proviseurs, Censeurs, Intendants, Enseignants et Parents', 36, 50);
  doc.rect(36, 64, contentWidth, 1).fill(C_BORDER);

  curY = 74;

  // PILIER 4 : APPEL NUMÉRIQUE & SMS
  curY = drawFeatureCard(
    curY,
    '4',
    'Appel Numérique & Notification SMS Immédiate aux Parents',
    'DISCIPLINE & SÉRÉNITÉ',
    'Élèves absents à l\'insu des parents, carnets de correspondance perdus ou falsifiés.',
    'L’enseignant fait l’appel en 30 secondes depuis son smartphone ou tablette. En cas d’absence injustifiée ou de retard, les parents reçoivent immédiatement une alerte SMS officielle sur leur téléphone.',
    [
      'Alerte SMS instantanée : Les parents sont informés en temps réel dès la première heure.',
      'Gestion des billets d\'entrée & retards : Traçabilité complète gérée par la Surveillance Générale.',
      'Espace Parents sécurisé : Consultation directe des notes d\'interrogations et du comportement.',
    ],
    C_PRIMARY
  );

  // PILIER 5 : ASSISTANT IA & DÉCROCHAGE
  curY = drawFeatureCard(
    curY,
    '5',
    'Assistant IA Pédagogique & Détection Précoce du Décrochage',
    'EXCLUSIVITÉ ZEKOULABIA',
    'Constater les échecs et abandons en fin d\'année scolaire quand il est déjà trop tard.',
    'L’Intelligence Artificielle analyse en continu la progression des notes et l’assiduité pour détecter les élèves en difficulté dès la 2e séquence, proposer des plans de remédiation et orienter vers les séries adaptées (A, C, D, TI, STT).',
    [
      'Alertes proactives : Identification automatique des signaux faibles de décrochage.',
      'Aide aux appréciations : Suggestions personnalisées pour les livrets scolaires et conseils.',
      'Orientation scolaire guidée : Tests d’aptitude et fiches de profil conformes MINESEC.',
    ],
    C_GOLD
  );

  // PILIER 6 : INSCRIPTIONS DÉMATÉRIALISÉES
  curY = drawFeatureCard(
    curY,
    '6',
    'Inscriptions Express & Dossiers Numériques Centralisés',
    'RENTREE SANS STRESS',
    'Piles de dossiers papier égarés, actes de naissance perdus et ressaisies manuelles pénibles.',
    'Dématérialisation complète du processus de rentrée : enregistrement rapide, numérisation des pièces justificatives (acte de naissance, carnet de vaccination, bulletins antérieurs) et import massif d’effectifs sous Excel.',
    [
      'Import Excel en 1 clic : Intégrez vos listes d\'élèves en quelques secondes sans ressaisie.',
      'Fiche d\'inscription officielle : Génération automatique de la fiche MINESEC avec photo.',
      'Archivage sécurisé : Dossier scolaire numérique conservé pendant toute la scolarité de l\'élève.',
    ],
    C_FOREST
  );

  // Encadré Réalités Cameroun
  const specY = curY;
  const specHeight = 62;
  doc.roundedRect(36, specY, contentWidth, specHeight, 6).fill('#fbf7f2');
  doc.roundedRect(36, specY, contentWidth, specHeight, 6).lineWidth(1).stroke(C_BORDER);
  doc.roundedRect(36, specY, 4, specHeight, 2).fill(C_GOLD);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(C_FOREST)
     .text('⚡ Une Conception Robuste, Adaptée aux Réalités du Terrain au Cameroun', 48, specY + 8);

  const specColW = (contentWidth - 24) / 3;
  // Item 1
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C_PRIMARY).text('📶 Mode Hors-Ligne (PWA)', 48, specY + 24);
  doc.font('Helvetica').fontSize(7.2).fillColor(C_TEXT_MUTED).text('Continue de fonctionner même en cas de coupure Internet ou réseau mobile instable.', 48, specY + 36, { width: specColW - 10 });

  // Item 2
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C_PRIMARY).text('🔒 Sécurité & Rôles Étanches', 48 + specColW, specY + 24);
  doc.font('Helvetica').fontSize(7.2).fillColor(C_TEXT_MUTED).text('Accès cloisonnés : Proviseur, Censeurs, Intendant, Secrétaires, Enseignants, Parents.', 48 + specColW, specY + 36, { width: specColW - 10 });

  // Item 3
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C_PRIMARY).text('🗣️ Bilinguisme Natif (FR / EN)', 48 + specColW * 2, specY + 24);
  doc.font('Helvetica').fontSize(7.2).fillColor(C_TEXT_MUTED).text('Parfaite parité pour les lycées d\'enseignement général, technique et bilingues.', 48 + specColW * 2, specY + 36, { width: specColW - 10 });

  // Offre Démo Gratuite
  const demoY = specY + specHeight + 10;
  const demoHeight = 44;
  doc.roundedRect(36, demoY, contentWidth, demoHeight, 6).fill(C_PRIMARY_LIGHT);
  doc.roundedRect(36, demoY, contentWidth, demoHeight, 6).lineWidth(1.2).stroke(C_PRIMARY);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(C_PRIMARY_DARK).text('🎁 Offre Spéciale Établissements Partenaires', 48, demoY + 8);
  doc.font('Helvetica').fontSize(8).fillColor(C_PRIMARY_DARK)
     .text('Bénéficiez d’une démonstration gratuite de 30 minutes au sein de votre établissement ou en visioconférence, avec simulation sur un échantillon de vos classes réelles et accompagnement personnalisé.', 48, demoY + 22, { width: contentWidth - 140, lineGap: 1.5 });

  // Badge Démo Offerte
  const freeBadgeW = 105;
  doc.roundedRect(pageWidth - 36 - freeBadgeW - 12, demoY + 11, freeBadgeW, 22, 11).fill(C_PRIMARY);
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff')
     .text('DÉMO OFFERTE', pageWidth - 36 - freeBadgeW - 12, demoY + 17, { width: freeBadgeW, align: 'center' });

  // Carte de Contact Professionnel (Ndzana Christophe)
  const contactY = demoY + demoHeight + 10;
  const contactHeight = 100;
  doc.roundedRect(36, contactY, contentWidth, contactHeight, 8).fill(C_FOREST);
  doc.roundedRect(36, contactY, contentWidth, contactHeight, 8).lineWidth(1).stroke(C_GOLD);

  // Colonne Gauche : Interlocuteur
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#f4c475').text('Contactez votre Conseiller Dédié', 50, contactY + 12);
  doc.font('Helvetica').fontSize(8).fillColor('#d1c7bc')
     .text('Pour organiser une présentation devant votre conseil de direction ou programmer un déploiement, contactez directement votre représentant :', 50, contactY + 28, { width: contentWidth / 2 - 20, lineGap: 1.5 });

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#ffffff').text('Ndzana Christophe', 50, contactY + 62);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#a7f3d0').text('Conseiller Déploiement & Partenariats Éducatifs', 50, contactY + 77);

  // Ligne verticale de séparation
  const sepX = 36 + contentWidth / 2 + 10;
  doc.rect(sepX, contactY + 12, 1, contactHeight - 24).fill('rgba(255,255,255,0.2)');

  // Colonne Droite : Coordonnées
  const rightX = sepX + 16;
  let infoY = contactY + 14;

  // Téléphone / WhatsApp
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#9ca3af').text('TÉLÉPHONE / WHATSAPP', rightX, infoY);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff').text('+237 695 55 78 91', rightX, infoY + 10);
  infoY += 28;

  // Email
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#9ca3af').text('COURRIER ÉLECTRONIQUE', rightX, infoY);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text('ndzanachristophe12@gmail.com', rightX, infoY + 10);
  infoY += 26;

  // Plateforme
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#9ca3af').text('PLATEFORME OFFICIELLE', rightX, infoY);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#f4c475').text('ZekoulABia · Cameroun', rightX, infoY + 10);

  // Footer Page 2
  doc.rect(36, 750, contentWidth, 0.8).fill(C_BORDER);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C_FOREST).text('ZekoulABia · Yaoundé / Douala · Cameroun · Tous droits réservés', 36, 758);
  doc.font('Helvetica').fontSize(7.5).fillColor(C_TEXT_LIGHT).text('Page 2 / 2 · Document Commercial Réservé aux Établissements', pageWidth - 36 - 220, 758, { width: 220, align: 'right' });

  doc.end();

  stream.on('finish', () => {
    console.log(`PDF généré avec succès à l'emplacement : ${outputPath}`);
  });
}

const targetPath = path.resolve('docs/prospectus/Prospectus_ZekoulABia_Ndzana_Christophe.pdf');
buildProspectusPdf(targetPath);

