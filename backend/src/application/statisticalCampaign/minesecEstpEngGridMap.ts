/**
 * Grille dynamique des specialites techniques (Students_ESTP_Eng, codes 2419-2436).
 * Miroir anglophone de minesecEstpGridMap.ts (codes 2319-2378).
 * Meme mecanique de creneaux : chaque bloc = liste de paires colonnes Filles/Garcons.
 * Categorie C_MANUAL integrale pour cette phase.
 */

export interface EstpEngGridBlock {
  blockLabel: string;
  sexeRow: number;
  nameRow: number;
  divRow: number;
  divCode: string;
  totalRow: number;
  totalCode: string;
  redoubRow: number;
  redoubCode: string;
  nbSlots: number;
  firstSlotCols: [string, string];
  lastSlotCols: [string, string];
}

export const ESTP_ENG_GRID_BLOCKS: EstpEngGridBlock[] = [
  {
    blockLabel: '1st Year',
    sexeRow: 43, nameRow: 41, divRow: 42, divCode: '2419',
    totalRow: 44, totalCode: '2420', redoubRow: 45, redoubCode: '2421',
    nbSlots: 10, firstSlotCols: ['D', 'E'], lastSlotCols: ['V', 'W'],
  },
  {
    blockLabel: '1st Year suite',
    sexeRow: 50, nameRow: 48, divRow: 49, divCode: '2422',
    totalRow: 51, totalCode: '2423', redoubRow: 52, redoubCode: '2424',
    nbSlots: 9, firstSlotCols: ['D', 'E'], lastSlotCols: ['T', 'U'],
  },
  {
    blockLabel: '2nd Year',
    sexeRow: 57, nameRow: 55, divRow: 56, divCode: '2425',
    totalRow: 58, totalCode: '2426', redoubRow: 59, redoubCode: '2427',
    nbSlots: 10, firstSlotCols: ['D', 'E'], lastSlotCols: ['V', 'W'],
  },
  {
    blockLabel: '2nd Year suite',
    sexeRow: 64, nameRow: 62, divRow: 63, divCode: '2428',
    totalRow: 65, totalCode: '2429', redoubRow: 66, redoubCode: '2430',
    nbSlots: 9, firstSlotCols: ['D', 'E'], lastSlotCols: ['T', 'U'],
  },
  {
    blockLabel: '3rd Year',
    sexeRow: 71, nameRow: 69, divRow: 70, divCode: '2431',
    totalRow: 72, totalCode: '2432', redoubRow: 73, redoubCode: '2433',
    nbSlots: 10, firstSlotCols: ['D', 'E'], lastSlotCols: ['V', 'W'],
  },
  {
    blockLabel: '3rd Year suite',
    sexeRow: 78, nameRow: 76, divRow: 77, divCode: '2434',
    totalRow: 79, totalCode: '2435', redoubRow: 80, redoubCode: '2436',
    nbSlots: 9, firstSlotCols: ['D', 'E'], lastSlotCols: ['T', 'U'],
  },
];

export function getEstpEngAnneesEtude(): { anneeEtude: string; capaciteMax: number }[] {
  const byBase = new Map<string, number>();
  for (const block of ESTP_ENG_GRID_BLOCKS) {
    const base = block.blockLabel.replace(/ suite$/, '');
    byBase.set(base, (byBase.get(base) ?? 0) + block.nbSlots);
  }
  return [...byBase.entries()].map(([anneeEtude, capaciteMax]) => ({ anneeEtude, capaciteMax }));
}
