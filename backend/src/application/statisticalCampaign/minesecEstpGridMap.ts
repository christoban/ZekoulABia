/**
 * Grille dynamique des specialites techniques (Eleves_ESTP_Fr, codes 2319+). Chaque bloc
 * annee/sous-bloc offre un nombre fixe de "creneaux" (paires colonnes Filles/Garcons) ou
 * l ecole peut placer une specialite au choix (parmi les 89 du catalogue officiel) -- ce
 * n est PAS un mapping fixe specialite->colonne, la position est libre. Extraction
 * auto-verifiee (creneaux dont Filles/Garcons sont des formules exclus, ex. colonne
 * "Total [annee] A").
 *
 * Categorie C_MANUAL integrale pour cette phase (voir decision actee : aucune
 * correspondance fiable entre les ~12 filieres internes ZekoulABia et les 89 specialites
 * officielles MINESEC).
 */

export interface EstpGridBlock {
  blockLabel: string;
  sexeRow: number;
  nameRow: number; // ligne ou ecrire l acronyme de la specialite (texte libre/dropdown)
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
export const ESTP_GRID_BLOCKS: EstpGridBlock[] = [
  {
    "blockLabel": "1ère année",
    "sexeRow": 43,
    "nameRow": 41,
    "divRow": 42,
    "divCode": "2319",
    "totalRow": 44,
    "totalCode": "2320",
    "redoubRow": 45,
    "redoubCode": "2321",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "1ère année suite",
    "sexeRow": 50,
    "nameRow": 48,
    "divRow": 49,
    "divCode": "2322",
    "totalRow": 51,
    "totalCode": "2323",
    "redoubRow": 52,
    "redoubCode": "2324",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "2ème année",
    "sexeRow": 57,
    "nameRow": 55,
    "divRow": 56,
    "divCode": "2325",
    "totalRow": 58,
    "totalCode": "2326",
    "redoubRow": 59,
    "redoubCode": "2327",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "2ème année suite",
    "sexeRow": 64,
    "nameRow": 62,
    "divRow": 63,
    "divCode": "2328",
    "totalRow": 65,
    "totalCode": "2329",
    "redoubRow": 66,
    "redoubCode": "2330",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "3ème année",
    "sexeRow": 71,
    "nameRow": 69,
    "divRow": 70,
    "divCode": "2331",
    "totalRow": 72,
    "totalCode": "2332",
    "redoubRow": 73,
    "redoubCode": "2333",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "3ème année suite",
    "sexeRow": 78,
    "nameRow": 76,
    "divRow": 77,
    "divCode": "2334",
    "totalRow": 79,
    "totalCode": "2335",
    "redoubRow": 80,
    "redoubCode": "2336",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "4ème année",
    "sexeRow": 85,
    "nameRow": 83,
    "divRow": 84,
    "divCode": "2337",
    "totalRow": 86,
    "totalCode": "2338",
    "redoubRow": 87,
    "redoubCode": "2339",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "4ème année suite",
    "sexeRow": 92,
    "nameRow": 90,
    "divRow": 91,
    "divCode": "2340",
    "totalRow": 93,
    "totalCode": "2341",
    "redoubRow": 94,
    "redoubCode": "2342",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "2nde T",
    "sexeRow": 102,
    "nameRow": 100,
    "divRow": 101,
    "divCode": "2343",
    "totalRow": 103,
    "totalCode": "2344",
    "redoubRow": 104,
    "redoubCode": "2345",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "2nde T suite",
    "sexeRow": 109,
    "nameRow": 107,
    "divRow": 108,
    "divCode": "2346",
    "totalRow": 110,
    "totalCode": "2347",
    "redoubRow": 111,
    "redoubCode": "2348",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "2nde BT",
    "sexeRow": 116,
    "nameRow": 114,
    "divRow": 115,
    "divCode": "2349",
    "totalRow": 117,
    "totalCode": "236150",
    "redoubRow": 118,
    "redoubCode": "2351",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "2nde BT suite",
    "sexeRow": 123,
    "nameRow": 121,
    "divRow": 122,
    "divCode": "2352",
    "totalRow": 124,
    "totalCode": "2353",
    "redoubRow": 125,
    "redoubCode": "2354",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "1ère T",
    "sexeRow": 131,
    "nameRow": 129,
    "divRow": 130,
    "divCode": "2355",
    "totalRow": 132,
    "totalCode": "2356",
    "redoubRow": 133,
    "redoubCode": "2357",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "1ère T suite",
    "sexeRow": 138,
    "nameRow": 136,
    "divRow": 137,
    "divCode": "2358",
    "totalRow": 139,
    "totalCode": "2359",
    "redoubRow": 140,
    "redoubCode": "2360",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "1ère BT",
    "sexeRow": 145,
    "nameRow": 143,
    "divRow": 144,
    "divCode": "2361",
    "totalRow": 146,
    "totalCode": "2362",
    "redoubRow": 147,
    "redoubCode": "2363",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "1ère BT suite",
    "sexeRow": 152,
    "nameRow": 150,
    "divRow": 151,
    "divCode": "2364",
    "totalRow": 153,
    "totalCode": "2365",
    "redoubRow": 154,
    "redoubCode": "2366",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "Tle T",
    "sexeRow": 160,
    "nameRow": 158,
    "divRow": 159,
    "divCode": "2367",
    "totalRow": 161,
    "totalCode": "2268",
    "redoubRow": 162,
    "redoubCode": "2369",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "Tle T suite",
    "sexeRow": 167,
    "nameRow": 165,
    "divRow": 166,
    "divCode": "2370",
    "totalRow": 168,
    "totalCode": "2371",
    "redoubRow": 169,
    "redoubCode": "2372",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  },
  {
    "blockLabel": "Tle BT",
    "sexeRow": 174,
    "nameRow": 172,
    "divRow": 173,
    "divCode": "2373",
    "totalRow": 175,
    "totalCode": "2374",
    "redoubRow": 176,
    "redoubCode": "2375",
    "nbSlots": 10,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "V",
      "W"
    ]
  },
  {
    "blockLabel": "Tle BT suite",
    "sexeRow": 181,
    "nameRow": 179,
    "divRow": 180,
    "divCode": "2376",
    "totalRow": 182,
    "totalCode": "2377",
    "redoubRow": 183,
    "redoubCode": "2378",
    "nbSlots": 9,
    "firstSlotCols": [
      "D",
      "E"
    ],
    "lastSlotCols": [
      "T",
      "U"
    ]
  }
];

/** Années d'étude valides + capacité totale de créneaux (bloc principal + "suite"). */
export function getEstpAnneesEtude(): { anneeEtude: string; capaciteMax: number }[] {
  const byBase = new Map<string, number>();
  for (const block of ESTP_GRID_BLOCKS) {
    const base = block.blockLabel.replace(/ suite$/, '');
    byBase.set(base, (byBase.get(base) ?? 0) + block.nbSlots);
  }
  return [...byBase.entries()].map(([anneeEtude, capaciteMax]) => ({ anneeEtude, capaciteMax }));
}
