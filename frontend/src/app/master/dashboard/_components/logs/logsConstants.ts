import type React from 'react'
import { CheckCircle2, XCircle, Ban, Trash2, Mail, RotateCw, type LucideIcon } from 'lucide-react'
import type { AIActionAuditLogDto } from '../../_api'

export type LogTab = 'auth' | 'actions' | 'emails' | 'security' | 'ai-security'

export const AI_OUTCOME_BADGE: Record<AIActionAuditLogDto['outcome'], 'event-success' | 'event-warning' | 'event-error'> = {
  SUCCES: 'event-success',
  REFUSE: 'event-error',
  ERREUR: 'event-warning',
}

export const AI_OUTCOME_LABEL: Record<AIActionAuditLogDto['outcome'], string> = {
  SUCCES: 'Réussie',
  REFUSE: 'Refusée',
  ERREUR: 'Erreur',
}

export const AUTH_LABELS: Record<string, string> = {
  'success:login_otp_sent':                         'Code OTP envoyé',
  'success:otp_verified':                           'Email vérifié',
  'success:mfa_verified':                           'MFA validé',
  'success:mfa_login_totp':                         'Connexion MFA (TOTP)',
  'success:mfa_login_recovery_code':                'Connexion MFA (code récup.)',
  'success:recovery_codes_regenerated':             'Codes de récupération regénérés',
  'success:password_changed_from_security_dashboard': 'Mot de passe modifié',
  'success:logout':                                 'Déconnexion',
  'success:otp_resend':                             'Code OTP renvoyé',
  'success:sensitive_auth_passed_no_mfa':           'Vérif. identité réussie (sans MFA)',
  'success:sensitive_auth_passed_totp':             'Vérif. identité réussie (TOTP)',
  'success:sensitive_auth_passed_recovery_code':    'Vérif. identité réussie (code récup.)',
  'failure:login_failed':                           'Échec de connexion',
  'failure:login_invalid_password':                 'Mot de passe invalide',
  'failure:otp_verification_failed':                'Échec vérification OTP',
  'failure:mfa_verification_failed':                'Échec vérification MFA',
  'failure:sensitive_auth_invalid_password':        'Vérif. identité échouée — mot de passe',
  'failure:sensitive_auth_invalid_mfa_code':        'Vérif. identité échouée — code MFA',
  'failure:sensitive_auth_missing_factors':         'Vérif. identité — champ manquant',
}

export const AUTH_BADGE: Record<string, 'event-success' | 'event-warning' | 'event-error' | 'event-info'> = {
  'success:login_otp_sent':                         'event-info',
  'success:otp_verified':                           'event-success',
  'success:mfa_verified':                           'event-success',
  'success:mfa_login_totp':                         'event-success',
  'success:mfa_login_recovery_code':                'event-warning',
  'success:recovery_codes_regenerated':             'event-success',
  'success:password_changed_from_security_dashboard': 'event-success',
  'success:logout':                                 'event-info',
  'success:otp_resend':                             'event-info',
  'success:sensitive_auth_passed_no_mfa':           'event-success',
  'success:sensitive_auth_passed_totp':             'event-success',
  'success:sensitive_auth_passed_recovery_code':    'event-warning',
  'failure:login_failed':                           'event-error',
  'failure:login_invalid_password':                 'event-error',
  'failure:otp_verification_failed':                'event-error',
  'failure:mfa_verification_failed':                'event-error',
  'failure:sensitive_auth_invalid_password':        'event-error',
  'failure:sensitive_auth_invalid_mfa_code':        'event-error',
  'failure:sensitive_auth_missing_factors':         'event-error',
}

export const ACTION_LABELS: Record<string, string> = {
  'action:school_approved':      'École approuvée',
  'action:school_rejected':      'École rejetée',
  'action:school_suspended':     'École suspendue',
  'action:school_reactivated':   'École réactivée',
  'action:school_deleted':       'École supprimée',
  'action:school_invite_sent':   'Invitation envoyée',
  'action:school_invite_resent': 'Invitation renvoyée',
  'action:school_reexamined':    'Demande réexaminée',
}

export const ACTION_ICONS: Record<string, LucideIcon> = {
  'action:school_approved':      CheckCircle2,
  'action:school_rejected':      XCircle,
  'action:school_suspended':     Ban,
  'action:school_reactivated':   CheckCircle2,
  'action:school_deleted':       Trash2,
  'action:school_invite_sent':   Mail,
  'action:school_invite_resent': Mail,
  'action:school_reexamined':    RotateCw,
}

export const ACTION_BADGE: Record<string, 'event-success' | 'event-warning' | 'event-error' | 'event-info'> = {
  'action:school_approved':      'event-success',
  'action:school_rejected':      'event-error',
  'action:school_suspended':     'event-warning',
  'action:school_reactivated':   'event-success',
  'action:school_deleted':       'event-error',
  'action:school_invite_sent':   'event-info',
  'action:school_invite_resent': 'event-info',
  'action:school_reexamined':    'event-info',
}

export const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  color: 'var(--text2)',
  verticalAlign: 'middle',
}

export const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--text3)',
  background: 'var(--bg2)',
  borderBottom: '1px solid var(--border)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}
