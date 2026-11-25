import type { ChampNonResolu } from './types';
import type { ResolvedCell } from './resolveAutoFields';
import {
  ATELIER_COLS,
  ATELIER_FIRST_DATA_ROW,
  ATELIER_MAX_ROWS,
  ATELIER_SHEET,
  isAtelierMappingReady,
  type AtelierDetailEntry,
} from './minesecAteliersFieldMap';

/**
 * Transforme ateliersDetail → cellules + gaps.
 * Stratégie: 1 entrée supplement = 1 ligne Excel (équipement[0] si présent).
 */
export function resolveAtelierFields(
  ateliersDetail: AtelierDetailEntry[],
): { cells: ResolvedCell[]; nonCouverts: ChampNonResolu[] } {
  const cells: ResolvedCell[] = [];
  const nonCouverts: ChampNonResolu[] = [];

  if (!isAtelierMappingReady()) {
    if (ateliersDetail.length > 0) {
      nonCouverts.push({
        fieldCode: 'ATELIER_NON_MAPPE',
        sheetName: ATELIER_SHEET,
        cellReference: '',
        fieldLabel: 'Ateliers',
        raison: 'Mapping cellules non prêt.',
      });
    }
    return { cells, nonCouverts };
  }

  const slice = ateliersDetail.slice(0, ATELIER_MAX_ROWS);
  if (ateliersDetail.length > ATELIER_MAX_ROWS) {
    nonCouverts.push({
      fieldCode: 'ATELIER_LIGNES_INSUFFISANTES',
      sheetName: ATELIER_SHEET,
      cellReference: '',
      fieldLabel: 'Ateliers',
      raison: `${ateliersDetail.length} ateliers pour ${ATELIER_MAX_ROWS} lignes max formulaire.`,
    });
  }

  slice.forEach((entry, idx) => {
    const row = ATELIER_FIRST_DATA_ROW + idx;
    const eq = entry.equipements?.[0];

    if (ATELIER_COLS.numero) {
      cells.push({
        sheetName: ATELIER_SHEET,
        cellReference: `${ATELIER_COLS.numero}${row}`,
        value: idx + 1,
        dataType: 'NUMBER',
      });
    }

    const nom = entry.atelier?.trim() ?? '';
    if (nom && ATELIER_COLS.atelier) {
      cells.push({
        sheetName: ATELIER_SHEET,
        cellReference: `${ATELIER_COLS.atelier}${row}`,
        value: nom,
        dataType: 'TEXT',
      });
      if (ATELIER_COLS.workshop) {
        cells.push({
          sheetName: ATELIER_SHEET,
          cellReference: `${ATELIER_COLS.workshop}${row}`,
          value: nom,
          dataType: 'TEXT',
        });
      }
    } else {
      nonCouverts.push({
        fieldCode: 'ATELIER_NOM',
        sheetName: ATELIER_SHEET,
        cellReference: `${ATELIER_COLS.atelier}${row}`,
        fieldLabel: `Atelier ligne ${idx + 1}`,
        raison: 'Nom atelier manquant.',
      });
    }

    if (entry.etat != null && entry.etat !== '' && ATELIER_COLS.etatAtelier) {
      cells.push({
        sheetName: ATELIER_SHEET,
        cellReference: `${ATELIER_COLS.etatAtelier}${row}`,
        value: String(entry.etat),
        dataType: 'TEXT',
      });
      if (ATELIER_COLS.stateEn) {
        cells.push({
          sheetName: ATELIER_SHEET,
          cellReference: `${ATELIER_COLS.stateEn}${row}`,
          value: String(entry.etat),
          dataType: 'TEXT',
        });
      }
    }

    if (eq?.designation && ATELIER_COLS.designationEquipement) {
      cells.push({
        sheetName: ATELIER_SHEET,
        cellReference: `${ATELIER_COLS.designationEquipement}${row}`,
        value: String(eq.designation),
        dataType: 'TEXT',
      });
      if (ATELIER_COLS.designationEn) {
        cells.push({
          sheetName: ATELIER_SHEET,
          cellReference: `${ATELIER_COLS.designationEn}${row}`,
          value: String(eq.designation),
          dataType: 'TEXT',
        });
      }
    }
    if (eq?.quantite != null && ATELIER_COLS.quantite) {
      cells.push({
        sheetName: ATELIER_SHEET,
        cellReference: `${ATELIER_COLS.quantite}${row}`,
        value: Number(eq.quantite) || 0,
        dataType: 'NUMBER',
      });
      if (ATELIER_COLS.quantiteEn) {
        cells.push({
          sheetName: ATELIER_SHEET,
          cellReference: `${ATELIER_COLS.quantiteEn}${row}`,
          value: Number(eq.quantite) || 0,
          dataType: 'NUMBER',
        });
      }
    }
    if (eq?.etat != null && eq.etat !== '' && ATELIER_COLS.etatEquipement) {
      cells.push({
        sheetName: ATELIER_SHEET,
        cellReference: `${ATELIER_COLS.etatEquipement}${row}`,
        value: String(eq.etat),
        dataType: 'TEXT',
      });
      if (ATELIER_COLS.etatEquipementEn) {
        cells.push({
          sheetName: ATELIER_SHEET,
          cellReference: `${ATELIER_COLS.etatEquipementEn}${row}`,
          value: String(eq.etat),
          dataType: 'TEXT',
        });
      }
    }

    if (entry.nombrePostesTravail != null && ATELIER_COLS.nombrePostes) {
      cells.push({
        sheetName: ATELIER_SHEET,
        cellReference: `${ATELIER_COLS.nombrePostes}${row}`,
        value: Number(entry.nombrePostesTravail) || 0,
        dataType: 'NUMBER',
      });
      if (ATELIER_COLS.nombrePostesEn) {
        cells.push({
          sheetName: ATELIER_SHEET,
          cellReference: `${ATELIER_COLS.nombrePostesEn}${row}`,
          value: Number(entry.nombrePostesTravail) || 0,
          dataType: 'NUMBER',
        });
      }
    }
  });

  return { cells, nonCouverts };
}
