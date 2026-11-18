import { apiFetch } from './client'

export interface MasterUserDto {
  id: string
  email: string
  name: string
  role: string
  isOwner?: boolean
  assignedSchoolIds?: string[]
}

export async function fetchMe(): Promise<MasterUserDto> {
  const res = await apiFetch<MasterUserDto>('/api/v2/master/auth/me')
  if (!res.data) throw new Error('Données utilisateur introuvables')
  return res.data
}

export async function fetchMasterMfaStatus(): Promise<{ mfaEnabled: boolean }> {
  const res = await apiFetch<{ mfaEnabled: boolean }>('/api/v2/master/auth/mfa-status')
  return res.data ?? { mfaEnabled: false }
}

export async function mfaSetup(): Promise<{ qrDataUri: string; manualKey: string }> {
  const res = await apiFetch<{ qrDataUri: string; manualKey: string }>('/api/v2/master/auth/mfa/setup', { method: 'POST', body: '{}' })
  if (!res.data) throw new Error('Erreur lors de la configuration MFA')
  return res.data
}

export async function mfaEnable(totpCode: string, password: string): Promise<{ recoveryCodes: string[] }> {
  const res = await apiFetch<{ recoveryCodes: string[] }>('/api/v2/master/auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ totpCode, sensitiveAuth: { password } }),
  })
  if (!res.data) throw new Error('Erreur lors de l\'activation MFA')
  return res.data
}

export async function mfaDisable(password: string, totpCode: string): Promise<void> {
  await apiFetch('/api/v2/master/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth: { password, code: totpCode } }),
  })
}

export async function mfaRegenCodes(password: string, totpCode: string): Promise<{ recoveryCodes: string[] }> {
  const res = await apiFetch<{ recoveryCodes: string[] }>('/api/v2/master/auth/mfa/regen-codes', {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth: { password, code: totpCode } }),
  })
  if (!res.data) throw new Error('Erreur lors de la régénération')
  return res.data
}

// Débloque un compte Admin/Staff/Teacher ayant perdu l'accès à son authenticator ET à ses
// codes de récupération — le compte devra reconfigurer le MFA depuis zéro à sa prochaine connexion.
export async function resetUserMfa(subdomain: string, email: string, password: string, totpCode: string): Promise<void> {
  await apiFetch('/api/v2/master/users/mfa-reset', {
    method: 'POST',
    body: JSON.stringify({ subdomain, email, sensitiveAuth: { password, code: totpCode } }),
  })
}

// Étape 1 — vérifier identité (password + MFA) → déclenche l'envoi d'un OTP par email
export async function initiatePasswordChange(body: {
  currentPassword: string
  mfaCode?: string
}): Promise<void> {
  await apiFetch('/api/v2/master/auth/password-change/initiate', {
    method: 'POST',
    body: JSON.stringify({
      sensitiveAuth: { password: body.currentPassword, ...(body.mfaCode ? { code: body.mfaCode } : {}) },
    }),
  })
}

// Étape 2 — vérifier OTP email + définir le nouveau mot de passe
export async function changePassword(body: {
  otp: string
  newPassword: string
}): Promise<void> {
  await apiFetch('/api/v2/master/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ otp: body.otp, newPassword: body.newPassword }),
  })
}

export async function logout(): Promise<void> {
  await apiFetch('/api/v2/master/auth/logout', { method: 'POST' })
}
