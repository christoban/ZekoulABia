/**
 * APPLICATION — Parser unifié pour les deux formats d'import matricule.
 *
 * Format ZekoulABia : colonnes nom, prenom, dateNaissance, classe, matricule, etc.
 * Format cartescolaire.cm : colonnes Nom, Prénom, Date Naissance, Établissement, Matricule
 *
 * Détection auto via les en-têtes de colonnes.
 */
import type { ImportMatriculeRow } from './types';

type RawRow = Record<string, string>;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
}

interface HeaderMapping {
  nom: number;
  prenom: number;
  dateNaissance?: number;
  matricule: number;
  etablissement?: number;
}

function detectFormat(headers: string[]): 'zekoulabia' | 'cartescolaire' | null {
  const normalized = headers.map(normalizeHeader);
  // cartescolaire.cm : Nom, Prénom, Date Naissance, Établissement, Matricule
  const hasNom = normalized.some(h => h === 'nom');
  const hasPrenom = normalized.some(h => h === 'prenom' || h === 'prenom');
  const hasMatricule = normalized.some(h => h === 'matricule' || h === 'matriculenational');
  const hasEtablissement = normalized.some(h => h === 'etablissement' || h === 'ecole' || h === 'school');

  if (hasNom && hasPrenom && hasMatricule && hasEtablissement) return 'cartescolaire';
  if (hasNom && hasPrenom && hasMatricule) return 'zekoulabia';
  return null;
}

function buildMapping(headers: string[]): HeaderMapping | null {
  const normalized = headers.map(normalizeHeader);
  const mapping: HeaderMapping = { nom: -1, prenom: -1, matricule: -1 };

  for (let i = 0; i < normalized.length; i++) {
    const h = normalized[i];
    if (h === 'nom' || h === 'lastname' || h === 'nomfamille') mapping.nom = i;
    else if (h === 'prenom' || h === 'firstname' || h === 'prenom' || h === 'prénom') mapping.prenom = i;
    else if (h === 'matricule' || h === 'matriculenational' || h === 'nationalid') mapping.matricule = i;
    else if (h === 'datenaissance' || h === 'datedenaissance' || h === 'dob' || h === 'birthdate') mapping.dateNaissance = i;
    else if (h === 'etablissement' || h === 'ecole' || h === 'school' || h === 'establishment') mapping.etablissement = i;
  }

  if (mapping.nom === -1 || mapping.prenom === -1 || mapping.matricule === -1) return null;
  return mapping;
}

export function parseMatriculeExcel(rows: RawRow[]): { format: string; data: ImportMatriculeRow[]; errors: string[] } {
  if (rows.length === 0) return { format: 'unknown', data: [], errors: ['Fichier vide'] };

  const headers = Object.keys(rows[0]);
  const format = detectFormat(headers);
  if (!format) return { format: 'unknown', data: [], errors: ['Format de fichier non reconnu. Colonnes attendues : Nom, Prénom, Matricule'] };

  const mapping = buildMapping(headers);
  if (!mapping) return { format, data: [], errors: ['Impossible de détecter les colonnes Nom, Prénom, Matricule'] };

  const data: ImportMatriculeRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const values = Object.values(row);
    const ligne = i + 2; // +1 pour le header, +1 pour l'index 0-based

    const nom = String(values[mapping.nom] ?? '').trim();
    const prenom = String(values[mapping.prenom] ?? '').trim();
    const matricule = String(values[mapping.matricule] ?? '').trim();

    if (!nom || !prenom) {
      errors.push(`Ligne ${ligne} : nom ou prénom manquant`);
      continue;
    }
    if (!matricule) {
      errors.push(`Ligne ${ligne} : matricule manquant pour ${nom} ${prenom}`);
      continue;
    }

    data.push({
      ligne,
      nom,
      prenom,
      matricule,
      dateNaissance: mapping.dateNaissance !== undefined ? String(values[mapping.dateNaissance] ?? '').trim() || undefined : undefined,
      etablissement: mapping.etablissement !== undefined ? String(values[mapping.etablissement] ?? '').trim() || undefined : undefined,
    });
  }

  return { format, data, errors };
}
