/**
 * Liste les onglets du template MINESEC officiel (déchiffré via xlsEngine).
 * Usage : bun scripts/list-minesec-sheets.ts
 * Option : TEMPLATE_PATH=/chemin/vers/1-DPPC-MINESEC-SECONDAIRE-2022.xls
 */
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { decryptTemplate, cleanupSession } from '../src/application/statisticalCampaign/xlsEngine.ts';

const prisma = new PrismaClient();

async function main() {
  let filePath = process.env.TEMPLATE_PATH;
  if (!filePath) {
    const t = await prisma.statisticalCampaignTemplate.findFirst({
      where: { ministry: 'MINESEC', isActive: true },
    });
    filePath = (t as any)?.filePath;
  }
  if (!filePath || !fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), 'storage', 'statistical-templates', '1-DPPC-MINESEC-SECONDAIRE-2022.xls');
  }
  if (!filePath || !fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), '..', '1-DPPC-MINESEC-SECONDAIRE-2022.xls');
  }
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Template introuvable: ${filePath}`);
  }

  const session = await decryptTemplate(filePath);
  try {
    const names = (session.workbook.worksheets as any[]).map((ws: any) => ws.name);
    console.log(JSON.stringify({ filePath, count: names.length, sheets: names }, null, 2));
  } finally {
    cleanupSession(session);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
