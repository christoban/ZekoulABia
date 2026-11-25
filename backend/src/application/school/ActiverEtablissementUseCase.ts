/**
 * APPLICATION LAYER — Use Case : Activer un établissement (Admin)
 * APPROVED → ACTIVE
 * Déclenché quand l'Admin soumet le formulaire de configuration (/admin/configuration).
 * Transaction atomique : crée l'année scolaire, les périodes, séquences, classes,
 * matières, départements, et applique les formules/mentions du template dans l'école.
 */
import type { SchoolActivationRepository } from '@domain/ports/repositories/SchoolActivationRepository';
import { getTemplateMeta, isPEBSFrancophoneEligible, isPEBSAnglophoneEligible } from './schoolTemplateConfig';
import { creerCalendrierInitial } from './activation/activationCalendar';
import { genererEtSauvegarderClasses } from './activation/activationClasses';
import { creerMatieresApc, creerDepartementsApc } from './activation/activationApc';
import { creerMatieresEtCoefficientsSecondaire, creerDepartementsSecondaire } from './activation/activationSecondary';
import { appliquerReconciliationEtFinalisation } from './activation/activationReconciliation';

export interface ActiverEtablissementCommande {
  schoolId: string;
}

export interface ActiverEtablissementResultat {
  schoolId: string;
  message: string;
  classCount: number;
  subjectCount: number;
  academicYear: string;
}

export class ActiverEtablissementUseCase {
  constructor(private readonly schoolActivationRepository: SchoolActivationRepository) {}

  async execute(commande: ActiverEtablissementCommande): Promise<ActiverEtablissementResultat> {
    const { schoolId } = commande;

    const school = await this.schoolActivationRepository.findSchoolForActivation(schoolId);
    if (!school) throw new Error(`École introuvable : ${schoolId}`);
    if (school.status !== 'APPROVED') {
      throw new Error(`L'établissement doit être approuvé avant d'être activé (statut actuel : ${school.status})`);
    }

    const config = (school.onboardingConfig ?? {}) as Record<string, unknown>;

    // Extraction des métadonnées du template
    const enGradingSystem = config.enGradingSystem as string | undefined;
    const bulletinFrequency = config.bulletinFrequency as string | undefined;
    const evalSystemPrimaire = config.evalSystemPrimaire as string | undefined;
    const templateCode = config.templateCode as string | undefined;

    const passMark = enGradingSystem === 'OVER_100' ? 50 : 10;
    const templateMeta = getTemplateMeta(templateCode);
    const langMode = templateMeta.langMode;
    const isPrimaire = templateMeta.isPrimaire;
    const isAnglophone = templateMeta.isAnglophone;
    const isTechnique = templateMeta.isTechnique;

    // Détection COMPLEXE_SCOLAIRE
    const isComplexe = templateCode === 'COMPLEXE_SCOLAIRE';
    const hasPrimaireContent =
      isComplexe &&
      ((Array.isArray(config?.niveauxPrimaire) && config.niveauxPrimaire.length > 0) ||
        (Array.isArray(config?.maternelleSections) && config.maternelleSections.length > 0) ||
        (Array.isArray(config?.nurseryLevels) && config.nurseryLevels.length > 0));
    const hasSecondaireContent =
      isComplexe &&
      ((Array.isArray(config?.niveaux1erCycle) && config.niveaux1erCycle.length > 0) ||
        (Array.isArray(config?.niveaux2eCycle) && config.niveaux2eCycle.length > 0));

    // Drapeaux PEBS & templates de bulletin
    const hasPEBSFrancophone = config?.hasPEBSFrancophone === true && isPEBSFrancophoneEligible(templateCode);
    const hasPEBSAnglophone = config?.hasPEBSAnglophone === true && isPEBSAnglophoneEligible(templateCode);

    type BulletinTpl = 'FR_SECONDARY' | 'EN_SECONDARY' | 'TECHNICAL_FR' | 'PRIMARY' | 'MONTHLY';
    let bulletinTemplate: BulletinTpl = 'FR_SECONDARY';
    if (bulletinFrequency === 'MONTHLY' && isPrimaire) bulletinTemplate = 'MONTHLY';
    else if (isPrimaire) bulletinTemplate = 'PRIMARY';
    else if (isTechnique) bulletinTemplate = 'TECHNICAL_FR';
    else if (isAnglophone) bulletinTemplate = 'EN_SECONDARY';

    const gradesPerTerm = bulletinFrequency === 'MONTHLY' ? 4 : 2;
    const finalPassMark = evalSystemPrimaire === 'APC_300' ? 10 : passMark;

    let classCount = 0;
    let subjectCount = 0;
    let academicYearName = '';

    await this.schoolActivationRepository.activerEtablissement(schoolId, async (tx) => {
      // 1. Calendrier scolaire, périodes et séquences
      const calRes = await creerCalendrierInitial({
        tx,
        config,
        isPrimaire,
        isAnglophone,
        hasPrimaireContent,
        hasSecondaireContent,
        isComplexe,
      });
      academicYearName = calRes.academicYearName;

      // 2. Génération et persistance des classes
      const classRes = await genererEtSauvegarderClasses({
        tx,
        config,
        schoolId,
        academicYearId: calRes.academicYear.id,
        templateCode,
        isTechnique,
        isAnglophone,
        isComplexe,
        hasPEBSFrancophone,
        hasPEBSAnglophone,
      });
      classCount = classRes.classCount;

      // 3. Matières APC (primaire)
      const apcRes = await creerMatieresApc(tx, isPrimaire, isComplexe, hasPrimaireContent);
      subjectCount += apcRes.subjectCount;

      // 4. Matières secondaires et assignations de coefficients
      const secRes = await creerMatieresEtCoefficientsSecondaire({
        tx,
        school,
        config,
        templateCode,
        classesACreer: classRes.classesACreer,
        enSixthClassNames: classRes.enSixthClassNames,
        isPrimaire,
        isAnglophone,
      });
      subjectCount += secRes.subjectCount;

      // 5. Départements pédagogiques
      await creerDepartementsSecondaire(tx, templateCode, isPrimaire, apcRes.apcSubjectIds);
      await creerDepartementsApc(tx, isPrimaire, isComplexe, hasPrimaireContent);

      // 6. Formules, mentions, LV2, PEBS mixte, frais et passage en statut ACTIVE
      const recRes = await appliquerReconciliationEtFinalisation({
        tx,
        school,
        config,
        templateCode,
        hasPEBSFrancophone,
        hasPEBSAnglophone,
        periodsCount: calRes.periodsCount,
        finalPassMark,
        langMode,
        bulletinTemplate,
        gradesPerTerm,
        isTechnique,
        isAnglophone,
        isPrimaire,
      });
      subjectCount += recRes.subjectCountAdded;
    });

    return {
      schoolId: school.id,
      message: `Établissement "${school.name}" activé avec succès`,
      classCount,
      subjectCount,
      academicYear: academicYearName,
    };
  }
}
