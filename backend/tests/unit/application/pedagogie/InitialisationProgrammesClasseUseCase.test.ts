import { describe, expect, it } from 'bun:test';
import { ProposerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/ProposerInitialisationProgrammesClasseUseCase';
import { AppliquerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/AppliquerInitialisationProgrammesClasseUseCase';
import type {
  ClassePourMaterialisation,
  MaterialisationProgrammeRepository,
  OfficialProgressionAvecChapitres,
  ProgrammeExistantClasse,
  ProgrammeMaterialiseResultat,
  ProgrammeNationalACreer,
} from '@domain/ports/repositories/MaterialisationProgrammeRepository';

class InMemoryMaterialisationRepo implements MaterialisationProgrammeRepository {
  public programmesStockes: Array<ProgrammeNationalACreer & { id: string; source: string }> = [];
  public appelsTransaction = 0;

  constructor(
    private readonly classe: ClassePourMaterialisation,
    private readonly officialProgressions: OfficialProgressionAvecChapitres[],
    existantsInitiaux: Array<ProgrammeNationalACreer & { id: string; source: string }> = [],
  ) {
    this.programmesStockes = [...existantsInitiaux];
  }

  async findClassePourMaterialisation(schoolId: string, classId: string) {
    if (this.classe.schoolId !== schoolId || this.classe.id !== classId) return null;
    return this.classe;
  }

  async findOfficialProgressionsCandidates() {
    return this.officialProgressions;
  }

  async findProgrammesExistantsClasse(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<ProgrammeExistantClasse[]> {
    return this.programmesStockes
      .filter(
        (p) => p.schoolId === schoolId && p.classId === classId && p.academicYearId === academicYearId,
      )
      .map((p) => ({
        id: p.id,
        subjectId: p.subjectId,
        titre: p.titre,
        source: p.source,
        officialProgressionId: p.officialProgressionId || null,
        nbChapitres: p.chapitres.length,
      }));
  }

  async creerProgrammesEtChapitresAtomique(
    items: ProgrammeNationalACreer[],
  ): Promise<ProgrammeMaterialiseResultat[]> {
    this.appelsTransaction += 1;
    const res: ProgrammeMaterialiseResultat[] = [];
    for (const item of items) {
      const id = `prog_created_${this.programmesStockes.length + 1}`;
      this.programmesStockes.push({ ...item, id, source: 'national' });
      res.push({
        programmeId: id,
        subjectId: item.subjectId,
        titre: item.titre,
        officialProgressionId: item.officialProgressionId,
        nbLeconsCreees: item.chapitres.length,
      });
    }
    return res;
  }
}

const PROG_MATHS_4E: OfficialProgressionAvecChapitres = {
  id: 'off_maths_4e',
  templateCode: '__ALL__',
  level: '4e',
  filiere: 'FR_GENERAL',
  subjectName: 'Mathématiques',
  titre: 'Programme Officiel Mathématiques 4e',
  importChecksum: 'chk_maths_4e',
  nbLecons: 2,
  chapitres: [
    {
      ordre: 1,
      titre: 'Nombres décimaux relatifs',
      volumeHeuresPrevu: null,
      sequenceCibleFin: null,
      moduleOrdre: 1,
      moduleTitre: 'Relations et opérations fondamentales',
      positionDansModule: 1,
      numeroAffiche: 'Leçon 1',
      sourceUrl: 'https://example.test/lecon-1',
      sourceKey: '1:1',
    },
    {
      ordre: 2,
      titre: 'Calcul littéral',
      volumeHeuresPrevu: null,
      sequenceCibleFin: null,
      moduleOrdre: 1,
      moduleTitre: 'Relations et opérations fondamentales',
      positionDansModule: 2,
      numeroAffiche: 'Leçon 2',
      sourceUrl: 'https://example.test/lecon-2',
      sourceKey: '1:2',
    },
  ],
};

const PROG_LATIN_4E: OfficialProgressionAvecChapitres = {
  id: 'off_latin_4e',
  templateCode: '__ALL__',
  level: '4e',
  filiere: 'FR_GENERAL',
  subjectName: 'Latin',
  titre: 'Programme Officiel Latin 4e',
  importChecksum: 'chk_latin_4e',
  nbLecons: 1,
  chapitres: [
    {
      ordre: 1,
      titre: 'La 3e déclinaison',
      volumeHeuresPrevu: null,
      sequenceCibleFin: null,
      moduleOrdre: 1,
      moduleTitre: 'Vie familiale',
      positionDansModule: 1,
      numeroAffiche: 'Leçon 1',
      sourceUrl: null,
      sourceKey: '1:1',
    },
  ],
};

const PROG_GREC_4E: OfficialProgressionAvecChapitres = {
  ...PROG_LATIN_4E,
  id: 'off_grec_4e',
  subjectName: 'Grec',
  titre: 'Programme Officiel Grec 4e',
  importChecksum: 'chk_grec_4e',
};

describe('Initialisation programmes d une classe (propose / apply / idempotence)', () => {
  const classe4e: ClassePourMaterialisation = {
    id: 'cls_4eA',
    schoolId: 'sch_1',
    name: '4e A',
    level: '4ème',
    filiere: 'FR_GENERAL',
    serie: null,
    pebsMixte: false,
    academicYearId: 'ay_2026',
    schoolTemplateCode: 'LYCEE_GENERAL_FR',
    subjects: [
      { id: 'sub_maths', name: 'Mathématiques' },
      { id: 'sub_fr', name: 'Français' },
      { id: 'sub_classiques', name: 'Lettres classiques (Latin/Grec)' },
      { id: 'sub_orient', name: 'Orientation Conseil' },
    ],
  };

  const manuelFrancais = {
    id: 'prog_manuel_fr',
    schoolId: 'sch_1',
    subjectId: 'sub_fr',
    classId: 'cls_4eA',
    level: '4ème',
    academicYearId: 'ay_2026',
    titre: 'Mon programme manuel de Français',
    officialProgressionId: '',
    sourceChecksum: null,
    filiere: null,
    source: 'manuel',
    chapitres: [
      {
        ordre: 1,
        titre: 'Chapitre manuel 1',
        volumeHeuresPrevu: 4,
        sequenceCibleFin: 1,
        moduleOrdre: null,
        moduleTitre: null,
        positionDansModule: null,
        numeroAffiche: null,
        sourceUrl: null,
        sourceKey: null,
      },
    ],
  };

  it('propose (dry-run) ne fait aucune écriture et classe aCreer, ignores, choixRequis et impossibles', async () => {
    const repo = new InMemoryMaterialisationRepo(
      classe4e,
      [PROG_MATHS_4E, PROG_LATIN_4E, PROG_GREC_4E],
      [manuelFrancais],
    );
    const proposer = new ProposerInitialisationProgrammesClasseUseCase(repo);

    const res = await proposer.execute({ schoolId: 'sch_1', classId: 'cls_4eA' });

    expect(repo.appelsTransaction).toBe(0);
    expect(res.aCreer.map((x) => x.subjectId)).toEqual(['sub_maths']);
    expect(res.ignores).toHaveLength(1);
    expect(res.ignores[0].subjectId).toBe('sub_fr');
    expect(res.ignores[0].raison).toBe('PROGRAMME_MANUEL_EXISTANT');
    expect(res.choixRequis).toHaveLength(1);
    expect(res.choixRequis[0].subjectId).toBe('sub_classiques');
    expect(res.choixRequis[0].options).toEqual(['Latin', 'Grec']);
    expect(res.impossibles).toHaveLength(1);
    expect(res.impossibles[0].subjectId).toBe('sub_orient');
  });

  it('apply crée atomiquement, respecte le choix Latin/Grec, ne touche pas au programme manuel et est idempotent', async () => {
    const repo = new InMemoryMaterialisationRepo(
      classe4e,
      [PROG_MATHS_4E, PROG_LATIN_4E, PROG_GREC_4E],
      [manuelFrancais],
    );
    const proposer = new ProposerInitialisationProgrammesClasseUseCase(repo);
    const appliquer = new AppliquerInitialisationProgrammesClasseUseCase(proposer, repo);

    // 1er passage avec choix Grec pour Lettres classiques
    const run1 = await appliquer.execute({
      schoolId: 'sch_1',
      classId: 'cls_4eA',
      optionsClassiques: { sub_classiques: 'Grec' },
    });

    expect(repo.appelsTransaction).toBe(1);
    expect(run1.totalCrees).toBe(2);
    expect(run1.totalLeconsCreees).toBe(3);

    // Le programme manuel de Français est strictement intact
    const manuelApres = repo.programmesStockes.find((p) => p.id === 'prog_manuel_fr');
    expect(manuelApres?.titre).toBe('Mon programme manuel de Français');
    expect(manuelApres?.source).toBe('manuel');

    // Les chapitres nationaux créés portent bien volumeHeuresPrevu = null et la traçabilité
    const mathsCree = repo.programmesStockes.find((p) => p.subjectId === 'sub_maths');
    expect(mathsCree?.source).toBe('national');
    expect(mathsCree?.chapitres[0].volumeHeuresPrevu).toBeNull();
    expect(mathsCree?.chapitres[0].sourceKey).toBe('1:1');
    expect(mathsCree?.chapitres[0].numeroAffiche).toBe('Leçon 1');

    // 2e passage (idempotence) : zéro création, zéro transaction, zéro doublon
    const run2 = await appliquer.execute({
      schoolId: 'sch_1',
      classId: 'cls_4eA',
      optionsClassiques: { sub_classiques: 'Grec' },
    });

    expect(run2.totalCrees).toBe(0);
    expect(run2.totalLeconsCreees).toBe(0);
    expect(repo.appelsTransaction).toBe(1);
    expect(repo.programmesStockes).toHaveLength(3);
    expect(run2.ignores.filter((i) => i.raison === 'DEJA_INITIALISE')).toHaveLength(2);
  });
});
