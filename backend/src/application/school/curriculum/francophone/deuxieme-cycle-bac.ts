// ─── 2e cycle francophone : Coefficients BAC ────────────────────────────────
// Source officielle : Arrêté N° 92/22 MINESEC du 17 Mars 2022
// Applicable à tous les templates secondaires francophones (templateCode '__ALL__')
// Séries couvertes : A1, A2, A3, A4, A5, ABI, C, D, E, TI, SH, AC
//
// Groupe 1 = matières principales  |  Groupe 2 = matières transversales
// ⚠️ Séries D et TI ne démarrent qu'en 1ère (aucune entrée SECONDE pour elles)

export type BacEntry = {
  subjectName: string;
  serie: string;
  niveau: 'SECONDE' | 'PREMIERE' | 'TERMINALE';
  coefficient: number;
  groupe: number;
  templateCode: string;
  source: string;
  isOfficialMinesec: boolean;
};

const S = 'SECONDE' as const, P = 'PREMIERE' as const, T = 'TERMINALE' as const;
const G1 = 1, G2 = 2;

function bc(sn: string, serie: string, n: typeof S | typeof P | typeof T, c: number, g: number): BacEntry {
  return {
    subjectName: sn, serie, niveau: n, coefficient: c, groupe: g,
    templateCode: '__ALL__',
    source: 'Arrêté N° 92/22 MINESEC du 17 Mars 2022',
    isOfficialMinesec: true,
  };
}

export const bacCoefficients: BacEntry[] = [

  // ══════════════════ SÉRIE A1 ══════════════════════════════════════════════
  bc("Latin",         "A1", S, 3, G1), bc("Latin",         "A1", P, 3, G1), bc("Latin",         "A1", T, 3, G1),
  bc("Grec",          "A1", S, 3, G1), bc("Grec",          "A1", P, 3, G1), bc("Grec",          "A1", T, 3, G1),
  bc("Littérature",   "A1", S, 3, G1), bc("Littérature",   "A1", P, 3, G1), bc("Littérature",   "A1", T, 3, G1),
  bc("Informatique",                          "A1", S, 2, G2), bc("Informatique",                          "A1", P, 2, G2), bc("Informatique",                          "A1", T, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "A1", S, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "A1", P, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "A1", T, 2, G2),
  bc("EPS",             "A1", S, 2, G2), bc("EPS",             "A1", P, 2, G2), bc("EPS",             "A1", T, 2, G2),
  bc("Mathématiques",   "A1", S, 2, G2), bc("Mathématiques",   "A1", P, 2, G2), bc("Mathématiques",   "A1", T, 2, G2),
  bc("Sciences",        "A1", S, 1, G2), bc("Sciences",        "A1", P, 1, G2), bc("Sciences",        "A1", T, 1, G2),
  bc("Langues Nationales","A1", S, 1, G2), bc("Langues Nationales","A1", P, 1, G2), bc("Langues Nationales","A1", T, 1, G2),
  bc("Cultures Nationales","A1", S, 1, G2), bc("Cultures Nationales","A1", P, 1, G2), bc("Cultures Nationales","A1", T, 1, G2),
  bc("Éducation Artistique et Culturelle","A1", S, 1, G2), bc("Éducation Artistique et Culturelle","A1", P, 1, G2), bc("Éducation Artistique et Culturelle","A1", T, 1, G2),
  bc("Travail Manuel",  "A1", S, 1, G2), bc("Travail Manuel",  "A1", P, 1, G2), bc("Travail Manuel",  "A1", T, 1, G2),

  // ══════════════════ SÉRIE A2 ══════════════════════════════════════════════
  bc("Latin",            "A2", S, 3, G1), bc("Latin",            "A2", P, 3, G1), bc("Latin",            "A2", T, 3, G1),
  bc("LV2",              "A2", S, 3, G1), bc("LV2",              "A2", P, 3, G1), bc("LV2",              "A2", T, 3, G1),
  bc("Littérature",      "A2", S, 3, G1), bc("Littérature",      "A2", P, 3, G1), bc("Littérature",      "A2", T, 3, G1),
  bc("Langue Française", "A2", S, 2, G1), bc("Langue Française", "A2", P, 2, G1), bc("Langue Française", "A2", T, 2, G1),
  bc("Philosophie",      "A2", S, 2, G1), bc("Philosophie",      "A2", P, 2, G1), bc("Philosophie",      "A2", T, 4, G1), // ⚠️ 4 en Tle
  bc("Anglais",          "A2", S, 4, G1), bc("Anglais",          "A2", P, 4, G1), bc("Anglais",          "A2", T, 4, G1),
  bc("Informatique",              "A2", S, 2, G2), bc("Informatique",              "A2", P, 2, G2), bc("Informatique",              "A2", T, 1, G2), // ⚠️ 1 en Tle
  bc("Éducation à la Citoyenneté et à la Morale", "A2", S, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "A2", P, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "A2", T, 2, G2),
  bc("EPS",               "A2", S, 2, G2), bc("EPS",               "A2", P, 2, G2), bc("EPS",               "A2", T, 2, G2),
  bc("Histoire",          "A2", S, 2, G2), bc("Histoire",          "A2", P, 2, G2), bc("Histoire",          "A2", T, 2, G2),
  bc("Géographie",        "A2", S, 2, G2), bc("Géographie",        "A2", P, 2, G2), bc("Géographie",        "A2", T, 2, G2),
  bc("Sciences",          "A2", S, 1, G2), bc("Sciences",          "A2", P, 1, G2), bc("Sciences",          "A2", T, 1, G2),
  bc("Langues Nationales","A2", S, 1, G2), bc("Langues Nationales","A2", P, 1, G2), bc("Langues Nationales","A2", T, 1, G2),
  bc("Cultures Nationales","A2", S, 1, G2), bc("Cultures Nationales","A2", P, 1, G2), bc("Cultures Nationales","A2", T, 1, G2),
  bc("Éducation Artistique et Culturelle","A2", S, 1, G2), bc("Éducation Artistique et Culturelle","A2", P, 1, G2), bc("Éducation Artistique et Culturelle","A2", T, 1, G2),
  bc("Travail Manuel",    "A2", S, 1, G2), bc("Travail Manuel",    "A2", P, 1, G2), bc("Travail Manuel",    "A2", T, 1, G2),

  // ══════════════════ SÉRIE A3 ══════════════════════════════════════════════
  bc("Latin",            "A3", S, 4, G1), bc("Latin",            "A3", P, 4, G1), bc("Latin",            "A3", T, 4, G1),
  bc("Littérature",      "A3", S, 3, G1), bc("Littérature",      "A3", P, 3, G1), bc("Littérature",      "A3", T, 3, G1),
  bc("Langue Française", "A3", S, 2, G1), bc("Langue Française", "A3", P, 2, G1), bc("Langue Française", "A3", T, 2, G1),
  bc("Philosophie",      "A3", S, 2, G1), bc("Philosophie",      "A3", P, 2, G1), bc("Philosophie",      "A3", T, 4, G1), // ⚠️ 4 en Tle
  bc("Anglais",          "A3", S, 4, G1), bc("Anglais",          "A3", P, 4, G1), bc("Anglais",          "A3", T, 4, G1),
  bc("Informatique",              "A3", S, 2, G2), bc("Informatique",              "A3", P, 2, G2), bc("Informatique",              "A3", T, 1, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "A3", S, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "A3", P, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "A3", T, 2, G2),
  bc("EPS",               "A3", S, 2, G2), bc("EPS",               "A3", P, 2, G2), bc("EPS",               "A3", T, 2, G2),
  bc("Histoire",          "A3", S, 2, G2), bc("Histoire",          "A3", P, 2, G2), bc("Histoire",          "A3", T, 2, G2),
  bc("Géographie",        "A3", S, 2, G2), bc("Géographie",        "A3", P, 2, G2), bc("Géographie",        "A3", T, 2, G2),
  bc("Sciences",          "A3", S, 1, G2), bc("Sciences",          "A3", P, 1, G2), bc("Sciences",          "A3", T, 1, G2),
  bc("Langues Nationales","A3", S, 1, G2), bc("Langues Nationales","A3", P, 1, G2), bc("Langues Nationales","A3", T, 1, G2),
  bc("Cultures Nationales","A3", S, 1, G2), bc("Cultures Nationales","A3", P, 1, G2), bc("Cultures Nationales","A3", T, 1, G2),
  bc("Éducation Artistique et Culturelle","A3", S, 1, G2), bc("Éducation Artistique et Culturelle","A3", P, 1, G2), bc("Éducation Artistique et Culturelle","A3", T, 1, G2),
  bc("Travail Manuel",    "A3", S, 1, G2), bc("Travail Manuel",    "A3", P, 1, G2), bc("Travail Manuel",    "A3", T, 1, G2),

  // ══════════════════ SÉRIE A4 ══════════════════════════════════════════════
  // LV2 = langue vivante 2 (Arabe, Espagnol, Allemand...) → remplacée dans le code par la langue réelle de la classe
  bc("Littérature",      "A4", S, 3, G1), bc("Littérature",      "A4", P, 3, G1), bc("Littérature",      "A4", T, 3, G1),
  bc("Langue Française", "A4", S, 2, G1), bc("Langue Française", "A4", P, 2, G1), bc("Langue Française", "A4", T, 2, G1),
  bc("Philosophie",      "A4", S, 2, G1), bc("Philosophie",      "A4", P, 2, G1), bc("Philosophie",      "A4", T, 4, G1), // ⚠️ 4 en Tle
  bc("Anglais",          "A4", S, 4, G1), bc("Anglais",          "A4", P, 4, G1), bc("Anglais",          "A4", T, 4, G1),
  bc("LV2",              "A4", S, 3, G1), bc("LV2",              "A4", P, 3, G1), bc("LV2",              "A4", T, 3, G1),
  bc("Géographie",               "A4", S, 2, G2), bc("Géographie",               "A4", P, 2, G2), bc("Géographie",               "A4", T, 2, G2),
  bc("Histoire",                 "A4", S, 2, G2), bc("Histoire",                 "A4", P, 2, G2), bc("Histoire",                 "A4", T, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale","A4", S, 2, G2), bc("Éducation à la Citoyenneté et à la Morale","A4", P, 2, G2), bc("Éducation à la Citoyenneté et à la Morale","A4", T, 2, G2),
  bc("Informatique",             "A4", S, 2, G2), bc("Informatique",             "A4", P, 2, G2), bc("Informatique",             "A4", T, 2, G2),
  bc("EPS",            "A4", S, 2, G2), bc("EPS",            "A4", P, 2, G2), bc("EPS",            "A4", T, 2, G2),
  bc("Mathématiques",  "A4", S, 2, G2), bc("Mathématiques",  "A4", P, 2, G2), bc("Mathématiques",  "A4", T, 2, G2),
  bc("Sciences",       "A4", S, 1, G2), bc("Sciences",       "A4", P, 1, G2), bc("Sciences",       "A4", T, 1, G2),
  bc("Langues Nationales","A4", S, 1, G2), bc("Langues Nationales","A4", P, 1, G2), bc("Langues Nationales","A4", T, 1, G2),
  bc("Cultures Nationales","A4", S, 1, G2), bc("Cultures Nationales","A4", P, 1, G2), bc("Cultures Nationales","A4", T, 1, G2),
  bc("Éducation Artistique et Culturelle","A4", S, 1, G2), bc("Éducation Artistique et Culturelle","A4", P, 1, G2), bc("Éducation Artistique et Culturelle","A4", T, 1, G2),
  bc("Travail Manuel", "A4", S, 1, G2), bc("Travail Manuel", "A4", P, 1, G2), bc("Travail Manuel", "A4", T, 1, G2),

  // ══════════════════ SÉRIE A5 ══════════════════════════════════════════════
  bc("Littérature",      "A5", S, 3, G1), bc("Littérature",      "A5", P, 3, G1), bc("Littérature",      "A5", T, 3, G1),
  bc("Langue Française", "A5", S, 2, G1), bc("Langue Française", "A5", P, 2, G1), bc("Langue Française", "A5", T, 2, G1),
  bc("Philosophie",      "A5", S, 2, G1), bc("Philosophie",      "A5", P, 2, G1), bc("Philosophie",      "A5", T, 2, G1), // reste à 2 en Tle
  bc("Anglais",          "A5", S, 4, G1), bc("Anglais",          "A5", P, 4, G1), bc("Anglais",          "A5", T, 4, G1),
  bc("LV2",              "A5", S, 3, G1), bc("LV2",              "A5", P, 3, G1), bc("LV2",              "A5", T, 3, G1),
  bc("LV3",              "A5", S, 3, G1), bc("LV3",              "A5", P, 3, G1), bc("LV3",              "A5", T, 3, G1),
  bc("Informatique",              "A5", S, 2, G2), bc("Informatique",              "A5", P, 2, G2), bc("Informatique",              "A5", T, 1, G2), // ⚠️ 1 en Tle
  bc("Éducation à la Citoyenneté et à la Morale", "A5", S, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "A5", P, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "A5", T, 2, G2),
  bc("EPS",               "A5", S, 2, G2), bc("EPS",               "A5", P, 2, G2), bc("EPS",               "A5", T, 2, G2),
  bc("Histoire",          "A5", S, 2, G2), bc("Histoire",          "A5", P, 2, G2), bc("Histoire",          "A5", T, 2, G2),
  bc("Géographie",        "A5", S, 2, G2), bc("Géographie",        "A5", P, 2, G2), bc("Géographie",        "A5", T, 2, G2),
  bc("Sciences",          "A5", S, 1, G2), bc("Sciences",          "A5", P, 1, G2), bc("Sciences",          "A5", T, 1, G2),
  bc("Langues Nationales","A5", S, 1, G2), bc("Langues Nationales","A5", P, 1, G2), bc("Langues Nationales","A5", T, 1, G2),
  bc("Cultures Nationales","A5", S, 1, G2), bc("Cultures Nationales","A5", P, 1, G2), bc("Cultures Nationales","A5", T, 1, G2),
  bc("Éducation Artistique et Culturelle","A5", S, 1, G2), bc("Éducation Artistique et Culturelle","A5", P, 1, G2), bc("Éducation Artistique et Culturelle","A5", T, 1, G2),
  bc("Travail Manuel",    "A5", S, 1, G2), bc("Travail Manuel",    "A5", P, 1, G2), bc("Travail Manuel",    "A5", T, 1, G2),

  // ══════════════════ SÉRIE ABI (Bilingue) ══════════════════════════════════
  bc("Intensive English", "ABI", S, 5, G1), bc("Intensive English", "ABI", P, 5, G1), bc("Intensive English", "ABI", T, 5, G1),
  bc("Littérature",       "ABI", S, 3, G1), bc("Littérature",       "ABI", P, 3, G1), bc("Littérature",       "ABI", T, 3, G1),
  bc("Langue Française",  "ABI", S, 2, G1), bc("Langue Française",  "ABI", P, 2, G1), bc("Langue Française",  "ABI", T, 2, G1),
  bc("Philosophie",       "ABI", S, 2, G1), bc("Philosophie",       "ABI", P, 2, G1), bc("Philosophie",       "ABI", T, 4, G1), // ⚠️ 4 en Tle
  bc("LV2",               "ABI", S, 3, G1), bc("LV2",               "ABI", P, 3, G1), bc("LV2",               "ABI", T, 3, G1),
  bc("Informatique",                   "ABI", S, 2, G2), bc("Informatique",                   "ABI", P, 2, G2), bc("Informatique",                   "ABI", T, 1, G2),
  bc("Citizenship Education",          "ABI", S, 2, G2), bc("Citizenship Education",          "ABI", P, 2, G2), bc("Citizenship Education",          "ABI", T, 2, G2),
  bc("Sport and Physical Education",   "ABI", S, 2, G2), bc("Sport and Physical Education",   "ABI", P, 2, G2), bc("Sport and Physical Education",   "ABI", T, 2, G2),
  bc("Mathématiques",                  "ABI", S, 2, G2), bc("Mathématiques",                  "ABI", P, 2, G2), bc("Mathématiques",                  "ABI", T, 2, G2),
  bc("Histoire",                       "ABI", S, 2, G2), bc("Histoire",                       "ABI", P, 2, G2), bc("Histoire",                       "ABI", T, 2, G2),
  bc("Géographie",                     "ABI", S, 2, G2), bc("Géographie",                     "ABI", P, 2, G2), bc("Géographie",                     "ABI", T, 2, G2),
  bc("Sciences",                       "ABI", S, 1, G2), bc("Sciences",                       "ABI", P, 1, G2), bc("Sciences",                       "ABI", T, 1, G2),
  bc("Langues Nationales",             "ABI", S, 1, G2), bc("Langues Nationales",             "ABI", P, 1, G2), bc("Langues Nationales",             "ABI", T, 1, G2),
  bc("Cultures Nationales",            "ABI", S, 1, G2), bc("Cultures Nationales",            "ABI", P, 1, G2), bc("Cultures Nationales",            "ABI", T, 1, G2),
  bc("Éducation Artistique et Culturelle", "ABI", S, 1, G2), bc("Éducation Artistique et Culturelle", "ABI", P, 1, G2), bc("Éducation Artistique et Culturelle", "ABI", T, 1, G2),
  bc("Manual Labour", "ABI", S, 1, G2), bc("Manual Labour", "ABI", P, 1, G2), bc("Manual Labour", "ABI", T, 1, G2),

  // ══════════════════ SÉRIE C (Mathématiques) ════════════════════════════════
  // Groupe 1 (varie par niveau)
  bc("Mathématiques",  "C", S, 5, G1), // ⚠️ 5 en 2nde (arrêté), pas 6
  bc("Physique",       "C", S, 3, G1),
  bc("Chimie",         "C", S, 3, G1),
  bc("Informatique",   "C", S, 3, G1),
  bc("SVTEEHB",        "C", S, 2, G1),
  bc("Mathématiques",  "C", P, 6, G1),
  bc("Physique",       "C", P, 3, G1),
  bc("Chimie",         "C", P, 2, G1), // ⚠️ 2 en 1ère
  bc("Informatique",   "C", P, 2, G1),
  bc("Mathématiques",  "C", T, 6, G1),
  bc("Physique",       "C", T, 3, G1),
  bc("Chimie",         "C", T, 2, G1),
  bc("Informatique",   "C", T, 4, G1),
  // Groupe 2
  bc("Littérature",               "C", S, 2, G2), bc("Littérature",               "C", P, 2, G2), bc("Littérature",               "C", T, 2, G2),
  bc("Langue Française",          "C", S, 1, G2), bc("Langue Française",          "C", P, 1, G2), bc("Langue Française",          "C", T, 1, G2),
  bc("Anglais",                   "C", S, 3, G2), bc("Anglais",                   "C", P, 3, G2), bc("Anglais",                   "C", T, 3, G2),
  bc("Philosophie",               "C", S, 0, G2), bc("Philosophie",               "C", P, 1, G2), bc("Philosophie",               "C", T, 2, G2),
  bc("Histoire",                  "C", S, 2, G2), bc("Histoire",                  "C", P, 2, G2),
  bc("Géographie",                "C", S, 2, G2),                                                  bc("Géographie",                "C", T, 2, G2),
  bc("SVTEEHB",                   "C", P, 2, G2), bc("SVTEEHB",                   "C", T, 2, G2), // SVTEEHB passe en G2 en 1ère/Tle
  bc("Éducation à la Citoyenneté et à la Morale","C", S, 1, G2), bc("Éducation à la Citoyenneté et à la Morale","C", P, 1, G2), bc("Éducation à la Citoyenneté et à la Morale","C", T, 1, G2),
  bc("EPS",                       "C", S, 2, G2), bc("EPS",                       "C", P, 2, G2), bc("EPS",                       "C", T, 2, G2),
  bc("Travail Manuel",            "C", S, 1, G2), bc("Travail Manuel",            "C", P, 1, G2), bc("Travail Manuel",            "C", T, 1, G2),

  // ══════════════════ SÉRIE D (SVT — commence en 1ère) ══════════════════════
  bc("SVTEEHB",      "D", P, 6, G1), bc("SVTEEHB",      "D", T, 6, G1),
  bc("Mathématiques","D", P, 4, G1), bc("Mathématiques","D", T, 4, G1),
  bc("Chimie",       "D", P, 2, G1), bc("Chimie",       "D", T, 2, G1),
  bc("Informatique", "D", P, 2, G1), bc("Informatique", "D", T, 2, G1),
  bc("Littérature",               "D", P, 2, G2), bc("Littérature",               "D", T, 2, G2),
  bc("Langue Française",          "D", P, 1, G2), bc("Langue Française",          "D", T, 1, G2),
  bc("Anglais",                   "D", P, 3, G2), bc("Anglais",                   "D", T, 3, G2),
  bc("Physique",                  "D", P, 2, G2), bc("Physique",                  "D", T, 3, G2), // ⚠️ 3 en Tle
  bc("Philosophie",               "D", P, 2, G2), bc("Philosophie",               "D", T, 2, G2),
  bc("Histoire",                  "D", P, 2, G2), // 1ère: Histoire seulement
  bc("Géographie",                "D", T, 2, G2), // Tle: Géographie seulement
  bc("Éducation à la Citoyenneté et à la Morale","D", P, 1, G2), bc("Éducation à la Citoyenneté et à la Morale","D", T, 1, G2),
  bc("EPS",                       "D", P, 2, G2), bc("EPS",                       "D", T, 2, G2),
  bc("Travail Manuel",            "D", P, 1, G2), bc("Travail Manuel",            "D", T, 1, G2),

  // ══════════════════ SÉRIE E (Technique Mécanique) ══════════════════════════
  bc("Mathématiques",                    "E", S, 5, G1), bc("Mathématiques",                    "E", P, 6, G1), bc("Mathématiques",                    "E", T, 6, G1),
  bc("Physique",                         "E", S, 3, G1), bc("Physique",                         "E", P, 3, G1), bc("Physique",                         "E", T, 3, G1),
  bc("Chimie",                           "E", S, 2, G1), bc("Chimie",                           "E", P, 2, G1), bc("Chimie",                           "E", T, 2, G1),
  bc("Dessin et Technologie Mécaniques", "E", S, 6, G1), bc("Dessin et Technologie Mécaniques", "E", P, 6, G1), bc("Dessin et Technologie Mécaniques", "E", T, 6, G1),
  bc("Fabrication Éléments Mécaniques",  "E", S, 4, G1), bc("Fabrication Éléments Mécaniques",  "E", P, 4, G1), bc("Fabrication Éléments Mécaniques",  "E", T, 4, G1),
  bc("Français",          "E", S, 3, G2), bc("Français",          "E", P, 2, G2), bc("Français",          "E", T, 2, G2),
  bc("Anglais",           "E", S, 3, G2), bc("Anglais",           "E", P, 3, G2), bc("Anglais",           "E", T, 2, G2),
  bc("Informatique",      "E", S, 2, G2), bc("Informatique",      "E", P, 2, G2), bc("Informatique",      "E", T, 2, G2),
  bc("Philosophie",       "E", S, 0, G2), bc("Philosophie",       "E", P, 1, G2), bc("Philosophie",       "E", T, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale","E", S, 2, G2), bc("Éducation à la Citoyenneté et à la Morale","E", P, 1, G2), bc("Éducation à la Citoyenneté et à la Morale","E", T, 1, G2),
  bc("EPS",               "E", S, 2, G2), bc("EPS",               "E", P, 2, G2), bc("EPS",               "E", T, 2, G2),

  // ══════════════════ SÉRIE TI (Technologie Info — commence en 1ère) ═════════
  bc("Algorithmique-Programmation", "TI", P, 3, G1),
  bc("Systèmes d'Information",      "TI", P, 3, G1),
  bc("Maintenance et Multimédia",   "TI", P, 2, G1),
  bc("Mathématiques",               "TI", P, 4, G1),
  bc("Physique",                    "TI", P, 2, G1),
  bc("Chimie",                      "TI", P, 1, G1),
  bc("Programmation",               "TI", T, 3, G1),
  bc("Systèmes d'Information",      "TI", T, 3, G1),
  bc("Réseau Internet Sécurité",    "TI", T, 2, G1),
  bc("Mathématiques",               "TI", T, 4, G1),
  bc("Physique",                    "TI", T, 2, G1),
  bc("Chimie",                      "TI", T, 2, G1),
  bc("Français",                    "TI", P, 3, G2), bc("Français",                    "TI", T, 3, G2),
  bc("Anglais",                     "TI", P, 3, G2), bc("Anglais",                     "TI", T, 3, G2),
  bc("SVTEEHB",                     "TI", P, 2, G2), bc("SVTEEHB",                     "TI", T, 2, G2),
  bc("Histoire",                    "TI", P, 2, G2), // 1ère: Histoire seulement
  bc("Géographie",                  "TI", T, 2, G2), // Tle: Géographie seulement
  bc("Éducation à la Citoyenneté et à la Morale", "TI", P, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "TI", T, 2, G2),
  bc("Philosophie",                 "TI", P, 1, G2), bc("Philosophie",                 "TI", T, 2, G2),
  bc("EPS",                         "TI", P, 2, G2), bc("EPS",                         "TI", T, 2, G2),
  bc("Cultures Nationales",         "TI", P, 1, G2), bc("Cultures Nationales",         "TI", T, 1, G2),
  bc("Travail Manuel",              "TI", P, 1, G2), bc("Travail Manuel",              "TI", T, 1, G2),

  // ══════════════════ SÉRIE SH (Sciences Humaines) ══════════════════════════
  bc("Géographie",                 "SH", S, 3, G1), bc("Géographie",                 "SH", P, 3, G1), bc("Géographie",                 "SH", T, 3, G1),
  bc("Histoire",                   "SH", S, 3, G1), bc("Histoire",                   "SH", P, 3, G1), bc("Histoire",                   "SH", T, 3, G1),
  bc("Littérature",                "SH", S, 3, G1), bc("Littérature",                "SH", P, 3, G1), bc("Littérature",                "SH", T, 3, G1),
  bc("Langue Française",           "SH", S, 2, G1), bc("Langue Française",           "SH", P, 2, G1), bc("Langue Française",           "SH", T, 2, G1),
  bc("Philosophie",                "SH", S, 2, G1), bc("Philosophie",                "SH", P, 2, G1), bc("Philosophie",                "SH", T, 4, G1), // ⚠️ 4 en Tle
  bc("Anglais",                    "SH", S, 4, G1), bc("Anglais",                    "SH", P, 4, G1), bc("Anglais",                    "SH", T, 4, G1),
  bc("Éducation à la Citoyenneté et à la Morale", "SH", S, 2, G1), bc("Éducation à la Citoyenneté et à la Morale", "SH", P, 2, G1), bc("Éducation à la Citoyenneté et à la Morale", "SH", T, 2, G1),
  bc("Informatique",              "SH", S, 2, G2), bc("Informatique",              "SH", P, 2, G2), bc("Informatique",              "SH", T, 2, G2),
  bc("EPS",                       "SH", S, 2, G2), bc("EPS",                       "SH", P, 2, G2), bc("EPS",                       "SH", T, 2, G2),
  bc("Mathématiques",             "SH", S, 2, G2), bc("Mathématiques",             "SH", P, 2, G2), bc("Mathématiques",             "SH", T, 2, G2),
  bc("Sciences",                  "SH", S, 2, G2), bc("Sciences",                  "SH", P, 2, G2), bc("Sciences",                  "SH", T, 2, G2),
  bc("Langues Nationales",        "SH", S, 1, G2), bc("Langues Nationales",        "SH", P, 1, G2), bc("Langues Nationales",        "SH", T, 1, G2),
  bc("Cultures Nationales",       "SH", S, 1, G2), bc("Cultures Nationales",       "SH", P, 1, G2), bc("Cultures Nationales",       "SH", T, 1, G2),
  bc("Éducation Artistique et Culturelle", "SH", S, 1, G2), bc("Éducation Artistique et Culturelle", "SH", P, 1, G2), bc("Éducation Artistique et Culturelle", "SH", T, 1, G2),
  bc("Travail Manuel",            "SH", S, 1, G2), bc("Travail Manuel",            "SH", P, 1, G2), bc("Travail Manuel",            "SH", T, 1, G2),

  // ══════════════════ SÉRIE AC (Art Cinématographique) ══════════════════════
  bc("Histoire du Cinéma",          "AC", S, 4, G1),
  bc("Éléments Langage Cinéma",     "AC", S, 4, G1),
  bc("Outils et Métiers Cinéma",    "AC", S, 3, G1),
  bc("Genres Cinématographiques",   "AC", P, 4, G1),
  bc("Analyse Filmique",            "AC", P, 3, G1),
  bc("Économie du Cinéma",          "AC", P, 3, G1),
  bc("Processus Réalisation Film",  "AC", T, 3, G1),
  bc("Projet Fin Formation",        "AC", T, 4, G1),
  bc("Sociologie du Cinéma",        "AC", T, 3, G1),
  bc("Français",                   "AC", S, 3, G2), bc("Français",                   "AC", P, 3, G2), bc("Français",                   "AC", T, 3, G2),
  bc("Anglais",                    "AC", S, 3, G2), bc("Anglais",                    "AC", P, 3, G2), bc("Anglais",                    "AC", T, 3, G2),
  bc("Informatique",               "AC", S, 3, G2), bc("Informatique",               "AC", P, 2, G2), bc("Informatique",               "AC", T, 2, G2),
  bc("Mathématiques",              "AC", S, 1, G2), bc("Mathématiques",              "AC", P, 1, G2), bc("Mathématiques",              "AC", T, 0, G2),
  bc("Physique",                   "AC", S, 2, G2), bc("Physique",                   "AC", P, 2, G2), bc("Physique",                   "AC", T, 0, G2),
  bc("Langues Nationales",         "AC", S, 1, G2), bc("Langues Nationales",         "AC", P, 1, G2), bc("Langues Nationales",         "AC", T, 1, G2),
  bc("Cultures Nationales",        "AC", S, 1, G2), bc("Cultures Nationales",        "AC", P, 1, G2), bc("Cultures Nationales",        "AC", T, 1, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "AC", S, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "AC", P, 2, G2), bc("Éducation à la Citoyenneté et à la Morale", "AC", T, 2, G2),
  bc("Philosophie",                "AC", S, 1, G2), bc("Philosophie",                "AC", P, 1, G2), bc("Philosophie",                "AC", T, 1, G2),
  bc("Histoire",                   "AC", S, 0, G2), bc("Histoire",                   "AC", P, 2, G2), bc("Histoire",                   "AC", T, 0, G2),
  bc("Géographie",                 "AC", S, 0, G2), bc("Géographie",                 "AC", P, 0, G2), bc("Géographie",                 "AC", T, 2, G2),
  bc("EPS",                        "AC", S, 2, G2), bc("EPS",                        "AC", P, 2, G2), bc("EPS",                        "AC", T, 2, G2),
  bc("Travail Manuel",             "AC", S, 1, G2), bc("Travail Manuel",             "AC", P, 1, G2), bc("Travail Manuel",             "AC", T, 1, G2),
];
