import type {
  OfficialProgressionImportRepository,
  OfficialProgressionNaturalKey,
  OfficialProgressionSnapshot,
  OfficialProgressionUpsertMutation,
} from '@domain/ports/repositories/OfficialProgressionImportRepository';
import {
  calculerChecksumProgression,
  construireCleProgression,
  normaliserChapitresEtCollecterDiagnostics,
  normaliserCleMatiere,
} from './chapitresNormalisation';
import {
  ImportProgressionsConflictError,
  ImportProgressionsValidationError,
  SOURCE_IMPORT_OFFICIEL,
  type ActionPlanifieeImport,
  type AppliquerImportProgressionsCommande,
  type ImportProgressionsDiagnostics,
  type ProposerImportProgressionsCommande,
  type RejetImportProgression,
  type ResultatApplicationImport,
  type ResultatPropositionImport,
} from './types';

function fusionnerDiagnostics(
  cible: ImportProgressionsDiagnostics,
  ajout: ImportProgressionsDiagnostics,
): void {
  cible.leconsSansNumero.push(...ajout.leconsSansNumero);
  cible.numerosDupliques.push(...ajout.numerosDupliques);
  cible.modulesParasites.push(...ajout.modulesParasites);
  cible.elementsExclus.push(...ajout.elementsExclus);
}

export class ImporterProgressionsOfficiellesUseCase {
  constructor(private readonly repo: OfficialProgressionImportRepository) {}

  /**
   * Dry-run strictement en lecture seule : valide le lot d'un niveau, résout les matières,
   * calcule les actions prévues, détecte les conflits manuels et agrège les diagnostics.
   */
  async proposer(commande: ProposerImportProgressionsCommande): Promise<ResultatPropositionImport> {
    // L'import officiel écrit toujours cette source fixe (détection fiable côté interface).
    const sourceImport = SOURCE_IMPORT_OFFICIEL;
    const diagnostics: ImportProgressionsDiagnostics = {
      leconsSansNumero: [],
      numerosDupliques: [],
      modulesParasites: [],
      elementsExclus: [],
    };
    const rejets: RejetImportProgression[] = [];

    if (!commande.items || commande.items.length === 0) {
      throw new ImportProgressionsValidationError('Le lot d\'import est vide.', [
        {
          index: -1,
          templateCode: '',
          level: commande.level ?? '',
          filiere: '',
          subjectName: '',
          subjectNameSource: null,
          code: 'EMPTY_BATCH',
          message: 'Aucun programme fourni dans le fichier JSON.',
        },
      ]);
    }

    // Contrainte métier : un seul niveau par fichier/lot
    const niveauxDistincts = Array.from(
      new Set(commande.items.map((it) => it.level.trim()).filter((lvl) => lvl.length > 0)),
    );
    const niveauDeclare = commande.level?.trim();

    if (niveauxDistincts.length > 1) {
      throw new ImportProgressionsValidationError(
        `Un lot d'import ne peut contenir qu'un seul niveau (niveaux détectés : ${niveauxDistincts.join(', ')}).`,
        niveauxDistincts.map((lvl, idx) => ({
          index: idx,
          templateCode: '',
          level: lvl,
          filiere: '',
          subjectName: '',
          subjectNameSource: null,
          code: 'MULTI_LEVEL_BATCH',
          message: `Niveau multiple détecté dans le même fichier : ${lvl}`,
        })),
      );
    }

    const levelLot = niveauxDistincts[0] ?? '';
    if (niveauDeclare && niveauDeclare !== levelLot) {
      throw new ImportProgressionsValidationError(
        `Le niveau déclaré (${niveauDeclare}) ne correspond pas au niveau des items (${levelLot}).`,
        [
          {
            index: -1,
            templateCode: '',
            level: levelLot,
            filiere: '',
            subjectName: '',
            subjectNameSource: null,
            code: 'LEVEL_MISMATCH',
            message: `Niveau déclaré « ${niveauDeclare} » différent de « ${levelLot} ».`,
          },
        ],
      );
    }

    const templatesConnus = new Set(await this.repo.listExistingTemplateCodes());
    const cacheMatieres = new Map<string, { map: Map<string, string>; liste: string[] }>();
    const clesVuesDansLot = new Set<string>();

    interface ItemValideIntermediaire {
      index: number;
      cleProgression: string;
      key: OfficialProgressionNaturalKey;
      subjectNameSource: string | null;
      titre: string;
      source: string;
      active: boolean;
      chapitres: ActionPlanifieeImport['chapitres'];
      nbChapitresExclus: number;
      importChecksum: string;
    }

    const itemsValides: ItemValideIntermediaire[] = [];

    for (let index = 0; index < commande.items.length; index++) {
      const raw = commande.items[index]!;
      const templateCode = raw.templateCode.trim() || '__ALL__';
      const level = raw.level.trim();
      const filiere = (raw.filiere ?? '').trim();
      const subjectNameBrut = raw.subjectName.trim();
      const subjectNameSource = raw.subjectNameSource?.trim() || null;
      const titre = raw.titre.trim();
      const source = sourceImport;
      const active = raw.active !== false;

      if (!templatesConnus.has(templateCode)) {
        rejets.push({
          index,
          templateCode,
          level,
          filiere,
          subjectName: subjectNameBrut,
          subjectNameSource,
          code: 'UNKNOWN_TEMPLATE',
          message: `Template inconnu en base : « ${templateCode} ».`,
        });
        continue;
      }

      // Résolution stricte de la matière officielle (normalisation casse + accents + espaces)
      const cleScope = `${templateCode}::${level}::${filiere}`;
      let entreeScope = cacheMatieres.get(cleScope);
      if (!entreeScope) {
        const connues = await this.repo.listKnownSubjectsForScope({ templateCode, level, filiere });
        const map = new Map<string, string>();
        const unifiees = new Set<string>();
        for (const nom of connues) {
          const canon = nom.trim();
          if (!canon) continue;
          unifiees.add(canon);
          map.set(normaliserCleMatiere(canon), canon);
        }
        const liste = Array.from(unifiees).sort((a, b) => a.localeCompare(b, 'fr'));
        entreeScope = { map, liste };
        cacheMatieres.set(cleScope, entreeScope);
      }

      const subjectNameCanonique = entreeScope.map.get(normaliserCleMatiere(subjectNameBrut));
      if (!subjectNameCanonique) {
        rejets.push({
          index,
          templateCode,
          level,
          filiere,
          subjectName: subjectNameBrut,
          subjectNameSource,
          code: 'SUBJECT_NOT_FOUND',
          message: `Matière « ${subjectNameBrut} » sans correspondance dans le référentiel (${templateCode} / ${level}${filiere ? ` / ${filiere}` : ''}).`,
          matieresConnues: entreeScope.liste,
        });
        continue;
      }

      const key: OfficialProgressionNaturalKey = {
        templateCode,
        level,
        filiere,
        subjectName: subjectNameCanonique,
      };
      const cleProgression = construireCleProgression(key);

      if (clesVuesDansLot.has(cleProgression)) {
        rejets.push({
          index,
          templateCode,
          level,
          filiere,
          subjectName: subjectNameCanonique,
          subjectNameSource,
          code: 'DUPLICATE_PROGRESSION_IN_BATCH',
          message: `Doublon dans le même lot pour la clé (${templateCode}, ${level}, ${filiere || '""'}, ${subjectNameCanonique}).`,
        });
        continue;
      }
      clesVuesDansLot.add(cleProgression);

      const norm = normaliserChapitresEtCollecterDiagnostics({
        cleProgression,
        subjectName: subjectNameCanonique,
        chapitresBruts: raw.chapitres,
      });

      if (norm.erreurCleNaturelleDupliquee) {
        rejets.push({
          index,
          templateCode,
          level,
          filiere,
          subjectName: subjectNameCanonique,
          subjectNameSource,
          code: 'DUPLICATE_CHAPTER_NATURAL_KEY',
          message: norm.erreurCleNaturelleDupliquee,
        });
        continue;
      }

      fusionnerDiagnostics(diagnostics, norm.diagnostics);

      if (norm.chapitres.length === 0) {
        rejets.push({
          index,
          templateCode,
          level,
          filiere,
          subjectName: subjectNameCanonique,
          subjectNameSource,
          code: 'NO_ACTIVE_CHAPTERS',
          message: `Aucune leçon retenue après exclusions pour « ${subjectNameCanonique} » (${norm.nbExclus} exclue(s)).`,
        });
        continue;
      }

      const importChecksum = calculerChecksumProgression({
        titre,
        active,
        chapitres: norm.chapitres,
      });

      itemsValides.push({
        index,
        cleProgression,
        key,
        subjectNameSource,
        titre,
        source,
        active,
        chapitres: norm.chapitres,
        nbChapitresExclus: norm.nbExclus,
        importChecksum,
      });
    }

    // Lecture en masse des lignes existantes
    const existantes = itemsValides.length > 0
      ? await this.repo.findProgressionsByKeys(itemsValides.map((i) => i.key))
      : [];

    const existantesMap = new Map<string, OfficialProgressionSnapshot>();
    for (const row of existantes) {
      existantesMap.set(construireCleProgression(row), row);
    }

    const actions: ActionPlanifieeImport[] = itemsValides.map((item) => {
      const existing = existantesMap.get(item.cleProgression) ?? null;
      let action: ActionPlanifieeImport['action'];
      // Priorité stricte à manuallyEdited : une modification manuelle entre deux imports
      // est TOUJOURS détectée, jamais masquée par un importChecksum encore identique.
      if (!existing) {
        action = 'CREATE';
      } else if (existing.manuallyEdited) {
        action = 'CONFLICT_MANUAL';
      } else if (existing.importChecksum !== null && existing.importChecksum === item.importChecksum) {
        action = 'UNCHANGED';
      } else {
        action = 'UPDATE';
      }

      return {
        index: item.index,
        action,
        cleProgression: item.cleProgression,
        existingId: existing?.id ?? null,
        existingUpdatedAt: existing?.updatedAt ?? null,
        templateCode: item.key.templateCode,
        level: item.key.level,
        filiere: item.key.filiere,
        subjectName: item.key.subjectName,
        subjectNameSource: item.subjectNameSource,
        titre: item.titre,
        source: item.source,
        active: item.active,
        manuallyEdited: existing?.manuallyEdited ?? false,
        nbChapitresRetenus: item.chapitres.length,
        nbChapitresExclus: item.nbChapitresExclus,
        importChecksum: item.importChecksum,
        chapitres: item.chapitres,
      };
    });

    const aCreer = actions.filter((a) => a.action === 'CREATE').length;
    const aMettreAJour = actions.filter((a) => a.action === 'UPDATE').length;
    const inchanges = actions.filter((a) => a.action === 'UNCHANGED').length;
    const conflitsManuels = actions.filter((a) => a.action === 'CONFLICT_MANUAL');

    const leconsRetenues = actions.reduce((acc, a) => acc + a.nbChapitresRetenus, 0);
    const leconsExclues = diagnostics.elementsExclus.length;

    return {
      dryRun: true,
      level: levelLot || null,
      source: sourceImport,
      peutAppliquer: rejets.length === 0,
      resume: {
        totalItems: commande.items.length,
        valides: actions.length,
        aCreer,
        aMettreAJour,
        inchanges,
        conflitsManuels: conflitsManuels.length,
        rejetes: rejets.length,
        leconsRetenues,
        leconsExclues,
      },
      actions,
      conflitsManuels,
      rejets,
      diagnostics,
    };
  }

  /**
   * Applique le lot validé dans une transaction unique et atomique :
   * - refait l'intégralité de la validation côté serveur (ne se fie jamais à un dry-run client)
   * - refuse si le lot contient des rejets (400)
   * - refuse tout écrasement d'une ligne manuallyEdited non confirmée explicitement (409 MANUAL_EDIT_CONFLICT)
   * - idempotence : si toutes les lignes sont déjà identiques (0 mutation), répond 200 avec createdCount=0, updatedCount=0, unchangedCount=N
   */
  async appliquer(commande: AppliquerImportProgressionsCommande): Promise<ResultatApplicationImport> {
    const proposition = await this.proposer(commande);

    if (proposition.rejets.length > 0) {
      throw new ImportProgressionsValidationError(
        `Import refusé : ${proposition.rejets.length} élément(s) rejeté(s) lors de la validation.`,
        proposition.rejets,
      );
    }

    const confirmes = new Set((commande.confirmOverwriteManualIds ?? []).map((id) => id.trim()));
    const skipManuallyEdited = commande.skipManuallyEdited === true;

    const conflitsNonConfirmes = proposition.conflitsManuels.filter(
      (c) => !c.existingId || !confirmes.has(c.existingId),
    );

    if (conflitsNonConfirmes.length > 0 && !skipManuallyEdited) {
      throw new ImportProgressionsConflictError(
        'MANUAL_EDIT_CONFLICT',
        `${conflitsNonConfirmes.length} progression(s) modifiée(s) manuellement nécessitent une confirmation explicite avant écrasement.`,
        conflitsNonConfirmes,
      );
    }

    const mutations: OfficialProgressionUpsertMutation[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let overwrittenManualCount = 0;
    let unchangedCount = 0;
    let skippedManualCount = 0;

    for (const act of proposition.actions) {
      if (act.action === 'UNCHANGED') {
        unchangedCount += 1;
        continue;
      }

      if (act.action === 'CONFLICT_MANUAL') {
        if (act.existingId && confirmes.has(act.existingId)) {
          overwrittenManualCount += 1;
          mutations.push({
            mode: 'OVERWRITE_MANUAL',
            existingId: act.existingId,
            templateCode: act.templateCode,
            level: act.level,
            filiere: act.filiere,
            subjectName: act.subjectName,
            titre: act.titre,
            chapitres: act.chapitres,
            source: act.source,
            importChecksum: act.importChecksum,
            active: act.active,
          });
        } else {
          skippedManualCount += 1;
        }
        continue;
      }

      if (act.action === 'CREATE') {
        createdCount += 1;
        mutations.push({
          mode: 'CREATE',
          templateCode: act.templateCode,
          level: act.level,
          filiere: act.filiere,
          subjectName: act.subjectName,
          titre: act.titre,
          chapitres: act.chapitres,
          source: act.source,
          importChecksum: act.importChecksum,
          active: act.active,
        });
        continue;
      }

      updatedCount += 1;
      mutations.push({
        mode: 'UPDATE',
        existingId: act.existingId ?? undefined,
        templateCode: act.templateCode,
        level: act.level,
        filiere: act.filiere,
        subjectName: act.subjectName,
        titre: act.titre,
        chapitres: act.chapitres,
        source: act.source,
        importChecksum: act.importChecksum,
        active: act.active,
      });
    }

    if (mutations.length === 0) {
      return {
        applied: true,
        level: proposition.level ?? '',
        source: proposition.source,
        createdCount: 0,
        updatedCount: 0,
        overwrittenManualCount: 0,
        unchangedCount,
        skippedManualCount,
        totalAffected: 0,
        items: [],
        diagnostics: proposition.diagnostics,
      };
    }

    const persistes = await this.repo.applyImportTransaction(mutations);

    return {
      applied: true,
      level: proposition.level ?? '',
      source: proposition.source,
      createdCount,
      updatedCount,
      overwrittenManualCount,
      unchangedCount,
      skippedManualCount,
      totalAffected: persistes.length,
      items: persistes.map((row, idx) => ({
        id: row.id,
        mode: mutations[idx]?.mode ?? 'UPDATE',
        templateCode: row.templateCode,
        level: row.level,
        filiere: row.filiere,
        subjectName: row.subjectName,
        titre: row.titre,
        nbChapitres: mutations[idx]?.chapitres.length ?? 0,
        importChecksum: row.importChecksum ?? '',
      })),
      diagnostics: proposition.diagnostics,
    };
  }
}

