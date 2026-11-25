/**
 * Mapping des champs Themes_Transversaux (Themes_Tranversaux, questionnaire 7.1-7.3).
 * Categorie C integrale : admin remplit via formulaire complementaire (themesTransversauxDetail).
 *
 * Structure :
 *   7.1 : Reglement interieur HIV/SIDA (Oui/Non)
 *   7.1.1 : Aspects couverts (checkboxes)
 *   7.1.2 : Parties prenantes informees (checkboxes par stakeholder)
 *   7.2 : Education sexuelle (Oui/Non + formes)
 *   7.3 : Sessions parents (Oui/Non)
 */

export interface ThemesFieldEntry {
  fieldCode: string;
  questionRef: string;
  cellRef: string;
  dataType: 'BOOLEAN' | 'TEXT' | 'NUMBER';
  fieldLabel: string;
}

export const THEMES_FIELD_MAPPING: ThemesFieldEntry[] = [
  // 7.1 Reglement interieur HIV/SIDA
  { fieldCode: '7.1', questionRef: '7.1', cellRef: 'D9', dataType: 'BOOLEAN', fieldLabel: 'Reglement interieur HIV/SIDA' },
  // 7.1.1 Aspects couverts
  { fieldCode: '7.1.1.1a', questionRef: '7.1.1.1a', cellRef: 'D12', dataType: 'BOOLEAN', fieldLabel: 'Securite physique' },
  { fieldCode: '7.1.1.1b', questionRef: '7.1.1.1b', cellRef: 'D13', dataType: 'BOOLEAN', fieldLabel: 'Stigmatisation VIH' },
  { fieldCode: '7.1.1.1c', questionRef: '7.1.1.1c', cellRef: 'D14', dataType: 'BOOLEAN', fieldLabel: 'Stigmatisation race/ethnie/religion' },
  { fieldCode: '7.1.1.1d', questionRef: '7.1.1.1d', cellRef: 'D15', dataType: 'BOOLEAN', fieldLabel: 'Harcelement et abus sexuels' },
  // 7.1.1.2 Application des reglements
  { fieldCode: '7.1.1.2', questionRef: '7.1.1.2', cellRef: 'D17', dataType: 'BOOLEAN', fieldLabel: 'Procedures disciplinaires' },
  // 7.1.2 Parties prenantes
  { fieldCode: '7.1.2a', questionRef: '7.1.2a', cellRef: 'D21', dataType: 'TEXT', fieldLabel: 'Eleves — Reunion/Atelier' },
  { fieldCode: '7.1.2b', questionRef: '7.1.2b', cellRef: 'E21', dataType: 'TEXT', fieldLabel: 'Eleves — Par Ecrit' },
  { fieldCode: '7.1.2c', questionRef: '7.1.2c', cellRef: 'F21', dataType: 'TEXT', fieldLabel: 'Eleves — Autre' },
  { fieldCode: '7.1.2d', questionRef: '7.1.2d', cellRef: 'D22', dataType: 'TEXT', fieldLabel: 'Personnel Enseignant — Reunion' },
  { fieldCode: '7.1.2e', questionRef: '7.1.2e', cellRef: 'E22', dataType: 'TEXT', fieldLabel: 'Personnel Enseignant — Par Ecrit' },
  { fieldCode: '7.1.2f', questionRef: '7.1.2f', cellRef: 'F22', dataType: 'TEXT', fieldLabel: 'Personnel Enseignant — Autre' },
  { fieldCode: '7.1.2g', questionRef: '7.1.2g', cellRef: 'D23', dataType: 'TEXT', fieldLabel: 'Personnel Non Enseignant — Reunion' },
  { fieldCode: '7.1.2h', questionRef: '7.1.2h', cellRef: 'E23', dataType: 'TEXT', fieldLabel: 'Personnel Non Enseignant — Par Ecrit' },
  { fieldCode: '7.1.2i', questionRef: '7.1.2i', cellRef: 'F23', dataType: 'TEXT', fieldLabel: 'Personnel Non Enseignant — Autre' },
  { fieldCode: '7.1.2j', questionRef: '7.1.2j', cellRef: 'D24', dataType: 'TEXT', fieldLabel: 'Parents/Tuteurs — Reunion' },
  { fieldCode: '7.1.2k', questionRef: '7.1.2k', cellRef: 'E24', dataType: 'TEXT', fieldLabel: 'Parents/Tuteurs — Par Ecrit' },
  { fieldCode: '7.1.2l', questionRef: '7.1.2l', cellRef: 'F24', dataType: 'TEXT', fieldLabel: 'Parents/Tuteurs — Autre' },
  { fieldCode: '7.1.2m', questionRef: '7.1.2m', cellRef: 'D25', dataType: 'TEXT', fieldLabel: 'Conseil d etablissement — Reunion' },
  { fieldCode: '7.1.2n', questionRef: '7.1.2n', cellRef: 'E25', dataType: 'TEXT', fieldLabel: 'Conseil d etablissement — Par Ecrit' },
  { fieldCode: '7.1.2o', questionRef: '7.1.2o', cellRef: 'F25', dataType: 'TEXT', fieldLabel: 'Conseil d etablissement — Autre' },
  { fieldCode: '7.1.2p', questionRef: '7.1.2p', cellRef: 'D26', dataType: 'TEXT', fieldLabel: 'APEE/PTA — Reunion' },
  { fieldCode: '7.1.2q', questionRef: '7.1.2q', cellRef: 'E26', dataType: 'TEXT', fieldLabel: 'APEE/PTA — Par Ecrit' },
  { fieldCode: '7.1.2r', questionRef: '7.1.2r', cellRef: 'F26', dataType: 'TEXT', fieldLabel: 'APEE/PTA — Autre' },
  // 7.2 Education sexuelle
  { fieldCode: '7.2', questionRef: '7.2', cellRef: 'D28', dataType: 'BOOLEAN', fieldLabel: 'Education sexuelle et VIH' },
  { fieldCode: '7.2.1a', questionRef: '7.2.1a', cellRef: 'D30', dataType: 'BOOLEAN', fieldLabel: 'Competences generiques vie courante' },
  { fieldCode: '7.2.1b', questionRef: '7.2.1b', cellRef: 'D31', dataType: 'BOOLEAN', fieldLabel: 'Education sante reproductive' },
  { fieldCode: '7.2.1c', questionRef: '7.2.1c', cellRef: 'D32', dataType: 'BOOLEAN', fieldLabel: 'Transmission prevention VIH' },
  // 7.3 Sessions parents
  { fieldCode: '7.3', questionRef: '7.3', cellRef: 'D33', dataType: 'BOOLEAN', fieldLabel: 'Sessions orientation parents' },
];
