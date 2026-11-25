/**
 * Dump lignes 1–20 de Atelier_Workshop (valeurs texte) pour relever colonnes/lignes.
 * Usage:
 *   TEMPLATE_PATH=storage/statistical-templates/1-DPPC-MINESEC-SECONDAIRE-2022.xls \
 *   LIBREOFFICE_CONVERT_TIMEOUT_MS=90000 \
 *   bun scripts/dump-atelier-workshop-headers.ts
 */
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { decryptTemplate, cleanupSession } from '../src/application/statisticalCampaign/xlsEngine.ts';

const prisma = new PrismaClient();

function colName(idx0: number): string {
  let n = idx0 + 1;
  let col = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

async function main() {
  let filePath = process.env.TEMPLATE_PATH;
  if (!filePath) {
    const t = await prisma.statisticalCampaignTemplate.findFirst({
      where: { ministry: 'MINESEC', isActive: true },
    });
    filePath = (t as any)?.filePath;
  }
  if (!filePath || !fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), 'storage/statistical-templates/1-DPPC-MINESEC-SECONDAIRE-2022.xls');
  }
  if (!fs.existsSync(filePath!)) throw new Error(`Template introuvable: ${filePath}`);

  const session = await decryptTemplate(filePath!);
  try {
    const ws = session.workbook.getWorksheet('Atelier_Workshop');
    if (!ws) throw new Error('Onglet Atelier_Workshop introuvable');

    const rows: Record<string, unknown>[] = [];
    for (let r = 1; r <= 20; r++) {
      const cells: Record<string, string> = {};
      for (let c = 0; c < 30; c++) {
        const addr = `${colName(c)}${r}`;
        const cell = ws.getCell(addr);
        const v = (cell as any)?.value;
        if (v === null || v === undefined || v === '') continue;
        const text =
          typeof v === 'object' && v !== null && 'result' in (v as object)
            ? String((v as any).result ?? '')
            : typeof v === 'object' && v !== null && 'richText' in (v as object)
              ? ((v as any).richText as { text: string }[]).map((t) => t.text).join('')
              : String(v);
        if (text.trim()) cells[addr] = text.trim().slice(0, 80);
      }
      if (Object.keys(cells).length) rows.push({ row: r, cells });
    }
    console.log(JSON.stringify({ sheet: 'Atelier_Workshop', rows }, null, 2));
  } finally {
    cleanupSession(session);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
