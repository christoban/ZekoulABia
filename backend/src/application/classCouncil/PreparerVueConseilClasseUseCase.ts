/**
 * APPLICATION LAYER — Use Case : Vue préparatoire du Conseil de Classe (V1.12)
 *
 * Agrège en une vue synthétique les signaux déjà présents pour préparer la délibération :
 *  - effectif
 *  - promus d'office : moyenne générale ≥ seuil de passage (10/20 FR, 40% EN)
 *    ET aucune matière < 5 (FR) / < 25 (EN) — la règle composée évite de classer
 *    « promu d'office » un élève à 18/20 mais 2/20 dans une matière fondamentale.
 *  - à surveiller : alertLevel non nul (Early Warning, déjà calculé)
 *  - cas disciplinaires : DisciplineRecord ACTIVE en cours
 *  - en forte baisse : baisse de moyenne générale ≥ SEUIL_BAISSE entre la période
 *    précédente et la période courante (grain période, distinct du signal par note
 *    qui remonte déjà dans alertLevel)
 *  - décision d'orientation : RecommandationSerie non encore validée par l'admin
 *    (signal « décision à prendre cette session »)
 *
 * Lecture seule. Ne crée rien, ne verrouille rien — utilisable avant même
 * l'ouverture de la session de conseil.
 */
import type { ClassCouncilPreviewQueryPort, DonneesVueConseilParEleve } from '@domain/ports/repositories/ClassCouncilPreviewQueryPort';
import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';

export interface PreparerVueConseilCommande {
  schoolId: string;
  classId: string;
  academicPeriodId: string;
}

export interface EleveVueConseil {
  studentId: string;
  firstName: string;
  lastName: string;
  moyenneGenerale: number | null;
  rang: number | null;
  promuOffice: boolean;
  aSurveiller: boolean;
  alertLevel: 'warning' | 'critical' | null;
  casDisciplinaire: boolean;
  enForteBaisse: boolean;
  baissePoints: number | null;
  decisionOrientation: boolean;
}

export interface VueConseilClasse {
  effectif: number;
  compteurs: {
    promusOffice: number;
    aSurveiller: number;
    casDisciplinaires: number;
    enForteBaisse: number;
    decisionsOrientation: number;
  };
  eleves: EleveVueConseil[];
}

export class PreparerVueConseilClasseUseCase {
  constructor(
    private readonly previewQuery: ClassCouncilPreviewQueryPort,
    private readonly repo: Pick<ClassCouncilRepository, 'classeExiste'>,
  ) {}

  async execute(commande: PreparerVueConseilCommande): Promise<VueConseilClasse> {
    const classe = await this.repo.classeExiste(commande.classId, commande.schoolId);
    if (!classe) throw new NotFoundError('Classe introuvable');

    const donnees = await this.previewQuery.chargerDonneesVue(commande);

    const eleves = donnees.eleves.map((e) => this.analyserEleve(e));
    const c = (pred: (e: EleveVueConseil) => boolean) => eleves.filter(pred).length;

    return {
      effectif: donnees.effectif,
      compteurs: {
        promusOffice: c((e) => e.promuOffice),
        aSurveiller: c((e) => e.aSurveiller),
        casDisciplinaires: c((e) => e.casDisciplinaire),
        enForteBaisse: c((e) => e.enForteBaisse),
        decisionsOrientation: c((e) => e.decisionOrientation),
      },
      eleves,
    };
  }

  private analyserEleve(e: DonneesVueConseilParEleve): EleveVueConseil {
    const estAnglophone = e.template === 'EN';
    const seuilPassage = estAnglophone ? SEUIL_PASSAGE_EN : SEUIL_PASSAGE_FR;
    const seuilMatiere = estAnglophone ? SEUIL_MATIERE_EN : SEUIL_MATIERE_FR;

    const moyenneOk = e.moyenneGenerale !== null && e.moyenneGenerale >= seuilPassage;
    const aucuneMatiereFaible = e.moyennesMatieres.every((m) => m >= seuilMatiere);
    const promuOffice = moyenneOk && aucuneMatiereFaible;

    const baisse = e.moyenneGenerale !== null && e.moyenneGeneralePeriodePrecedente !== null
      ? e.moyenneGeneralePeriodePrecedente - e.moyenneGenerale
      : null;
    const enForteBaisse = baisse !== null && baisse >= SEUIL_BAISSE_SIGNIFICATIVE;

    return {
      studentId: e.studentId,
      firstName: e.firstName,
      lastName: e.lastName,
      moyenneGenerale: e.moyenneGenerale,
      rang: e.rang,
      promuOffice,
      aSurveiller: e.alertLevel !== null,
      alertLevel: e.alertLevel,
      casDisciplinaire: e.casDisciplinaire,
      enForteBaisse,
      baissePoints: enForteBaisse ? baisse : null,
      decisionOrientation: e.orientationNonValidee,
    };
  }
}

// Seuils métier de la vue préparatoire (règle composée, délibération réelle)
const SEUIL_PASSAGE_FR = 10;      // 10/20 — MINESEC
const SEUIL_PASSAGE_EN = 40;      // 40% — sous-système anglophone
const SEUIL_MATIERE_FR = 5;       // aucune matière < 5/20
const SEUIL_MATIERE_EN = 25;      // équivalent 5/20 sur barème /100
const SEUIL_BAISSE_SIGNIFICATIVE = 3; // pts de moyenne générale entre 2 périodes

class NotFoundError extends Error {
  constructor(message: string) { super(message); this.name = 'NotFoundError'; }
}