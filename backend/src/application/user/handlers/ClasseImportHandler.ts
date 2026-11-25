import type { CreerClasseService } from '@domain/ports/services/CreerClasseService';
import type { ClasseImportRow } from '../dto/ImportUserDtos';

interface Dependencies {
  creerClasseUseCase: CreerClasseService;
}

export async function traiterLigneClasse(
  deps: Dependencies,
  schoolId: string,
  row: ClasseImportRow,
): Promise<void> {
  const { creerClasseUseCase } = deps;

  if (!row.nom?.trim()) throw new Error('Nom de la classe obligatoire');
  if (!row.niveau?.trim()) throw new Error('Niveau obligatoire');

  let capacity: number | undefined;
  if (row.capacite?.trim()) {
    capacity = parseInt(row.capacite.trim(), 10);
    if (isNaN(capacity) || capacity < 1 || capacity > 200) {
      throw new Error('Capacité invalide (entier entre 1 et 200)');
    }
  }

  await creerClasseUseCase.execute({
    schoolId,
    name: row.nom.trim(),
    level: row.niveau.trim(),
    serie: row.serie?.trim() || undefined,
    filiere: row.filiere?.trim() || undefined,
    capacity,
  });
}