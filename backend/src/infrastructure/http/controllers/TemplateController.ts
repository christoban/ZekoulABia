import type { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';

export class TemplateController {
  constructor(
    private readonly classeRepository: ClasseRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  importEleves = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const [classes, pebsFlags, lv2Subjects] = await Promise.all([
        this.classeRepository.findBySchool(schoolId),
        this.schoolRepository.findPEBSFlags(schoolId),
        this.matiereRepository.findLV2BySchool(schoolId),
      ]);

      const classNames = classes.map((c) => c.name).sort((a, b) => a.localeCompare(b));
      const lv2Names = lv2Subjects.map((s) => s.name).sort((a, b) => a.localeCompare(b));

      const hasPEBS = !!(pebsFlags?.hasPEBSFrancophone || pebsFlags?.hasPEBSAnglophone);

      const baseHeaders = ['matricule', 'nom', 'prenom', 'email', 'date_naissance', 'classe', 'nom_parent', 'prenom_parent', 'email_parent', 'telephone_parent'];
      const baseRow1 = ['2025001', 'NGONO', 'Marie', 'marie.ngono@eleve.cm', '15/03/2010', '6e A', 'NGONO', 'Robert', 'robert.ngono@email.cm', '+237690000001'];
      const baseRow2 = ['', 'ESSOMBA', 'Jean', '', '22/07/2009', '5e B', 'ESSOMBA', 'Cécile', '', '+237690000002'];
      const baseRow3 = ['2025003', 'BELA', 'Paul', 'paul.bela@eleve.cm', '10/01/2011', '6e A', 'BELA', 'Hortense', 'hortense.bela@email.cm', ''];

      const extraHeaders: string[] = [];
      const extraRow1: string[] = [];
      const extraRow2: string[] = [];
      const extraRow3: string[] = [];

      if (hasPEBS) {
        extraHeaders.push('pebs');
        extraRow1.push('FR_PEBS');
        extraRow2.push('');
        extraRow3.push('');
      }
      if (lv2Names.length > 0) {
        extraHeaders.push('lv2');
        extraRow1.push(lv2Names[0]);
        extraRow2.push('');
        extraRow3.push('');
      }

      const headers = [...baseHeaders, ...extraHeaders];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        [...baseRow1, ...extraRow1],
        [...baseRow2, ...extraRow2],
        [...baseRow3, ...extraRow3],
      ]);

      ws['!cols'] = headers.map((h) => ({ wch: h.startsWith('email') ? 28 : h === 'lv2' ? 22 : 18 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Élèves');

      const instrLines: any[][] = [
        ['INSTRUCTIONS — Import des élèves'],
        [''],
        ['Colonnes obligatoires : nom, prenom'],
        ['Colonnes recommandées : matricule, email, date_naissance, classe'],
        ['Colonnes optionnelles : nom_parent, prenom_parent, email_parent, telephone_parent'],
      ];

      if (hasPEBS) {
        instrLines.push(
          [''],
          ['--- COLONNES OPTIONNELLES AVANCÉES ---'],
          [''],
          ['Colonne "pebs" (Programme d\'Éducation Bilingue Spécial) :'],
          ['  Valeurs acceptées : FR_PEBS ou EN_PEBS'],
          ['  Laissez vide pour les élèves non-PEBS'],
        );
      }
      if (lv2Names.length > 0) {
        if (!hasPEBS) instrLines.push([''], ['--- COLONNES OPTIONNELLES AVANCÉES ---']);
        instrLines.push(
          [''],
          ['Colonne "lv2" (Langue Vivante 2) — valeurs acceptées :'],
          ...lv2Names.map(s => [`  • ${s}`]),
          ['  Laissez vide si l\'élève n\'a pas de LV2'],
        );
      }

      instrLines.push(
        [''],
        ['Format date : JJ/MM/AAAA (ex: 15/03/2010)'],
        ['Format téléphone : +237XXXXXXXXX (9 chiffres après +237)'],
        [''],
        ['Classes disponibles dans votre établissement :'],
        ...classNames.map(c => [`  • ${c}`]),
        [''],
        ['Important :'],
        ['  • Les lignes grisées sont des exemples — supprimez-les avant import'],
        ['  • Le matricule peut être laissé vide (généré automatiquement)'],
        ['  • Si email_parent est fourni, un compte parent sera créé automatiquement'],
        ['  • Les élèves et parents recevront un email avec leur identifiant'],
      );

      const ws2 = XLSX.utils.aoa_to_sheet(instrLines);
      ws2['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="import-eleves.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  importEnseignants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const [subjects, classes] = await Promise.all([
        this.matiereRepository.findBySchool(schoolId),
        this.classeRepository.findBySchool(schoolId),
      ]);

      const subjectNames = subjects.map(s => s.name).sort((a, b) => a.localeCompare(b));
      const classNames = classes.map(c => c.name).sort((a, b) => a.localeCompare(b));

      const wb = XLSX.utils.book_new();

      const headers = ['nom', 'prenom', 'email', 'telephone', 'matieres'];
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ['NGONO', 'Jean', 'jean.ngono@lycee.cm', '+237690000001', 'Mathématiques,Physique'],
        ['ESSOMBA', 'Marie', 'marie.essomba@lycee.cm', '', 'Français,Histoire-Géographie'],
        ['BELA', 'Paul', 'paul.bela@lycee.cm', '+237690000003', 'SVTEEHB'],
      ]);

      ws['!cols'] = headers.map((_, i) => ({ wch: i >= 5 ? 26 : 22 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Enseignants');

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['INSTRUCTIONS — Import des enseignants'],
        [''],
        ['Colonnes obligatoires : nom, prenom, email'],
        ['Colonnes optionnelles : telephone, matieres'],
        [''],
        ['Email : obligatoire — l\'enseignant recevra son invitation par email'],
        ['Format téléphone : +237XXXXXXXXX (9 chiffres après +237)'],
        [''],
        ['Colonne "matieres" :'],
        ['  Séparez les matières par des virgules'],
        ['  Exemple : "Mathématiques,Physique,SVTEEHB"'],
        [''],
       
        ['Matières disponibles dans votre établissement :'],
        ...subjectNames.map(s => [`  • ${s}`]),
        [''],
        ['Classes disponibles dans votre établissement :'],
        ...classNames.map(c => [`  • ${c}`]),
        [''],
        ['Important :'],
        ['  • Un mot de passe temporaire sera généré automatiquement'],
        ['  • L\'enseignant recevra un email avec son lien de connexion'],
        ['  • Les lignes grisées sont des exemples — supprimez-les avant import'],
      ]);
      ws2['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="import-enseignants.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // ── NOUVEAUX TEMPLATES (Étape 4) ────────────────────────────────────────

  importStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const [departments] = await Promise.all([
        this.departmentRepository.findBySchool(schoolId),
      ]);

      const departmentNames = departments.map((d) => d.name).sort((a, b) => a.localeCompare(b));

      const wb = XLSX.utils.book_new();

      const headers = ['nom', 'prenom', 'email', 'telephone', 'fonction', 'section'];
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ['NGONO', 'Jean', 'jean.ngono@lycee.cm', '+237690000001', 'Censeur', 'Francophone'],
        ['ESSOMBA', 'Marie', 'marie.essomba@lycee.cm', '', 'Intendant', ''],
        ['BELA', 'Paul', 'paul.bela@lycee.cm', '+237690000003', 'Animateur Pédagogique', 'Anglophone'],
      ]);

      ws['!cols'] = headers.map((_, i) => ({ wch: i === 4 ? 28 : i === 5 ? 16 : 22 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Personnel');

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['INSTRUCTIONS — Import du personnel (STAFF)'],
        [''],
        ['Colonnes obligatoires : nom, prenom, email, fonction'],
        ['Colonnes optionnelles : telephone, section'],
        [''],
        ['Email : obligatoire — le personnel recevra son invitation par email'],
        ['Format téléphone : +237XXXXXXXXX (9 chiffres après +237)'],
        [''],
        ['Colonne "fonction" :'],
        ['  Titre exact du poste (ex: Censeur, Intendant, Surveillant Général, Animateur Pédagogique, ...).'],
        ['  Les permissions sont assignées automatiquement selon la fonction.'],
        [''],
        ['Colonne "section" (optionnelle) :'],
        ['  Section pédagogique (ex: Francophone, Anglophone, Bilingue).'],
        [''],
        ['Fonctions disponibles dans votre établissement :'],
        ['  (Les permissions sont définies par la configuration de l\'établissement)'],
        [''],
        ['Important :'],
        ['  • Les lignes grisées sont des exemples — supprimez-les avant import'],
        ['  • Un mot de passe temporaire sera généré automatiquement'],
        ['  • Le personnel recevra un email avec son lien de connexion'],
      ]);
      ws2['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="import-staff.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  importParents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const [students] = await Promise.all([
        this.classeRepository.findBySchool(schoolId),
      ]);

      const studentNames = students.map((c) => c.name).sort((a, b) => a.localeCompare(b));

      const wb = XLSX.utils.book_new();

      const headers = ['nom', 'prenom', 'email', 'telephone', 'matricules_enfants', 'emails_enfants'];
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ['NGONO', 'Robert', 'robert.ngono@email.cm', '+237690000001', '2025001', 'marie.ngono@eleve.cm'],
        ['ESSOMBA', 'Cécile', 'cecile.essomba@email.cm', '', '2025002,2025003', 'jean.essomba@eleve.cm,paul.essomba@eleve.cm'],
        ['BELA', 'Hortense', 'hortense.bela@email.cm', '+237690000003', '', ''],
      ]);

      ws['!cols'] = headers.map((_, i) => ({ wch: i >= 4 ? 28 : 22 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Parents');

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['INSTRUCTIONS — Import des parents'],
        [''],
        ['Colonnes obligatoires : nom, prenom'],
        ['Colonnes optionnelles : email, telephone, matricules_enfants, emails_enfants'],
        [''],
        ['Au moins un contact (email ou telephone) est requis'],
        ['Format téléphone : +237XXXXXXXXX (9 chiffres après +237)'],
        [''],
        ['Colonne "matricules_enfants" (optionnelle) :'],
        ['  Matricules des enfants séparés par des virgules (ex: "2025001,2025002")'],
        ['  Le système lie automatiquement le parent aux élèves trouvés par matricule'],
        [''],
        ['Colonne "emails_enfants" (optionnelle) :'],
        ['  Emails des enfants séparés par des virgules (ex: "eleve1@email.cm,eleve2@email.cm")'],
        ['  Alternative aux matricules pour lier le parent aux élèves'],
        [''],
        ['Important :'],
        ['  • Les lignes grisées sont des exemples — supprimez-les avant import'],
        ['  • Un mot de passe temporaire sera généré automatiquement'],
        ['  • Le parent recevra un email avec son lien de connexion'],
      ]);
      ws2['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="import-parents.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  importClasses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const wb = XLSX.utils.book_new();

      const headers = ['nom', 'niveau', 'serie', 'filiere', 'capacite', 'section'];
      const ws = XLSX.utils.aoa_to_sheet([
        headers,
        ['6e A', '6e', '', '', '45', 'FRANCOPHONE'],
        ['2nde C', '2nde', 'C', '', '50', 'FRANCOPHONE'],
        ['Form 1', 'Form1', '', 'GENERAL', '35', 'ANGLPHONE'],
      ]);

      ws['!cols'] = headers.map((_, i) => ({ wch: i === 3 ? 18 : i === 5 ? 14 : 18 }));

      XLSX.utils.book_append_sheet(wb, ws, 'Classes');

      const ws2 = XLSX.utils.aoa_to_sheet([
        ['INSTRUCTIONS — Import des classes'],
        [''],
        ['Colonnes obligatoires : nom, niveau'],
        ['Colonnes optionnelles : serie, filiere, capacite, section'],
        [''],
        ['Niveau : 6e, 5e, 4e, 3e, 2nde, 1ere, Tle, CP, CE1, CE2, CM1, CM2, CI, CP1, CP2, Form1, Form2, Form3, Form4, Form5, LowerSixth, UpperSixth'],
        ['Serie : C, D, A, B, E, F, G, TI, TB, etc. (secondaire francophone)'],
        ['Filiere : GENERAL, INDUSTRIEL, COMMERCIAL, etc. (secondaire francophone)'],
        ['Capacite : entier entre 1 et 200 (défaut selon configuration)'],
        ['Section : FRANCOPHONE, ANGLOPHONE, BILINGUE (défaut: FRANCOPHONE)'],
        [''],
        ['Important :'],
        ['  • Les lignes grisées sont des exemples — supprimez-les avant import'],
        ['  • Les canaux de messagerie (classe + parents) sont créés automatiquement'],
        ['  • Les coefficients de matières sont appliqués selon le niveau/série'],
      ]);
      ws2['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="import-classes.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
