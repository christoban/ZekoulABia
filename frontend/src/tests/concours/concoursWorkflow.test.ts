import { describe, it, expect } from 'bun:test';

interface CandidateTest {
  id: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  examScore?: number | null;
  admissionStatus: string;
  cepResult?: 'REUSSI' | 'ECHOUE' | null;
}

// Fonction de calcul de délibération simulée
function simulerDeliberation(
  candidates: CandidateTest[],
  threshold: number,
  availableSeats: number
) {
  // Tri par note décroissante
  const sorted = [...candidates].sort((a, b) => (b.examScore ?? 0) - (a.examScore ?? 0));

  let admisCount = 0;
  const resultats = sorted.map((cand, idx) => {
    const rank = idx + 1;
    const score = cand.examScore ?? 0;

    let status = 'REFUSE';
    if (score >= threshold && admisCount < availableSeats) {
      status = 'ADMIS_PROVISOIRE';
      admisCount++;
    } else if (score >= threshold - 1.5) {
      status = 'LISTE_ATTENTE';
    }

    return {
      ...cand,
      rank,
      admissionStatus: status,
    };
  });

  return {
    total: candidates.length,
    admis: resultats.filter((r) => r.admissionStatus === 'ADMIS_PROVISOIRE'),
    attente: resultats.filter((r) => r.admissionStatus === 'LISTE_ATTENTE'),
    refuses: resultats.filter((r) => r.admissionStatus === 'REFUSE'),
  };
}

// Détection de doublons
function detecterDoublons(
  nouveaux: Array<{ firstName: string; lastName: string; dateOfBirth?: string }>,
  existants: Array<{ firstName: string; lastName: string; dateOfBirth?: string | null }>
) {
  return nouveaux.map((c, idx) => {
    const nom = c.lastName.trim().toLowerCase();
    const prenom = c.firstName.trim().toLowerCase();

    const doublonExistant = existants.some(
      (e) =>
        e.lastName.trim().toLowerCase() === nom &&
        e.firstName.trim().toLowerCase() === prenom
    );

    const doublonLot = nouveaux.some(
      (other, otherIdx) =>
        otherIdx !== idx &&
        other.lastName.trim().toLowerCase() === nom &&
        other.firstName.trim().toLowerCase() === prenom
    );

    return {
      ...c,
      isDuplicate: doublonExistant || doublonLot,
      typeDoublon: doublonExistant ? 'BASE' : doublonLot ? 'LOT' : null,
    };
  });
}

// Transition CEP et finalisation sans validation
function appliquerConfirmationCepEtFinalisation(candidates: CandidateTest[]) {
  return candidates.map((c) => {
    if (c.admissionStatus === 'ADMIS_PROVISOIRE') {
      if (c.cepResult === 'REUSSI') {
        // Confirmation directe -> prêt pour inscription
        return { ...c, admissionStatus: 'CONFIRME' };
      } else if (c.cepResult === 'ECHOUE') {
        // Libération de la place
        return { ...c, admissionStatus: 'ANNULE' };
      }
    }
    return c;
  });
}

describe('Concours d\'Entrée — Workflow & Logique Métier', () => {
  it('détecte correctement les doublons par rapport à la base et internes au lot', () => {
    const existants = [
      { firstName: 'Marie', lastName: 'NGONO', dateOfBirth: '2012-05-14' },
      { firstName: 'Paul', lastName: 'ATANGANA', dateOfBirth: '2012-08-20' },
    ];

    const nouveaux = [
      { firstName: 'Marie', lastName: 'NGONO', dateOfBirth: '2012-05-14' }, // Doublon base
      { firstName: 'Jean', lastName: 'ESSOMBA', dateOfBirth: '2013-01-10' },  // Unique 1
      { firstName: 'Jean', lastName: 'ESSOMBA', dateOfBirth: '2013-01-10' },  // Doublon interne lot
      { firstName: 'Carine', lastName: 'FOUDA', dateOfBirth: '2012-11-03' }, // Unique 2
    ];

    const res = detecterDoublons(nouveaux, existants);
    expect(res[0].isDuplicate).toBe(true);
    expect(res[0].typeDoublon).toBe('BASE');

    expect(res[1].isDuplicate).toBe(true);
    expect(res[1].typeDoublon).toBe('LOT');

    expect(res[2].isDuplicate).toBe(true);
    expect(res[2].typeDoublon).toBe('LOT');

    expect(res[3].isDuplicate).toBe(false);
    expect(res[3].typeDoublon).toBeNull();
  });

  it('calcule la délibération et respecte le seuil et le quota de places', () => {
    const candidats: CandidateTest[] = [
      { id: '1', firstName: 'A', lastName: 'Test', examScore: 16.5, admissionStatus: 'PENDING' },
      { id: '2', firstName: 'B', lastName: 'Test', examScore: 14.0, admissionStatus: 'PENDING' },
      { id: '3', firstName: 'C', lastName: 'Test', examScore: 11.5, admissionStatus: 'PENDING' },
      { id: '4', firstName: 'D', lastName: 'Test', examScore: 9.5, admissionStatus: 'PENDING' },
      { id: '5', firstName: 'E', lastName: 'Test', examScore: 7.0, admissionStatus: 'PENDING' },
    ];

    // Seuil 10.0, Places disponibles 2
    const outcome = simulerDeliberation(candidats, 10.0, 2);

    expect(outcome.admis.length).toBe(2);
    expect(outcome.admis[0].id).toBe('1'); // 16.5 (Rang 1)
    expect(outcome.admis[1].id).toBe('2'); // 14.0 (Rang 2)

    // Le 3e a 11.5 >= (10 - 1.5) = 8.5 -> Liste d'attente car quota dépassé
    expect(outcome.attente.length).toBe(2);
    expect(outcome.attente[0].id).toBe('3'); // 11.5 (Rang 3)
    expect(outcome.attente[1].id).toBe('4'); // 9.5 >= 8.5 (Rang 4)

    // Le 5e a 7.0 < 8.5 -> Refusé
    expect(outcome.refuses.length).toBe(1);
    expect(outcome.refuses[0].id).toBe('5');
  });

  it('confirme les admis ayant réussi le CEP et libère les places des forfaits', () => {
    const candidats: CandidateTest[] = [
      { id: '1', firstName: 'A', lastName: 'Lauréat', examScore: 15, admissionStatus: 'ADMIS_PROVISOIRE', cepResult: 'REUSSI' },
      { id: '2', firstName: 'B', lastName: 'Forfait', examScore: 13, admissionStatus: 'ADMIS_PROVISOIRE', cepResult: 'ECHOUE' },
      { id: '3', firstName: 'C', lastName: 'EnAttente', examScore: 12, admissionStatus: 'ADMIS_PROVISOIRE', cepResult: null },
    ];

    const result = appliquerConfirmationCepEtFinalisation(candidats);

    expect(result[0].admissionStatus).toBe('CONFIRME');
    expect(result[1].admissionStatus).toBe('ANNULE');
    expect(result[2].admissionStatus).toBe('ADMIS_PROVISOIRE');
  });

  it('autorise la finalisation directe sans re-validation de la direction', () => {
    // Un candidat CONFIRME ou REPECHE passe directement à INSCRIT lors de la finalisation
    const candidatConfirme: CandidateTest = {
      id: 'c1',
      firstName: 'Alice',
      lastName: 'MBARGA',
      examScore: 14.5,
      admissionStatus: 'CONFIRME',
      cepResult: 'REUSSI',
    };

    // La fonction de finalisation directe bascule directement en INSCRIT
    const finaliserCandidat = (c: CandidateTest) => {
      if (c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'REPECHE') {
        return { ...c, admissionStatus: 'INSCRIT' };
      }
      return c;
    };

    const finalise = finaliserCandidat(candidatConfirme);
    expect(finalise.admissionStatus).toBe('INSCRIT');
  });
});
