export type OrientationStatus = 'OUVERTE' | 'EN_COURS' | 'CLOSE' | 'TRANSFEREE';
export type NiveauRisque      = 'FAIBLE'  | 'MOYEN'   | 'ELEVE' | 'CRITIQUE';
export type TypePreoccupation =
  | 'SCOLAIRE' | 'COMPORTEMENTAL' | 'FAMILIAL'
  | 'PROFESSIONNEL' | 'SANTE' | 'AUTRE';

export type TypeEntretien  = 'INDIVIDUEL' | 'GROUPE' | 'AVEC_PARENT';
export type MotifEntretien =
  | 'ORIENTATION_GENERALE' | 'DIFFICULTE_SCOLAIRE' | 'CHOIX_FILIERE_BAC'
  | 'PROJET_PROFESSIONNEL' | 'PROBLEME_COMPORTEMENT'
  | 'DEMANDE_ELEVE' | 'DEMANDE_PARENT' | 'DEMANDE_ENSEIGNANT';
export type StatutEntretien  = 'PLANIFIE' | 'REALISE' | 'ANNULE' | 'REPORTE';
export type TypeTest          =
  | 'COGNITIF' | 'INTERETS_PROFESSIONNELS' | 'PERSONNALITE' | 'PSYCHOTECHNIQUE';
export type StatutRecommandation =
  | 'PROPOSEE' | 'VALIDEE_ADMIN' | 'ACCEPTEE_PARENT'
  | 'REFUSEE_PARENT' | 'TRANSMISE_DRES'
  | 'CALCULEE' | 'VALIDEE_CONSEILLER' | 'PROPOSEE_A_L_ELEVE'
  | 'VALIDEE_ELEVE' | 'VALIDEE_PAR_DEFAUT';

export type OrientationCheckpointType = 'FIN_TROISIEME' | 'FIN_SECONDE_C';
export type ConfidenceLevel = 'ELEVEE' | 'MOYENNE' | 'FAIBLE';

export interface FicheOrientationProps {
  id:             string;
  studentId:      string;
  schoolId:       string;
  academicYearId: string;
  conseillerId:   string;
  status:         OrientationStatus;
  riskLevel:      NiveauRisque;
  mainConcern?:   TypePreoccupation | null;
  createdAt:      Date;
  updatedAt:      Date;
}

export class FicheOrientation {
  constructor(private readonly props: FicheOrientationProps) {}

  get id()             { return this.props.id; }
  get studentId()      { return this.props.studentId; }
  get schoolId()       { return this.props.schoolId; }
  get academicYearId() { return this.props.academicYearId; }
  get conseillerId()   { return this.props.conseillerId; }
  get status()         { return this.props.status; }
  get riskLevel()      { return this.props.riskLevel; }
  get mainConcern()    { return this.props.mainConcern; }
  get createdAt()      { return this.props.createdAt; }
  get updatedAt()      { return this.props.updatedAt; }

  estOuverte():   boolean { return this.props.status !== 'CLOSE' && this.props.status !== 'TRANSFEREE'; }
  estCritique():  boolean { return this.props.riskLevel === 'CRITIQUE'; }
  estArisque():   boolean { return this.props.riskLevel === 'ELEVE' || this.props.riskLevel === 'CRITIQUE'; }

  verifierPeutRecevoirEntretien(): void {
    if (!this.estOuverte()) {
      throw new Error('Impossible d\'ajouter un entretien à une fiche clôturée ou transférée');
    }
  }

  verifierPeutRecevoirTest(): void {
    if (!this.estOuverte()) {
      throw new Error('Impossible d\'ajouter un test à une fiche clôturée ou transférée');
    }
  }

  static creer(props: Omit<FicheOrientationProps, 'createdAt' | 'updatedAt'>): FicheOrientation {
    return new FicheOrientation({
      ...props,
      status: 'OUVERTE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
