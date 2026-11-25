/**
 * SmsNotificationService — wraps Techsoft sendSMS with:
 *   - Simulation mode when TECHSOFT_API_KEY is absent
 *   - SmsLog persistence (success and failure)
 *   - SchoolNotificationSettings gate per event type
 *   - Never throws — all public functions are fire-and-forget safe
 */
import {
  DISCIPLINE_TYPE_LABELS,
  smsTemplates,
  formatSmsDate,
  formatSmsAmount,
} from './smsNotificationTemplates.ts'
import {
  getParentContacts,
  resolveSchoolName,
  sendStudentNotification,
  sendSchoolNotification,
  sendRawSms,
  sendGenericAlertBatch,
} from './smsNotificationSenders.ts'

export { DISCIPLINE_TYPE_LABELS, getParentContacts }

// ── Public API ─────────────────────────────────────────────────────────────

export async function notifyAbsenceSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  date: Date
  subjectName?: string
  /** Repli push-d'abord (voir PushFirstNotifier.ts) : si omis, résout tous les parents comme avant. */
  phones?: string[]
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    type: 'ABSENCE',
    settingKey: 'smsAbsences',
    phones: opts.phones,
    logLabel: 'SMS Absence',
    buildMessage: (lang) => {
      const dateStr = formatSmsDate(opts.date, lang)
      const subjectPart = opts.subjectName ? (lang === 'fr' ? ` en ${opts.subjectName}` : ` in ${opts.subjectName}`) : ''
      return smsTemplates.absence[lang](opts.studentName, dateStr, subjectPart)
    },
  })
}

export async function notifyPaymentSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  amount: number
  parentPhone?: string
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    type: 'PAYMENT',
    settingKey: 'smsPayments',
    phones: opts.parentPhone ? [opts.parentPhone] : undefined,
    logLabel: 'SMS Paiement',
    buildMessage: (lang) => smsTemplates.payment[lang](opts.studentName, formatSmsAmount(opts.amount, lang)),
  })
}

export async function notifyOverdueInvoiceSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  amount: number
  daysOverdue: number
  invoiceLabel: string
  /** Repli push-d'abord (voir PushFirstNotifier.ts) : si omis, résout tous les parents comme avant. */
  phones?: string[]
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    type: 'PAYMENT',
    settingKey: 'smsPayments',
    phones: opts.phones,
    logLabel: 'SMS Overdue Invoice',
    buildMessage: (lang) =>
      smsTemplates.overdue[lang](opts.studentName, opts.invoiceLabel, formatSmsAmount(opts.amount, lang), opts.daysOverdue),
  })
}

export async function notifyDisciplineSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  type: string
  reason: string
  /** Repli push-d'abord (voir PushFirstNotifier.ts) : si omis, résout tous les parents comme avant. */
  phones?: string[]
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    type: 'DISCIPLINE',
    phones: opts.phones,
    logLabel: 'SMS Discipline',
    buildMessage: (lang) => {
      const typeLabel = DISCIPLINE_TYPE_LABELS[opts.type]?.[lang] ?? opts.type
      return smsTemplates.discipline[lang](opts.studentName, typeLabel, opts.reason)
    },
  })
}

/**
 * Cible une liste explicite de téléphones plutôt que de les résoudre elle-même — l'appelant
 * (markOverdueLoans) essaie d'abord le push par parent et ne passe ici que les numéros des
 * parents que le push n'a pas atteints (aucune souscription active), voir getParentContacts.
 */
export async function notifyOverdueBookSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  bookTitle: string
  phones: string[]
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    type: 'LIBRARY',
    phones: opts.phones,
    logLabel: 'SMS Library Overdue',
    buildMessage: (lang) => smsTemplates.libraryOverdue[lang](opts.studentName, opts.bookTitle),
  })
}

export async function notifyAbsenceThresholdSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  count: number
  threshold: number
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    type: 'ABSENCE',
    settingKey: 'smsAbsences',
    logLabel: 'SMS Seuil Absences',
    buildMessage: (lang) => smsTemplates.absenceThreshold[lang](opts.studentName, opts.count, opts.threshold),
  })
}

export async function notifyBulletinSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  periodName: string
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentId,
    type: 'BULLETIN',
    settingKey: 'smsBulletins',
    logLabel: 'SMS Bulletin',
    buildMessage: (lang) => smsTemplates.bulletin[lang](opts.studentName, opts.periodName),
  })
}

// ── Module Examens & Affectations (concours d'entrée, sélection PEBS, choix LV2) ──

export async function notifyAdmissionProvisoireSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  schoolName?: string
  level?: string
  examName?: string
  nextStep?: string
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.parentPhone,
    type: 'ADMISSION',
    logLabel: 'SMS Admission Provisoire',
    buildMessage: async (lang) => {
      const schoolName = await resolveSchoolName(opts.schoolId, opts.schoolName)
      return smsTemplates.admissionProvisoire[lang](opts.candidateName, schoolName, opts.level, opts.examName, opts.nextStep)
    },
  })
}

export async function notifyConcoursNonAdmisSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  schoolName?: string
  level?: string
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.parentPhone,
    type: 'ADMISSION',
    logLabel: 'SMS Concours Non Admis',
    buildMessage: async (lang) => {
      const schoolName = await resolveSchoolName(opts.schoolId, opts.schoolName)
      return smsTemplates.concoursNonAdmis[lang](opts.candidateName, schoolName, opts.level)
    },
  })
}

export async function notifyConcoursListeAttenteSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  schoolName?: string
  level?: string
  rank?: number
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.parentPhone,
    type: 'ADMISSION',
    logLabel: 'SMS Concours Liste Attente',
    buildMessage: async (lang) => {
      const schoolName = await resolveSchoolName(opts.schoolId, opts.schoolName)
      return smsTemplates.concoursListeAttente[lang](opts.candidateName, schoolName, opts.level, opts.rank)
    },
  })
}

export async function notifyConcoursPromotionSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  schoolName?: string
  level?: string
  examName?: string
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.parentPhone,
    type: 'ADMISSION',
    logLabel: 'SMS Concours Promotion',
    buildMessage: async (lang) => {
      const schoolName = await resolveSchoolName(opts.schoolId, opts.schoolName)
      return smsTemplates.concoursPromotionListeAttente[lang](opts.candidateName, schoolName, opts.level, opts.examName)
    },
  })
}

export async function notifyCepResultSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  result: 'REUSSI' | 'ECHOUE'
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.parentPhone,
    type: 'ADMISSION',
    logLabel: 'SMS Résultat CEP',
    buildMessage: (lang) =>
      opts.result === 'REUSSI'
        ? smsTemplates.cepConfirme[lang](opts.candidateName)
        : smsTemplates.cepAnnule[lang](opts.candidateName),
  })
}

export async function notifyPebsSelectionSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  selected: boolean
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentUserId,
    type: 'PEBS',
    logLabel: 'SMS Sélection PEBS',
    buildMessage: (lang) =>
      opts.selected
        ? smsTemplates.pebsSelectionne[lang](opts.studentName)
        : smsTemplates.pebsNonSelectionne[lang](opts.studentName),
  })
}

export async function notifyMinesecOverdueSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  amount: number
  typesFrais: string
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentUserId,
    type: 'PAYMENT',
    settingKey: 'smsPayments',
    logLabel: 'SMS MINESEC Overdue',
    buildMessage: (lang) =>
      smsTemplates.minesecOverdue[lang](opts.studentName, formatSmsAmount(opts.amount, lang), opts.typesFrais),
  })
}

export async function notifyLv2WindowOpenSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  level: string
  closeDate: Date
}): Promise<void> {
  await sendStudentNotification({
    schoolId: opts.schoolId,
    studentId: opts.studentUserId,
    type: 'LV2',
    logLabel: 'SMS Fenêtre LV2',
    buildMessage: (lang) =>
      smsTemplates.lv2WindowOpen[lang](opts.studentName, opts.level, formatSmsDate(opts.closeDate, lang)),
  })
}

// ── Module Onboarding Auto-Service Élèves ───────────────────────────────────
// Le contact (téléphone) est déjà connu explicitement via StudentOnboarding.contactTelephone
// — pas de lookup via getParentPhones ici, contrairement aux notifications post-inscription
// (l'élève/parent n'a pas encore de compte au moment du lien ou de la relance).

export async function notifyOnboardingLinkSms(opts: {
  schoolId: string
  nomProvisoire: string
  schoolName: string
  phone: string | null
  expiryDays: number
  formUrl: string
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.phone,
    type: 'ONBOARDING',
    logLabel: 'SMS Onboarding Lien',
    buildMessage: (lang) => smsTemplates.onboardingLink[lang](opts.nomProvisoire, opts.schoolName, opts.expiryDays, opts.formUrl),
  })
}

export async function notifyOnboardingReminderSms(opts: {
  schoolId: string
  nomProvisoire: string
  schoolName: string
  phone: string | null
  formUrl: string
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.phone,
    type: 'ONBOARDING',
    logLabel: 'SMS Onboarding Relance',
    buildMessage: (lang) => smsTemplates.onboardingReminder[lang](opts.nomProvisoire, opts.schoolName, opts.formUrl),
  })
}

export async function notifyOnboardingActivatedSms(opts: {
  schoolId: string
  schoolName: string
  phone: string | null
  setupUrl: string
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.phone,
    type: 'ONBOARDING',
    logLabel: 'SMS Onboarding Activé',
    buildMessage: (lang) => smsTemplates.onboardingActivated[lang](opts.schoolName, opts.setupUrl),
  })
}

/** accessMode=SMS_ONLY : jamais de lien (le contact n'a aucun dispositif capable de l'ouvrir). */
export async function notifyOnboardingActivatedSmsOnly(opts: {
  schoolId: string
  schoolName: string
  phone: string | null
}): Promise<void> {
  await sendSchoolNotification({
    schoolId: opts.schoolId,
    phone: opts.phone,
    type: 'ONBOARDING',
    logLabel: 'SMS Onboarding Activé (SMS_ONLY)',
    buildMessage: (lang) => smsTemplates.onboardingActivatedSmsOnly[lang](opts.schoolName),
  })
}

export async function notifyCredentialsSms(opts: {
  schoolId: string
  phone: string | null
  roleLabel: string
  loginIdentifier: string
  temporaryPassword: string
}): Promise<void> {
  await sendRawSms({
    schoolId: opts.schoolId,
    phone: opts.phone,
    message: `ZekoulABia - ${opts.roleLabel}. Login: ${opts.loginIdentifier}. Mot de passe temporaire: ${opts.temporaryPassword}. Changez-le à la première connexion.`,
    type: 'ONBOARDING',
    sensitive: true,
    logLabel: 'SMS Identifiants',
  })
}

export async function notifyGenericAlertSms(opts: {
  schoolId: string
  phones: string[]
  message: string
}): Promise<void> {
  await sendGenericAlertBatch({
    schoolId: opts.schoolId,
    phones: opts.phones,
    message: opts.message,
    logLabel: 'SMS Alerte générique',
  })
}
