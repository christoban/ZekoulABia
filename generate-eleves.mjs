/**
 * Génère eleves-nkolanga.xlsx avec une distribution réaliste de parents :
 *  - 172 parents avec 1 enfant
 *  -  95 parents avec 2 enfants  (même année différente classe, OU cycles différents)
 *  -  46 parents avec 3 enfants  (cycles variés)
 * Total : 313 parents uniques pour 500 élèves
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('./backend/node_modules/xlsx/xlsx.js');

// ── Données ───────────────────────────────────────────────────────────────

const PRENOMS_M = [
  'Jean','Paul','Pierre','Marc','Henri','Louis','Emmanuel','André','Claude','Joseph',
  'Michel','Robert','Victor','Albert','Georges','Daniel','Bernard','François','Thomas','Patrick',
  'Serge','Alain','Christian','Olivier','Thierry','Joël','Etienne','Fabrice','Rodrigue','Arnaud',
  'Sylvain','Maurice','René','Julien','Nicolas','Cédric','Didier','Franck','Alexis','Laurent',
  'Bruno','Pascal','Hermann','Kévin','Lionel','Armel','Boris','Clovis','Davy','Éric',
];

const PRENOMS_F = [
  'Marie','Sophie','Julie','Claire','Anne','Christine','Isabelle','Catherine','Sylvie','Valérie',
  'Nathalie','Sandrine','Muriel','Véronique','Angèle','Flore','Céleste','Rose','Grâce','Laure',
  'Mireille','Cécile','Martine','Françoise','Brigitte','Irène','Danielle','Nicole','Monique','Patricia',
  'Claudine','Solange','Christelle','Nadège','Aline','Estelle','Blanche','Florence','Joëlle','Hortense',
  'Parfaite','Rosine','Marlène','Blandine','Edith','Amelia','Tatiana','Ghislaine','Emmeline','Jeannette',
];

const NOMS = [
  'Nkono','Mballa','Belinga','Atangana','Onana','Nganou','Fouda','Mbarga','Tabi','Abena',
  'Ndoum','Djomo','Biloa','Nguele','Mvondo','Bikele','Nyemb','Nkoutou','Essomba','Minko',
  'Evehe','Eyoum','Minga','Nzola','Kamga','Talla','Fotso','Tchuente','Simo','Djoum',
  'Menye','Engamba','Bilong','Asseng','Enama','Koubou','Essama','Bebey','Ella','Nlend',
  'Mba','Nnomo','Bongo','Ongolo','Akoa','Ndzana','Manga','Owona','Metogo','Azombo',
  'Nkolo','Biyong','Mbongo','Ebongue','Ndongo','Abessolo','Zang','Bengono','Beti','Ekwala',
  'Elono','Etoa','Medjo','Mekongo','Mevaa','Mfou','Ngoa','Nkolo','Nso','Obame',
  'Obono','Ondo','Tsimi','Yem','Zambo','Zogo','Mvogo','Ngono','Meye','Eba',
];

const PRENOMS_PARENT_M = [
  'Basile','Célestin','Damien','Edouard','Félix','Germain','Honoré','Isidore','Jacques','Lambert',
  'Médard','Norbert','Octave','Patrice','Quentin','Raymond','Stanislas','Théodore','Urbain','Valentin',
  'Wilfrid','Xavier','Yannick','Zacharie','Achille','Barthélémy','Casimir','Dieudonné','Eustache','Fidèle',
];
const PRENOMS_PARENT_F = [
  'Adèle','Bernadette','Clémentine','Dorothée','Euphrasie','Félicité','Geneviève','Henriette','Imelda','Joséphine',
  'Karine','Lucette','Mathilde','Noëlle','Odette','Pauline','Régine','Séraphine','Thérèse','Ursule',
  'Victorine','Wilhelmine','Ximène','Yvette','Zoé','Agnès','Bénédicte','Colette','Denise','Ernestine',
];

// ── Classes et effectifs ───────────────────────────────────────────────────

// 32 classes, 500 élèves : 20 classes × 16 + 12 classes × 15 = 320 + 180 = 500
const CLASSES_DEF = [
  { name: '6e A',            count: 16 },
  { name: '6e B',            count: 16 },
  { name: '6e C',            count: 16 },
  { name: '5e A',            count: 16 },
  { name: '5e B',            count: 16 },
  { name: '5e C',            count: 16 },
  { name: '4e A',            count: 16 },
  { name: '4e B',            count: 16 },
  { name: '4e C',            count: 16 },
  { name: '3e A',            count: 16 },
  { name: '3e B',            count: 16 },
  { name: '3e C',            count: 16 },
  { name: '2nde A4-Allemand',count: 16 },
  { name: '2nde A4-Arabe',   count: 16 },
  { name: '2nde A4-Chinois', count: 16 },
  { name: '2nde A4-Espagnol',count: 16 },
  { name: '2nde C',          count: 16 },
  { name: '2nde D',          count: 16 },
  { name: '1ère A4-Allemand',count: 16 },
  { name: '1ère A4-Arabe',   count: 16 },
  { name: '1ère A4-Chinois', count: 15 },
  { name: '1ère A4-Espagnol',count: 15 },
  { name: '1ère C',          count: 15 },
  { name: '1ère D',          count: 15 },
  { name: '1ère TI',         count: 15 },
  { name: 'Tle A4-Allemand', count: 15 },
  { name: 'Tle A4-Arabe',    count: 15 },
  { name: 'Tle A4-Chinois',  count: 15 },
  { name: 'Tle A4-Espagnol', count: 15 },
  { name: 'Tle C',           count: 15 },
  { name: 'Tle D',           count: 15 },
  { name: 'Tle TI',          count: 15 },
];

// ── Utilitaires ────────────────────────────────────────────────────────────

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function randomDOB(rng, minAge, maxAge) {
  const now = new Date();
  const year = now.getFullYear() - minAge - Math.floor(rng() * (maxAge - minAge + 1));
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
}

// Pseudo-random mais déterministe (seed simple)
function makePRNG(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const rng = makePRNG(42);

// Fisher-Yates shuffle
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Génération des 500 élèves ──────────────────────────────────────────────

const students = [];
let sIdx = 1;

for (const cls of CLASSES_DEF) {
  // Âge minimum selon le niveau (approximatif)
  const ageRange = cls.name.startsWith('6e')          ? [10, 13]
                 : cls.name.startsWith('5e')          ? [11, 14]
                 : cls.name.startsWith('4e')          ? [12, 15]
                 : cls.name.startsWith('3e')          ? [13, 16]
                 : cls.name.startsWith('2nde')        ? [14, 17]
                 : cls.name.startsWith('1ère')        ? [15, 18]
                 : /* Tle */                            [16, 20];

  for (let i = 0; i < cls.count; i++) {
    const isFemale = rng() < 0.48;
    const prenom = isFemale ? pick(PRENOMS_F, rng) : pick(PRENOMS_M, rng);
    const nom    = pick(NOMS, rng);
    const tag    = String(sIdx).padStart(3, '0');
    const email     = `${slugify(prenom)}.${slugify(nom)}${tag}@lycee-nkolanga.cm`;
    const dob       = randomDOB(rng, ageRange[0], ageRange[1]);
    const matricule = `LN-2025-${tag}`;

    students.push({ prenom, nom, email, matricule, classe: cls.name, date_naissance: dob });
    sIdx++;
  }
}

// Ordonner en round-robin par classe pour garantir que les élèves consécutifs
// sont dans des classes différentes → les fratries seront toujours dans des classes distinctes
const byClass = {};
for (const cls of CLASSES_DEF) byClass[cls.name] = [];
for (const s of students) byClass[s.classe].push(s);

// Mélanger les élèves au sein de chaque classe (pour varier les noms)
for (const arr of Object.values(byClass)) shuffle(arr);

const roundRobin = [];
const queues = CLASSES_DEF.map(cls => [...byClass[cls.name]]);
let changed = true;
while (changed) {
  changed = false;
  for (const q of queues) {
    if (q.length > 0) { roundRobin.push(q.shift()); changed = true; }
  }
}
// roundRobin contient 500 élèves, consécutifs = classes différentes garanties

// ── Distribution parents ────────────────────────────────────────────────────
//  172 parents × 1 enfant  =  172 élèves
//   95 parents × 2 enfants =  190 élèves
//   46 parents × 3 enfants =  138 élèves
//  ─────────────────────────────────────
//  313 parents             =  500 élèves
const students_ordered = roundRobin;

const PRENOMS_PARENT = [...PRENOMS_PARENT_M, ...PRENOMS_PARENT_F];

const rows = []; // lignes Excel finales
let pIdx   = 1;
let phoneIdx = 1; // compteur pour numéros de téléphone parents uniques

function makeParentEmail(prenom, nom) {
  const tag = String(pIdx).padStart(3, '0');
  return `parent.${slugify(prenom)}.${slugify(nom)}${tag}@lycee-nkolanga.cm`;
}

// ~65% des parents ont un numéro de téléphone — format camerounais +2376XXXXXXXX
function makeParentPhone() {
  if (rng() > 0.65) return '';
  // Opérateurs MTN (67x, 68x) et Orange (69x, 65x)
  const prefixes = ['670', '671', '672', '673', '680', '681', '690', '691', '650', '651'];
  const prefix = prefixes[Math.floor(rng() * prefixes.length)];
  const suffix = String(phoneIdx++).padStart(6, '0');
  return `+237${prefix}${suffix}`;
}

function addGroup(studentGroup) {
  const firstNom = studentGroup[0].nom;
  const pPrenom  = pick(PRENOMS_PARENT, rng);
  const pNom     = pick(NOMS, rng);
  const pEmail   = makeParentEmail(pPrenom, pNom);
  const pPhone   = makeParentPhone();
  pIdx++;
  for (const s of studentGroup) {
    rows.push({
      matricule:        s.matricule,
      nom:              s.nom,
      prenom:           s.prenom,
      email:            s.email,
      date_naissance:   s.date_naissance,
      classe:           s.classe,
      nom_parent:       pNom.toUpperCase(),
      prenom_parent:    pPrenom,
      email_parent:     pEmail,
      telephone_parent: pPhone,
    });
  }
}

let cursor = 0;
const s = students_ordered;

// 1 enfant
for (let i = 0; i < 172; i++) {
  addGroup([s[cursor++]]);
}

// 2 enfants — élèves consécutifs = classes différentes (round-robin)
for (let i = 0; i < 95; i++) {
  addGroup([s[cursor++], s[cursor++]]);
}

// 3 enfants — même garantie
for (let i = 0; i < 46; i++) {
  addGroup([s[cursor++], s[cursor++], s[cursor++]]);
}

// ── Vérifications ──────────────────────────────────────────────────────────

const totalStudents = rows.length;
const uniqueStudentEmails = new Set(rows.map(r => r.email)).size;
const uniqueParentEmails  = new Set(rows.map(r => r.email_parent)).size;

console.log(`Élèves générés    : ${totalStudents}`);
console.log(`Emails élèves uniques: ${uniqueStudentEmails}`);
console.log(`Parents uniques   : ${uniqueParentEmails}`);

if (totalStudents !== 500)       console.error('ERREUR : nombre d\'élèves != 500');
if (uniqueStudentEmails !== 500) console.error('ERREUR : doublons emails élèves');
if (uniqueParentEmails  !== 313) console.error(`ERREUR : parents attendus=313 obtenu=${uniqueParentEmails}`);

// Distribution fratries
const parentCount = {};
for (const r of rows) {
  parentCount[r.email_parent] = (parentCount[r.email_parent] || 0) + 1;
}
const dist = {};
for (const c of Object.values(parentCount)) {
  dist[c] = (dist[c] || 0) + 1;
}
console.log('Distribution parents:', dist);

// Vérifier que les fratries sont dans des classes différentes
let sameclassSiblings = 0;
for (const [email, count] of Object.entries(parentCount)) {
  if (count > 1) {
    const siblingsRows = rows.filter(r => r.email_parent === email);
    const classes = siblingsRows.map(r => r.classe);
    const unique = new Set(classes);
    if (unique.size < classes.length) sameclassSiblings++;
  }
}
if (sameclassSiblings > 0) {
  console.warn(`⚠️  ${sameclassSiblings} fratries ont des élèves dans la même classe (rare mais possible après shuffle).`);
} else {
  console.log('✅ Toutes les fratries sont dans des classes différentes.');
}

// ── Export Excel ───────────────────────────────────────────────────────────

// Trier par classe pour la lisibilité
rows.sort((a, b) => a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom));

const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Élèves');
XLSX.writeFile(wb, 'eleves-nkolanga.xlsx');

console.log('\n✅ Fichier eleves-nkolanga.xlsx généré avec succès.');
