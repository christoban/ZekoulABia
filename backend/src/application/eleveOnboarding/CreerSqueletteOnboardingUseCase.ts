/**
 * APPLICATION — Use case : Créer le squelette d'un onboarding élève auto-service
 *
 * Génère un lien sécurisé à token unique que l'élève/parent utilisera pour compléter
 * son dossier. Ne crée AUCUN compte — uniquement le squelette + le token. La création
 * du compte n'a lieu qu'après validation humaine explicite (voir ValiderOnboardingUseCase).
 * L'envoi effectif de l'email/SMS est délégué au contrôleur (pas de dépendance infra ici,
 * cohérent avec EntranceExamController/PebsExamController qui notifient après coup).
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { randomBytes } from 'crypto';
import { determinerRecipientType } from './rules';
import { getTemplateMeta } from '../school/schoolTemplateConfig';
import { isNiveauPrimaireOuMaternelle } from '../../lib/classSerieValidator';
import type { CreerSqueletteOnboardingCommande, CreerSqueletteOnboardingResultat } from './types';

export class CreerSqueletteOnboardingUseCase {
  constructor(
    private readonly eleveOnboardingRepository: EleveOnboardingRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(cmd: CreerSqueletteOnboardingCommande): Promise<CreerSqueletteOnboardingResultat> {
    const sourceType = cmd.sourceType ?? 'AUTOSERVICE';

    const settings = await this.eleveOnboardingRepository.findSettings(cmd.schoolId);

    // L'auto-service classique peut être désactivé par établissement, mais JAMAIS les flux
    // CONCOURS ou GROUPE_TRANSFERT — dans les deux cas, c'est un Admin (pas une famille) qui
    // valide chaque dossier un par un ; le toggle self-service ne concerne que l'inscription
    // spontanée d'une famille inconnue, pas ce mécanisme administratif encadré.
    if (sourceType !== 'CONCOURS' && sourceType !== 'GROUPE_TRANSFERT' && !settings?.selfServiceEnabled) {
      throw new Error("L'auto-service des inscriptions n'est pas activé pour cet établissement");
    }

    const aucunContact = !cmd.contactEmail && !cmd.contactTelephone && !cmd.parentContactEmail && !cmd.parentContactTelephone;
    if (aucunContact && !cmd.aucunContactDisponible) {
      throw new Error('Un email ou un numéro de téléphone de contact est requis pour envoyer le lien (ou confirmer explicitement qu\'aucun contact n\'est disponible)');
    }

    // Deux comptes distincts (LES_DEUX) exigent des contacts distincts — sinon @@unique
    // ([schoolId, email/phone]) sur User ferait échouer la création du second compte, au
    // moment de la validation seulement. On le vérifie ici, tout de suite, avec un message clair.
    if (cmd.contactEmail && cmd.parentContactEmail && cmd.contactEmail === cmd.parentContactEmail) {
      throw new Error('Le contact élève et le contact parent doivent utiliser des emails différents');
    }
    if (cmd.contactTelephone && cmd.parentContactTelephone && cmd.contactTelephone === cmd.parentContactTelephone) {
      throw new Error('Le contact élève et le contact parent doivent utiliser des numéros de téléphone différents');
    }

    // Signal structurel prioritaire (maternelle/primaire) : le niveau RÉEL de la classe
    // (Class.level, ex. "CM2" vs "6e") tranche en priorité — nécessaire pour un établissement
    // COMPLEXE_SCOLAIRE où primaire et secondaire coexistent dans la même école, donc le
    // template seul ne suffit pas à distinguer. Repli sur le template de l'école si le niveau
    // de la classe n'est pas reconnu (ancien comportement, inchangé pour tout établissement
    // mono-cycle).
    let sectionCycle: 'primaire' | 'secondaire' | null = null;
    if (cmd.classId) {
      const classe = await this.eleveOnboardingRepository.findClassOnboardingInfo(cmd.classId);
      if (classe) {
        sectionCycle = isNiveauPrimaireOuMaternelle(classe.level)
          ? 'primaire'
          : getTemplateMeta(classe.templateCode ?? undefined).isPrimaire ? 'primaire' : 'secondaire';
      }
    }

    const recipientType = determinerRecipientType({
      sourceType,
      recipientTypeExplicite: cmd.recipientType,
      defaultRecipient: settings?.defaultRecipient,
      sectionCycle,
      eleveADispositif: cmd.eleveADispositif,
      parentADispositif: cmd.parentADispositif,
      ageThresholdForParent: settings?.ageThresholdForParent,
    });

    const token = randomBytes(32).toString('hex');
    const tokenExpiryDays = settings?.tokenExpiryDays ?? 14;
    const tokenExpiresAt = new Date(Date.now() + tokenExpiryDays * 24 * 60 * 60 * 1000);

    const onboarding = await this.eleveOnboardingRepository.createSquelette({
      schoolId: cmd.schoolId,
      nomProvisoire: cmd.nomProvisoire,
      classId: cmd.classId ?? null,
      contactEmail: cmd.contactEmail ?? null,
      contactTelephone: cmd.contactTelephone ?? null,
      parentContactEmail: cmd.parentContactEmail ?? null,
      parentContactTelephone: cmd.parentContactTelephone ?? null,
      recipientType,
      sourceType,
      examCandidateId: cmd.examCandidateId ?? null,
      eleveADispositif: cmd.eleveADispositif ?? null,
      eleveDispositifOS: cmd.eleveDispositifOS ?? null,
      parentADispositif: cmd.parentADispositif ?? null,
      parentDispositifOS: cmd.parentDispositifOS ?? null,
      token,
      tokenExpiresAt,
    });

    await this.activityLog.log({
      userId: cmd.createdById,
      schoolId: cmd.schoolId,
      action: 'ONBOARDING_LINK_CREATED',
      details: `Dossier créé pour "${cmd.nomProvisoire}" (source ${sourceType}, destinataire ${recipientType})`,
    });

    return {
      id: onboarding.id,
      token,
      tokenExpiresAt,
      status: onboarding.status,
      recipientType,
      contactEmail: onboarding.contactEmail,
      contactTelephone: onboarding.contactTelephone,
    };
  }
}
