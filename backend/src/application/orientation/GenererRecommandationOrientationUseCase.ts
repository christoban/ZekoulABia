/**
 * APPLICATION — Le moteur de règles d'orientation (A.4 du plan). Calcule une proposition de
 * piste par élève à partir de trois signaux : tendance de notes réelles, résultat du test
 * psychotechnique (si l'établissement en fait un), et aspiration déclarée. Jamais un verdict
 * fermé — toujours 2-3 pistes scorées, jamais un seul choix imposé.
 *
 * Écrit sa sortie dans le module Orientation existant (RecommandationSerie, statut CALCULEE) —
 * ne crée jamais de modèle parallèle. Ouvre automatiquement une FicheOrientation si aucune
 * n'existe encore pour cet élève cette année (contrairement au déclenchement "à risque" qui
 * n'ouvre JAMAIS de fiche automatiquement — ici c'est un processus systématique, pas exceptionnel).
 */
import type { IOrientationRepository, RecommandationDetail, TestDetail, AspirationDetail } from '@domain/ports/repositories/IOrientationRepository';
import type { GradeOrientationRepository } from '@domain/ports/repositories/GradeOrientationRepository';
import type { OrientationCheckpointType, ConfidenceLevel } from '@domain/entities/FicheOrientation';
import { defaultConfigFor, type CheckpointScoringConfig, type TrackWeights } from './checkpointScoringConfig';

export interface GenererRecommandationCommande {
  schoolId: string;
  studentId: string;
  checkpointType: OrientationCheckpointType;
  academicYearId: string;
  conseillerId: string;
}

const SEUIL_PISTE_RETENUE = 55;

export class GenererRecommandationOrientationUseCase {
  constructor(
    private readonly orientationRepo: IOrientationRepository,
    private readonly gradeRepo: GradeOrientationRepository,
  ) {}

  async execute(cmd: GenererRecommandationCommande): Promise<RecommandationDetail> {
    const config = await this.orientationRepo.findCheckpointConfig(cmd.schoolId, cmd.checkpointType);
    if (!config) {
      throw new Error(`Aucune configuration d'orientation pour le checkpoint ${cmd.checkpointType} dans cette école`);
    }

    const scoringConfig = this.parseScoringConfig(config.relevantSubjects) ?? defaultConfigFor(cmd.checkpointType);

    const [tendances, dataDepthMonths, fiche, aspiration, serieActuelle] = await Promise.all([
      this.calculerTendances(cmd.schoolId, cmd.studentId, scoringConfig),
      this.calculerProfondeurDonnees(cmd.schoolId, cmd.studentId),
      this.trouverOuCreerFiche(cmd.studentId, cmd.schoolId, cmd.academicYearId, cmd.conseillerId),
      this.orientationRepo.findAspiration(cmd.studentId, cmd.checkpointType),
      this.determinerSerieActuelle(cmd.studentId),
    ]);

    const test = await this.orientationRepo.findTestByFicheAndCheckpoint(fiche.id, cmd.checkpointType);
    const testPresent = !!test;
    const useTest = config.psychotechnicalTestRequired && testPresent;

    const scores = Object.entries(scoringConfig)
      .map(([track, weights]) => ({
        track,
        score: Math.round(this.calculerScorePiste(track, weights, tendances, test, aspiration, useTest)),
      }))
      .sort((a, b) => b.score - a.score);

    const retenues = scores.filter((s) => s.score >= SEUIL_PISTE_RETENUE);
    // Filet de sécurité : jamais de liste vide — un dossier doit toujours exister, même avec
    // une seule piste sous le seuil (principe déjà appliqué ailleurs dans le projet).
    const finalScores = retenues.length > 0 ? retenues : [scores[0]!];
    const suggestedTracks = finalScores.map((s) => ({
      track: s.track,
      score: s.score,
      justification: this.genererJustification(s.track, scoringConfig[s.track]!, tendances, aspiration, useTest),
    }));

    const confidenceLevel = this.calculerConfiance(dataDepthMonths, config.psychotechnicalTestRequired, testPresent);

    return this.orientationRepo.createOrUpdateRecommandationCheckpoint(fiche.id, cmd.studentId, {
      checkpointType: cmd.checkpointType,
      serieActuelle,
      suggestedTracks,
      confidenceLevel,
      dataDepthMonths,
      justification: suggestedTracks.map((t) => t.justification).join(' '),
    });
  }

  private parseScoringConfig(raw: unknown): CheckpointScoringConfig | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length === 0) return null;
    // Validation minimale — retombe sur les défauts si la forme est manifestement invalide.
    const valid = entries.every(([, v]) => v && typeof v === 'object' && Array.isArray((v as { subjects?: unknown }).subjects));
    return valid ? (raw as CheckpointScoringConfig) : null;
  }

  private async trouverOuCreerFiche(studentId: string, schoolId: string, academicYearId: string, conseillerId: string) {
    const existante = await this.orientationRepo.findFicheByStudentAndYear(studentId, academicYearId);
    if (existante) return existante;
    return this.orientationRepo.createFiche({ studentId, schoolId, academicYearId, conseillerId });
  }

  private async determinerSerieActuelle(studentId: string): Promise<string> {
    const classe = await this.orientationRepo.findSerieActuelle(studentId);
    return classe?.serie || classe?.level || classe?.name || 'Non renseignée';
  }

  /**
   * Tendance par matière (A.4.1) : moyenne pondérée des séquences validées, poids croissant
   * avec la récence (la séquence la plus récente pèse le plus). Normalisée sur 0-100.
   */
  private async calculerTendances(schoolId: string, studentId: string, config: CheckpointScoringConfig): Promise<Record<string, number>> {
    const subjectNames = new Set<string>();
    for (const w of Object.values(config)) for (const s of w.subjects) subjectNames.add(s);
    if (subjectNames.size === 0) return {};

    const grades = await this.gradeRepo.findGradesPourTendances(schoolId, studentId, [...subjectNames]);

    const bySubject = new Map<string, { value: number; ts: number }[]>();
    for (const g of grades) {
      const normalized = (g.sequenceAverage / (g.maxValue || 20)) * 100;
      const ts = g.yearStartTs + g.orderIndex;
      const arr = bySubject.get(g.subjectName) ?? [];
      arr.push({ value: normalized, ts });
      bySubject.set(g.subjectName, arr);
    }

    const tendances: Record<string, number> = {};
    for (const [name, entries] of bySubject) {
      entries.sort((a, b) => a.ts - b.ts);
      const n = entries.length;
      const totalWeight = (n * (n + 1)) / 2;
      const sum = entries.reduce((acc, e, i) => acc + e.value * (i + 1), 0);
      tendances[name] = totalWeight > 0 ? sum / totalWeight : 0;
    }
    return tendances;
  }

  /** Profondeur de données disponibles, en mois — pilote le niveau de confiance (A.4.4). */
  private async calculerProfondeurDonnees(schoolId: string, studentId: string): Promise<number> {
    const startDate = await this.gradeRepo.findEarliestGradeYearStart(schoolId, studentId);
    if (!startDate) return 0;
    const months = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.max(0, Math.round(months));
  }

  private signalAspiration(track: string, aspiration: AspirationDetail | null): number {
    if (!aspiration?.desiredTrack) return 50; // neutre — ne pénalise jamais un élève indécis
    return aspiration.desiredTrack === track ? 100 : 20;
  }

  private signalInteretInformatique(aspiration: AspirationDetail | null): number {
    const texte = `${aspiration?.careerInterest ?? ''} ${aspiration?.desiredTrack ?? ''}`.toLowerCase();
    return /informati|numérique|digital|programmat|développeur|tic\b/.test(texte) ? 100 : 30;
  }

  private calculerScorePiste(
    track: string, weights: TrackWeights, tendances: Record<string, number>,
    test: TestDetail | null, aspiration: AspirationDetail | null, useTest: boolean,
  ): number {
    const subjectAvg = weights.subjects.length > 0
      ? weights.subjects.reduce((s, name) => s + (tendances[name] ?? 50), 0) / weights.subjects.length
      : 50; // 50 = neutre si aucune note disponible pour cette matière (jamais 0, injuste)

    const isTI = track === 'TI';

    if (!useTest) {
      let score = weights.subjectWeightNoTest * subjectAvg;
      score += isTI && weights.interestSignalWeight
        ? weights.interestSignalWeight * this.signalInteretInformatique(aspiration)
        : weights.aspirationWeight * this.signalAspiration(track, aspiration);
      return Math.max(0, Math.min(100, score));
    }

    const aptitudeScore = weights.aptitudeField
      ? (test![weights.aptitudeField] ?? 50)
      : ((test!.scientificAptitude ?? 50) + (test!.literaryAptitude ?? 50)) / 2;

    let score = weights.subjectWeightWithTest * subjectAvg + weights.aptitudeWeightWithTest * aptitudeScore;
    score += isTI && weights.interestSignalWeight
      ? weights.interestSignalWeight * this.signalInteretInformatique(aspiration)
      : weights.aspirationWeight * this.signalAspiration(track, aspiration);
    return Math.max(0, Math.min(100, score));
  }

  private genererJustification(
    track: string, weights: TrackWeights, tendances: Record<string, number>,
    aspiration: AspirationDetail | null, useTest: boolean,
  ): string {
    const moyennes = weights.subjects.map((s) => tendances[s]).filter((v): v is number => v != null);
    const moyenne = moyennes.length > 0 ? moyennes.reduce((a, b) => a + b, 0) / moyennes.length : null;
    const tendanceTexte = moyenne == null ? 'données insuffisantes' : moyenne >= 65 ? 'en hausse' : moyenne >= 50 ? 'stable' : 'en baisse';
    const testTexte = useTest ? 'avec confirmation du test psychotechnique' : 'sur la base des matières déterminantes de cet établissement';
    const aligne = aspiration?.desiredTrack === track ? 'alignée sur' : aspiration?.desiredTrack ? 'différente de' : 'sans';
    return `Piste ${track} : tendance ${tendanceTexte} en ${weights.subjects.join(', ')}, ${testTexte}, ${aligne} l'aspiration déclarée.`;
  }

  private calculerConfiance(dataDepthMonths: number, testRequired: boolean, testPresent: boolean): ConfidenceLevel {
    let niveau: ConfidenceLevel = dataDepthMonths >= 36 ? 'ELEVEE' : dataDepthMonths >= 12 ? 'MOYENNE' : 'FAIBLE';
    if (testRequired && !testPresent) {
      // Accident isolé (établissement qui fait normalement le test, mais absent pour cet élève) —
      // dégrade d'un cran, jamais si l'établissement ne fait simplement pas de test du tout.
      if (niveau === 'ELEVEE') niveau = 'MOYENNE';
      else if (niveau === 'MOYENNE') niveau = 'FAIBLE';
    }
    return niveau;
  }
}
