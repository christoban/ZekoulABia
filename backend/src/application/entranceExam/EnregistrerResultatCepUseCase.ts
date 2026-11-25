import type { EnregistrerResultatCepCommande } from './types';
import type { EntranceExamRepository } from '@domain/ports/repositories/EntranceExamRepository';
import { CreerSqueletteOnboardingUseCase } from '../eleveOnboarding/CreerSqueletteOnboardingUseCase';

export interface NotifierEvenementAcademique {
  (schoolId: string, targetRoles: string[], titre: string, corps: string): Promise<void>;
}

/**
 * Phase 5 de la spec onboarding auto-service élève (spec-onboarding-eleve-autoservice.md
 * section 6) : la branche REUSSI ne crée plus de compte directement (mot de passe
 * hardcodé 'ZEKOULABIA2024', sans email/téléphone, classe devinée par
 * Class.level.contains('6') et imposée) — elle délègue à CreerSqueletteOnboardingUseCase,
 * le même mécanisme de lien sécurisé/validation humaine que l'onboarding classique. La
 * classe suggérée devient EntranceExamSession.targetClassId si configuré, sinon retombe
 * sur l'ancienne heuristique par niveau — mais dans les deux cas ce n'est plus qu'une
 * SUGGESTION modifiable par le responsable au moment de valider, jamais une assignation
 * automatique. recipientType=PARENT forcé : un admis en 6e est quasi systématiquement
 * mineur (règle métier n°3 de la spec).
 */
export class EnregistrerResultatCepUseCase {
  constructor(
    private readonly entranceRepository: EntranceExamRepository,
    private readonly creerSqueletteOnboarding: CreerSqueletteOnboardingUseCase,
    private readonly notifier: NotifierEvenementAcademique,
  ) {}

  async execute(cmd: EnregistrerResultatCepCommande): Promise<{
    status: string; onboardingCreated: boolean; candidateName: string; parentPhone: string | null;
    onboarding?: { id: string; token: string; tokenExpiresAt: Date; contactEmail: string | null; contactTelephone: string | null };
  }> {
    const candidate = await this.entranceRepository.trouverCandidatAvecSession(cmd.candidateId);
    if (!candidate) throw new Error('Candidat introuvable');
    if (candidate.session?.schoolId !== cmd.schoolId) throw new Error('Accès refusé');
    if (candidate.admissionStatus !== 'ADMIS_PROVISOIRE') {
      throw new Error('Seuls les candidats ADMIS_PROVISOIRE peuvent recevoir un résultat CEP');
    }

    const now = new Date();
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const parentPhone: string | null = candidate.parentPhone ?? null;

    if (cmd.cepResult === 'REUSSI') {
      await this.entranceRepository.mettreAJourResultatCEP(cmd.candidateId, {
        cepResult: 'REUSSI',
        admissionStatus: 'CONFIRME',
      });

      // Suggestion de classe — targetClassId si configuré sur la session (déterministe),
      // sinon repli sur l'heuristique par niveau (comportement historique, mais désormais
      // seulement une suggestion éditable, jamais une assignation directe).
      let classId: string | undefined = candidate.session?.targetClassId ?? undefined;
      if (!classId) {
        const classe6e = await this.entranceRepository.trouverClasseNiveau(cmd.schoolId, '6');
        classId = classe6e?.id;
      }

      // L'admission est déjà confirmée ci-dessus — la création du squelette d'onboarding est
      // volontairement best-effort : si elle échoue malgré tout, l'admission ne doit pas rester
      // bloquée ni le candidat coincé en CONFIRME sans dossier (la garde ADMIS_PROVISOIRE plus
      // haut empêcherait alors tout nouvel essai). L'admin est notifié via onboardingCreated=false
      // et peut créer le squelette manuellement. Un candidat sans aucun téléphone parent renseigné
      // (famille sans dispositif du tout — Axe 2, Plan Diversité Numérique) n'est PAS un échec :
      // aucunContactDisponible=true crée quand même le dossier, sans lien envoyé — le staff le
      // complètera en présentiel (formulaire PDF exportable) quand la famille se présentera.
      let onboarding: { id: string; token: string; tokenExpiresAt: Date; contactEmail: string | null; contactTelephone: string | null } | undefined;
      try {
        onboarding = await this.creerSqueletteOnboarding.execute({
          schoolId: candidate.session!.schoolId,
          createdById: cmd.enregistreParId,
          nomProvisoire: candidateName,
          classId,
          contactTelephone: parentPhone,
          recipientType: 'PARENT',
          sourceType: 'CONCOURS',
          examCandidateId: candidate.id,
          aucunContactDisponible: !parentPhone,
        });
      } catch (err: unknown) {
        console.error('[EnregistrerResultatCepUseCase] Échec création squelette onboarding:', err instanceof Error ? err.message : String(err));
      }

      await this.cloturerSessionSiTousTraites(candidate.sessionId, candidate.session!.schoolId);
      return { status: 'CONFIRME', onboardingCreated: Boolean(onboarding), candidateName, parentPhone, onboarding };
    } else {
      await this.entranceRepository.mettreAJourResultatCEP(cmd.candidateId, {
        cepResult: 'ECHOUE',
        admissionStatus: 'ANNULE',
      });
      await this.cloturerSessionSiTousTraites(candidate.sessionId, candidate.session!.schoolId);
      return { status: 'ANNULE', onboardingCreated: false, candidateName, parentPhone };
    }
  }

  /**
   * Clôture automatique de la session dès que plus aucun candidat n'est en attente de
   * traitement (PENDING = admission pas encore calculée, ADMIS_PROVISOIRE = résultat CEP pas
   * encore saisi) — pas de date de clôture arbitraire pour ce type de fonctionnalité : le
   * processus se termine réellement quand le dernier résultat CEP est saisi, jamais avant. Sert
   * de source de vérité pour la visibilité du menu « Concours d'entrée » côté Admin.
   */
  private async cloturerSessionSiTousTraites(sessionId: string, schoolId: string): Promise<void> {
    const enAttente = await this.entranceRepository.compterCandidatsEnAttente(sessionId);
    if (enAttente === 0) {
      await this.entranceRepository.mettreAJourStatutSession(sessionId, 'CLOSED');
      void this.notifier(
        schoolId, ['ADMIN', 'STAFF'],
        'Concours d\'entrée clôturé',
        'Tous les candidats ont été traités — la session de concours est clôturée et le menu Concours d\'entrée n\'est plus mis en avant.',
      ).catch((err) => console.error('[EntranceExam] notification clôture:', err?.message));
    }
  }
}
