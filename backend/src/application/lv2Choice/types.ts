export interface OuvrirFenetreCommande {
  schoolId: string;
  level: string;
  academicYearId: string;
  openDate: Date;
  closeDate: Date;
}

export interface SoumettreChoixCommande {
  schoolId: string;
  studentUserId: string;
  chosenSubjectId: string;
}

export interface SaisirChoixManuelCommande {
  schoolId: string;
  windowId: string;
  studentProfileId: string;
  chosenSubjectId: string;
  submittedByUserId: string;
}

export interface AppliquerChoixCommande {
  schoolId: string;
  windowId: string;
}

export interface SuivreFenetreCommande {
  schoolId: string;
  windowId: string;
}
