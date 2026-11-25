/**
 * Genere les fichiers import-eleves.xlsx et import-enseignants.xlsx
 * pour l'etablissement secondaire general francophone avec PEBS.
 *
 * Classes (34 totales) :
 *   1er cycle : 6e/5e/4e/3e × A/B/C  = 12 classes
 *   2nde      : ABI, A4-{Allemand,Arabe,Chinois,Espagnol}, C  = 6 classes
 *   1ère      : ABI, A4-{Allemand,Arabe,Chinois,Espagnol}, C, D, TI  = 8 classes
 *   Tle       : ABI, A4-{Allemand,Arabe,Chinois,Espagnol}, C, D, TI  = 8 classes
 *
 * Distribution parents : 1 enfant > 2 enfants > 3 enfants
 * Distribution eleves  : 15-17 par classe
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('./backend/node_modules/xlsx/xlsx.js');

// ─── Config ─────────────────────────────────────────────────────────────────
const SCHOOL_DOMAIN = 'zekoul-abia.cm';
const ACADEMIC_YEAR = '2025';

// ─── Classes ─────────────────────────────────────────────────────────────────
const FIRST_CYCLE = ['6e A','6e B','6e C','5e A','5e B','5e C','4e A','4e B','4e C','3e A','3e B','3e C'];

const SECOND_CYCLE = [
  '2nde ABI',
  '2nde A4-Allemand','2nde A4-Arabe','2nde A4-Chinois','2nde A4-Espagnol',
  '2nde C',
  '1ère ABI',
  '1ère A4-Allemand','1ère A4-Arabe','1ère A4-Chinois','1ère A4-Espagnol',
  '1ère C','1ère D','1ère TI',
  'Tle ABI',
  'Tle A4-Allemand','Tle A4-Arabe','Tle A4-Chinois','Tle A4-Espagnol',
  'Tle C','Tle D','Tle TI',
];

const ALL_CLASSES = [...FIRST_CYCLE, ...SECOND_CYCLE];

// ─── Noms / Prenoms ──────────────────────────────────────────────────────────
const PRENOMS_M = [
  'Jean','Paul','Pierre','Marc','Henri','Louis','Emmanuel','Andre','Claude','Joseph',
  'Michel','Robert','Victor','Albert','Georges','Daniel','Bernard','Francois','Thomas','Patrick',
  'Serge','Alain','Christian','Olivier','Thierry','Joel','Etienne','Fabrice','Rodrigue','Arnaud',
  'Sylvain','Maurice','Rene','Julien','Nicolas','Cedric','Didier','Franck','Alexis','Laurent',
  'Bruno','Pascal','Hermann','Kevin','Lionel','Armel','Boris','Clovis','Davy','Eric',
];

const PRENOMS_F = [
  'Marie','Sophie','Julie','Claire','Anne','Christine','Isabelle','Catherine','Sylvie','Valerie',
  'Nathalie','Sandrine','Muriel','Veronique','Angele','Flore','Celeste','Rose','Grace','Laure',
  'Mireille','Cecile','Martine','Francoise','Brigitte','Irene','Danielle','Nicole','Monique','Patricia',
  'Claudine','Solange','Christelle','Nadege','Aline','Estelle','Blanche','Florence','Joelle','Hortense',
  'Parfaite','Rosine','Marlene','Blandine','Edith','Amelia','Tatiana','Ghislaine','Emmeline','Jeannette',
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

const PRENOMS_PARENT = [
  'Basile','Celestin','Damien','Edouard','Felix','Germain','Honore','Isidore','Jacques','Lambert',
  'Medard','Norbert','Octave','Patrice','Quentin','Raymond','Stanislas','Theodore','Urbain','Valentin',
  'Wilfrid','Xavier','Yannick','Zacharie','Achille','Barthelemy','Casimir','Dieudonne','Eustache','Fidele',
  'Adele','Bernadette','Clementine','Dorothee','Euphrasie','Felicitie','Genevieve','Henriette','Imelda','Josephine',
  'Karine','Lucette','Mathilde','Noelle','Odette','Pauline','Regine','Seraphine','Therese','Ursule',
  'Victorine','Wilhelmine','Ximene','Yvette','Zoe','Agnes','Benedicte','Colette','Denise','Ernestine',
];

const PRENOMS_TEACHER_M = [
  'Alain','Boris','Christophe','Daniel','Emile','Fernand','Gilles','Hugues','Ivan','Jules',
  'Leon','Marcel','Noel','Oscar','Pascal','Roland','Simon','Toussaint','Vincent','William',
];

const PRENOMS_TEACHER_F = [
  'Adrienne','Beatrice','Carine','Danielle','Eliane','Flavie','Gisele','Helene','Jacqueline','Lise',
  'Marguerite','Nadine','Odile','Pascale','Rachel','Suzanne','Tatiana','Viviane','Wendy','Yolande',
];

const NOMS_TEACHER = [
  'Ayissi','Biyiha','Ebene','Edzoa','Ekani','Ekoto','Elingui','Enone','Essono','Etoa',
  'Eyebe','Mbarga','Mbotto','Mekongo','Menga','Mimboe','Minko','Mvogo','Ndjana','Ndongo',
  'Ngono','Nguele','Nkotti','Nkwi','Nnanga','Nomo','Nyobe','Ondoua','Owona','Sohaing',
  'Tchinda','Tchoffo','Tchouala','Tsala','Tsopgni','Wouafo','Yembe','Zambo','Zoa','Zogo',
];

// ─── Departements et Animateurs Pedagogiques ─────────────────────────────────
const DEPARTEMENTS = {
  Sciences:        ['Mathématiques','Physique','Chimie','SVTEEHB','Sciences','Physique-Chimie-Technologie'],
  Lettres:         ['Littérature','Langue Française','Français','Philosophie','Lettres classiques (Latin/Grec)'],
  Langues:         ['Anglais','LV2','Intensive English','Langues Nationales'],
  HistoireGeo:     ['Histoire','Géographie','Éducation à la Citoyenneté et à la Morale','Citizenship Education'],
  TIC:             ['Informatique','Algorithmique-Programmation','Systèmes d\'Information','Programmation','Réseau Internet Sécurité','Maintenance et Multimédia'],
  EPS:             ['EPS','Sport and Physical Education'],
  Arts:            ['Éducation Artistique','Éducation Artistique et Culturelle','Cultures Nationales','Travail Manuel','Manual Labor / Handicraft / Drawing'],
};

// Sujets par type de classe (pour assigner des matieres pertinentes aux enseignants PP)
const PP_SUBJECT_BY_LEVEL = {
  '6e':  'Français',
  '5e':  'Mathématiques',
  '4e':  'Anglais',
  '3e':  'Histoire',
  '2nde ABI':          'Intensive English',
  '2nde A4-Allemand':  'Littérature',
  '2nde A4-Arabe':     'Littérature',
  '2nde A4-Chinois':   'Littérature',
  '2nde A4-Espagnol':  'Littérature',
  '2nde C':            'Mathématiques',
  '1ère ABI':          'Intensive English',
  '1ère A4-Allemand':  'Littérature',
  '1ère A4-Arabe':     'Littérature',
  '1ère A4-Chinois':   'Littérature',
  '1ère A4-Espagnol':  'Littérature',
  '1ère C':            'Physique',
  '1ère D':            'SVTEEHB',
  '1ère TI':           'Algorithmique-Programmation',
  'Tle ABI':           'Philosophie',
  'Tle A4-Allemand':   'Philosophie',
  'Tle A4-Arabe':      'Philosophie',
  'Tle A4-Chinois':    'Philosophie',
  'Tle A4-Espagnol':   'Philosophie',
  'Tle C':             'Mathématiques',
  'Tle D':             'Mathématiques',
  'Tle TI':            'Systèmes d\'Information',
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────
function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

function slugify(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function makePRNG(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const rng = makePRNG(137);

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function ageRange(classe) {
  if (classe.startsWith('6e'))      return [10, 13];
  if (classe.startsWith('5e'))      return [11, 14];
  if (classe.startsWith('4e'))      return [12, 15];
  if (classe.startsWith('3e'))      return [13, 16];
  if (classe.startsWith('2nde'))    return [14, 17];
  if (classe.startsWith('1ère'))    return [15, 18];
  if (classe.startsWith('Tle'))     return [16, 20];
  return [14, 18];
}

function randomDOB(classe) {
  const [min, max] = ageRange(classe);
  const now = new Date();
  const year = now.getFullYear() - min - Math.floor(rng() * (max - min + 1));
  const month = 1 + Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 28);
  return `${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;
}

let globalIdx = 1;

// ═══════════════════════════════════════════════════════════════════════════════
//  GENERATION DES ELEVES
// ═══════════════════════════════════════════════════════════════════════════════

const studentRows = [];
const allStudents = [];

for (const cls of ALL_CLASSES) {
  const count = (cls.startsWith('Tle') || cls.includes('TI') && cls.startsWith('1ère')) ? 15 : 16;
  for (let i = 0; i < count; i++) {
    const isFemale = rng() < 0.48;
    const prenom = isFemale ? pick(PRENOMS_F, rng) : pick(PRENOMS_M, rng);
    const nom    = pick(NOMS, rng);
    const tag    = String(globalIdx).padStart(3, '0');
    const email  = `${slugify(prenom)}.${slugify(nom)}${tag}@${SCHOOL_DOMAIN}`;
    const dob    = randomDOB(cls);
    const matricule = `EN-${ACADEMIC_YEAR}-${tag}`;

    allStudents.push({ prenom, nom, email, matricule, classe: cls, date_naissance: dob });
    globalIdx++;
  }
}

// Round-robin pour que les fratries soient dans des classes differentes
const byCls = {};
for (const cls of ALL_CLASSES) byCls[cls] = [];
for (const s of allStudents) byCls[s.classe].push(s);
for (const arr of Object.values(byCls)) shuffle(arr);

const queues = ALL_CLASSES.map(cls => [...byCls[cls]]);
const rr = [];
let changed = true;
while (changed) {
  changed = false;
  for (const q of queues) {
    if (q.length > 0) { rr.push(q.shift()); changed = true; }
  }
}

// Distribution parents : ~58% 1-enfant, ~27% 2-enfants, ~15% 3-enfants
// Total etudiants = 536
// 1-enfant: 200 parents × 1 = 200
// 2-enfants: 90 parents × 2 = 180
// 3-enfants: 52 parents × 3 = 156
// Total: 342 parents, 536 etudiants

const GROUP_SIZES = [
  ...Array(200).fill(1),
  ...Array(90).fill(2),
  ...Array(52).fill(3),
];

let cursor = 0;
let pIdx = 1;
let phoneIdx = 1;

function makeParentEmail() {
  const pPrenom = pick(PRENOMS_PARENT, rng);
  const pNom = pick(NOMS, rng);
  const tag = String(pIdx).padStart(3, '0');
  pIdx++;
  return { pPrenom, pNom, email: `parent.${slugify(pPrenom)}.${slugify(pNom)}${tag}@${SCHOOL_DOMAIN}` };
}

function makeParentPhone() {
  if (rng() > 0.65) return '';
  const prefixes = ['670','671','672','673','680','681','690','691','650','651'];
  const prefix = prefixes[Math.floor(rng() * prefixes.length)];
  const suffix = String(phoneIdx++).padStart(6, '0');
  return `+237${prefix}${suffix}`;
}

for (const size of GROUP_SIZES) {
  const group = [];
  for (let i = 0; i < size; i++) {
    if (cursor >= rr.length) break;
    group.push(rr[cursor++]);
  }
  if (group.length === 0) break;
  const { pPrenom, pNom, email: pEmail } = makeParentEmail();
  const pPhone = makeParentPhone();
  for (const s of group) {
    studentRows.push({
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

// Tri par classe
studentRows.sort((a, b) => a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom));

// Stats
const parentEmails = new Set(studentRows.map(r => r.email_parent));
const dist = {};
for (const r of studentRows) {
  const c = [...studentRows.filter(x => x.email_parent === r.email_parent)].length;
  dist[c] = (dist[c] || 0) + 1;
}
const uniqParentCounts = {};
for (const r of studentRows) {
  const cnt = studentRows.filter(x => x.email_parent === r.email_parent).length;
  uniqParentCounts[r.email_parent] = cnt;
}
const distParents = {};
for (const cnt of Object.values(uniqParentCounts)) {
  distParents[cnt] = (distParents[cnt] || 0) + 1;
}

console.log('=== ELEVES ===');
console.log(`Total eleves      : ${studentRows.length}`);
console.log(`Parents uniques   : ${parentEmails.size}`);
console.log('Distribution parents:', Object.entries(distParents).sort((a,b) => Number(a[0])-Number(b[0])).map(([k,v]) => `${k} enfant(s): ${v} parents`).join(', '));

// ═══════════════════════════════════════════════════════════════════════════════
//  GENERATION DES ENSEIGNANTS
// ═══════════════════════════════════════════════════════════════════════════════

const teacherRows = [];
let tIdx = 1;

// 1) Professeurs principaux (1 par classe = 34)
const ppAssignments = {}; // classe -> teacher info

for (let ci = 0; ci < ALL_CLASSES.length; ci++) {
  const cls = ALL_CLASSES[ci];
  const isFemale = rng() < 0.4;
  const prenom = isFemale ? pick(PRENOMS_TEACHER_F, rng) : pick(PRENOMS_TEACHER_M, rng);
  const nom    = pick(NOMS_TEACHER, rng);
  const tag    = String(tIdx).padStart(3, '0');
  const email  = `${slugify(prenom)}.${slugify(nom)}.teacher${tag}@${SCHOOL_DOMAIN}`;

  // Matiere principale (celle du PP pour sa classe)
  let mainSubject = PP_SUBJECT_BY_LEVEL[cls];
  if (!mainSubject) mainSubject = 'Francais';

  // Choisir 1-2 matieres supplementaires pertinentes
  const extraPool = getExtraSubjects(cls, mainSubject);
  const extraCount = rng() < 0.4 ? 2 : 1;
  const extras = [];
  const shuffled = shuffle([...extraPool]);
  for (let i = 0; i < Math.min(extraCount, shuffled.length); i++) extras.push(shuffled[i]);

  const matieres = [mainSubject, ...extras].join(', ');

  ppAssignments[cls] = { prenom, nom, email, matieres, tag: tIdx };
  tIdx++;
}

// 2) Enseignants supplementaires pour matieres specialisees (LV2, TI, etc.)
const ADDITIONAL_TEACHERS = [
  // LV2 specifiques
  { prenom: 'Marcelle', nom: 'Mimboe', matieres: 'LV2' },
  { prenom: 'Gerard',   nom: 'Tchinda', matieres: 'LV2' },
  { prenom: 'Sylvie',   nom: 'Essono', matieres: 'LV2' },
  { prenom: 'Jose',     nom: 'Ondoua', matieres: 'LV2' },
  // TI specialises
  { prenom: 'Luc',      nom: 'Tsala', matieres: 'Algorithmique-Programmation, Systèmes d\'Information, Programmation' },
  { prenom: 'Anicet',   nom: 'Eyebe', matieres: 'Maintenance et Multimédia, Réseau Internet Sécurité' },
  // Sciences
  { prenom: 'Therese',  nom: 'Mvogo', matieres: 'Physique, Chimie, Sciences' },
  { prenom: 'Pierre',   nom: 'Nkotti', matieres: 'SVTEEHB, Physique-Chimie-Technologie' },
  // Lettres
  { prenom: 'Josephine',nom: 'Ebene', matieres: 'Littérature, Langue Française, Français' },
  { prenom: 'Rene',     nom: 'Edzoa', matieres: 'Philosophie, Lettres classiques (Latin/Grec)' },
  // Histoire-Geo
  { prenom: 'Marthe',   nom: 'Zambo', matieres: 'Histoire, Géographie, Éducation à la Citoyenneté et à la Morale' },
];

for (const t of ADDITIONAL_TEACHERS) {
  const email = `${slugify(t.prenom)}.${slugify(t.nom)}.teacher${String(tIdx).padStart(3, '0')}@${SCHOOL_DOMAIN}`;
  ppAssignments[`__extra_${tIdx}__`] = { prenom: t.prenom, nom: t.nom, email, matieres: t.matieres, extra: true, tag: tIdx };
  tIdx++;
}

// Assigner les AP (Animateurs Pedagogiques) — on prend des PP existants
const apAssignments = {
  Sciences:    null,
  Lettres:     null,
  Langues:     null,
  HistoireGeo: null,
  TIC:         null,
  EPS:         null,
  Arts:        null,
};

// Selectionner des PP comme AP (on les prend parmi les PP de classes pertinentes)
const apCandidates = {
  Sciences:    ALL_CLASSES.filter(c => c.includes(' C') || c.includes(' D') || c.includes('TI')),
  Lettres:     ALL_CLASSES.filter(c => c.includes('A4') || c.includes('ABI')),
  Langues:     ALL_CLASSES.filter(c => c.includes('A4') || c.includes('ABI')),
  HistoireGeo: ALL_CLASSES.filter(c => true),
  TIC:         ALL_CLASSES.filter(c => c.includes('TI')),
  EPS:         ALL_CLASSES.filter(c => true),
  Arts:        ALL_CLASSES.filter(c => c.includes('A4') || c.includes('ABI') || c.startsWith('6e') || c.startsWith('5e')),
};

for (const [dept, candidates] of Object.entries(apCandidates)) {
  if (candidates.length === 0) continue;
  const chosen = candidates[Math.floor(rng() * candidates.length)];
  apAssignments[dept] = chosen;
}

// Assembler le fichier enseignants
for (const [cls, info] of Object.entries(ppAssignments)) {
  if (info.extra) {
    // Enseignant supplementaire (pas de PP)
    teacherRows.push({
      nom:               info.nom.toUpperCase(),
      prenom:            info.prenom,
      email:             info.email,
      telephone:         '',
      matricule:         `ENS-${ACADEMIC_YEAR}-${String(info.tag).padStart(3, '0')}`,
      date_naissance:    '',
      classe:            '',
      matieres:          info.matieres,
      classe_principale: '',
      departement_ap:    '',
    });
  } else {
    // PP d'une classe
    let apDept = '';
    for (const [dept, assignedCls] of Object.entries(apAssignments)) {
      if (assignedCls === cls) {
        apDept = dept;
        break;
      }
    }

    teacherRows.push({
      nom:               info.nom.toUpperCase(),
      prenom:            info.prenom,
      email:             info.email,
      telephone:         `+2376${String(70000000 + Math.floor(rng() * 9999999)).slice(0, 8)}`,
      matricule:         `ENS-${ACADEMIC_YEAR}-${String(info.tag).padStart(3, '0')}`,
      date_naissance:    `${String(1 + Math.floor(rng() * 28)).padStart(2,'0')}/${String(1 + Math.floor(rng() * 12)).padStart(2,'0')}/${1970 + Math.floor(rng() * 20)}`,
      classe:            '',
      matieres:          info.matieres,
      classe_principale: cls,
      departement_ap:    apDept,
    });
  }
}

// Melanger les enseignants
shuffle(teacherRows);

// Stats enseignants
const ppCount = teacherRows.filter(r => r.classe_principale !== '').length;
const apCount = teacherRows.filter(r => r.departement_ap !== '').length;

console.log('\n=== ENSEIGNANTS ===');
console.log(`Total enseignants : ${teacherRows.length}`);
console.log(`Professeurs principaux : ${ppCount}`);
console.log(`Animateurs pedagogiques: ${apCount}`);
console.log(`(dont AP: ${Object.entries(apAssignments).filter(([_,v]) => v !== null).map(([k,v]) => `${k}=>${v}`).join(', ')})`);

// ─── Fonctions helper pour les matieres complementaires ──────────────────────
function getExtraSubjects(clsName, mainSubject) {
  const pool = [];

  if (clsName.startsWith('6e') || clsName.startsWith('5e')) {
    if (mainSubject !== 'Français') pool.push('Français');
    pool.push('Anglais', 'Histoire', 'Géographie', 'Mathématiques', 'Sciences', 'Éducation Artistique et Culturelle', 'EPS', 'Informatique');
  } else if (clsName.startsWith('4e') || clsName.startsWith('3e')) {
    if (mainSubject !== 'Anglais') pool.push('Anglais');
    pool.push('Français', 'Histoire', 'Géographie', 'Mathématiques', 'LV2', 'Physique-Chimie-Technologie', 'SVTEEHB', 'EPS', 'Informatique');
  } else if (clsName.includes('ABI')) {
    pool.push('Littérature', 'Anglais', 'Histoire', 'Géographie', 'Informatique', 'Sport and Physical Education', 'Citizenship Education');
  } else if (clsName.includes('A4')) {
    pool.push('Anglais', 'Histoire', 'Géographie', 'Informatique', 'Éducation Artistique', 'Mathématiques');
  } else if (clsName.includes(' C') || clsName.includes(' D')) {
    pool.push('Mathématiques', 'Physique', 'Chimie', 'SVTEEHB', 'Anglais', 'Informatique');
  } else if (clsName.includes('TI')) {
    pool.push('Mathématiques', 'Physique', 'Informatique', 'Anglais');
  }
  return pool.filter(s => s !== mainSubject);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EXPORT EXCEL
// ═══════════════════════════════════════════════════════════════════════════════

// --- Eleves ---
const wsStudents = XLSX.utils.json_to_sheet(studentRows);
const wbStudents = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbStudents, wsStudents, 'Eleves');
XLSX.writeFile(wbStudents, 'import-eleves.xlsx');

// --- Enseignants ---
const wsTeachers = XLSX.utils.json_to_sheet(teacherRows);
const wbTeachers = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbTeachers, wsTeachers, 'Enseignants');
XLSX.writeFile(wbTeachers, 'import-enseignants.xlsx');

console.log('\n✅ Fichiers generés :');
console.log('   - import-eleves.xlsx');
console.log('   - import-enseignants.xlsx');
