/**
 * Seed unique : enregistre le fichier officiel 1-DPPC-MINESEC-SECONDAIRE-2022.xls comme
 * StatisticalCampaignTemplate actif, et peuple CampaignFieldMapping (registre des champs
 * couverts, à but de documentation/audit — la résolution effective des valeurs se fait par
 * code, voir resolveAutoFields.ts / minesecEsgFieldMap.ts).
 *
 * NOTE (V2.14) : ce seed documente Identification/Infra/Financement/ESG_Fr.
 * La résolution runtime couvre aussi Students_ESG_Eng, ESTP Fr/Eng,
 * Manuels-Didactics, Themes_Tranversaux, Personnels — voir GenererDeclarationStatistiqueMinesecUseCase.
 *
 * À exécuter une fois : bun scripts/seed-minesec-template.ts
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { ESG_FIELD_MAPPING } from '../src/application/statisticalCampaign/minesecEsgFieldMap';
import { IDENTIFICATION_FIELDS, INFRASTRUCTURE_FIELDS, FINANCEMENT_FIELDS } from '../src/application/statisticalCampaign/minesecFixedFieldMap';

const prisma = new PrismaClient();

async function main() {
  const sourceFile = path.resolve(process.cwd(), '..', '1-DPPC-MINESEC-SECONDAIRE-2022.xls');
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Fichier source introuvable : ${sourceFile}`);
  }

  const templateDir = path.resolve(process.cwd(), 'storage', 'statistical-templates');
  fs.mkdirSync(templateDir, { recursive: true });
  const destFile = path.join(templateDir, '1-DPPC-MINESEC-SECONDAIRE-2022.xls');
  fs.copyFileSync(sourceFile, destFile);

  // Désactive tout ancien template MINESEC actif (au cas où ce script est relancé)
  await prisma.statisticalCampaignTemplate.updateMany({
    where: { ministry: 'MINESEC', isActive: true },
    data: { isActive: false },
  });

  const template = await prisma.statisticalCampaignTemplate.create({
    data: {
      ministry: 'MINESEC',
      year: '2022',
      fileName: '1-DPPC-MINESEC-SECONDAIRE-2022.xls',
      filePath: destFile,
      fileFormat: 'XLS_LEGACY_BIFF8',
      isActive: true,
    },
  });

  const rows: any[] = [];

  for (const f of IDENTIFICATION_FIELDS) {
    rows.push({
      templateId: template.id,
      sheetName: f.sheetName,
      fieldCode: f.fieldCode,
      fieldLabel: f.fieldLabel,
      cellReference: f.cellReference,
      dataType: 'TEXT',
      category: f.category,
      zekoulabiaSource: f.category === 'A_AUTO' ? 'School (champ direct)' : `SchoolStatisticalSupplement.${f.supplementKey}`,
    });
  }
  for (const f of INFRASTRUCTURE_FIELDS) {
    rows.push({
      templateId: template.id,
      sheetName: f.sheetName,
      fieldCode: f.fieldCode,
      fieldLabel: f.fieldLabel,
      cellReference: f.cellReference,
      dataType: 'NUMBER',
      category: f.category,
      zekoulabiaSource: `SchoolStatisticalSupplement.${f.supplementKey}`,
    });
  }
  for (const f of FINANCEMENT_FIELDS) {
    rows.push({
      templateId: template.id,
      sheetName: f.sheetName,
      fieldCode: f.fieldCode,
      fieldLabel: f.fieldLabel,
      cellReference: f.cellReference,
      dataType: 'TEXT',
      category: f.category,
      zekoulabiaSource: `SchoolStatisticalSupplement.${f.supplementKey}`,
    });
  }
  for (const e of ESG_FIELD_MAPPING) {
    if (e.meta.track === 'NON_COUVERT') continue; // Anglais Renforcé — jamais écrit, pas dans le registre
    if (e.fillesCell) {
      rows.push({
        templateId: template.id,
        sheetName: 'Eleves_ESG_Fr',
        fieldCode: e.fieldCode,
        fieldLabel: `${e.kind} — ${e.levelLabel} (Filles)`,
        cellReference: e.fillesCell,
        dataType: 'NUMBER',
        category: 'A_AUTO',
        zekoulabiaSource: 'StudentProfile agrégé (Class.level/serie/filiere, lv2Subject, gender)',
      });
    }
    if (e.garconsCell) {
      rows.push({
        templateId: template.id,
        sheetName: 'Eleves_ESG_Fr',
        fieldCode: e.fieldCode,
        fieldLabel: `${e.kind} — ${e.levelLabel} (Garçons)`,
        cellReference: e.garconsCell,
        dataType: 'NUMBER',
        category: 'A_AUTO',
        zekoulabiaSource: 'StudentProfile agrégé (Class.level/serie/filiere, lv2Subject, gender)',
      });
    }
  }

  await prisma.campaignFieldMapping.createMany({ data: rows, skipDuplicates: true });

  console.log(`Template MINESEC 2022 enregistré (id=${template.id}), ${rows.length} champs de mapping créés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
