/**
 * APPLICATION — Use case : Valider un onboarding élève (dernière étape avant création de compte)
 *
 * Seule action qui crée réellement le(s) compte(s) — jamais avant, jamais automatiquement
 * (règle métier n°1). La classe reste modifiable ici (classId en override), pas imposée
 * par le squelette initial : c'est la correction directe de la faille "classe assignée
 * automatiquement" du flux concours (voir spec section 6). Les mots de passe sont
 * aléatoires et jamais révélés — chaque compte est activé via un lien "configurez votre
 * mot de passe" qui réutilise le mécanisme resetPasswordToken déjà en place
 * (UserController.forgotPassword), pas un mot de passe par défaut en clair comme dans
 * l'ancien flux concours.
 *
 * Crée le compte élève (User role STUDENT + StudentProfile) systématiquement — un
 * StudentProfile exige toujours un User. En plus, selon recipientType :
 *   - ELEVE     : seul le compte élève reçoit les coordonnées de contact + un lien de
 *                 configuration de mot de passe.
 *   - PARENT    : le compte élève n'a pas de coordonnées propres (email/phone null) ;
 *                 un compte PARENT (User + ParentProfile + ParentStudent) est créé et
 *                 reçoit les coordonnées + le lien de configuration.
 *   - LES_DEUX  : si le dossier porte deux coordonnées distinctes (parentContactEmail/
 *                 parentContactTelephone renseignées — Axe 2, Plan_Diversite_Numerique),
 *                 le compte élève reçoit contactEmail/contactTelephone et le compte parent
 *                 reçoit les coordonnées parent séparées, chacun avec son propre lien.
 *                 Sinon (dossier créé avant cet ajout, ou seul un contact partagé a été
 *                 saisi), retombe sur l'ancien comportement : seul le compte PARENT reçoit
 *                 le contact partagé (contrainte @@unique([schoolId, email/phone]) sur User
 *                 oblige — deux comptes de rôles différents ne peuvent pas partager un contact).
 * Le lien parent↔élève (ParentStudent) est indispensable au-delà du simple accès :
 * tout le système de notifications (SMS absences, paiements, bulletins...) résout le
 * téléphone à contacter via ParentStudent → ParentProfile → User.phone, JAMAIS via le
 * téléphone propre de l'élève (voir SmsNotificationService.getParentPhones) — sans ce
 * lien, un élève onboardé via CONCOURS (recipientType=PARENT forcé) ne recevrait plus
 * aucune notification, silencieusement. C'est la même classe de faille que celle que ce
 * chantier corrige déjà (compte injoignable), donc traitée ici plutôt que laissée de côté.
 *
 * Si un compte PARENT existe déjà pour ce contact dans l'école (cas fréquent : un autre
 * enfant déjà scolarisé), il est réutilisé — pas de doublon, pas de nouveau mot de passe
 * à configurer (contrainte @@unique([schoolId, email/phone]) sur User de toute façon).
 *
 * accessMode=SMS_ONLY reste porté par le compte pour les règles d'accès existantes ; les
 * identifiants temporaires sont envoyés par SMS lorsque l'email n'est pas prioritaire.
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { parseDateFR } from '../../shared/date/parseDateFR';
import { peutTransitionnerDepuisPendingValidation } from './rules';
import type { ValiderOnboardingCommande, ValiderOnboardingResultat } from './types';

export class ValiderOnboardingUseCase {
  constructor(
    private readonly eleveOnboardingRepository: EleveOnboardingRepository,
    private readonly activityLog: ActivityLogPort,
  ) {}

  async execute(cmd: ValiderOnboardingCommande): Promise<ValiderOnboardingResultat> {
    const onboarding = await this.eleveOnboardingRepository.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');
    if (!peutTransitionnerDepuisPendingValidation(onboarding.status)) {
      throw new Error(`Ce dossier ne peut pas être validé depuis son statut actuel (${onboarding.status}) — seul PENDING_VALIDATION peut passer à VALIDATED`);
    }

    const settings = await this.eleveOnboardingRepository.findSettings(cmd.schoolId);
    const responsableRole = settings?.responsableRole ?? 'ADMIN';
    if (cmd.validatorRole !== responsableRole) {
      throw new Error(`Seul un utilisateur avec le rôle ${responsableRole} peut valider ce dossier`);
    }

    const classId = cmd.classId ?? onboarding.classId;
    if (!classId) throw new Error('Aucune classe définie pour ce dossier — précisez-en une avant de valider');

    const submitted = (onboarding.submittedData ?? {}) as Record<string, unknown>;
    const nom = String(submitted.nom || onboarding.nomProvisoire);
    const prenom = String(submitted.prenom || '');
    const dateOfBirth = typeof submitted.dateNaissance === 'string' ? parseDateFR(submitted.dateNaissance) : null;
    const gender = typeof submitted.gender === 'string' ? submitted.gender : null;

    const recipientType = onboarding.recipientType as 'ELEVE' | 'PARENT' | 'LES_DEUX';
    // Un dossier LES_DEUX peut désormais porter deux coordonnées distinctes
    // (parentContactEmail/parentContactTelephone) — dans ce cas, le compte élève reçoit
    // contactEmail/contactTelephone (les siens) et le compte parent reçoit les coordonnées
    // parent séparées. Sans ces champs (PARENT seul, ou dossier LES_DEUX créé avant leur
    // ajout), on retombe sur l'ancien comportement : seul le compte PARENT reçoit le contact
    // partagé — nécessaire car @@unique([schoolId, email/phone]) sur User empêcherait deux
    // comptes de rôles différents de partager le même contact dans la même école.
    const hasDistinctParentContact = !!(onboarding.parentContactEmail || onboarding.parentContactTelephone);
    const eleveRecoitContact = recipientType === 'ELEVE' || (recipientType === 'LES_DEUX' && hasDistinctParentContact);
    const parentRecoitContact = recipientType === 'PARENT' || recipientType === 'LES_DEUX';

    const eleveContactEmail = eleveRecoitContact ? onboarding.contactEmail : null;
    const eleveContactTelephone = eleveRecoitContact ? onboarding.contactTelephone : null;
    const parentContactEmailUtilise = hasDistinctParentContact ? onboarding.parentContactEmail : onboarding.contactEmail;
    const parentContactTelephoneUtilise = hasDistinctParentContact ? onboarding.parentContactTelephone : onboarding.contactTelephone;

    // accessMode=SMS_ONLY seulement si le dispositif a été explicitement déclaré absent
    // (jamais si l'info est inconnue/null — Principe : ne jamais restreindre faute d'avoir
    // posé la question) ET qu'un numéro existe pour recevoir au moins une notification.
    const eleveAccessMode: 'FULL_ACCESS' | 'SMS_ONLY' =
      onboarding.eleveADispositif === false && !!eleveContactTelephone ? 'SMS_ONLY' : 'FULL_ACCESS';
    const parentAccessMode: 'FULL_ACCESS' | 'SMS_ONLY' =
      onboarding.parentADispositif === false && !!parentContactTelephoneUtilise ? 'SMS_ONLY' : 'FULL_ACCESS';

    const { studentProfileId, comptesCrees } = await this.eleveOnboardingRepository.validerOnboarding({
      schoolId: cmd.schoolId,
      onboardingId: onboarding.id,
      validatedById: cmd.validatedById,
      classId,
      nom,
      prenom,
      dateOfBirth,
      gender,
      eleveContactEmail,
      eleveContactTelephone,
      parentContactEmail: parentContactEmailUtilise,
      parentContactTelephone: parentContactTelephoneUtilise,
      parentRecoitContact,
      eleveAccessMode,
      parentAccessMode,
      eleveDispositifOS: onboarding.eleveDispositifOS,
      parentDispositifOS: onboarding.parentDispositifOS,
      examCandidateId: onboarding.examCandidateId,
    });

    await this.activityLog.log({
      userId: cmd.validatedById,
      schoolId: cmd.schoolId,
      action: 'ONBOARDING_VALIDATED',
      details: `Compte(s) créé(s) pour ${nom} ${prenom} (dossier ${onboarding.id}, source ${onboarding.sourceType}, ${comptesCrees.length} compte(s))`,
    });

    return {
      onboardingId: onboarding.id,
      studentProfileId,
      recipientType,
      comptesCrees,
    };
  }
}
