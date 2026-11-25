/**
 * DOMAIN LAYER — Entité Bulletin (ReportCard)
 *
 * Loi 4 : la génération est bloquée si une seule note de la classe
 * est encore en DRAFT.
 *
 * Workflow : DRAFT → GENERATED → SENT
 */
import type { BulletinTemplate, ReportCardStatus } from '@domain/types/enums';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
import { deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';

// --- Ligne matière (value object imbriqué) ---

export interface LigneMatiereProps {
  id: string;
  subjectId: string;
  subjectName: string;
  coefficient: number;

  // Scores selon le système d'évaluation
  seq1Score?: number;
  seq2Score?: number;
  compositionScore?: number;
  seq3Score?: number;
  seq4Score?: number;
  seq5Score?: number;
  seq6Score?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;

  subjectAverage?: number;
  weightedScore?: number;
  subjectRank?: number;
  groupKey?: string;
  groupLabel?: string;
  groupOrder?: number;
  teacherName?: string;
  classSubjectAverage?: number;
  minSubjectAverage?: number;
  maxSubjectAverage?: number;
  teacherComment?: string;
  competenceLabel?: string; // Libellé compétence visée — bulletins bilingues
}

// --- Entité principale ---

export interface BulletinProps {
  id: string;
  schoolId: string;
  studentId: string;
  academicYearId: string;
  academicPeriodId: string;
  sectionId?: string;
  template: BulletinTemplate;
  templateSpecId?: string;
  templateVersion?: number;
  computationVersion?: number;
  snapshotData?: unknown;
  contentHash?: string;
  verifyToken?: string;
  shortVerifyCode?: string;
  reprintCount?: number;
  validationStatus: ReportCardStatus;
  revokedAt?: Date;
  revokedById?: string;
  revocationReason?: string;

  generalAverage?: number;
  rank?: number;
  rankTrimestre1?: number;
  rankTrimestre2?: number;
  rankTrimestre3?: number;
  totalStudents?: number;
  mention?: string;
  absenceCount: number;

  classMasterComment?: string;
  conductGrade?: string;
  aiComment?: string;

  isGenerated: boolean;
  pdfUrl?: string;
  createdAt: Date;

  lignesMatiere: LigneMatiereProps[];
}

export interface CreerBulletinProps {
  schoolId: string;
  studentId: string;
  academicYearId: string;
  academicPeriodId: string;
  sectionId?: string;
  template: BulletinTemplate;
}

// Ce que retourne la vérification des prérequis
export interface NoteNonValidee {
  matiereNom: string;
  enseignantNom: string;
  statut: string;
}

export class Bulletin {
  private constructor(private readonly props: BulletinProps) {}

  // --- Factories ---

  static create(props: CreerBulletinProps): Bulletin {
    return new Bulletin({
      ...props,
      id: crypto.randomUUID(),
      templateVersion: 1,
      computationVersion: 2,
      reprintCount: 0,
      validationStatus: 'DRAFT',
      isGenerated: false,
      absenceCount: 0,
      lignesMatiere: [],
      createdAt: new Date(),
    });
  }

  static reconstituer(props: BulletinProps): Bulletin {
    return new Bulletin(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get studentId(): string { return this.props.studentId; }
  get academicYearId(): string { return this.props.academicYearId; }
  get academicPeriodId(): string { return this.props.academicPeriodId; }
  get template(): BulletinTemplate { return this.props.template; }
  get templateSpecId(): string | undefined { return this.props.templateSpecId; }
  get validationStatus(): ReportCardStatus { return this.props.validationStatus; }
  get computationVersion(): number { return this.props.computationVersion ?? 1; }
  get templateVersion(): number { return this.props.templateVersion ?? 1; }
  get snapshotData(): unknown { return this.props.snapshotData; }
  get contentHash(): string | undefined { return this.props.contentHash; }
  get verifyToken(): string | undefined { return this.props.verifyToken; }
  get shortVerifyCode(): string | undefined { return this.props.shortVerifyCode; }
  get reprintCount(): number { return this.props.reprintCount ?? 0; }
  get generalAverage(): number | undefined { return this.props.generalAverage; }
  get rank(): number | undefined { return this.props.rank; }
  get mention(): string | undefined { return this.props.mention; }
  get isGenerated(): boolean { return this.props.isGenerated; }
  get pdfUrl(): string | undefined { return this.props.pdfUrl; }
  get lignesMatiere(): LigneMatiereProps[] { return [...this.props.lignesMatiere]; }
  get absenceCount(): number { return this.props.absenceCount; }

  // --- Loi 4 : vérification prérequis avant génération ---

  /**
   * Vérifie que toutes les notes sont LOCKED avant de générer le bulletin.
   * Lance BulletinBloqueError si ce n'est pas le cas.
   *
   * @param notesNonValidees - liste des notes pas encore LOCKED dans la classe
   * @param classeNom - nom de la classe pour le message d'erreur
   */
  static verifierPrerequisGeneration(
    notesNonValidees: NoteNonValidee[],
    classeNom: string
  ): void {
    if (notesNonValidees.length > 0) {
      throw new BulletinBloqueError(classeNom, notesNonValidees);
    }
  }

  // --- Workflow de génération ---

  /**
   * Attache les lignes matière calculées au bulletin.
   * Doit être appelé avant marquerGenere().
   */
  definirLignesMatiere(lignes: LigneMatiereProps[]): void {
    if (this.props.isGenerated) {
      throw new Error('Impossible de modifier un bulletin déjà généré');
    }
    this.props.lignesMatiere = lignes;
  }

  /**
   * Définit les résultats calculés : moyenne, rang, mention.
   */
  definirResultats(params: {
    generalAverage: number;
    rank: number;
    totalStudents: number;
    mention: string;
    absenceCount: number;
    rankTrimestre1?: number;
    rankTrimestre2?: number;
    rankTrimestre3?: number;
  }): void {
    if (this.props.isGenerated) {
      throw new Error('Impossible de modifier un bulletin déjà généré');
    }
    this.props.generalAverage = params.generalAverage;
    this.props.rank = params.rank;
    this.props.totalStudents = params.totalStudents;
    this.props.mention = params.mention;
    this.props.absenceCount = params.absenceCount;
    this.props.rankTrimestre1 = params.rankTrimestre1;
    this.props.rankTrimestre2 = params.rankTrimestre2;
    this.props.rankTrimestre3 = params.rankTrimestre3;
  }

  /**
   * Marque le bulletin comme généré avec la clé réelle FileStoragePort du PDF scellé
   * (ou `null` lorsqu'aucun PDF n'est encore stocké — jamais de chemin fictif).
   * DRAFT → GENERATED
   */
  marquerGenere(pdfUrl: string | null = null): void {
    if (this.props.isGenerated) {
      throw new Error('Ce bulletin est déjà généré');
    }
    if (this.props.lignesMatiere.length === 0) {
      throw new Error('Impossible de générer un bulletin sans lignes matière');
    }
    if (this.props.generalAverage === undefined) {
      throw new Error('Impossible de générer un bulletin sans moyenne générale calculée');
    }
    this.props.isGenerated = true;
    this.props.pdfUrl = pdfUrl ?? undefined;
    this.props.validationStatus = 'GENERATED';
  }

  /**
   * Scelle le snapshot JSON immuable du bulletin avec son empreinte SHA-256 et son jeton QR.
   */
  scellerSnapshot(params: {
    snapshotData: unknown;
    contentHash: string;
    verifyToken: string;
    shortVerifyCode?: string;
    computationVersion?: number;
    templateSpecId?: string;
    templateVersion?: number;
  }): void {
    if (this.props.isGenerated) {
      throw new Error('Impossible de modifier le snapshot d’un bulletin déjà scellé');
    }
    this.props.snapshotData = params.snapshotData;
    this.props.contentHash = params.contentHash;
    this.props.verifyToken = params.verifyToken;
    this.props.shortVerifyCode = params.shortVerifyCode ?? deriveShortVerifyCode(params.verifyToken);
    this.props.computationVersion = params.computationVersion ?? 2;
    this.props.templateSpecId = params.templateSpecId;
    this.props.templateVersion = params.templateVersion ?? 1;
  }

  /**
   * Fige la clé de stockage du PDF rendu et la version exacte du modèle lors de la validation/publication.
   */
  scellerStockagePdf(params: {
    pdfUrl: string;
    templateSpecId?: string | null;
    templateVersion?: number;
  }): void {
    this.props.pdfUrl = params.pdfUrl;
    if (params.templateSpecId !== undefined) {
      this.props.templateSpecId = params.templateSpecId ?? undefined;
    }
    if (params.templateVersion !== undefined) {
      this.props.templateVersion = params.templateVersion;
    }
  }

  /**
   * Révoque officiellement ce bulletin (uniquement lors d'une régénération contrôlée Admin avec motif).
   */
  revoquer(params: { revokedById: string; reason: string; revokedAt?: Date }): void {
    if (!params.reason || !params.reason.trim()) {
      throw new Error('Un motif obligatoire est requis pour révoquer un bulletin.');
    }
    this.props.validationStatus = 'REVOKED';
    this.props.revokedById = params.revokedById;
    this.props.revocationReason = params.reason.trim();
    this.props.revokedAt = params.revokedAt ?? new Date();
  }

  /**
   * Marque le bulletin comme envoyé au parent.
   * GENERATED → SENT
   */
  marquerEnvoye(): void {
    if (!this.props.isGenerated) {
      throw new Error('Impossible de marquer comme envoyé un bulletin non encore généré');
    }
    this.props.validationStatus = 'SENT';
  }

  // --- Commentaires ---

  ajouterCommentaireProfesseurPrincipal(commentaire: string): void {
    this.props.classMasterComment = commentaire;
  }

  ajouterCommentaireIA(commentaire: string): void {
    this.props.aiComment = commentaire;
  }

  definirNoteTenue(note: string): void {
    this.props.conductGrade = note;
  }

  // --- Helpers métier ---

  estGenere(): boolean { return this.props.isGenerated; }
  estEnvoye(): boolean { return this.props.validationStatus === 'SENT'; }

  estBulletinAnnuel(): boolean { return this.props.template === 'ANNUAL'; }
  estBulletinMensuel(): boolean { return this.props.template === 'MONTHLY'; }
  estBulletinTechnique(): boolean { return this.props.template === 'TECHNICAL_FR'; }
  estBulletinPrimaire(): boolean { return this.props.template === 'PRIMARY'; }

  // --- Sérialisation ---

  toObject(): BulletinProps {
    return {
      ...this.props,
      lignesMatiere: [...this.props.lignesMatiere],
    };
  }
}
