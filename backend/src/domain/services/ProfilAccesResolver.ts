/**
 * DOMAIN SERVICE — ProfilAccesResolver
 * Détermine le profil d'accès numérique de l'élève et du parent
 * selon le cycle éducatif et les dispositifs disponibles dans la famille.
 *
 * Règles : Tableau 7.2 et Addendum v2 du Plan d'implémentation.
 */

import type {
  UserAccessMode,
  StudentAccessScope,
  ProfileManagedBy,
  NotificationDeliveryChannel,
} from '@domain/types/enums';
import type { EducationalCycle } from './CycleResolver';

export interface ResoudreProfilAccesInput {
  cycle: EducationalCycle;
  eleveSmartphone: boolean;
  parentSmartphone: boolean;
  parentTelSimple: boolean;
  ageEleve?: number | null;
  seuilAgeParent?: number;
}

export interface ProfilAccesResultat {
  eleveAccessMode: UserAccessMode;
  parentAccessMode: UserAccessMode;
  eleveAccessScope: StudentAccessScope;
  profileManagedBy: ProfileManagedBy;
  notificationChannel: NotificationDeliveryChannel;
  loginEnabled: boolean;
  descriptionFr: string;
  descriptionEn: string;
}

export class ProfilAccesResolver {
  /**
   * Résout le profil d'accès complet selon les entrées fournies.
   */
  static resoudre(input: ResoudreProfilAccesInput): ProfilAccesResultat {
    const {
      cycle,
      eleveSmartphone,
      parentSmartphone,
      parentTelSimple,
      ageEleve,
      seuilAgeParent = 15,
    } = input;

    // Détermination effective du cycle
    let isPremierCycle =
      cycle === 'PREMIER_CYCLE' ||
      cycle === 'PRIMAIRE' ||
      cycle === 'MATERNELLE';

    if (cycle === 'INCONNU') {
      if (ageEleve != null && !Number.isNaN(ageEleve)) {
        isPremierCycle = ageEleve < seuilAgeParent;
      } else {
        // Défaut sécurisé en cas d'inconnu total : traité comme 1er cycle (protection mineur)
        isPremierCycle = true;
      }
    }

    // ── Cas 1 : Premier Cycle (et Primaire / Maternelle) ──
    if (isPremierCycle) {
      if (eleveSmartphone && parentSmartphone) {
        return {
          eleveAccessMode: 'FULL_ACCESS',
          parentAccessMode: 'FULL_ACCESS',
          eleveAccessScope: 'READ_ONLY',
          profileManagedBy: 'PARENT',
          notificationChannel: 'APPLI_PARENT',
          loginEnabled: true,
          descriptionFr:
            "Compte élève en lecture seule ; profil géré par le parent, notifications via l'application parent.",
          descriptionEn:
            'Student account in read-only mode; profile managed by parent, notifications via parent app.',
        };
      }

      if (!eleveSmartphone && parentSmartphone) {
        return {
          eleveAccessMode: 'NO_LOGIN',
          parentAccessMode: 'FULL_ACCESS',
          eleveAccessScope: 'READ_ONLY',
          profileManagedBy: 'PARENT',
          notificationChannel: 'APPLI_PARENT',
          loginEnabled: false,
          descriptionFr:
            "L'élève n'a pas de compte numérique ; gestion par le parent via l'application parent.",
          descriptionEn:
            'Student has no digital login; management by parent via parent app.',
        };
      }

      if (parentTelSimple) {
        if (eleveSmartphone) {
          return {
            eleveAccessMode: 'FULL_ACCESS',
            parentAccessMode: 'SMS_ONLY',
            eleveAccessScope: 'READ_ONLY',
            profileManagedBy: 'SECRETARIAT',
            notificationChannel: 'SMS',
            loginEnabled: true,
            descriptionFr:
              "Compte élève en lecture seule ; parent notifié par SMS, modifications du profil gérées au secrétariat.",
            descriptionEn:
              'Student account in read-only mode; parent notified by SMS, profile managed at secretariat.',
          };
        }

        return {
          eleveAccessMode: 'NO_LOGIN',
          parentAccessMode: 'SMS_ONLY',
          eleveAccessScope: 'READ_ONLY',
          profileManagedBy: 'SECRETARIAT',
          notificationChannel: 'SMS',
          loginEnabled: false,
          descriptionFr:
            "L'élève n'a pas de compte ; notifications au parent par SMS, gestion par le secrétariat.",
          descriptionEn:
            'Student has no digital account; parent notified by SMS, managed at secretariat.',
        };
      }

      // Aucun contact téléphonique
      return {
        eleveAccessMode: 'NO_LOGIN',
        parentAccessMode: 'NO_LOGIN',
        eleveAccessScope: 'READ_ONLY',
        profileManagedBy: 'SECRETARIAT',
        notificationChannel: 'PAPIER',
        loginEnabled: false,
        descriptionFr:
          "Aucun compte numérique ; convocations et bulletins imprimés sur papier, gestion par le secrétariat.",
        descriptionEn:
          'No digital account; paper report cards and notices, managed at secretariat.',
      };
    }

    // ── Cas 2 : Second Cycle (2nde à Terminale / High School) ──
    if (eleveSmartphone) {
      const parentMode: UserAccessMode = parentSmartphone
        ? 'FULL_ACCESS'
        : parentTelSimple
        ? 'SMS_ONLY'
        : 'NO_LOGIN';

      return {
        eleveAccessMode: 'FULL_ACCESS',
        parentAccessMode: parentMode,
        eleveAccessScope: 'FULL',
        profileManagedBy: 'STUDENT',
        notificationChannel: 'APPLI_ELEVE',
        loginEnabled: true,
        descriptionFr:
          "Compte élève autonome complet ; le profil est géré par l'élève, notifications via l'application élève.",
        descriptionEn:
          'Full autonomous student account; profile managed by student, notifications via student app.',
      };
    }

    if (parentSmartphone) {
      return {
        eleveAccessMode: 'NO_LOGIN',
        parentAccessMode: 'FULL_ACCESS',
        eleveAccessScope: 'READ_ONLY',
        profileManagedBy: 'PARENT',
        notificationChannel: 'APPLI_PARENT',
        loginEnabled: false,
        descriptionFr:
          "L'élève n'a pas de smartphone ; suivi assuré par le parent via l'application.",
        descriptionEn:
          'Student has no smartphone; tracking handled by parent via the app.',
      };
    }

    if (parentTelSimple) {
      return {
        eleveAccessMode: 'NO_LOGIN',
        parentAccessMode: 'SMS_ONLY',
        eleveAccessScope: 'READ_ONLY',
        profileManagedBy: 'SECRETARIAT',
        notificationChannel: 'SMS',
        loginEnabled: false,
        descriptionFr:
          "Aucun smartphone ; notifications transmises au parent par SMS, gestion par le secrétariat.",
        descriptionEn:
          'No smartphone; notifications sent to parent via SMS, managed at secretariat.',
      };
    }

    // Second cycle, aucun contact
    return {
      eleveAccessMode: 'NO_LOGIN',
      parentAccessMode: 'NO_LOGIN',
      eleveAccessScope: 'READ_ONLY',
      profileManagedBy: 'SECRETARIAT',
      notificationChannel: 'PAPIER',
      loginEnabled: false,
      descriptionFr:
        "Mode papier intégral ; convocations et bulletins imprimés, gestion au secrétariat.",
      descriptionEn:
        'Full paper mode; printed documents, managed at secretariat.',
    };
  }
}
