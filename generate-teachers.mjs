import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('./backend/node_modules/xlsx');

const teachers = [
  // MATHÉMATIQUES (5)
  { nom:'KAMGA',     prenom:'Emmanuel',  matieres:'Mathématiques',                                                    cp:'6e A' },
  { nom:'TALLA',     prenom:'Sylvain',   matieres:'Mathématiques',                                                    cp:'5e A' },
  { nom:'NKEMENI',   prenom:'Cédric',    matieres:'Mathématiques',                                                    cp:'4e A' },
  { nom:'FOPA',      prenom:'Romain',    matieres:'Mathématiques',                                                    cp:'3e A' },
  { nom:'KOUAM',     prenom:'Thierry',   matieres:'Mathématiques',                                                    cp:'2nde C' },

  // FRANÇAIS (3)
  { nom:'MBALLA',    prenom:'Sophie',    matieres:'Français',                                                         cp:'6e B' },
  { nom:'ESSOMBA',   prenom:'Christine', matieres:'Français',                                                         cp:'5e B' },
  { nom:'ATEBA',     prenom:'Didier',    matieres:'Français',                                                         cp:'4e B' },

  // ANGLAIS (5)
  { nom:'NGONO',     prenom:'Patrick',   matieres:'Anglais',                                                          cp:'6e C' },
  { nom:'ABEGA',     prenom:'Laurent',   matieres:'Anglais',                                                          cp:'5e C' },
  { nom:'FOUDA',     prenom:'Eric',      matieres:'Anglais',                                                          cp:'4e C' },
  { nom:'ETOUNDI',   prenom:'Nicolas',   matieres:'Anglais',                                                          cp:'3e B' },
  { nom:'OWONA',     prenom:'Marie',     matieres:'Anglais',                                                          cp:'2nde A4-Arabe' },

  // HISTOIRE-GÉOGRAPHIE 1er cycle (2)
  { nom:'MENGUE',    prenom:'Véronique', matieres:'Histoire-Géographie',                                              cp:'6e D' },
  { nom:'ASSOUMOU',  prenom:'Bernard',   matieres:'Histoire-Géographie',                                              cp:'5e D' },

  // HISTOIRE + GÉOGRAPHIE 2nd cycle (2)
  { nom:'BIDIAS',    prenom:'Jean',      matieres:'Histoire, Géographie',                                             cp:'4e D' },
  { nom:'NGANDJUI',  prenom:'Anne',      matieres:'Histoire, Géographie',                                             cp:'3e C' },

  // PHYSIQUE-CHIMIE 1er cycle (1)
  { nom:'ONDOUA',    prenom:'Alain',     matieres:'Physique-Chimie-Technologie',                                      cp:'3e D' },

  // PHYSIQUE + CHIMIE 2nd cycle (2)
  { nom:'NGOUNOU',   prenom:'Philippe',  matieres:'Physique, Chimie',                                                 cp:'1ère C' },
  { nom:'DONFACK',   prenom:'Hélène',    matieres:'Physique, Chimie',                                                 cp:'Tle C' },

  // SVTEEHB (2)
  { nom:'TCHOUGANG', prenom:'Michel',    matieres:'SVTEEHB',                                                          cp:'1ère D' },
  { nom:'SAMBA',     prenom:'Isabelle',  matieres:'SVTEEHB',                                                          cp:'Tle D' },

  // EPS (3)
  { nom:'WAMBA',     prenom:'Carole',    matieres:'EPS',                                                              cp:'2nde A4-Allemand' },
  { nom:'DIFFO',     prenom:'Luc',       matieres:'EPS',                                                              cp:'2nde A4-Espagnol' },
  { nom:'MONTHE',    prenom:'Stéphane',  matieres:'EPS',                                                              cp:'2nde D' },

  // LITTÉRATURE + LANGUE FRANÇAISE (4 — classes A4)
  { nom:'ZANG',      prenom:'Pauline',   matieres:'Littérature, Langue Française',                                    cp:'1ère A4-Allemand' },
  { nom:'BIYIHA',    prenom:'William',   matieres:'Littérature, Langue Française',                                    cp:'1ère A4-Arabe' },
  { nom:'NGUELE',    prenom:'Carole',    matieres:'Littérature, Langue Française',                                    cp:'1ère A4-Chinois' },
  { nom:'MVOMO',     prenom:'Antoine',   matieres:'Littérature, Langue Française',                                    cp:'1ère A4-Espagnol' },

  // LANGUES VIVANTES (A4)
  { nom:'NGAMENI',   prenom:'Robert',    matieres:'Allemand',                                                         cp:'Tle A4-Allemand' },
  { nom:'KENFACK',   prenom:'Julie',     matieres:'Espagnol',                                                         cp:'Tle A4-Espagnol' },
  { nom:'BELIBI',    prenom:'Baptiste',  matieres:'Arabe',                                                            cp:'Tle A4-Arabe' },
  { nom:'MANGA',     prenom:'Thomas',    matieres:'Chinois',                                                          cp:'Tle A4-Chinois' },

  // PHILOSOPHIE + CITOYENNETÉ (2)
  { nom:'ETOGA',     prenom:'François',  matieres:"Philosophie, Éducation à la Citoyenneté et à la Morale",          cp:'Tle TI' },
  { nom:'NGUEMBI',   prenom:'Sylvie',    matieres:"Philosophie, Éducation à la Citoyenneté et à la Morale",          cp:'1ère TI' },

  // INFORMATIQUE + TI (3)
  { nom:'EDZOA',     prenom:'Daniel',    matieres:"Informatique, Algorithmique-Programmation",                        cp:'2nde A4-Chinois' },
  { nom:'TEUKAM',    prenom:'Gilles',    matieres:"Maintenance et Multimédia, Réseau Internet Sécurité, Programmation", cp:'' },
  { nom:'NGUEFACK',  prenom:'Alexandre', matieres:"Systèmes d'Information, Informatique",                            cp:'' },

  // Enseignants complémentaires (sans classe principale)
  { nom:'MVONDO',    prenom:'Pierre',    matieres:'Mathématiques',                                                    cp:'' },
  { nom:'NGAH',      prenom:'Rachel',    matieres:'Sciences, SVT',                                                    cp:'' },
  { nom:'ATANGANA',  prenom:'Henri',     matieres:'Éducation à la Citoyenneté et à la Morale, Cultures Nationales, Langues Nationales', cp:'' },
  { nom:'MONKAM',    prenom:'Carine',    matieres:'Travail Manuel, Éducation Artistique, Éducation Artistique et Culturelle', cp:'' },
  { nom:'NTOUBA',    prenom:'Marc',      matieres:'Philosophie',                                                      cp:'' },
  { nom:'DIFFO',     prenom:'Justine',   matieres:'Français, Langue Française',                                       cp:'' },
  { nom:'KETCHEMEN', prenom:'Paul',      matieres:'Histoire, Géographie',                                             cp:'' },
  { nom:'DJOMKAM',   prenom:'Beatrice',  matieres:'Sciences, Éducation Artistique, Éducation Artistique et Culturelle', cp:'' },

  // RENFORTS MATHÉMATIQUES (+3)
  { nom:'BELLA',     prenom:'Joseph',    matieres:'Mathématiques',                                                    cp:'' },
  { nom:'NKODO',     prenom:'Rose',      matieres:'Mathématiques',                                                    cp:'' },
  { nom:'AMOUGOU',   prenom:'Théodore',  matieres:'Mathématiques',                                                    cp:'' },

  // RENFORTS FRANÇAIS (+3)
  { nom:'ONDOA',     prenom:'Patricia',  matieres:'Français, Langue Française',                                       cp:'' },
  { nom:'FEUDJIO',   prenom:'Jean-Pierre', matieres:'Français, Langue Française',                                     cp:'' },
  { nom:'MBARGA',    prenom:'Cécile',    matieres:'Français',                                                         cp:'' },

  // RENFORTS ANGLAIS (+2)
  { nom:'TCHANA',    prenom:'Armand',    matieres:'Anglais',                                                          cp:'' },
  { nom:'NWANA',     prenom:'Grace',     matieres:'Anglais',                                                          cp:'' },

  // RENFORTS HISTOIRE-GÉOGRAPHIE (+2)
  { nom:'MBANGUE',   prenom:'Lionel',    matieres:'Histoire-Géographie, Histoire, Géographie',                       cp:'' },
  { nom:'OTTOU',     prenom:'Francine',  matieres:'Histoire-Géographie, Histoire, Géographie',                       cp:'' },

  // RENFORTS PHYSIQUE-CHIMIE / SCIENCES (+2)
  { nom:'MBIANDA',   prenom:'Guy',       matieres:'Physique-Chimie, Physique, Chimie, Physique-Chimie-Technologie',  cp:'' },
  { nom:'NGNOULAYE', prenom:'Suzanne',   matieres:'Sciences, SVT, SVTEEHB',                                          cp:'' },

  // RENFORTS EPS (+2)
  { nom:'TSAFACK',   prenom:'Bruno',     matieres:'EPS',                                                              cp:'' },
  { nom:'NDZANA',    prenom:'Léa',       matieres:'EPS',                                                              cp:'' },

  // RENFORT INFORMATIQUE / TI (+1)
  { nom:'FOSSO',     prenom:'Patrick',   matieres:"Informatique, Algorithmique-Programmation, Systèmes d'Information", cp:'' },

  // LETTRES CLASSIQUES (+2)
  { nom:'MBIDA',     prenom:'Serge',     matieres:'Lettres classiques (Latin/Grec)',                                   cp:'' },
  { nom:'ONANA',     prenom:'Véronique', matieres:'Lettres classiques (Latin/Grec)',                                   cp:'' },
];

const header = ['nom','prenom','email','telephone','matricule','date_naissance','classe','matieres','classe_principale','departement_ap'];
const rows = [header];

teachers.forEach((t, i) => {
  const num = String(i + 1).padStart(3, '0');
  const prenomClean = t.prenom.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z]/g,'');
  const nomClean = t.nom.toLowerCase();
  const email = `${prenomClean}.${nomClean}.teacher${num}@zekoul-abia.cm`;
  const base = 670000000 + (i * 13337891) % 29000000;
  const phone = `+237${base}`;
  const matricule = `ENS-2025-${num}`;
  const year = 1965 + (i * 7 % 30);
  const month = String(1 + (i * 3 % 12)).padStart(2,'0');
  const day = String(1 + (i * 11 % 28)).padStart(2,'0');
  const dob = `${day}/${month}/${year}`;
  rows.push([t.nom, t.prenom, email, phone, matricule, dob, '', t.matieres, t.cp, '']);
});

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(rows);
ws['!cols'] = [12,12,40,16,16,12,6,50,22,15].map(w => ({wch:w}));
XLSX.utils.book_append_sheet(wb, ws, 'Enseignants');
XLSX.writeFile(wb, './import-enseignants.xlsx');

console.log(`✅ ${rows.length - 1} enseignants générés`);
rows.slice(1).forEach(r => console.log(` ${r[4]}  ${r[0]} ${r[1]}  |  ${r[8] || '(sans classe principale)'}  |  ${r[7].slice(0,40)}`));
