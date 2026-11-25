/**
 * APPLICATION LAYER — Use Case : Génération des rapports scolarité et statistiques (GENERATE_REPORTS)
 *
 * Consolide les effectifs, liste les dossiers d'inscription incomplets, agrège les résultats de concours,
 * et produit l'export Excel multi-feuilles pour le secrétariat et la direction.
 */
import type {
  RapportsScolariteRepository,
  EffectifClasseRow,
  DossierIncompletRow,
  StatConcoursRow,
} from '@domain/ports/repositories/RapportsScolariteRepository';
import * as XLSX from 'xlsx';

export interface CycleStats {
  inscrits: number;
  capacite: number;
  garcons: number;
  filles: number;
}

export interface RapportEffectifsComplet {
  totalInscrits: number;
  totalCapacite: number;
  totalGarcons: number;
  totalFilles: number;
  tauxOccupationGlobal: number;
  parClasse: Array<EffectifClasseRow & { tauxOccupation: number }>;
  parCycle: {
    premierCycle: CycleStats;
    secondCycle: CycleStats;
  };
  parNiveau: Array<{ niveau: string; inscrits: number; garcons: number; filles: number }>;
}

export interface RapportScolariteGlobal {
  effectifs: RapportEffectifsComplet;
  dossiersIncomplets: DossierIncompletRow[];
  concours: StatConcoursRow[];
}

export class GenererRapportsScolariteUseCase {
  constructor(private readonly repository: RapportsScolariteRepository) {}

  async getEffectifs(schoolId: string, academicYearId?: string): Promise<RapportEffectifsComplet> {
    const classes = await this.repository.getEffectifsParClasse(schoolId, academicYearId);

    let totalInscrits = 0;
    let totalCapacite = 0;
    let totalGarcons = 0;
    let totalFilles = 0;

    const premierCycle: CycleStats = { inscrits: 0, capacite: 0, garcons: 0, filles: 0 };
    const secondCycle: CycleStats = { inscrits: 0, capacite: 0, garcons: 0, filles: 0 };
    const niveauMap = new Map<string, { inscrits: number; garcons: number; filles: number }>();

    const parClasse = classes.map((c) => {
      totalInscrits += c.totalInscrits;
      totalCapacite += c.capacity;
      totalGarcons += c.garcons;
      totalFilles += c.filles;

      const tauxOccupation = c.capacity > 0 ? Math.round((c.totalInscrits / c.capacity) * 100) : 0;

      // Détermination du cycle (francophone & anglophone)
      const lvl = (c.level || '').toLowerCase().trim();
      const isPremierCycle =
        lvl.includes('6') ||
        lvl.includes('5') ||
        lvl.includes('4') ||
        lvl.includes('3') ||
        lvl.includes('form 1') ||
        lvl.includes('form 2') ||
        lvl.includes('form 3') ||
        lvl.includes('form 4') ||
        lvl.includes('form1') ||
        lvl.includes('form2') ||
        lvl.includes('form3') ||
        lvl.includes('form4');

      if (isPremierCycle) {
        premierCycle.inscrits += c.totalInscrits;
        premierCycle.capacite += c.capacity;
        premierCycle.garcons += c.garcons;
        premierCycle.filles += c.filles;
      } else {
        secondCycle.inscrits += c.totalInscrits;
        secondCycle.capacite += c.capacity;
        secondCycle.garcons += c.garcons;
        secondCycle.filles += c.filles;
      }

      const niveauKey = c.level || 'Non classé';
      const existing = niveauMap.get(niveauKey) || { inscrits: 0, garcons: 0, filles: 0 };
      existing.inscrits += c.totalInscrits;
      existing.garcons += c.garcons;
      existing.filles += c.filles;
      niveauMap.set(niveauKey, existing);

      return {
        ...c,
        tauxOccupation,
      };
    });

    const parNiveau = Array.from(niveauMap.entries()).map(([niveau, stats]) => ({
      niveau,
      ...stats,
    }));

    const tauxOccupationGlobal = totalCapacite > 0 ? Math.round((totalInscrits / totalCapacite) * 100) : 0;

    return {
      totalInscrits,
      totalCapacite,
      totalGarcons,
      totalFilles,
      tauxOccupationGlobal,
      parClasse,
      parCycle: { premierCycle, secondCycle },
      parNiveau,
    };
  }

  async getDossiersIncomplets(schoolId: string): Promise<DossierIncompletRow[]> {
    return this.repository.getDossiersIncomplets(schoolId);
  }

  async getStatistiquesConcours(schoolId: string): Promise<StatConcoursRow[]> {
    return this.repository.getStatistiquesConcours(schoolId);
  }

  async getRapportGlobal(schoolId: string, academicYearId?: string): Promise<RapportScolariteGlobal> {
    const [effectifs, dossiersIncomplets, concours] = await Promise.all([
      this.getEffectifs(schoolId, academicYearId),
      this.getDossiersIncomplets(schoolId),
      this.getStatistiquesConcours(schoolId),
    ]);

    return { effectifs, dossiersIncomplets, concours };
  }

  async genererExportExcel(schoolId: string, academicYearId?: string): Promise<Buffer> {
    const globalData = await this.getRapportGlobal(schoolId, academicYearId);
    const workbook = XLSX.utils.book_new();

    // 1. Feuille Effectifs & Capacités
    const effectifsRows = globalData.effectifs.parClasse.map((c) => ({
      Classe: c.className,
      Niveau: c.level || '—',
      Série: c.serie || '—',
      Filière: c.filiere || '—',
      Capacité: c.capacity,
      Inscrits: c.totalInscrits,
      Garçons: c.garcons,
      Filles: c.filles,
      'Taux d\'occupation': `${c.tauxOccupation}%`,
    }));

    // Ligne de synthèse
    effectifsRows.push({
      Classe: 'TOTAL ÉTABLISSEMENT',
      Niveau: '—',
      Série: '—',
      Filière: '—',
      Capacité: globalData.effectifs.totalCapacite,
      Inscrits: globalData.effectifs.totalInscrits,
      Garçons: globalData.effectifs.totalGarcons,
      Filles: globalData.effectifs.totalFilles,
      'Taux d\'occupation': `${globalData.effectifs.tauxOccupationGlobal}%`,
    });

    const sheetEffectifs = XLSX.utils.json_to_sheet(effectifsRows);
    XLSX.utils.book_append_sheet(workbook, sheetEffectifs, 'Effectifs');

    // 2. Feuille Dossiers Incomplets
    const dossiersRows = globalData.dossiersIncomplets.map((d) => ({
      'Nom de l\'élève': d.nomProvisoire,
      'Classe souhaitée': d.className || 'Non affectée',
      Téléphone: d.contactTelephone || '—',
      Complétude: `${d.completenessScore ?? 0}%`,
      'Validable sous réserve': d.validableSousReserve ? 'Oui' : 'Non',
      Statut: d.status,
      'Date soumission': new Date(d.createdAt).toLocaleDateString('fr-FR'),
      'Pièces manquantes': d.piecesManquantes.join(', ') || 'Aucune',
    }));

    const sheetDossiers = XLSX.utils.json_to_sheet(dossiersRows);
    XLSX.utils.book_append_sheet(workbook, sheetDossiers, 'Dossiers Incomplets');

    // 3. Feuille Statistiques Concours
    const concoursRows = globalData.concours.map((s) => ({
      Session: s.sessionName,
      'Date épreuve': new Date(s.examDate).toLocaleDateString('fr-FR'),
      Capacité: s.capacity,
      'Total Candidats': s.totalCandidats,
      Admis: s.admis,
      'Liste d\'attente': s.listeAttente,
      Refusés: s.refuses,
      'Taux de réussite': `${s.tauxReussitePercent}%`,
      'Moyenne générale': s.moyenneGenerale,
    }));

    const sheetConcours = XLSX.utils.json_to_sheet(concoursRows);
    XLSX.utils.book_append_sheet(workbook, sheetConcours, 'Concours');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
