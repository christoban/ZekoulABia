/**
 * APPLICATION — Use case : générer le rapport PDF de synthèse MINEDUB (préscolaire/primaire).
 * Contrairement à MINESEC, aucun blocage strict : les champs manquants sont listés
 * directement dans le PDF, qui reste un support de préparation avant la vraie collecte
 * IAEB — jamais présenté comme un document officiel (bandeau explicite en en-tête).
 */
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import type { StatisticalQueryPort } from '@domain/ports/repositories/StatisticalQueryPort';
import type { MinedubReportRepository } from '@domain/ports/repositories/MinedubReportRepository';
import { resolveEffectifsParNiveau, resolveEffectifsParAge, resolvePersonnelPrimaire } from './resolvePrimaryAutoFields';
import type { ChampNonResoluMinedub, GenererRapportMinedubCommande, GenererRapportMinedubResultat } from './types';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'minedub-reports');

const ZONE_LABELS: Record<string, string> = { URBAINE: 'Urbaine', RURALE: 'Rurale' };
const ORDRE_LABELS: Record<string, string> = {
  PUBLIC: 'Public', PRIVE_CATHOLIQUE: 'Privé catholique', PRIVE_PROTESTANT: 'Privé protestant',
  PRIVE_ISLAMIQUE: 'Privé islamique', PRIVE_LAIC: 'Privé laïc', COMMUNAUTAIRE: 'Communautaire',
};

const INFRA_LABELS: { key: string; label: string }[] = [
  { key: 'sallesClasseOccupees', label: 'Salles de classe occupées' },
  { key: 'sallesClasseNonOccupees', label: 'Salles de classe non occupées' },
  { key: 'salleInformatique', label: 'Salle informatique' },
  { key: 'logementFonction', label: 'Logement de fonction' },
  { key: 'magasins', label: 'Magasins' },
  { key: 'toilettesLatrines', label: 'Toilettes ou latrines' },
];
const INFRA_SUB_KEYS = [
  { key: 'durBon', label: 'Dur — Bon' }, { key: 'durAssezBon', label: 'Dur — Assez bon' }, { key: 'durMauvais', label: 'Dur — Mauvais' },
  { key: 'semiDurBon', label: 'Semi-dur — Bon' }, { key: 'semiDurAssezBon', label: 'Semi-dur — Assez bon' }, { key: 'semiDurMauvais', label: 'Semi-dur — Mauvais' },
  { key: 'provisoireBon', label: 'Provisoire — Bon' }, { key: 'provisoireAssezBon', label: 'Provisoire — Assez bon' }, { key: 'provisoireMauvais', label: 'Provisoire — Mauvais' },
];

export class GenererRapportSyntheseMinedubUseCase {
  constructor(
    private readonly query: StatisticalQueryPort,
    private readonly minedubReportRepository: MinedubReportRepository,
  ) {}

  async execute(cmd: GenererRapportMinedubCommande): Promise<GenererRapportMinedubResultat> {
    const school = await this.query.trouverEcole(cmd.schoolId);
    if (!school) throw new Error('École introuvable');
    const supplement = await this.minedubReportRepository.trouverSupplementPrimaire(cmd.schoolId);

    const champsNonResolus: ChampNonResoluMinedub[] = [];
    const effectifsNiveau = await resolveEffectifsParNiveau(this.query, cmd.schoolId);
    const effectifsAge = await resolveEffectifsParAge(this.query, cmd.schoolId);
    const { rows: personnel, champsNonResolus: personnelGaps } = await resolvePersonnelPrimaire(this.query, cmd.schoolId);
    for (const g of personnelGaps) champsNonResolus.push({ section: 'Personnel enseignant', champ: '—', raison: g });

    if (effectifsNiveau.length === 0) {
      champsNonResolus.push({ section: 'Effectifs élèves', champ: '—', raison: 'Aucun élève actif trouvé dans un niveau primaire (SIL→CM2 / Class1-6) pour cette école.' });
    }

    if (!supplement?.zoneImplantation) champsNonResolus.push({ section: 'Identification', champ: "Zone d'implantation", raison: 'Non renseigné dans le formulaire complémentaire.' });
    if (!supplement?.ordreEnseignement) champsNonResolus.push({ section: 'Identification', champ: "Ordre d'enseignement détaillé", raison: 'Non renseigné dans le formulaire complémentaire.' });
    if (!supplement?.elevesVulnerablesDetail) champsNonResolus.push({ section: 'Élèves vulnérables', champ: '—', raison: "Aucune donnée saisie (réfugiés/déplacés internes/handicapés) — aucun champ individuel n'existe dans ZekoulABia pour ce statut." });
    if (!supplement?.infrastructuresDetail) champsNonResolus.push({ section: 'Infrastructures', champ: '—', raison: 'Non renseigné dans le formulaire complémentaire.' });
    if (!supplement?.commoditesDetail) champsNonResolus.push({ section: 'Commodités', champ: '—', raison: 'Non renseigné dans le formulaire complémentaire.' });
    if (!supplement?.manuelsDetail) champsNonResolus.push({ section: 'Manuels scolaires', champ: '—', raison: 'Non renseigné dans le formulaire complémentaire.' });

    const buffer = await this.buildPdf(school, supplement, effectifsNiveau, effectifsAge, personnel, champsNonResolus);

    const outDir = path.join(STORAGE_DIR, cmd.schoolId);
    fs.mkdirSync(outDir, { recursive: true });
    const fileName = `rapport-minedub-${school.subdomain}-${Date.now()}.pdf`;
    const outputPath = path.join(outDir, fileName);
    fs.writeFileSync(outputPath, buffer);

    const report = await this.minedubReportRepository.creerRapport({
      schoolId: cmd.schoolId,
      generatedBy: cmd.generatedByUserId,
      filePath: outputPath,
      champsNonResolus,
    });

    return { reportId: report.id, filePath: outputPath, champsNonResolus };
  }

  private buildPdf(
    school: NonNullable<Awaited<ReturnType<StatisticalQueryPort['trouverEcole']>>>,
    supplement: Awaited<ReturnType<MinedubReportRepository['trouverSupplementPrimaire']>>,
    effectifsNiveau: Awaited<ReturnType<typeof resolveEffectifsParNiveau>>,
    effectifsAge: Awaited<ReturnType<typeof resolveEffectifsParAge>>,
    personnel: Awaited<ReturnType<typeof resolvePersonnelPrimaire>>['rows'],
    champsNonResolus: ChampNonResoluMinedub[],
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 42 });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Bandeau non-officiel ──
      doc.rect(42, 42, doc.page.width - 84, 46).fill('#fef3c7');
      doc.fillColor('#92400e').fontSize(10).font('Helvetica-Bold').text(
        "DOCUMENT DE TRAVAIL ZEKOULABIA — NON OFFICIEL. Basé sur la structure publique des Annuaires Statistiques MINEDUB. " +
        "À vérifier auprès de votre IAEB avant toute transmission — ne remplace pas le vrai questionnaire papier.",
        52, 52, { width: doc.page.width - 104 },
      );
      doc.fillColor('black').moveDown(3);

      doc.fontSize(16).font('Helvetica-Bold').text('Rapport de préparation statistique MINEDUB', { align: 'center' });
      doc.fontSize(11).font('Helvetica').text(`${school.name}`, { align: 'center' });
      doc.fontSize(9).fillColor('gray').text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });
      doc.fillColor('black').moveDown(1.5);

      // ── Identification ──
      this.sectionTitle(doc, '1. Identification de l\'établissement');
      this.kv(doc, 'Nom', school.name);
      this.kv(doc, 'Ville / Région', `${school.city ?? '—'} / ${school.region ?? '—'}`);
      this.kv(doc, 'Sous-système', school.subsystem === 'ANGLOPHONE' ? 'Anglophone' : school.subsystem === 'BILINGUAL' ? 'Bilingue' : 'Francophone');
      this.kv(doc, "Zone d'implantation", supplement?.zoneImplantation ? ZONE_LABELS[supplement.zoneImplantation] ?? supplement.zoneImplantation : 'Non renseigné');
      this.kv(doc, "Ordre d'enseignement", supplement?.ordreEnseignement ? ORDRE_LABELS[supplement.ordreEnseignement] ?? supplement.ordreEnseignement : 'Non renseigné');
      doc.moveDown(1);

      // ── Effectifs par niveau ──
      this.sectionTitle(doc, '2. Effectifs élèves par niveau et par sexe');
      if (effectifsNiveau.length === 0) {
        this.emptyNote(doc, 'Aucune donnée disponible.');
      } else {
        this.table(doc, ['Niveau', 'Filles', 'Garçons', 'Total'], effectifsNiveau.map((e) => [e.niveau, String(e.filles), String(e.garcons), String(e.total)]));
      }
      doc.moveDown(1);

      // ── Effectifs par âge ──
      this.sectionTitle(doc, '3. Effectifs élèves par âge');
      this.table(doc, ['Âge', 'Filles', 'Garçons'], effectifsAge.map((e) => [e.ageLabel, String(e.filles), String(e.garcons)]));
      doc.moveDown(1);

      // ── Élèves vulnérables ──
      this.sectionTitle(doc, '4. Élèves vulnérables (réfugiés, déplacés internes, handicapés)');
      if (supplement?.elevesVulnerablesDetail) {
        const detail = supplement.elevesVulnerablesDetail as Record<string, Record<string, unknown>>;
        const rows = Object.entries(detail).map(([niveau, v]) => [
          niveau, String(v['refugiesF'] ?? 0), String(v['refugiesG'] ?? 0), String(v['deplacesF'] ?? 0), String(v['deplacesG'] ?? 0), String(v['handicapesF'] ?? 0), String(v['handicapesG'] ?? 0),
        ]);
        this.table(doc, ['Niveau', 'Réf. F', 'Réf. G', 'Dépl. F', 'Dépl. G', 'Handi. F', 'Handi. G'], rows);
      } else {
        this.emptyNote(doc, 'Non renseigné — voir formulaire complémentaire.');
      }
      doc.moveDown(1);

      if (doc.y > 600) doc.addPage();

      // ── Personnel enseignant ──
      this.sectionTitle(doc, '5. Personnel enseignant');
      if (personnel.length === 0) {
        this.emptyNote(doc, 'Aucun personnel actif trouvé.');
      } else {
        this.table(doc, ['Nom', 'Sexe', 'Fonction', 'Statut', 'Diplôme'], personnel.map((p) => [p.nomComplet, p.genre ?? '—', p.fonction ?? '—', p.typeContrat ?? '—', p.diplome ?? '—']));
      }
      doc.moveDown(1);

      if (doc.y > 550) doc.addPage();

      // ── Infrastructures ──
      this.sectionTitle(doc, '6. Infrastructures');
      if (supplement?.infrastructuresDetail) {
        const detail = supplement.infrastructuresDetail as Record<string, Record<string, unknown>>;
        for (const infra of INFRA_LABELS) {
          const row = detail[infra.key];
          if (!row) continue;
          const total = INFRA_SUB_KEYS.reduce((sum, k) => sum + (Number(row[k.key]) || 0), 0);
          const width = doc.page.width - 84;
          doc.fontSize(10).font('Helvetica-Bold').text(`${infra.label} — total : ${total}`, 42, doc.y, { width });
          doc.fontSize(9).font('Helvetica').text(INFRA_SUB_KEYS.map((k) => `${k.label}: ${row[k.key] ?? 0}`).join('  |  '), 42, doc.y, { width });
          doc.moveDown(0.3);
        }
      } else {
        this.emptyNote(doc, 'Non renseigné — voir formulaire complémentaire.');
      }
      doc.moveDown(1);

      if (doc.y > 600) doc.addPage();

      // ── Champs non résolus ──
      this.sectionTitle(doc, 'Champs non résolus — à compléter avant transmission');
      if (champsNonResolus.length === 0) {
        this.emptyNote(doc, 'Aucun.');
      } else {
        const width = doc.page.width - 84;
        for (const c of champsNonResolus) {
          doc.fontSize(9).font('Helvetica-Bold').text(`${c.section}${c.champ !== '—' ? ' — ' + c.champ : ''}`, 42, doc.y, { width });
          doc.fontSize(9).font('Helvetica').fillColor('gray').text(c.raison, 42, doc.y, { width });
          doc.fillColor('black').moveDown(0.3);
        }
      }

      doc.end();
    });
  }

  private sectionTitle(doc: PDFKit.PDFDocument, title: string) {
    doc.x = 42;
    doc.fontSize(13).font('Helvetica-Bold').text(title, 42, doc.y, { width: doc.page.width - 84 });
    doc.moveDown(0.4);
  }
  private kv(doc: PDFKit.PDFDocument, key: string, value: string) {
    doc.x = 42;
    doc.fontSize(10).font('Helvetica-Bold').text(`${key} : `, 42, doc.y, { continued: true }).font('Helvetica').text(value);
  }
  private emptyNote(doc: PDFKit.PDFDocument, text: string) {
    doc.x = 42;
    doc.fontSize(9).font('Helvetica-Oblique').fillColor('gray').text(text, 42, doc.y, { width: doc.page.width - 84 });
    doc.fillColor('black');
  }
  private table(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
    const startX = 42;
    const colWidth = (doc.page.width - 84) / headers.length;
    const lineHeight = 16;

    doc.fontSize(9).font('Helvetica-Bold');
    let y = doc.y;
    headers.forEach((h, i) => doc.text(h, startX + i * colWidth, y, { width: colWidth, lineBreak: false }));
    y += lineHeight;
    doc.moveTo(startX, y - 3).lineTo(doc.page.width - 42, y - 3).strokeColor('#cccccc').stroke();

    doc.font('Helvetica');
    for (const row of rows) {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = doc.y;
      }
      row.forEach((cell, i) => doc.text(cell, startX + i * colWidth, y, { width: colWidth, lineBreak: false }));
      y += lineHeight;
    }
    doc.y = y;
  }
}
