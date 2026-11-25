import * as XLSX from 'xlsx';

export interface CandidatAEnregistrer {
  tempId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  originSchool?: string;
  parentPhone?: string;
  gender?: string;
  fraisPayes?: boolean;
  piecesFournies?: boolean;
  isDuplicate?: boolean;
  errorMessage?: string;
}

export interface ExistingCandidate {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
}

export type SourceType = 'SAISIE' | 'EXCEL' | 'DOCUMENT' | 'PHOTO';

export interface ScannedCandidateRaw {
  nom?: string;
  lastName?: string;
  prenom?: string;
  firstName?: string;
  dateNaissance?: string;
  dateOfBirth?: string;
  telephone?: string;
  phone?: string;
  email?: string;
  gender?: string;
  ecoleOrigine?: string;
  originSchool?: string;
  telephoneParent?: string;
  parentPhone?: string;
}

export function verifierDoublons(
  list: CandidatAEnregistrer[],
  existingCandidates: ExistingCandidate[]
): CandidatAEnregistrer[] {
  return list.map((cand, idx) => {
    const nomNorm = cand.lastName.trim().toLowerCase();
    const prenomNorm = cand.firstName.trim().toLowerCase();

    const existeEnBase = existingCandidates.some(
      (ec) =>
        ec.lastName.trim().toLowerCase() === nomNorm &&
        ec.firstName.trim().toLowerCase() === prenomNorm &&
        (!cand.dateOfBirth || !ec.dateOfBirth || ec.dateOfBirth.slice(0, 10) === cand.dateOfBirth.slice(0, 10))
    );

    const doublonInterne = list.some(
      (other, otherIdx) =>
        otherIdx !== idx &&
        other.lastName.trim().toLowerCase() === nomNorm &&
        other.firstName.trim().toLowerCase() === prenomNorm
    );

    const isDup = existeEnBase || doublonInterne;
    return {
      ...cand,
      isDuplicate: isDup,
      errorMessage: !cand.lastName.trim() || !cand.firstName.trim()
        ? 'Nom et prénom obligatoires'
        : isDup
        ? existeEnBase
          ? 'Candidat déjà inscrit à ce concours'
          : 'Doublon détecté dans ce lot'
        : undefined,
    };
  });
}

export function parseExcelCandidates(bstr: string | ArrayBuffer | null | undefined): CandidatAEnregistrer[] {
  const wb = XLSX.read(bstr, { type: 'binary' });
  const wsname = wb.SheetNames[0];
  const ws = wb.Sheets[wsname];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

  return rows
    .map((r, i) => {
      const keys = Object.keys(r);
      const getVal = (patterns: string[]): string => {
        const foundKey = keys.find((k) => patterns.some((p) => k.toLowerCase().includes(p)));
        return foundKey ? String(r[foundKey] ?? '').trim() : '';
      };

      const nom = getVal(['nom', 'last', 'surname']);
      const prenom = getVal(['prenom', 'first', 'given']);
      const dateNaiss = getVal(['date', 'naissance', 'birth', 'dob']);
      const ecole = getVal(['ecole', 'school', 'etablissement', 'origine']);
      const phone = getVal(['tel', 'phone', 'contact', 'parent']);

      return {
        tempId: `xls_${Date.now()}_${i}`,
        lastName: nom.toUpperCase(),
        firstName: prenom,
        dateOfBirth: dateNaiss || undefined,
        originSchool: ecole || undefined,
        parentPhone: phone || undefined,
        fraisPayes: false,
        piecesFournies: false,
      };
    })
    .filter((c) => c.lastName || c.firstName);
}

export function parseTextCandidates(text: string): CandidatAEnregistrer[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((line, idx) => {
    const parts = line.split(/\s+/);
    const phone = parts.find((p) => /^[0-9+]{8,15}$/.test(p));
    const nameParts = parts.filter((p) => p !== phone);
    return {
      tempId: `txt_${Date.now()}_${idx}`,
      lastName: (nameParts[0] || '').toUpperCase(),
      firstName: nameParts.slice(1).join(' ') || 'Prénom',
      parentPhone: phone,
      fraisPayes: false,
      piecesFournies: false,
    };
  });
}

export function mapScannedCandidates(rawList: ScannedCandidateRaw[]): CandidatAEnregistrer[] {
  return rawList.map((c, i: number) => ({
    tempId: `scan_${Date.now()}_${i}`,
    lastName: String(c.nom || c.lastName || '').toUpperCase(),
    firstName: String(c.prenom || c.firstName || ''),
    dateOfBirth: c.dateNaissance || c.dateOfBirth,
    originSchool: c.ecoleOrigine || c.originSchool,
    parentPhone: c.telephoneParent || c.parentPhone,
    fraisPayes: false,
    piecesFournies: false,
  }));
}
