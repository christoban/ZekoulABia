/**
 * Moteur de lecture/écriture du fichier officiel MINESEC, en conversion ponctuelle LibreOffice
 * (jamais un service permanent — un sous-processus headless lancé et refermé à chaque
 * génération) + exceljs pour l'écriture des valeurs. Remplace l'ancien moteur 100% SheetJS :
 * l'écriture BIFF8 de la lib `xlsx` ne préservait AUCUNE formule Excel au round-trip, même
 * sur les cellules jamais touchées par le code (vérifié empiriquement — toute cellule formule
 * du template redevenait une valeur statique figée à son dernier cache, 0 sur un formulaire
 * vierge). LibreOffice, en tant que vrai moteur Excel-compatible, préserve les formules à la
 * conversion de format ; exceljs préserve formules et mise en forme au round-trip .xlsx tant
 * qu'on ne réassigne pas explicitement `cell.value`.
 *
 * Pipeline : .xls chiffré → déchiffrement (officecrypto, inchangé) → conversion LibreOffice
 * vers .xlsx → écriture des valeurs (exceljs) → reconversion LibreOffice vers .xls si le
 * format strict est requis (configurable, voir DELIVER_XLS) → nettoyage systématique des
 * fichiers temporaires (réussite ou échec).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import officecrypto from 'officecrypto-tool';
import { messageErreur } from '@application/shared/messageErreur';
import ExcelJS from 'exceljs';

const execFileAsync = promisify(execFile);

const VELVET_SWEATSHOP_PASSWORD = 'VelvetSweatshop';

/** Aucune confirmation officielle du format exigé par le MINESEC (.xls strict vs .xlsx) —
 * on livre .xls par sécurité par défaut, mais c'est un paramètre, pas un choix figé en dur. */
export const DELIVER_XLS_BY_DEFAULT = (process.env.MINESEC_DELIVER_XLS ?? 'true').toLowerCase() !== 'false';

const CONVERT_TIMEOUT_MS = Number(process.env.LIBREOFFICE_CONVERT_TIMEOUT_MS ?? 30_000);

export class LibreOfficeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LibreOfficeUnavailableError';
  }
}

export class LibreOfficeConversionError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = 'LibreOfficeConversionError';
  }
}

function resolveSofficeBinary(): string {
  if (process.env.LIBREOFFICE_BIN) return process.env.LIBREOFFICE_BIN;
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }
  // Linux/Docker (Railway) : installé via apt-get, disponible sur le PATH sous le nom `soffice`.
  return 'soffice';
}

/**
 * Health check — à appeler au démarrage du serveur, pas seulement découvert en échec au
 * moment où un admin génère une déclaration (voir DoD #1/#6). Utilise un profil utilisateur
 * isolé et jetable, comme `runLibreOfficeConvert` : sans ça, deux invocations `--headless`
 * rapprochées partageant le profil par défaut se bloquent l'une l'autre (verrou de profil /
 * boîte de dialogue de récupération après un premier lancement) — reproduit empiriquement,
 * la 2e invocation consécutive restait bloquée jusqu'au timeout sans ce paramètre.
 */
export async function checkLibreOfficeAvailable(): Promise<{ available: boolean; version?: string; error?: string }> {
  const bin = resolveSofficeBinary();
  const profileDir = path.join(os.tmpdir(), `minesec-health-${crypto.randomUUID()}`);
  const profileUri = `file:///${profileDir.replace(/\\/g, '/')}`;
  try {
    const { stdout } = await execFileAsync(
      bin,
      ['--headless', '--norestore', `-env:UserInstallation=${profileUri}`, '--version'],
      { timeout: 15_000 },
    );
    return { available: true, version: stdout.trim() };
  } catch (err) {
    return { available: false, error: messageErreur(err) };
  } finally {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

/** Lance une conversion LibreOffice headless ponctuelle, avec timeout et profil utilisateur
 * isolé (évite les blocages de verrou quand plusieurs conversions tournent en parallèle). */
async function runLibreOfficeConvert(args: {
  inputPath: string;
  outDir: string;
  targetFilter: string; // ex. "xlsx" ou 'xls:"MS Excel 97"'
  profileDir: string;
}): Promise<void> {
  const bin = resolveSofficeBinary();
  const profileUri = `file:///${args.profileDir.replace(/\\/g, '/')}`;
  try {
    await execFileAsync(
      bin,
      [
        '--headless',
        '--norestore',
        `-env:UserInstallation=${profileUri}`,
        '--convert-to',
        args.targetFilter,
        '--outdir',
        args.outDir,
        args.inputPath,
      ],
      { timeout: CONVERT_TIMEOUT_MS },
    );
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { killed?: boolean; signal?: string };
    if (e.code === 'ENOENT') {
      throw new LibreOfficeUnavailableError(
        "Le service de génération est temporairement indisponible (LibreOffice introuvable). Réessayez ou contactez le support.",
      );
    }
    if (e.killed || e.signal === 'SIGTERM') {
      throw new LibreOfficeConversionError(
        `La conversion LibreOffice a dépassé le délai de ${CONVERT_TIMEOUT_MS}ms (fichier : ${path.basename(args.inputPath)}).`,
        err,
      );
    }
    throw new LibreOfficeConversionError(`Échec de la conversion LibreOffice (${args.targetFilter}) : ${err?.message ?? err}`, err);
  }
}

export interface WorkbookSession {
  workbook: ExcelJS.Workbook;
  /** Chemin du .xlsx de travail — c'est ici que les mutations exceljs sont sauvegardées. */
  workingXlsxPath: string;
  /** Dossier temporaire complet (déchiffré, xlsx, profils LO) — supprimé en bloc au nettoyage. */
  tempDir: string;
}

/**
 * Étape 1+2 : déchiffre le template officiel (VelvetSweatshop, inchangé) puis le convertit en
 * .xlsx via LibreOffice pour que exceljs puisse le lire en préservant formules et mise en forme.
 *
 * Pas de pré-vérification `checkLibreOfficeAvailable()` ici — ce serait un 3e lancement
 * LibreOffice (~7-10s) redondant avec le health check déjà fait une fois au démarrage du
 * serveur (voir server.ts). `runLibreOfficeConvert` détecte lui-même un binaire absent
 * (ENOENT) et lève `LibreOfficeUnavailableError` avec le même message clair.
 */
export async function decryptTemplate(filePath: string): Promise<WorkbookSession> {
  const tempDir = path.join(os.tmpdir(), `minesec-gen-${crypto.randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    const buf = fs.readFileSync(filePath);
    const decrypted = await officecrypto.decrypt(buf, { password: VELVET_SWEATSHOP_PASSWORD });
    // Nommé différemment du .xlsx de travail rempli (voir writeWorkbookToFile) : LibreOffice
    // dérive le nom de sortie du nom d'entrée, une collision de basename entre l'entrée
    // déchiffrée et la sortie remplie fait échouer la reconversion finale côté LibreOffice
    // (erreur 0x81a "Please verify input parameters" — reproduit empiriquement).
    const decryptedXlsPath = path.join(tempDir, 'template-input.xls');
    fs.writeFileSync(decryptedXlsPath, decrypted);

    const profileDir = path.join(tempDir, 'lo_profile_in');
    await runLibreOfficeConvert({ inputPath: decryptedXlsPath, outDir: tempDir, targetFilter: 'xlsx', profileDir });

    const workingXlsxPath = path.join(tempDir, 'template-input.xlsx');
    if (!fs.existsSync(workingXlsxPath)) {
      throw new LibreOfficeConversionError('La conversion xls → xlsx a réussi mais le fichier attendu est introuvable.');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(workingXlsxPath);

    return { workbook, workingXlsxPath, tempDir };
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
}

export type CellDataType = 'NUMBER' | 'TEXT' | 'BOOLEAN';

function cellHasFormula(cell: ExcelJS.Cell): boolean {
  return cell.type === ExcelJS.ValueType.Formula || cell.formula !== undefined;
}

/**
 * Écrit une valeur dans une cellule, en refusant par défaut d'écraser une formule Excel
 * (protection contre un mapping qui viserait accidentellement une cellule calculée plutôt
 * qu'une cellule d'entrée réelle) — même contrat que l'ancien moteur SheetJS. Retourne false
 * (et n'écrit rien) si la cellule cible contient déjà une formule et que
 * `allowFormulaOverwrite` n'est pas explicitement activé.
 */
export function setCellValue(
  ws: ExcelJS.Worksheet,
  cellRef: string,
  value: string | number | boolean | null,
  dataType: CellDataType = 'NUMBER',
  allowFormulaOverwrite = false,
): boolean {
  const cell = ws.getCell(cellRef);
  if (cellHasFormula(cell) && !allowFormulaOverwrite) return false;
  if (value === null || value === undefined) return true;

  if (dataType === 'NUMBER') {
    cell.value = Number(value);
  } else if (dataType === 'BOOLEAN') {
    cell.value = value ? 'Oui' : 'Non';
  } else {
    cell.value = String(value);
  }
  return true;
}

/**
 * Étape 3 (optionnelle, selon DELIVER_XLS) + nettoyage. Sauvegarde les mutations exceljs dans
 * le .xlsx de travail, reconvertit en .xls strict si demandé, déplace le résultat vers
 * `outputPath`, puis supprime systématiquement le dossier temporaire (déchiffré + xlsx
 * intermédiaire) — qu'il y ait eu succès ou échec, aucune donnée d'élève ne doit traîner sur
 * le disque au-delà de la génération.
 */
export async function writeWorkbookToFile(
  session: WorkbookSession,
  outputPath: string,
  options: { deliverXls?: boolean } = {},
): Promise<void> {
  const deliverXls = options.deliverXls ?? DELIVER_XLS_BY_DEFAULT;
  try {
    // Écrit les mutations exceljs sous un NOUVEAU nom ("filled.xlsx"), distinct du .xlsx
    // chargé initialement — évite que la reconversion finale ne dérive un nom de sortie qui
    // collisionne avec le .xls d'entrée déchiffré (voir commentaire dans decryptTemplate).
    const filledXlsxPath = path.join(session.tempDir, 'filled.xlsx');
    await session.workbook.xlsx.writeFile(filledXlsxPath);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    if (!deliverXls) {
      const finalXlsxPath = outputPath.endsWith('.xlsx') ? outputPath : outputPath.replace(/\.xls$/, '.xlsx');
      fs.copyFileSync(filledXlsxPath, finalXlsxPath);
      return;
    }

    const profileDir = path.join(session.tempDir, 'lo_profile_out');
    await runLibreOfficeConvert({
      inputPath: filledXlsxPath,
      outDir: session.tempDir,
      // Pas de guillemets autour de "MS Excel 97" : execFile passe les arguments directement
      // au process, sans shell — les guillemets de la doc LibreOffice ne servent qu'à protéger
      // l'espace dans un contexte shell ; passés tels quels ici, ils deviennent des caractères
      // littéraux dans le nom du filtre et LibreOffice échoue silencieusement (0x81a) — reproduit
      // et corrigé empiriquement.
      targetFilter: 'xls:MS Excel 97',
      profileDir,
    });

    const convertedXlsPath = path.join(session.tempDir, 'filled.xls');
    if (!fs.existsSync(convertedXlsPath)) {
      throw new LibreOfficeConversionError('La reconversion xlsx → xls a réussi mais le fichier attendu est introuvable.');
    }
    const finalXlsPath = outputPath.endsWith('.xls') ? outputPath : outputPath.replace(/\.xlsx$/, '.xls');
    fs.copyFileSync(convertedXlsPath, finalXlsPath);
  } finally {
    fs.rmSync(session.tempDir, { recursive: true, force: true });
  }
}

/** À appeler explicitement si `decryptTemplate` a réussi mais qu'une étape ultérieure du use
 * case échoue avant d'atteindre `writeWorkbookToFile` (ex. erreur métier imprévue) — garantit
 * qu'aucun fichier temporaire ne survit à un chemin d'erreur non prévu. */
export function cleanupSession(session: WorkbookSession): void {
  fs.rmSync(session.tempDir, { recursive: true, force: true });
}
