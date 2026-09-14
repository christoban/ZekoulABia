import { PrismaClient } from "@prisma/client";
// Données de référence — source unique de vérité pour les curricula
import { bacCoefficients } from '../src/application/school/curriculum/francophone/deuxieme-cycle-bac';
import { premierCycleFR, CYCLE1_FR_TEMPLATES } from '../src/application/school/curriculum/francophone/premier-cycle';
import { primaireFR, PRIMAIRE_FR_TEMPLATES } from '../src/application/school/curriculum/francophone/primaire';
import { techniqueFR, TECHNIQUE_FR_TEMPLATES, professionnelFR, PROFESSIONNEL_FR_TEMPLATES } from '../src/application/school/curriculum/francophone/technique';
import { getAslEntries, ASL_TEMPLATES } from '../src/application/school/curriculum/anglophone/secondary';
import { getTechniqueAnEntries, TECHNICAL_EN_TEMPLATES } from '../src/application/school/curriculum/anglophone/technical';
import { primaryEN, PRIMARY_EN_TEMPLATES } from '../src/application/school/curriculum/anglophone/primary';
import { getTemplateMeta } from '../src/application/school/schoolTemplateConfig';
import { defaultsConfigLocalePourTemplate } from '../src/domain/rules/configLocaleTemplate';
import { seedOfficialAcademicCalendar } from '../src/infrastructure/seed/officialAcademicCalendarDefaults';

const prisma = new PrismaClient();
// ─── LES 19 VRAIS TEMPLATES D'ÉTABLISSEMENTS CAMEROUNAIS ────────────────────
//
// Répartition :
//   Francophone   : LYCEE_FR, CES_FR, PRIVE_FR, LYCEE_TECHNIQUE_FR, CETIC,
//                   SAR_SM, CFM, PRIMAIRE_FR, MATERNELLE_FR  (9 templates)
//   Anglophone    : GHS_EN, GSS_EN, PRIVE_EN, GTC_GTHS_EN, GTC_EN,
//                   PRIMARY_EN, NURSERY_EN                                    (7 templates)
//   Bilingue      : LYCEE_BILINGUE, PRIMARY_BILINGUAL                         (2 templates)
//   Multi-niveaux : COMPLEXE_SCOLAIRE                                         (1 template)
//   TOTAL         : 19 templates
//
// NOTE : LYCEE_BILINGUE_FR a été supprimé — c'était une erreur conceptuelle.
//   Un lycée est soit francophone, soit bilingue. "Bilingue francophone" est
//   une contradiction dans les termes. La série ABI existe dans LYCEE_BILINGUE.
//
// NOTE (13/07/2026) : GTC_EN/GTC_GTHS_EN ajoutés — miroir anglophone de
//   CETIC/LYCEE_TECHNIQUE_FR (filières STT/IND vs F1/G2 francophone). Aucun
//   template dédié pour GGTC (Girls Technical College) : géré via
//   School.admissionType, même curriculum que la variante mixte — voir
//   commentaire "CETIF" dans francophone/technique.ts pour le précédent
//   conceptuel (jamais un template séparé côté francophone non plus).

const schoolTemplates = [

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTÈME FRANCOPHONE (9 templates)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 1. Lycée général francophone ───────────────────────────────────────────
  // Établissements publics : Lycée de Yaoundé, Lycée de Douala, etc.
  // 1er cycle (6e-3e) + 2nd cycle (2nde-Tle), séries A4/C/D/TI
  // Pas de série D ni TI en 2nde (démarrent en 1ère)
  {
    code: "LYCEE_FR",
    name: "Lycée général francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        // 1er cycle — pas de série
        { level: "6e",   serie: null, filiere: null },
        { level: "5e",   serie: null, filiere: null },
        { level: "4e",   serie: null, filiere: null },
        { level: "3e",   serie: null, filiere: null },
        // 2nd cycle — séries A4, C (D et TI interdits en 2nde)
        { level: "2nde", serie: "A4", filiere: null },
        { level: "2nde", serie: "C",  filiere: null },
        // 1ère — TI démarre ici
        { level: "1ere", serie: "A4", filiere: null },
        { level: "1ere", serie: "C",  filiere: null },
        { level: "1ere", serie: "D",  filiere: null },
        { level: "1ere", serie: "TI", filiere: null },
        // Terminale
        { level: "Tle",  serie: "A4", filiere: null },
        { level: "Tle",  serie: "C",  filiere: null },
        { level: "Tle",  serie: "D",  filiere: null },
        { level: "Tle",  serie: "TI", filiere: null },
      ],
      officialExams: ["BEPC", "PROBATOIRE", "BAC"],
      bacSeriesAvailable: ["A4", "C", "D", "TI"],
      probatoire: "1ere",
      bacCoefficientsApplyAt: "Tle",
      roleTitles: {
        ADMIN:            "Proviseur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 2. CES — Collège d'Enseignement Secondaire francophone ─────────────────
  // 1er cycle uniquement (6e → 3e). Pas de 2nd cycle.
  // Exemple : CES de Mfou, CES de Mbalmayo
  {
    code: "CES_FR",
    name: "Collège d'Enseignement Secondaire francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "6e", serie: null, filiere: null },
        { level: "5e", serie: null, filiere: null },
        { level: "4e", serie: null, filiere: null },
        { level: "3e", serie: null, filiere: null },
      ],
      firstCycleOnly: true,
      officialExams: ["BEPC"],
      roleTitles: {
        ADMIN:            "Directeur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 3. Institut privé francophone ──────────────────────────────────────────
  // Établissements privés laïcs ou confessionnels francophones.
  // Même structure qu'un lycée FR. Le code ownership différencie public/privé.
  // Exemples : Institut Samba, Collège La Salle, etc.
  {
    code: "PRIVE_FR",
    name: "Établissement privé francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PRIVATE_SECULAR" as const,
    config: {
      classes: [
        { level: "6e",   serie: null, filiere: null },
        { level: "5e",   serie: null, filiere: null },
        { level: "4e",   serie: null, filiere: null },
        { level: "3e",   serie: null, filiere: null },
        { level: "2nde", serie: "A4", filiere: null },
        { level: "2nde", serie: "C",  filiere: null },
        { level: "1ere", serie: "A4", filiere: null },
        { level: "1ere", serie: "C",  filiere: null },
        { level: "1ere", serie: "D",  filiere: null },
        { level: "1ere", serie: "TI", filiere: null },
        { level: "Tle",  serie: "A4", filiere: null },
        { level: "Tle",  serie: "C",  filiere: null },
        { level: "Tle",  serie: "D",  filiere: null },
        { level: "Tle",  serie: "TI", filiere: null },
      ],
      officialExams: ["BEPC", "PROBATOIRE", "BAC"],
      bacSeriesAvailable: ["A4", "C", "D", "TI"],
      probatoire: "1ere",
      bacCoefficientsApplyAt: "Tle",
      isPrivate: true,
      roleTitles: {
        ADMIN:            "Directeur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 4. Lycée Technique francophone ─────────────────────────────────────────
  // CAP (4 ans) + BT (3 ans). Filières industrielles et tertiaires.
  // Chef des Travaux obligatoire. Sous-groupes TP. Notes pratique/théorie séparées.
  {
    code: "LYCEE_TECHNIQUE_FR",
    name: "Lycée Technique francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "TECHNICAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "CAP1", serie: null, filiere: "F1" },
        { level: "CAP1", serie: null, filiere: "G2" },
        { level: "CAP2", serie: null, filiere: "F1" },
        { level: "CAP2", serie: null, filiere: "G2" },
        { level: "CAP3", serie: null, filiere: "F1" },
        { level: "CAP3", serie: null, filiere: "G2" },
        { level: "CAP4", serie: null, filiere: "F1" },
        { level: "CAP4", serie: null, filiere: "G2" },
        { level: "BT1",  serie: null, filiere: "F1" },
        { level: "BT1",  serie: null, filiere: "G2" },
        { level: "BT2",  serie: null, filiere: "F1" },
        { level: "BT2",  serie: null, filiere: "G2" },
        { level: "BT3",  serie: null, filiere: "F1" },
        { level: "BT3",  serie: null, filiere: "G2" },
      ],
      officialExams: ["CAP", "PROBATOIRE_TECHNIQUE", "BT"],
      subGroupEnabled: true,
      hasPracticalGrades: true,
      hasProfessionalAttitude: true,
      hasInternships: true,
      roleTitles: {
        ADMIN:            "Proviseur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_WORKS:      "Chef des Travaux",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 5. CETIC ───────────────────────────────────────────────────────────────
  // Collège d'Enseignement Technique Industriel et Commercial.
  // CAP uniquement (4 ans). Pas de BT. 1er cycle technique.
  {
    code: "CETIC",
    name: "Collège d'Enseignement Technique Industriel et Commercial",
    subsystem: "FRANCOPHONE" as const,
    educationType: "TECHNICAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "CAP1", serie: null, filiere: "F1" },
        { level: "CAP1", serie: null, filiere: "G2" },
        { level: "CAP2", serie: null, filiere: "F1" },
        { level: "CAP2", serie: null, filiere: "G2" },
        { level: "CAP3", serie: null, filiere: "F1" },
        { level: "CAP3", serie: null, filiere: "G2" },
        { level: "CAP4", serie: null, filiere: "F1" },
        { level: "CAP4", serie: null, filiere: "G2" },
      ],
      officialExams: ["CAP"],
      firstCycleOnly: true,
      subGroupEnabled: true,
      hasPracticalGrades: true,
      hasProfessionalAttitude: true,
      roleTitles: {
        ADMIN:            "Directeur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_WORKS:      "Chef des Travaux",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 6. SAR-SM ──────────────────────────────────────────────────────────────
  // Section Artisanale Rurale (SAR) + Section Ménagère (SM).
  // Formation professionnelle courte, zones rurales. 2 ans.
  {
    code: "SAR_SM",
    name: "Section Artisanale Rurale / Section Ménagère",
    subsystem: "FRANCOPHONE" as const,
    educationType: "PROFESSIONAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Année1", serie: null, filiere: "SAR" },
        { level: "Année2", serie: null, filiere: "SAR" },
        { level: "Année1", serie: null, filiere: "SM"  },
        { level: "Année2", serie: null, filiere: "SM"  },
      ],
      hasPracticalGrades: true,
      isRural: true,
      roleTitles: {
        ADMIN:   "Directeur",
        TEACHER: "Moniteur / Monitrice",
      },
    },
  },

  // ── 7. CFM ─────────────────────────────────────────────────────────────────
  // Centre de Formation des Métiers. Formation professionnelle courte.
  // Filières : SAR, SM, Couture, et autres selon le centre.
  {
    code: "CFM",
    name: "Centre de Formation des Métiers",
    subsystem: "FRANCOPHONE" as const,
    educationType: "PROFESSIONAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Année1", serie: null, filiere: "SAR"     },
        { level: "Année2", serie: null, filiere: "SAR"     },
        { level: "Année1", serie: null, filiere: "SM"      },
        { level: "Année2", serie: null, filiere: "SM"      },
        { level: "Année1", serie: null, filiere: "COUTURE" },
        { level: "Année2", serie: null, filiere: "COUTURE" },
      ],
      hasPracticalGrades: true,
      isRural: true,
      roleTitles: {
        ADMIN:   "Directeur",
        TEACHER: "Formateur / Formatrice",
      },
    },
  },

  // ── 8. École primaire francophone ──────────────────────────────────────────
  // SIL (Sous-Initiation à la Lecture) → CM2.
  // Examen officiel : CEPE en CM2 + Concours d'entrée en 6e.
  // Un seul instituteur par classe. Directeur = admin.
  {
    code: "PRIMAIRE_FR",
    name: "École primaire francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "PRIMARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "SIL", serie: null, filiere: null },
        { level: "CP",  serie: null, filiere: null },
        { level: "CE1", serie: null, filiere: null },
        { level: "CE2", serie: null, filiere: null },
        { level: "CM1", serie: null, filiere: null },
        { level: "CM2", serie: null, filiere: null },
      ],
      officialExams: ["CEPE", "CONCOURS_6EME"],
      apcSystem: true,
      totalPoints: 300,
      gradingSystem: "COMPETENCY_BASED",
      bulletinTemplate: "PRIMARY",
      attendanceTwiceDaily: true,
      unitsPerYear: 8,
      unitsPerTerm: [3, 3, 2],
      subjectScales: {
        "Français":                30,
        "Anglais":                 30,
        "Mathématiques":           40,
        "Sciences et Technologie": 40,
        "TIC":                     40,
        "Histoire-Géographie":     20,
        "Éducation Morale + EPS":  20,
        "Éducation Artistique":    20,
        "Sport":                   20,
        "Développement Personnel": 20,
        "Langue Nationale":        20,
      },
      subjectsFromCE1: ["Histoire", "Géographie"],
      promotionByLevel: true,
      levels: [
        { name: "Niveau 1", classes: ["SIL", "CP"], collectivePromotion: true },
        { name: "Niveau 2", classes: ["CE1", "CE2"], collectivePromotion: true },
        { name: "Niveau 3", classes: ["CM1", "CM2"], collectivePromotion: true },
      ],
      teacherHasFinalDecision: true,
      roleTitles: {
        ADMIN:   "Directeur",
        TEACHER: "Instituteur / Institutrice",
      },
    },
  },

  // ── 9. Maternelle francophone ──────────────────────────────────────────────
  // Petite / Moyenne / Grande section.
  // Évaluation par compétences (pas de notes chiffrées).
  {
    code: "MATERNELLE_FR",
    name: "Maternelle francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "PRESCHOOL" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Petite section",  serie: null, filiere: null },
        { level: "Moyenne section", serie: null, filiere: null },
        { level: "Grande section",  serie: null, filiere: null },
      ],
      gradingSystem: "COMPETENCY_BASED",
      roleTitles: {
        ADMIN:   "Directeur",
        TEACHER: "Institutrice de maternelle",
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTÈME ANGLOPHONE (5 templates)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 10. GHS — Government High School anglophone ────────────────────────────
  // Form 1-5 (O-Level) + Lower Sixth + Upper Sixth (A-Level).
  // Examen : GCE O-Level (Form 5) + GCE A-Level (Upper Sixth).
  // Notes sur 100. Pass mark = 40%.
  {
    code: "GHS_EN",
    name: "Government High School (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Form1",      serie: null, filiere: null },
        { level: "Form2",      serie: null, filiere: null },
        { level: "Form3",      serie: null, filiere: null },
        { level: "Form4",      serie: null, filiere: null },
        { level: "Form5",      serie: null, filiere: null },
        { level: "LowerSixth", serie: null, filiere: null },
        { level: "UpperSixth", serie: null, filiere: null },
      ],
      officialExams: ["GCE_O_LEVEL", "GCE_A_LEVEL"],
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      roleTitles: {
        ADMIN:            "Principal",
        STAFF_DEPUTY:     "Vice-Principal",
        STAFF_DISCIPLINE: "Discipline Master",
        STAFF_FINANCE:    "Bursar",
        STAFF_HOD:        "Head of Department (HOD)",
      },
    },
  },

  // ── 11. GSS — Government Secondary School anglophone ──────────────────────
  // Form 1-5 uniquement. Pas d'A-Level.
  // Examen : GCE O-Level seulement.
  {
    code: "GSS_EN",
    name: "Government Secondary School (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Form1", serie: null, filiere: null },
        { level: "Form2", serie: null, filiere: null },
        { level: "Form3", serie: null, filiere: null },
        { level: "Form4", serie: null, filiere: null },
        { level: "Form5", serie: null, filiere: null },
      ],
      firstCycleOnly: true,
      officialExams: ["GCE_O_LEVEL"],
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      roleTitles: {
        ADMIN:            "Principal",
        STAFF_DEPUTY:     "Vice-Principal",
        STAFF_DISCIPLINE: "Discipline Master",
        STAFF_FINANCE:    "Bursar",
      },
    },
  },

  // ── 12. Private school anglophone ──────────────────────────────────────────
  // Même structure qu'un GHS mais privé (laïc ou confessionnel).
  // Exemples : Presbyterian Secondary School, Baptist High School, etc.
  {
    code: "PRIVE_EN",
    name: "Private school (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PRIVATE_SECULAR" as const,
    config: {
      classes: [
        { level: "Form1",      serie: null, filiere: null },
        { level: "Form2",      serie: null, filiere: null },
        { level: "Form3",      serie: null, filiere: null },
        { level: "Form4",      serie: null, filiere: null },
        { level: "Form5",      serie: null, filiere: null },
        { level: "LowerSixth", serie: null, filiere: null },
        { level: "UpperSixth", serie: null, filiere: null },
      ],
      officialExams: ["GCE_O_LEVEL", "GCE_A_LEVEL"],
      isPrivate: true,
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      roleTitles: {
        ADMIN:            "Principal",
        STAFF_DEPUTY:     "Vice-Principal",
        STAFF_DISCIPLINE: "Discipline Master",
        STAFF_FINANCE:    "Bursar",
      },
    },
  },

  // ── 13. GTHS — Government Technical College & High School (anglophone) ─────
  // Miroir anglophone de LYCEE_TECHNIQUE_FR. Form1→Form4 (1er cycle technique,
  // CAP) puis LowerSixth/UpperSixth (2nd cycle, Probatoire Technique → Bac
  // Technique). Filières STT (Tertiary Sciences & Technology) & IND (Industrial
  // Sciences & Technology) — confirmées sur le site officiel MINESEC anglais,
  // équivalents fonctionnels des filières F1/G2 francophones (voir technical.ts).
  // roleTitles STAFF_WORKS ("Vice Principal (Technical)") : titre raisonnable
  // mais NON confirmé par une source officielle indépendante — à vérifier
  // auprès d'un établissement réel avant de le considérer comme figé.
  {
    code: "GTC_GTHS_EN",
    name: "Government Technical College & High School",
    subsystem: "ANGLOPHONE" as const,
    educationType: "TECHNICAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Form1", serie: null, filiere: "STT" },
        { level: "Form1", serie: null, filiere: "IND" },
        { level: "Form2", serie: null, filiere: "STT" },
        { level: "Form2", serie: null, filiere: "IND" },
        { level: "Form3", serie: null, filiere: "STT" },
        { level: "Form3", serie: null, filiere: "IND" },
        { level: "Form4", serie: null, filiere: "STT" },
        { level: "Form4", serie: null, filiere: "IND" },
        { level: "LowerSixth", serie: null, filiere: "STT" },
        { level: "LowerSixth", serie: null, filiere: "IND" },
        { level: "UpperSixth", serie: null, filiere: "STT" },
        { level: "UpperSixth", serie: null, filiere: "IND" },
      ],
      officialExams: ["CAP", "PROBATOIRE_TECHNIQUE", "BAC_TECHNIQUE"],
      subGroupEnabled: true,
      hasPracticalGrades: true,
      hasProfessionalAttitude: true,
      hasInternships: true,
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      roleTitles: {
        ADMIN:            "Principal",
        STAFF_DEPUTY:     "Vice-Principal",
        STAFF_WORKS:      "Vice Principal (Technical)",
        STAFF_DISCIPLINE: "Discipline Master",
        STAFF_FINANCE:    "Bursar",
      },
    },
  },

  // ── 14. GTC — Government Technical College (anglophone) ────────────────────
  // Miroir anglophone de CETIC. Form1→Form4 uniquement (1er cycle technique,
  // CAP). Pas de 2nd cycle. GGTC (Girls Technical College) = même programme,
  // admission filles — géré via School.admissionType, pas un template séparé.
  {
    code: "GTC_EN",
    name: "Government Technical College",
    subsystem: "ANGLOPHONE" as const,
    educationType: "TECHNICAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Form1", serie: null, filiere: "STT" },
        { level: "Form1", serie: null, filiere: "IND" },
        { level: "Form2", serie: null, filiere: "STT" },
        { level: "Form2", serie: null, filiere: "IND" },
        { level: "Form3", serie: null, filiere: "STT" },
        { level: "Form3", serie: null, filiere: "IND" },
        { level: "Form4", serie: null, filiere: "STT" },
        { level: "Form4", serie: null, filiere: "IND" },
      ],
      officialExams: ["CAP"],
      firstCycleOnly: true,
      subGroupEnabled: true,
      hasPracticalGrades: true,
      hasProfessionalAttitude: true,
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      roleTitles: {
        ADMIN:            "Principal",
        STAFF_DEPUTY:     "Vice-Principal",
        STAFF_WORKS:      "Vice Principal (Technical)",
        STAFF_DISCIPLINE: "Discipline Master",
        STAFF_FINANCE:    "Bursar",
      },
    },
  },

  // ── 15. Primary School anglophone ──────────────────────────────────────────
  // Class 1 → Class 6. Examen : FSLC (First School Leaving Certificate) en Class 6
  // + Common Entrance pour intégrer Form 1.
  {
    code: "PRIMARY_EN",
    name: "Primary School (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "PRIMARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Class1", serie: null, filiere: null },
        { level: "Class2", serie: null, filiere: null },
        { level: "Class3", serie: null, filiere: null },
        { level: "Class4", serie: null, filiere: null },
        { level: "Class5", serie: null, filiere: null },
        { level: "Class6", serie: null, filiere: null },
      ],
      officialExams: ["FSLC", "COMMON_ENTRANCE"],
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      // Confirmé terrain : Groupe Scolaire Bilingue Le Québécois, Class 5, 2025-2026
      // Bulletin mensuel (Month 1 Term 1) — pas trimestriel
      // Notes sur barèmes variables (40, 70, 10, 15...) — pas sur 20 ou 100 fixes
      monthlyReportCard: true,
      gradingVariableScale: true,
      bulletinTemplate: "MONTHLY",
      roleTitles: {
        ADMIN:   "Head Teacher",
        TEACHER: "Class Teacher",
      },
    },
  },

  // ── 16. Nursery School anglophone ──────────────────────────────────────────
  // PreNursery, Nursery 1, Nursery 2. Évaluation par compétences.
  {
    code: "NURSERY_EN",
    name: "Nursery School (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "PRESCHOOL" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "PreNursery", serie: null, filiere: null },
        { level: "Nursery1",   serie: null, filiere: null },
        { level: "Nursery2",   serie: null, filiere: null },
      ],
      gradingSystem: "COMPETENCY_BASED",
      roleTitles: {
        ADMIN:   "Head Teacher",
        TEACHER: "Nursery Teacher",
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BILINGUE (2 templates)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 17. Lycée bilingue secondaire ──────────────────────────────────────────
  // Deux sections coexistant dans le même établissement :
  //   Section FR : 6e→Tle, séries A4/ABI/C/D/TI (ABI spécifique au bilingue)
  //   Section EN : Form 1→UpperSixth
  // Proviseur général supervise les deux sections.
  // Censeur (section FR) + Vice-Principal (section EN).
  // Certains enseignants peuvent enseigner dans les deux sections.
  {
    code: "LYCEE_BILINGUE",
    name: "Lycée bilingue (sections FR + EN)",
    subsystem: "BILINGUAL" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      isBilingual: true,
      sections: [
        {
          code: "FR",
          name: "Section Francophone",
          gradingSystem: "OUT_OF_20",
          passmark: 10,
        },
        {
          code: "EN",
          name: "Anglophone Section",
          gradingSystem: "OUT_OF_100",
          passmark: 40,
        },
      ],
      // Section FR : ABI disponible (série bilingue, code OBC: BAABI)
      // Note : ABI démarre en 2nde dans les lycées bilingues
      classesFR: [
        { level: "6e",   serie: null  },
        { level: "5e",   serie: null  },
        { level: "4e",   serie: null  },
        { level: "3e",   serie: null  },
        { level: "2nde", serie: "A4"  },
        { level: "2nde", serie: "ABI" },
        { level: "2nde", serie: "C"   },
        { level: "1ere", serie: "A4"  },
        { level: "1ere", serie: "ABI" },
        { level: "1ere", serie: "C"   },
        { level: "1ere", serie: "D"   },
        { level: "1ere", serie: "TI"  },
        { level: "Tle",  serie: "A4"  },
        { level: "Tle",  serie: "ABI" },
        { level: "Tle",  serie: "C"   },
        { level: "Tle",  serie: "D"   },
        { level: "Tle",  serie: "TI"  },
      ],
      // Section EN : Form 1-5 + Sixth Form
      classesEN: [
        { level: "Form1"      },
        { level: "Form2"      },
        { level: "Form3"      },
        { level: "Form4"      },
        { level: "Form5"      },
        { level: "LowerSixth" },
        { level: "UpperSixth" },
      ],
      officialExams: ["BEPC", "PROBATOIRE", "BAC", "GCE_O_LEVEL", "GCE_A_LEVEL"],
      roleTitles: {
        ADMIN:               "Proviseur",
        STAFF_DEPUTY_FR:     "Censeur",
        STAFF_DEPUTY_EN:     "Vice-Principal",
        STAFF_DISCIPLINE:    "Surveillant Général / Discipline Master",
        STAFF_FINANCE:       "Intendant / Bursar",
      },
    },
  },

  // ── 18. École primaire bilingue ────────────────────────────────────────────
  // Section FR (SIL→CM2) + Section EN (Class 1→Class 6) dans le même bâtiment.
  {
    code: "PRIMARY_BILINGUAL",
    name: "École primaire bilingue",
    subsystem: "BILINGUAL" as const,
    educationType: "GENERAL" as const,
    level: "PRIMARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      isBilingual: true,
      sections: [
        { code: "FR", name: "Section Francophone", gradingSystem: "OUT_OF_20",  passmark: 10 },
        { code: "EN", name: "Anglophone Section",  gradingSystem: "OUT_OF_100", passmark: 40 },
      ],
      attendanceTwiceDaily: true,
      apcSystem: true,
      unitsPerYear: 8,
      unitsPerTerm: [3, 3, 2],
      classesFR: [
        { level: "SIL" }, { level: "CP"  }, { level: "CE1" },
        { level: "CE2" }, { level: "CM1" }, { level: "CM2" },
      ],
      classesEN: [
        { level: "Class1" }, { level: "Class2" }, { level: "Class3" },
        { level: "Class4" }, { level: "Class5" }, { level: "Class6" },
      ],
      officialExams: ["CEPE", "FSLC", "COMMON_ENTRANCE"],
      teacherHasFinalDecision: true,
      roleTitles: {
        ADMIN:      "Directeur / Head Teacher",
        TEACHER_FR: "Instituteur / Institutrice",
        TEACHER_EN: "Class Teacher",
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-NIVEAUX (1 template)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 19. Complexe scolaire ──────────────────────────────────────────────────
  // Établissement regroupant plusieurs cycles sous une direction générale.
  // Exemples : Complexe Scolaire Excellence, Institut Polyvalent…
  // Ce template crée la structure de base uniquement.
  // Chaque cycle est configuré séparément après approbation.
  {
    code: "COMPLEXE_SCOLAIRE",
    name: "Complexe scolaire (multi-niveaux)",
    subsystem: "BILINGUAL" as const,
    educationType: "MIXED" as const,
    level: "MULTI" as const,
    ownership: "PRIVATE_SECULAR" as const,
    config: {
      isMultiLevel: true,
      levels: ["PRESCHOOL", "PRIMARY", "SECONDARY"],
      note: "Structure de base — chaque cycle est configuré séparément par l'admin.",
      roleTitles: {
        ADMIN: "Directeur Général",
      },
    },
  },
];

// ─── MATIÈRES PAR DÉFAUT PAR TEMPLATE ────────────────────────────────────────
// Stockées dans SchoolTemplate.config au moment du seed.
// Le use case d'activation les lit pour créer les Subject records de l'école.
// coefficient = coefficient standard (1er cycle FR) ou barème max (primaire).

type SubjectDef = {
  name: string
  code: string
  coefficient: number
  hoursPerWeek?: number
  subjectType?: 'THEORETICAL' | 'PRACTICAL' | 'MIXED'
}

const FR_SEC_SUBJECTS: SubjectDef[] = [
  { name: "Français",            code: "FR",    coefficient: 4, hoursPerWeek: 5 },
  { name: "Mathématiques",       code: "MATHS", coefficient: 4, hoursPerWeek: 4 },
  { name: "SVTEEHB",             code: "SVT",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Physique",            code: "PHY",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Chimie",              code: "CHIM",  coefficient: 2, hoursPerWeek: 2 },
  { name: "Histoire-Géographie", code: "HG",    coefficient: 2, hoursPerWeek: 3 },
  { name: "Anglais",             code: "ANG",   coefficient: 2, hoursPerWeek: 3 },
  { name: "LV2",                 code: "LV2",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Éducation Civique",   code: "EC",    coefficient: 1, hoursPerWeek: 1 },
  { name: "EPS",                 code: "EPS",   coefficient: 1, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
]

const TECH_FR_SUBJECTS: SubjectDef[] = [
  { name: "Français",            code: "FR",    coefficient: 2, hoursPerWeek: 3 },
  { name: "Mathématiques",       code: "MATHS", coefficient: 2, hoursPerWeek: 3 },
  { name: "Anglais",             code: "ANG",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Sciences Physiques",  code: "SP",    coefficient: 2, hoursPerWeek: 2 },
  { name: "Éducation Civique",   code: "EC",    coefficient: 1, hoursPerWeek: 1 },
  { name: "EPS",                 code: "EPS",   coefficient: 1, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
  { name: "Technologie",         code: "TECH",  coefficient: 6, hoursPerWeek: 6, subjectType: 'MIXED' },
  { name: "Travaux Pratiques",   code: "TP",    coefficient: 6, hoursPerWeek: 6, subjectType: 'PRACTICAL' },
]

const SAR_CFM_SUBJECTS: SubjectDef[] = [
  { name: "Pratique Atelier",         code: "PRATIQUE", coefficient: 6, hoursPerWeek: 6, subjectType: 'PRACTICAL' },
  { name: "Calcul Professionnel",      code: "CALCUL",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Français / Communication", code: "FR",       coefficient: 2, hoursPerWeek: 2 },
  { name: "Éducation Physique",        code: "EPS",      coefficient: 1, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
]

// Matières traditionnelles primaire FR (coefficients = 300 au total).
// NON utilisées à l'activation APC — les écoles primaires utilisent primaire-apc.ts (260 pts).
// Conservées ici comme référence pour les modes d'évaluation non-APC.
const PRIMAIRE_FR_SUBJECTS: SubjectDef[] = [
  { name: "Français",                code: "FR",    coefficient: 30, hoursPerWeek: 5 },
  { name: "Anglais",                 code: "ANG",   coefficient: 30, hoursPerWeek: 3 },
  { name: "Mathématiques",           code: "MATHS", coefficient: 40, hoursPerWeek: 5 },
  { name: "Sciences et Technologie", code: "SCI",   coefficient: 40, hoursPerWeek: 3 },
  { name: "TIC",                     code: "TIC",   coefficient: 40, hoursPerWeek: 2 },
  { name: "Histoire-Géographie",     code: "HG",    coefficient: 20, hoursPerWeek: 2 },
  { name: "Éducation Morale + EPS",  code: "MEPS",  coefficient: 20, hoursPerWeek: 2 },
  { name: "Éducation Artistique",    code: "EA",    coefficient: 20, hoursPerWeek: 1 },
  { name: "Sport",                   code: "SPORT", coefficient: 20, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
  { name: "Développement Personnel", code: "DP",    coefficient: 20, hoursPerWeek: 1 },
  { name: "Langue Nationale",        code: "LN",    coefficient: 20, hoursPerWeek: 1 },
]

const EN_SEC_SUBJECTS: SubjectDef[] = [
  { name: "English Language",             code: "ENG",   coefficient: 4, hoursPerWeek: 5 },
  { name: "French",                       code: "FR",    coefficient: 3, hoursPerWeek: 3 },
  { name: "Mathematics",                  code: "MATHS", coefficient: 4, hoursPerWeek: 4 },
  { name: "Biology",                      code: "BIO",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Chemistry",                    code: "CHEM",  coefficient: 2, hoursPerWeek: 2 },
  { name: "Physics",                      code: "PHY",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Geography",                    code: "GEO",   coefficient: 2, hoursPerWeek: 2 },
  { name: "History",                      code: "HIST",  coefficient: 2, hoursPerWeek: 2 },
  { name: "Computer Science",             code: "CS",    coefficient: 2, hoursPerWeek: 2 },
  { name: "Citizenship Education",        code: "CE",    coefficient: 1, hoursPerWeek: 1 },
  { name: "Physical & Health Education",  code: "PHE",   coefficient: 1, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
]

// barèmes variables par école — valeurs indicatives terrain
const PRIMARY_EN_SUBJECTS: SubjectDef[] = [
  { name: "English Language",            code: "ENG",   coefficient: 40, hoursPerWeek: 5 },
  { name: "French",                      code: "FR",    coefficient: 30, hoursPerWeek: 3 },
  { name: "Mathematics",                 code: "MATHS", coefficient: 40, hoursPerWeek: 4 },
  { name: "Sciences",                    code: "SCI",   coefficient: 20, hoursPerWeek: 2 },
  { name: "Social Studies",              code: "SS",    coefficient: 20, hoursPerWeek: 2 },
  { name: "Religious Studies",           code: "RS",    coefficient: 15, hoursPerWeek: 1 },
  { name: "Physical & Health Education", code: "PHE",   coefficient: 10, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
  { name: "Arts & Crafts",               code: "AC",    coefficient: 10, hoursPerWeek: 1, subjectType: 'PRACTICAL' },
]

// fr = sujets section FR (aussi utilisé pour templates purement FR)
// en = sujets section EN (bilingual + purement EN)
const TEMPLATE_SUBJECTS: Record<string, { fr?: SubjectDef[]; en?: SubjectDef[] }> = {
  LYCEE_FR:           { fr: FR_SEC_SUBJECTS },
  CES_FR:             { fr: FR_SEC_SUBJECTS },
  PRIVE_FR:           { fr: FR_SEC_SUBJECTS },
  LYCEE_TECHNIQUE_FR: { fr: TECH_FR_SUBJECTS },
  CETIC:              { fr: TECH_FR_SUBJECTS },
  SAR_SM:             { fr: SAR_CFM_SUBJECTS },
  CFM:                { fr: SAR_CFM_SUBJECTS },
  PRIMAIRE_FR:        { fr: PRIMAIRE_FR_SUBJECTS },
  MATERNELLE_FR:      {},
  GHS_EN:             { en: EN_SEC_SUBJECTS },
  GSS_EN:             { en: EN_SEC_SUBJECTS },
  PRIVE_EN:           { en: EN_SEC_SUBJECTS },
  PRIMARY_EN:         { en: PRIMARY_EN_SUBJECTS },
  NURSERY_EN:         {},
  LYCEE_BILINGUE:     { fr: FR_SEC_SUBJECTS,       en: EN_SEC_SUBJECTS },
  PRIMARY_BILINGUAL:  { fr: PRIMAIRE_FR_SUBJECTS,  en: PRIMARY_EN_SUBJECTS },
  COMPLEXE_SCOLAIRE:  {},
}

// ─── SUBJECT PACKS ──────────────────────────────────────────────────────────
// Packs de matières par défaut qu'un Admin peut accepter en un clic
// lors de l'activation de son école. Stockés dans SchoolTemplate.config.subjectPacks.

type SubjectPackItem = { name: string; code: string; coefficient: number; optional?: boolean }

const CYCLE1_FR_PACK: SubjectPackItem[] = [
  { name: "Français",            code: "FR",    coefficient: 4 },
  { name: "Mathématiques",       code: "MATHS", coefficient: 4 },
  { name: "Sciences",            code: "SCI",   coefficient: 2 },
  { name: "Histoire-Géographie", code: "HG",    coefficient: 2 },
  { name: "Anglais LV1",         code: "ANG",   coefficient: 2 },
  { name: "Éducation Civique",   code: "EC",    coefficient: 1 },
  { name: "EPS",                 code: "EPS",   coefficient: 1 },
  { name: "LV2",                 code: "LV2",   coefficient: 2, optional: true },
]

const PRIMAIRE_FR_BASE_PACK: SubjectPackItem[] = [
  { name: "Français",      code: "FR",    coefficient: 30 },
  { name: "Mathématiques", code: "MATHS", coefficient: 40 },
  { name: "Éveil",         code: "EVEIL", coefficient: 20 },
  { name: "EPS",           code: "EPS",   coefficient: 20 },
  { name: "Religion",      code: "REL",   coefficient: 0,  optional: true },
]

const PRIMAIRE_FR_CE1_PLUS_PACK: SubjectPackItem[] = [
  { name: "Sciences/TIC",        code: "SCI",   coefficient: 40 },
  { name: "Histoire",            code: "HIST",  coefficient: 20 },
  { name: "Géographie",          code: "GEO",   coefficient: 20 },
  { name: "Langue Nationale",    code: "LN",    coefficient: 20 },
]

const TEMPLATE_SUBJECT_PACKS: Record<string, { cycle1?: SubjectPackItem[]; cycle2?: SubjectPackItem[]; primaire?: SubjectPackItem[]; primaireCE1Plus?: SubjectPackItem[] }> = {
  LYCEE_FR:           { cycle1: CYCLE1_FR_PACK, cycle2: undefined }, // cycle2 = BacCoefficients au moment de l'activation
  PRIVE_FR:           { cycle1: CYCLE1_FR_PACK, cycle2: undefined },
  CES_FR:             { cycle1: CYCLE1_FR_PACK },
  PRIMAIRE_FR:        { primaire: PRIMAIRE_FR_BASE_PACK, primaireCE1Plus: PRIMAIRE_FR_CE1_PLUS_PACK },
  MATERNELLE_FR:      {},
  LYCEE_TECHNIQUE_FR: {},
  CETIC:              {},
  SAR_SM:             {},
  CFM:                {},
  GHS_EN:             {},
  GSS_EN:             {},
  PRIVE_EN:           {},
  PRIMARY_EN:         {},
  NURSERY_EN:         {},
  LYCEE_BILINGUE:     { cycle1: CYCLE1_FR_PACK, cycle2: undefined },
  PRIMARY_BILINGUAL:  { primaire: PRIMAIRE_FR_BASE_PACK, primaireCE1Plus: PRIMAIRE_FR_CE1_PLUS_PACK },
  COMPLEXE_SCOLAIRE:  {},
}

// ─── FORMULES DE NOTES PAR DÉFAUT ────────────────────────────────────────────
// isDefault=true + schoolId null → règles système, non liées à une école.
// Appliquées automatiquement à l'activation selon le type de template.

const defaultGradeFormulas = [
  {
    id: "default-fr",
    label: "Formule séquentielle FR standard — une note DS par séquence",
    // Cas majoritaire : l'enseignant saisit une seule note (DS) par séquence.
    // Moyenne trimestre = (Séq1 + Séq2) ÷ 2
    // Le CC existe dans certains établissements (ex: Le Québécois) → formule configurable par école.
    evaluations: [
      { code: "DS", label: "Devoir Surveillé", weight: 100, count: 1 },
    ],
    isDefault: true,
  },
  {
    id: "default-en",
    label: "Default EN formula — Class Tests 30% + Terminal Exam 70%",
    // Valeur provisoire à confirmer terrain
    evaluations: [
      { code: "CLASS_TEST",    label: "Class Test",    weight: 30, count: 2 },
      { code: "TERMINAL_EXAM", label: "Terminal Exam", weight: 70, count: 1 },
    ],
    isDefault: true,
  },
  {
    id: "default-technique-fr",
    label: "Formule technique FR — Éval 1 + Éval 2 (50/50 par trimestre)",
    // Source : LYCEE_TECHNIQUE_FR, CETIC — 2 évaluations séparées par trimestre
    // Notes théorie et pratique saisies séparément (bulletin technique)
    evaluations: [
      { code: "EVAL1", label: "Évaluation 1", weight: 50, count: 1 },
      { code: "EVAL2", label: "Évaluation 2", weight: 50, count: 1 },
    ],
    isDefault: true,
  },
];

// ─── RÈGLES DE MENTION PAR DÉFAUT ────────────────────────────────────────────

const defaultMentionRules = [
  {
    id: "default-fr-mentions",
    rules: [
      { label: "Excellent",      min: 18,  max: 20    },
      { label: "Très Bien",      min: 16,  max: 17.99 },
      { label: "Bien",           min: 14,  max: 15.99 },
      { label: "Assez Bien",     min: 12,  max: 13.99 },
      { label: "Passable",       min: 10,  max: 11.99 },
      { label: "Insuffisant",    min: 8,   max: 9.99  },
      { label: "T. Insuffisant", min: 6,   max: 7.99  },
      { label: "Médiocre",       min: 0,   max: 5.99  },
    ],
    isDefault: true,
  },
  {
    id: "default-en-mentions",
    rules: [
      { label: "Excellent",  min: 18,  max: 20    },
      { label: "Very Good",  min: 16,  max: 17.99 },
      { label: "Good",       min: 14,  max: 15.99 },
      { label: "Fair",       min: 12,  max: 13.99 },
      { label: "Pass",       min: 10,  max: 11.99 },
      { label: "Poor",       min: 0,   max: 9.99  },
    ],
    isDefault: true,
  },
  {
    id: "default-apc-mentions",
    // Source : grille MINEDUB APC primaire — cotes sur /20
    rules: [
      { label: "Expert", min: 18,    max: 20    },
      { label: "Acquis", min: 15,    max: 17.99 },
      { label: "ECA",    min: 11,    max: 14.99 },
      { label: "NA",     min: 0,     max: 10.99 },
    ],
    isDefault: true,
  },
];

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 EduNexus — Phase 0 seed\n");

  // 0. SchoolTemplates (17) — seed FIRST to satisfy FK constraints on reference data
  console.log("\n🏫 Seeding SchoolTemplates...");
  for (const t of schoolTemplates) {
    const subs = TEMPLATE_SUBJECTS[t.code] ?? {}
    const packs = TEMPLATE_SUBJECT_PACKS[t.code] ?? {}
    const mergedConfig = {
      ...(t.config as any),
      ...(subs.fr ? { defaultSubjects: subs.fr } : {}),
      ...(subs.en ? { defaultSubjectsEN: subs.en } : {}),
      ...(Object.keys(packs).length > 0 ? { subjectPacks: packs } : {}),
    }
    await prisma.schoolTemplate.upsert({
      where:  { code: t.code },
      update: { config: mergedConfig as any, name: t.name },
      create: {
        code: t.code,
        name: t.name,
        subsystem: t.subsystem,
        educationType: t.educationType,
        level: t.level,
        ownership: t.ownership,
        config: mergedConfig as any,
      },
    });
    const nbSubj = (subs.fr?.length ?? 0) + (subs.en?.length ?? 0);
    console.log(`   ✓ ${t.code}${nbSubj ? ` (${nbSubj} matières)` : ''}`);
  }
  console.log(`   → ${schoolTemplates.length} templates seeded`);

  // 0a-b. Version v1 avec defaults SchoolConfig réels pour chaque template — V0.4 Phase 2
  // Defaults alignés sur la logique d'activation (passMark FR/EN, contributions MINESEC).
  console.log("\n🗂 Seeding SchoolTemplateVersion v1...");
  for (const t of schoolTemplates) {
    const meta = getTemplateMeta(t.code);
    const configDefaults = defaultsConfigLocalePourTemplate(meta) as Record<string, string | number | boolean>;
    await prisma.schoolTemplateVersion.upsert({
      where: { templateCode_version: { templateCode: t.code, version: 1 } },
      update: { config: configDefaults },
      create: {
        templateCode: t.code,
        version: 1,
        config: configDefaults,
        publishedAt: new Date(),
        active: true,
      },
    });
  }
  console.log(`   → ${schoolTemplates.length} versions v1 seeded`);

  // 0b. Sentinel template pour les données référençant "__ALL__"
  await prisma.schoolTemplate.upsert({
    where:  { code: "__ALL__" },
    update: { name: "Sentinel (tous templates)" },
    create: { code: "__ALL__", name: "Sentinel (tous templates)", subsystem: "FRANCOPHONE", educationType: "GENERAL", level: "SECONDARY", config: {} },
  });

  // ─── 1. Données de référence (FK → SchoolTemplate) ─────────────────────────

  // 1a. BacCoefficients
  console.log("\n🎓 Seeding BacCoefficients...");
  for (const coeff of bacCoefficients) {
    await prisma.bacCoefficient.upsert({
      where: {
        subjectName_serie_niveau_templateCode: {
          subjectName: coeff.subjectName,
          serie: coeff.serie,
          niveau: coeff.niveau,
          templateCode: coeff.templateCode,
        },
      },
      update: {
        coefficient: coeff.coefficient,
        groupe: coeff.groupe,
        source: coeff.source,
        isOfficialMinesec: coeff.isOfficialMinesec,
      },
      create: coeff,
    });
  }
  console.log(`   ✓ ${bacCoefficients.length} entrées`);

  // 1b. CycleCoefficients — 1er cycle FR (6e→3e) + primaire FR
  // Source : curriculum/francophone/premier-cycle.ts + primaire.ts
  console.log("\n📊 Seeding CycleCoefficients...");
  const allCycleEntries: { templateCode: string; classLevel: string; subjectName: string; coefficient: number; weeklyPeriods?: number; filiere: string }[] = [];
  for (const tc of CYCLE1_FR_TEMPLATES) {
    for (const lvl of premierCycleFR.levels) {
      for (const s of lvl.subjects) {
        allCycleEntries.push({ templateCode: tc, classLevel: lvl.level, subjectName: s.name, coefficient: s.coefficient, weeklyPeriods: s.hoursPerWeek, filiere: lvl.filiere });
      }
    }
  }
  for (const tc of PRIMAIRE_FR_TEMPLATES) {
    for (const lvl of primaireFR.levels) {
      for (const s of lvl.subjects) {
        allCycleEntries.push({ templateCode: tc, classLevel: lvl.level, subjectName: s.name, coefficient: s.coefficient, weeklyPeriods: s.hoursPerWeek, filiere: lvl.filiere });
      }
    }
  }
  // Technique (LYCEE_TECHNIQUE_FR, CETIC) — CAP1→4 + BT1→3, filières F1 & G2
  for (const tc of TECHNIQUE_FR_TEMPLATES) {
    for (const lvl of techniqueFR.levels) {
      for (const s of lvl.subjects) {
        allCycleEntries.push({ templateCode: tc, classLevel: lvl.level, subjectName: s.name, coefficient: s.coefficient, weeklyPeriods: s.hoursPerWeek, filiere: lvl.filiere });
      }
    }
  }
  // Professionnel (SAR_SM, CFM) — Année1→2, filières SAR / SM / COUTURE
  for (const tc of PROFESSIONNEL_FR_TEMPLATES) {
    for (const lvl of professionnelFR.levels) {
      for (const s of lvl.subjects) {
        allCycleEntries.push({ templateCode: tc, classLevel: lvl.level, subjectName: s.name, coefficient: s.coefficient, weeklyPeriods: s.hoursPerWeek, filiere: lvl.filiere });
      }
    }
  }
  // Nettoyage : la matière PEBS "Travail Manuel" (1er cycle FR) a été renommée "Manual Labour"
  // (cohérence avec la série ABI du 2nd cycle + programme bilingue). Le seed étant en upsert
  // additif, on retire l'ancienne ligne orpheline pour éviter un doublon avec la version générale FR.
  await prisma.cycleCoefficient.deleteMany({
    where: { filiere: 'FR_PEBS', subjectName: 'Travail Manuel', templateCode: { in: [...CYCLE1_FR_TEMPLATES] } },
  });
  for (const cc of allCycleEntries) {
    await prisma.cycleCoefficient.upsert({
      where: { templateCode_classLevel_subjectName_filiere: { templateCode: cc.templateCode, classLevel: cc.classLevel, subjectName: cc.subjectName, filiere: cc.filiere } },
      update: { coefficient: cc.coefficient, weeklyPeriods: cc.weeklyPeriods },
      create: cc,
    });
  }
  console.log(`   ✓ ${allCycleEntries.length} entrées`);

  // 1c. AnglophoneSubjectLoad — Form1→UpperSixth (EN) + Class1→6 (EN Primary)
  // Source : curriculum/anglophone/secondary.ts + primary.ts
  console.log("\n📚 Seeding AnglophoneSubjectLoad...");
  const aslSecondary = getAslEntries(ASL_TEMPLATES);
  const aslPrimary: { templateCode: string; classLevel: string; subjectName: string; coefficient: number; weeklyPeriods: number; filiere: string }[] = [];
  for (const tc of PRIMARY_EN_TEMPLATES) {
    for (const lvl of primaryEN.levels) {
      for (const s of lvl.subjects) {
        aslPrimary.push({ templateCode: tc, classLevel: lvl.level, subjectName: s.name, coefficient: s.coefficient, weeklyPeriods: s.hoursPerWeek, filiere: lvl.filiere });
      }
    }
  }
  // Technique (GTC_GTHS_EN, GTC_EN) — Form1→4 + LowerSixth/UpperSixth, filières STT & IND
  // Détail des matières APPROXIMATIF — voir avertissement dans anglophone/technical.ts
  const aslTechnique = getTechniqueAnEntries(TECHNICAL_EN_TEMPLATES);
  const allAslEntries = [...aslSecondary, ...aslPrimary, ...aslTechnique];
  for (const entry of allAslEntries) {
    await prisma.anglophoneSubjectLoad.upsert({
      where: { templateCode_classLevel_subjectName_filiere: { templateCode: entry.templateCode, classLevel: entry.classLevel, subjectName: entry.subjectName, filiere: entry.filiere } },
      update: { coefficient: entry.coefficient, weeklyPeriods: entry.weeklyPeriods },
      create: entry,
    });
  }
  console.log(`   ✓ ${allAslEntries.length} entrées (secondaire: ${aslSecondary.length}, primaire: ${aslPrimary.length})`);

    // 1d. OLevelSubject — codes d'examens officiels GCE O-Level (P2)
  console.log("\n📋 Seeding OLevelSubject...");
  const O_LEVEL_CODES: { subjectName: string; examCode: string }[] = [
    { subjectName: "English Language",        examCode: "0530" },
    { subjectName: "Literature in English",   examCode: "0531" },
    { subjectName: "French",                  examCode: "0570" },
    { subjectName: "Geography",               examCode: "0460" },
    { subjectName: "Economics",               examCode: "0455" },
    { subjectName: "History",                 examCode: "0470" },
    { subjectName: "Mathematics",             examCode: "0705" },
    { subjectName: "Additional Mathematics",  examCode: "0606" },
    { subjectName: "Biology",                 examCode: "0650" },
    { subjectName: "Chemistry",               examCode: "0651" },
    { subjectName: "Physics",                 examCode: "0652" },
    { subjectName: "Computer Science",        examCode: "0653" },
    { subjectName: "Geology",                 examCode: "0654" },
    { subjectName: "Food and Nutrition",      examCode: "0648" },
    { subjectName: "Human Biology",           examCode: "0655" },
    { subjectName: "Commerce",                examCode: "0710" },
    { subjectName: "Citizenship Education",   examCode: "0533" },
    { subjectName: "Logic",                   examCode: "0535" },
  ];
  let oLevelCount = 0;
  for (const entry of O_LEVEL_CODES) {
    await prisma.oLevelSubject.upsert({
      where:  { subjectName: entry.subjectName },
      update: { examCode: entry.examCode },
      create: entry,
    });
    oLevelCount++;
  }
  console.log(`   ✓ ${oLevelCount} entrées`);

  // 1e. ALevelSubject — codes d'examens officiels GCE A-Level (P2)
  console.log("\n📋 Seeding ALevelSubject...");
  const A_LEVEL_CODES: { subjectName: string; examCode: string }[] = [
    { subjectName: "English Language",        examCode: "9070" },
    { subjectName: "Literature in English",   examCode: "9071" },
    { subjectName: "French",                  examCode: "9090" },
    { subjectName: "Geography",               examCode: "9095" },
    { subjectName: "Economics",               examCode: "9080" },
    { subjectName: "History",                 examCode: "9091" },
    { subjectName: "Mathematics",             examCode: "9231" },
    { subjectName: "Additional Mathematics",  examCode: "9232" },
    { subjectName: "Biology",                 examCode: "9260" },
    { subjectName: "Chemistry",               examCode: "9261" },
    { subjectName: "Physics",                 examCode: "9262" },
    { subjectName: "Computer Science",        examCode: "9263" },
    { subjectName: "Geology",                 examCode: "9265" },
    { subjectName: "Food and Nutrition",      examCode: "9248" },
    { subjectName: "Philosophy",              examCode: "9074" },
  ];
  let aLevelCount = 0;
  for (const entry of A_LEVEL_CODES) {
    await prisma.aLevelSubject.upsert({
      where:  { subjectName: entry.subjectName },
      update: { examCode: entry.examCode },
      create: entry,
    });
    aLevelCount++;
  }
  console.log(`   ✓ ${aLevelCount} entrées`);

  // 1f. AnglophoneStreamCombination — combinaisons indicatives A1-A5 / S1-S5 (P3)
  console.log("\n🧪 Seeding AnglophoneStreamCombination...");
  const STREAM_COMBOS: { filiere: string; type: string; coreSubjects: string[]; electiveGroup?: string[][]; description: string }[] = [
    {
      filiere: "A1", type: "ARTS",
      coreSubjects: ["English Language", "Literature in English", "French", "History", "Geography"],
      electiveGroup: [["Economics", "Logic"], ["Computer Science", "Food and Nutrition"]],
      description: "Lettres classiques — langues + littérature + histoire-géo",
    },
    {
      filiere: "A2", type: "ARTS",
      coreSubjects: ["English Language", "Literature in English", "French", "History"],
      electiveGroup: [["Geography", "Economics"], ["Logic", "Computer Science"]],
      description: "Lettres modernes — littérature + langues",
    },
    {
      filiere: "A3", type: "ARTS",
      coreSubjects: ["English Language", "French", "History", "Geography"],
      electiveGroup: [["Literature in English", "Economics"], ["Food and Nutrition", "Logic"]],
      description: "Sciences sociales — histoire-géo + langues",
    },
    {
      filiere: "A4", type: "ARTS",
      coreSubjects: ["English Language", "French", "Geography", "Economics"],
      electiveGroup: [["History", "Literature in English"], ["Commerce", "Logic"]],
      description: "Économie et commerce",
    },
    {
      filiere: "A5", type: "ARTS",
      coreSubjects: ["English Language", "French", "Literature in English"],
      electiveGroup: [["History", "Geography"], ["Economics", "Logic", "Food and Nutrition"]],
      description: "Lettres et arts appliqués",
    },
    {
      filiere: "S1", type: "SCIENCES",
      coreSubjects: ["Mathematics", "Physics", "Chemistry", "Biology", "English Language"],
      electiveGroup: [["Additional Mathematics", "Computer Science"], ["Geology", "Food and Nutrition"]],
      description: "Sciences pures — Maths + PC + SVT",
    },
    {
      filiere: "S2", type: "SCIENCES",
      coreSubjects: ["Mathematics", "Physics", "Chemistry", "English Language"],
      electiveGroup: [["Biology", "Computer Science"], ["Geology", "Additional Mathematics"]],
      description: "Sciences physiques et technologies",
    },
    {
      filiere: "S3", type: "SCIENCES",
      coreSubjects: ["Mathematics", "Biology", "Chemistry", "English Language"],
      electiveGroup: [["Physics", "Computer Science"], ["Food and Nutrition", "Human Biology"]],
      description: "Sciences de la vie et de la terre",
    },
    {
      filiere: "S4", type: "SCIENCES",
      coreSubjects: ["Mathematics", "Physics", "Computer Science", "English Language"],
      electiveGroup: [["Chemistry", "Additional Mathematics"], ["Commerce", "Economics"]],
      description: "Informatique et sciences numériques",
    },
  ];
  let streamCount = 0;
  for (const sc of STREAM_COMBOS) {
    await prisma.anglophoneStreamCombination.upsert({
      where:  { filiere: sc.filiere },
      update: {
        type: sc.type,
        coreSubjects: sc.coreSubjects,
        electiveGroup: sc.electiveGroup ?? null,
        description: sc.description,
      },
      create: {
        filiere: sc.filiere,
        type: sc.type,
        coreSubjects: sc.coreSubjects,
        electiveGroup: sc.electiveGroup ?? null,
        description: sc.description,
      },
    });
    streamCount++;
  }
  console.log(`   ✓ ${streamCount} entrées`);

  // 1g. OLevelGrade — barème notation GCE O-Level A→U (P4)
  console.log("\n📊 Seeding OLevelGrade (barème A→U)...");
  const O_LEVEL_GRADES: { grade: string; minScore: number; maxScore: number; description: string }[] = [
    { grade: "A", minScore: 75, maxScore: 100, description: "Excellent" },
    { grade: "B", minScore: 65, maxScore: 74.99, description: "Very Good" },
    { grade: "C", minScore: 55, maxScore: 64.99, description: "Good" },
    { grade: "D", minScore: 45, maxScore: 54.99, description: "Credit" },
    { grade: "E", minScore: 40, maxScore: 44.99, description: "Pass" },
    { grade: "F", minScore: 30, maxScore: 39.99, description: "Fail" },
    { grade: "U", minScore: 0, maxScore: 29.99, description: "Ungraded / Unclassified" },
  ];
  for (const g of O_LEVEL_GRADES) {
    await prisma.oLevelGrade.upsert({
      where:  { grade: g.grade },
      update: { minScore: g.minScore, maxScore: g.maxScore, description: g.description },
      create: g,
    });
  }
  console.log(`   ✓ ${O_LEVEL_GRADES.length} entrées`);

  // 1h. ALevelGrade — barème notation GCE A-Level A→F (P4)
  console.log("\n📊 Seeding ALevelGrade (barème A→F)...");
  const A_LEVEL_GRADES: { grade: string; minScore: number; maxScore: number; description: string }[] = [
    { grade: "A", minScore: 80, maxScore: 100, description: "Excellent" },
    { grade: "B", minScore: 70, maxScore: 79.99, description: "Very Good" },
    { grade: "C", minScore: 60, maxScore: 69.99, description: "Good" },
    { grade: "D", minScore: 50, maxScore: 59.99, description: "Credit" },
    { grade: "E", minScore: 40, maxScore: 49.99, description: "Pass" },
    { grade: "F", minScore: 0, maxScore: 39.99, description: "Fail" },
  ];
  for (const g of A_LEVEL_GRADES) {
    await prisma.aLevelGrade.upsert({
      where:  { grade: g.grade },
      update: { minScore: g.minScore, maxScore: g.maxScore, description: g.description },
      create: g,
    });
  }
  console.log(`   ✓ ${A_LEVEL_GRADES.length} entrées`);

  // 2. Autres seeds (pas de FK vers SchoolTemplate)
  // 3. École système de référence pour les données globales
  // Certains modèles exigent désormais un schoolId non nul au niveau DB.
  const systemSchool = await prisma.school.upsert({
    where: { subdomain: "system" },
    update: {},
    create: {
      name: "École système EduNexus",
      subdomain: "system",
      templateCode: "LYCEE_FR",
    },
  });

  console.log(`   ✓ School système ${systemSchool.id}`);

  // 4. GradeFormulas et MentionRules par défaut
  console.log("\n📐 Seeding default GradeFormulas and MentionRules...");

  for (const formula of defaultGradeFormulas) {
    await prisma.gradeFormula.upsert({
      where:  { id: formula.id },
      update: {
        schoolId:    null,   // règle système — pas liée à une école
        label:       formula.label,
        evaluations: formula.evaluations as any,
        isDefault:   formula.isDefault,
      },
      create: {
        id:          formula.id,
        schoolId:    null,
        label:       formula.label,
        evaluations: formula.evaluations as any,
        isDefault:   formula.isDefault,
      },
    });
    console.log(`   ✓ GradeFormula ${formula.id}`);
  }

  for (const rule of defaultMentionRules) {
    await prisma.mentionRule.upsert({
      where:  { id: rule.id },
      update: {
        schoolId:  null,   // règle système — pas liée à une école
        rules:     rule.rules as any,
        isDefault: rule.isDefault,
      },
      create: {
        id:        rule.id,
        schoolId:  null,
        rules:     rule.rules as any,
        isDefault: rule.isDefault,
      },
    });
    console.log(`   ✓ MentionRule ${rule.id}`);
  }

  console.log(`   → ${defaultGradeFormulas.length} default GradeFormulas et ${defaultMentionRules.length} MentionRules seeded`);

  // 1d. TarifMinesecReference — montants officiels MINESEC (scolarité + examens).
  // Sans cette table, GenererPaiementsMinesecUseCase ne trouve jamais de tarif et ne
  // génère jamais aucune ligne de paiement (échec silencieux constaté en production).
  // Seedé sur deux années pour couvrir la bascule d'année scolaire.
  console.log("\n💰 Seeding TarifMinesecReference...");
  const tarifsMinesecBase: { typeFrais: string; montantFCFA: number; niveau: string | null }[] = [
    { typeFrais: 'SCOLARITE_PREMIER_CYCLE', montantFCFA: 7500,  niveau: '1er_cycle' },
    { typeFrais: 'SCOLARITE_SECOND_CYCLE',  montantFCFA: 10000, niveau: '2nd_cycle' },
    { typeFrais: 'EXAMEN_BEPC',             montantFCFA: 7000,  niveau: null },
    { typeFrais: 'EXAMEN_PROBATOIRE',       montantFCFA: 12000, niveau: null },
    { typeFrais: 'EXAMEN_BAC',              montantFCFA: 12000, niveau: null },
    { typeFrais: 'EXAMEN_GCE_OL',           montantFCFA: 8000,  niveau: null },
    { typeFrais: 'EXAMEN_GCE_AL',           montantFCFA: 9000,  niveau: null },
  ];
  const anneesScolairesTarifs = ['2025-2026', '2026-2027'];
  // Note : upsert() sur une clé composée n'accepte pas `null` pour un champ nullable
  // (limitation Prisma) — on passe donc par findFirst + create/update.
  let tarifsCreated = 0;
  for (const anneeScolaire of anneesScolairesTarifs) {
    for (const t of tarifsMinesecBase) {
      const existing = await (prisma as any).tarifMinesecReference.findFirst({
        where: { typeFrais: t.typeFrais, anneeScolaire, niveau: t.niveau },
      });
      if (existing) {
        await (prisma as any).tarifMinesecReference.update({
          where: { id: existing.id },
          data: { montantFCFA: t.montantFCFA, actif: true },
        });
      } else {
        await (prisma as any).tarifMinesecReference.create({
          data: { typeFrais: t.typeFrais, anneeScolaire, niveau: t.niveau, montantFCFA: t.montantFCFA, actif: true },
        });
      }
      tarifsCreated++;
    }
  }
  console.log(`   ✓ ${tarifsCreated} tarifs (${anneesScolairesTarifs.join(', ')})`);

  console.log("\n📅 Seeding Calendrier Académique Officiel (Arrêté Conjoint)...");
  await seedOfficialAcademicCalendar(prisma);

  console.log("\n✅ Seed Phase 0 terminé.\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });