'use client'

import { Smartphone, UserCheck, Phone, X } from 'lucide-react'

export type ClassItem = {
  id: string
  name: string
  level?: string
}

export type StudentItem = {
  id: string
  userId?: string
  firstName?: string
  lastName?: string
  name?: string
  matricule?: string
  gender?: string
  dateOfBirth?: string
  className?: string
  photoUrl?: string | null
  avatarUrl?: string | null
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  parentHasDevice?: boolean
  studentHasDevice?: boolean
  accessProfile?: 'AUTONOME' | 'ASSISTE' | 'SMS_SEUL' | 'NON_CONNECTE'
  onboardingId?: string
}

export function mapDirectoryStudents(rawList: Record<string, unknown>[], className: string): StudentItem[] {
  return rawList.map((s, idx) => {
    const fn = String(s.firstName ?? '')
    const ln = String(s.lastName ?? s.name ?? '')
    const pPhone = typeof s.parentPhone === 'string' ? s.parentPhone : (typeof s.phone === 'string' ? s.phone : '')
    const pEmail = typeof s.parentEmail === 'string' ? s.parentEmail : (typeof s.email === 'string' ? s.email : '')
    const pHasDev = Boolean(s.parentADispositif ?? s.parentHasDevice ?? (pEmail.length > 0))

    let profile: 'AUTONOME' | 'ASSISTE' | 'SMS_SEUL' | 'NON_CONNECTE' = 'NON_CONNECTE'
    if (pEmail && pHasDev) profile = 'AUTONOME'
    else if (pPhone && pHasDev) profile = 'ASSISTE'
    else if (pPhone) profile = 'SMS_SEUL'

    return {
      id: String(s.id ?? `stud-${idx}`),
      userId: String(s.userId ?? s.id ?? ''),
      firstName: fn,
      lastName: ln,
      name: `${fn} ${ln}`.trim(),
      matricule: String(s.matricule ?? `MAT-${1000 + idx}`),
      gender: String(s.gender ?? (idx % 2 === 0 ? 'M' : 'F')),
      dateOfBirth: typeof s.dateOfBirth === 'string' ? s.dateOfBirth : (typeof s.dateNaissance === 'string' ? s.dateNaissance : '—'),
      photoUrl: (s.photoUrl as string) || null,
      avatarUrl: (s.avatarUrl as string) || null,
      className,
      parentName: typeof s.parentName === 'string' ? s.parentName : 'Famille ' + (ln || 'Parent'),
      parentPhone: pPhone || '',
      parentEmail: pEmail,
      parentHasDevice: pHasDev,
      accessProfile: profile,
      onboardingId: typeof s.onboardingId === 'string' ? s.onboardingId : undefined,
    }
  })
}

export function mapLegacyStudents(rawList: Record<string, unknown>[], className: string): StudentItem[] {
  return rawList.map((s, idx) => ({
    id: String(s.id ?? `stud-${idx}`),
    userId: String(s.userId ?? s.id ?? ''),
    firstName: String(s.firstName ?? ''),
    lastName: String(s.lastName ?? ''),
    name: `${String(s.firstName ?? '')} ${String(s.lastName ?? '')}`.trim(),
    matricule: String(s.matricule ?? `MAT-${1000 + idx}`),
    gender: String(s.gender ?? 'M'),
    className,
    photoUrl: (s.photoUrl as string) || null,
    parentName: String(s.parentName ?? 'Parent'),
    parentPhone: String(s.parentPhone ?? ''),
    parentEmail: String(s.parentEmail ?? ''),
    accessProfile: 'NON_CONNECTE' as const,
  }))
}

export function openStudentDocument(docType: 'certificat' | 'carte' | 'fiche' | 'transfert', student: StudentItem) {
  const studentId = student.userId || student.id
  let url = ''
  if (docType === 'certificat') {
    url = `/api/v2/students/${studentId}/certificat`
  } else if (docType === 'carte') {
    url = `/api/v2/students/${studentId}/carte`
  } else if (docType === 'transfert') {
    url = `/api/v2/students/${studentId}/lettre-transfert`
  } else if (docType === 'fiche') {
    url = student.onboardingId
      ? `/api/v2/eleve-onboarding/${student.onboardingId}/pdf`
      : `/api/v2/eleve-onboarding/fiche-vierge-pdf`
  }
  window.open(url, '_blank')
}

export function StudentProfileBadge({ profile }: { profile?: string }) {
  switch (profile) {
    case 'AUTONOME':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/15 text-success dark:text-success"><Smartphone size={11} /> Autonome (App)</span>
    case 'ASSISTE':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400"><UserCheck size={11} /> Guichet assisté</span>
    case 'SMS_SEUL':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400"><Phone size={11} /> SMS uniquement</span>
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-500/15 text-gray-600 dark:text-gray-300"><X size={11} /> Non connecté</span>
  }
}
