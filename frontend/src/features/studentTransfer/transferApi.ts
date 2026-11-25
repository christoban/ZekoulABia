'use client'

/**
 * Client API des transferts inter-écoles (Plan v2 §8 — Frontend).
 * Garanties : fetchApi = refresh 401 automatique ; chaque action est online-only
 * (registre FORT) et le serveur revalide RBAC + flag + transitions de machine d'états.
 */
import { fetchApi } from '@/lib/fetchApi'

export type TransferStatus =
  | 'PENDING_GUARDIAN' | 'PENDING_SOURCE' | 'APPROVED'
  | 'REFUSED_BY_GUARDIAN' | 'REFUSED_BY_SOURCE' | 'EXPIRED'
  | 'REVOKED' | 'COMPLETED' | 'CANCELLED'

export interface TransferRequest {
  id: string
  targetSchoolId: string
  sourceSchoolId: string
  status: TransferStatus
  requestedAt: string
  guardianDecisionAt: string | null
  sourceDecisionAt: string | null
  completedAt: string | null
  parentExpiresAt: string
  sourceAutoApprovalAt: string | null
  academicYearTarget: string
  rejectionReason: string | null
  targetStudentProfileId: string | null
}

export interface SentTransfer extends TransferRequest {
  sourceSchoolName: string
}

export interface ReceivedTransfer extends TransferRequest {
  targetSchoolName: string
  consenterDecision: 'PENDING' | 'ACCEPTED' | 'REFUSED' | 'REVOKED' | null
  consenterExpiresAt: string | null
}

export interface CompletedTransferBrief {
  id: string
  completedAt: string | null
  sourceSchoolName: string
  snapshotId: string | null
  targetStudentProfileId: string | null
}

export interface DossierTransfertLu {
  snapshotId: string
  categories: string[]
  payload: Record<string, unknown>
  generatedAt: string
  deleteAfter: string
}

interface Enveloppe<T> { success?: boolean; data?: T; message?: string }

async function lire<T>(p: Promise<Response>): Promise<T> {
  const res = await p
  const json = await res.json().catch(() => null) as Enveloppe<T> | null
  if (!json?.success) throw new Error(json?.message || 'Erreur serveur')
  return json.data as T
}

export async function verifierIdentite(nationalId: string): Promise<boolean> {
  return lire<boolean>(
    fetchApi('/api/v2/student-transfers/detect', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nationalId }),
    }),
  )
}

export async function creerDemande(input: { nationalId: string; academicYearTarget: string }): Promise<TransferRequest> {
  return lire<TransferRequest>(
    fetchApi('/api/v2/student-transfers/requests', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export function listerEnvoyees(): Promise<SentTransfer[]> {
  return lire<SentTransfer[]>(fetchApi('/api/v2/student-transfers/requests', { credentials: 'include' }))
}

export async function annulerDemande(requestId: string): Promise<void> {
  await fetchApi(`/api/v2/student-transfers/requests/${encodeURIComponent(requestId)}/cancel`, {
    method: 'POST', credentials: 'include',
  })
}

export async function associerProfilCible(requestId: string, targetStudentProfileId: string): Promise<void> {
  await fetchApi(`/api/v2/student-transfers/requests/${encodeURIComponent(requestId)}/link-target`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetStudentProfileId }),
  })
}

export function listerRecues(): Promise<ReceivedTransfer[]> {
  return lire<ReceivedTransfer[]>(fetchApi('/api/v2/student-transfers/source/requests', { credentials: 'include' }))
}

export async function deciderDemande(input: { requestId: string; decision: 'APPROVE' | 'REFUSE'; rejectionReason?: string }): Promise<void> {
  await fetchApi(`/api/v2/student-transfers/requests/${encodeURIComponent(input.requestId)}/decide`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: input.decision, rejectionReason: input.rejectionReason }),
  })
}

export function historiqueTransferts(): Promise<CompletedTransferBrief[]> {
  return lire<CompletedTransferBrief[]>(fetchApi('/api/v2/student-transfers/requests/history', { credentials: 'include' }))
}

export function lireDossier(requestId: string, snapshotId: string): Promise<DossierTransfertLu> {
  return lire<DossierTransfertLu>(
    fetchApi(
      `/api/v2/student-transfers/requests/${encodeURIComponent(requestId)}/snapshots/${encodeURIComponent(snapshotId)}`,
      { credentials: 'include' },
    ),
  )
}

export type ConsentChallengeState = 'PENDING' | 'DECIDED' | 'REVOKED' | 'EXPIRED'

export async function etatConsentement(input: { requestId: string; token: string }): Promise<{ status: ConsentChallengeState; expiresAt: string } | null> {
  const params = new URLSearchParams({ token: input.token })
  return lire<{ status: ConsentChallengeState; expiresAt: string } | null>(
    fetch(
      `/api/v2/student-transfers/requests/${encodeURIComponent(input.requestId)}/consent/status?${params}`,
      { credentials: 'omit' },
    ),
  )
}

export async function consentir(input: {
  requestId: string
  token: string
  otp: string
  decision: 'ACCEPT' | 'REFUSE'
}): Promise<void> {
  await fetchApi(`/api/v2/student-transfers/requests/${encodeURIComponent(input.requestId)}/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: input.token, otp: input.otp, decision: input.decision }),
  })
}

export async function revoquer(input: { requestId: string; token: string }): Promise<void> {
  await fetchApi(`/api/v2/student-transfers/requests/${encodeURIComponent(input.requestId)}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: input.token }),
  })
}
