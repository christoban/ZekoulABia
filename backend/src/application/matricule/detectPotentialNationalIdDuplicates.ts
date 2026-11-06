import { normalizeNationalId } from './normalizeNationalId';

export interface NationalIdAuditRow {
  profileId: string;
  schoolId: string;
  matricule: string;
}

export interface NationalIdDuplicateGroup {
  normalizedNationalId: string;
  rows: NationalIdAuditRow[];
}

export interface NationalIdConfusablePair {
  normalizedNationalIdA: string;
  normalizedNationalIdB: string;
  rowsA: NationalIdAuditRow[];
  rowsB: NationalIdAuditRow[];
}

export interface NationalIdAuditReport {
  exactDuplicates: NationalIdDuplicateGroup[];
  confusableVariants: NationalIdConfusablePair[];
}

const confusableSkeleton = (value: string): string =>
  normalizeNationalId(value).replace(/[O0]/g, '0').replace(/[I1]/g, '1');

export function detectPotentialNationalIdDuplicates(rows: NationalIdAuditRow[]): NationalIdAuditReport {
  const exact = new Map<string, NationalIdAuditRow[]>();
  const confusable = new Map<string, Map<string, NationalIdAuditRow[]>>();

  for (const row of rows) {
    const normalized = normalizeNationalId(row.matricule);
    const exactRows = exact.get(normalized) ?? [];
    exactRows.push({ ...row, matricule: normalized });
    exact.set(normalized, exactRows);

    const skeleton = confusableSkeleton(normalized);
    const variants = confusable.get(skeleton) ?? new Map<string, NationalIdAuditRow[]>();
    const variantRows = variants.get(normalized) ?? [];
    variantRows.push({ ...row, matricule: normalized });
    variants.set(normalized, variantRows);
    confusable.set(skeleton, variants);
  }

  const exactDuplicates = [...exact.entries()]
    .filter(([, groupedRows]) => groupedRows.length > 1)
    .map(([normalizedNationalId, groupedRows]) => ({ normalizedNationalId, rows: groupedRows }));

  const confusableVariants: NationalIdConfusablePair[] = [];
  for (const variants of confusable.values()) {
    const entries = [...variants.entries()];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        confusableVariants.push({
          normalizedNationalIdA: entries[i][0],
          normalizedNationalIdB: entries[j][0],
          rowsA: entries[i][1],
          rowsB: entries[j][1],
        });
      }
    }
  }

  return { exactDuplicates, confusableVariants };
}
