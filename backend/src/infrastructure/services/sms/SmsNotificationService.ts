/**
 * SmsNotificationService — wraps Techsoft sendSMS with:
 *   - Simulation mode when TECHSOFT_API_KEY is absent
 *   - SmsLog persistence (success and failure)
 *   - SchoolNotificationSettings gate per event type
 *   - Never throws — all public functions are fire-and-forget safe
 */
import { prisma } from '@infrastructure/persistence/prisma/prisma.client'
import { sendSMS, isSmsConfigured } from './SmsService.ts'
import { resolveLanguage, type Language } from '../../../domain/policies/LanguagePolicy.ts'

type SmsType = 'ABSENCE' | 'PAYMENT' | 'BULLETIN' | 'DISCIPLINE' | 'ADMISSION' | 'PEBS' | 'LV2' | 'ONBOARDING' | 'LIBRARY'

export const DISCIPLINE_TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  WARNING_ORAL:        { fr: 'Avertissement oral',                 en: 'Verbal warning' },
  WARNING_WRITTEN:     { fr: 'Avertissement écrit',                en: 'Written warning' },
  TEMP_EXCLUSION:      { fr: 'Exclusion temporaire',               en: 'Temporary exclusion' },
  COUNCIL_DECISION:    { fr: 'Décision du conseil de discipline',  en: 'Disciplinary council decision' },
  PERMANENT_EXCLUSION: { fr: 'Exclusion définitive',               en: 'Permanent exclusion' },
}

// ── Templates SMS bilingues (fr/en) ─────────────────────────────────────────
// La langue est résolue par resolveSmsLanguage() (sous-système + section si bilingue).
const smsTemplates = {
  absence: {
    fr: (name: string, date: string, subjectPart: string) => `ZekoulABia: ${name} a été marqué(e) absent(e) le ${date}${subjectPart}.`,
    en: (name: string, date: string, subjectPart: string) => `ZekoulABia: ${name} was marked absent on ${date}${subjectPart}.`,
  },
  payment: {
    fr: (name: string, amount: string) => `ZekoulABia: Paiement de ${amount} XAF reçu pour ${name}. Merci !`,
    en: (name: string, amount: string) => `ZekoulABia: Payment of ${amount} XAF received for ${name}. Thank you!`,
  },
  overdue: {
    fr: (name: string, label: string, amount: string, days: number) => `ZekoulABia: RAPPEL — Facture "${label}" de ${amount} XAF pour ${name} est en retard de ${days} jour(s). Veuillez régulariser.`,
    en: (name: string, label: string, amount: string, days: number) => `ZekoulABia: REMINDER — Invoice "${label}" of ${amount} XAF for ${name} is ${days} day(s) overdue. Please settle it.`,
  },
  discipline: {
    fr: (name: string, typeLabel: string, reason: string) => `ZekoulABia: ${name} a fait l'objet d'une sanction (${typeLabel}). Motif : ${reason}. Contactez l'établissement pour plus d'informations.`,
    en: (name: string, typeLabel: string, reason: string) => `ZekoulABia: ${name} received a disciplinary sanction (${typeLabel}). Reason: ${reason}. Please contact the school for more information.`,
  },
  libraryOverdue: {
    fr: (name: string, title: string) => `ZekoulABia: RAPPEL — L'ouvrage "${title}" emprunté par ${name} est en retard. Merci de le retourner à la bibliothèque.`,
    en: (name: string, title: string) => `ZekoulABia: REMINDER — The book "${title}" borrowed by ${name} is overdue. Please return it to the library.`,
  },
  absenceThreshold: {
    fr: (name: string, count: number, threshold: number) => `ZekoulABia: ALERTE — ${name} cumule ${count} absences non justifiées (seuil : ${threshold}). Merci de contacter l'établissement.`,
    en: (name: string, count: number, threshold: number) => `ZekoulABia: ALERT — ${name} has ${count} unexcused absences (threshold: ${threshold}). Please contact the school.`,
  },
  bulletin: {
    fr: (name: string, period: string) => `ZekoulABia: Le bulletin de ${name} (${period}) est disponible. Connectez-vous pour le consulter.`,
    en: (name: string, period: string) => `ZekoulABia: ${name}'s report card (${period}) is available. Log in to view it.`,
  },
  admissionProvisoire: {
    fr: (name: string, schoolName = 'Établissement', level = '6e', examName = 'CEP', nextStep?: string) =>
      `${schoolName}: ${name} est admis(e) provisoirement en ${level} au concours d'entrée, sous réserve de la réussite au ${examName}.${nextStep ? ' ' + nextStep : ' Merci de vous présenter au secrétariat pour la suite des démarches.'}`,
    en: (name: string, schoolName = 'School', level = 'Form 1', examName = 'FSLC', nextStep?: string) =>
      `${schoolName}: ${name} has been provisionally admitted into ${level} on the entrance exam, subject to passing ${examName}.${nextStep ? ' ' + nextStep : ' Please contact the school administration for the next steps.'}`,
  },
  concoursNonAdmis: {
    fr: (name: string, schoolName = 'Établissement', level = '6e') =>
      `${schoolName}: Nous vous informons que ${name} n'a pas été retenu(e) au concours d'entrée en ${level}. Nous vous remercions pour votre confiance et lui souhaitons plein succès.`,
    en: (name: string, schoolName = 'School', level = 'Form 1') =>
      `${schoolName}: We regret to inform you that ${name} was not admitted into ${level} through the entrance exam. We thank you for your application and wish them great success.`,
  },
  concoursListeAttente: {
    fr: (name: string, schoolName = 'Établissement', level = '6e', rank?: number) =>
      `${schoolName}: ${name} est placé(e) sur la liste complémentaire du concours d'entrée en ${level}${rank ? ' (rang ' + rank + ')' : ''}. Vous serez contacté(e) en cas de libération d'une place.`,
    en: (name: string, schoolName = 'School', level = 'Form 1', rank?: number) =>
      `${schoolName}: ${name} is on the waiting list for entrance exam into ${level}${rank ? ' (rank ' + rank + ')' : ''}. You will be contacted should a place become available.`,
  },
  concoursPromotionListeAttente: {
    fr: (name: string, schoolName = 'Établissement', level = '6e', examName = 'CEP') =>
      `${schoolName}: Excellente nouvelle ! Une place s'est libérée et ${name} est désormais admis(e) provisoirement en ${level}, sous réserve de réussite au ${examName}. Merci de vous présenter au secrétariat.`,
    en: (name: string, schoolName = 'School', level = 'Form 1', examName = 'FSLC') =>
      `${schoolName}: Great news! A seat has become available and ${name} is now provisionally admitted into ${level}, subject to passing ${examName}. Please contact the school administration.`,
  },
  cepConfirme: {
    fr: (name: string) => `ZekoulABia: Félicitations ! ${name} a réussi le CEP, son admission en 6e est confirmée.`,
    en: (name: string) => `ZekoulABia: Congratulations! ${name} passed the CEP, admission into Form 1 is confirmed.`,
  },
  cepAnnule: {
    fr: (name: string) => `ZekoulABia: ${name} n'a pas obtenu le CEP. L'admission en 6e ne peut malheureusement pas être maintenue. Contactez l'établissement pour plus d'informations.`,
    en: (name: string) => `ZekoulABia: ${name} did not pass the CEP. Admission into Form 1 unfortunately cannot be maintained. Please contact the school for more information.`,
  },
  pebsSelectionne: {
    fr: (name: string) => `ZekoulABia: ${name} a été sélectionné(e) pour le Programme Spécial Bilingue (PEBS) et a été transféré(e) dans la classe correspondante.`,
    en: (name: string) => `ZekoulABia: ${name} has been selected for the Special Bilingual Programme (PEBS) and has been transferred to the corresponding class.`,
  },
  pebsNonSelectionne: {
    fr: (name: string) => `ZekoulABia: ${name} n'a pas été sélectionné(e) pour le Programme Spécial Bilingue (PEBS) cette année.`,
    en: (name: string) => `ZekoulABia: ${name} was not selected for the Special Bilingual Programme (PEBS) this year.`,
  },
  lv2WindowOpen: {
    fr: (name: string, level: string, closeDate: string) => `ZekoulABia: La période de choix de la LV2 pour ${level} est ouverte jusqu'au ${closeDate}. Merci de faire le choix de ${name} depuis son compte élève.`,
    en: (name: string, level: string, closeDate: string) => `ZekoulABia: The LV2 choice period for ${level} is open until ${closeDate}. Please submit ${name}'s choice from their student account.`,
  },
  minesecOverdue: {
    fr: (name: string, amount: string, types: string) => `ZekoulABia: RAPPEL — Frais MINESEC (${types}) de ${amount} XAF en retard pour ${name}. Ce paiement se fait exclusivement sur cartescolaire.cm.`,
    en: (name: string, amount: string, types: string) => `ZekoulABia: REMINDER — MINESEC fees (${types}) of ${amount} XAF overdue for ${name}. This payment is made exclusively on cartescolaire.cm.`,
  },
  onboardingLink: {
    // Le lien est inclus directement dans le SMS (pas seulement "consultez votre email") : le
    // contact peut n'avoir aucune adresse email du tout (Axe 2, Plan_Diversite_Numerique) — le
    // SMS doit rester exploitable seul, sans dépendre du canal email.
    fr: (nomProvisoire: string, schoolName: string, expiryDays: number, formUrl: string) => `ZekoulABia: ${schoolName} vous invite à compléter le dossier d'inscription de ${nomProvisoire} (valable ${expiryDays} jours) : ${formUrl}`,
    en: (nomProvisoire: string, schoolName: string, expiryDays: number, formUrl: string) => `ZekoulABia: ${schoolName} invites you to complete ${nomProvisoire}'s enrollment file (valid ${expiryDays} days): ${formUrl}`,
  },
  onboardingReminder: {
    fr: (nomProvisoire: string, schoolName: string, formUrl: string) => `ZekoulABia: RAPPEL — Le dossier d'inscription de ${nomProvisoire} pour ${schoolName} n'est pas encore complété : ${formUrl}`,
    en: (nomProvisoire: string, schoolName: string, formUrl: string) => `ZekoulABia: REMINDER — ${nomProvisoire}'s enrollment file for ${schoolName} is not yet completed: ${formUrl}`,
  },
  onboardingActivated: {
    fr: (schoolName: string, setupUrl: string) => `ZekoulABia: Le dossier d'inscription a été validé par ${schoolName}. Configurez votre mot de passe : ${setupUrl}`,
    en: (schoolName: string, setupUrl: string) => `ZekoulABia: The enrollment file has been validated by ${schoolName}. Set up your password: ${setupUrl}`,
  },
  // accessMode=SMS_ONLY : aucun lien d'activation n'est jamais envoyé (le contact n'a aucun
  // dispositif capable de l'ouvrir) — le compte existe, mais sa configuration se fait en
  // présentiel à l'établissement.
  onboardingActivatedSmsOnly: {
    fr: (schoolName: string) => `ZekoulABia: Le dossier d'inscription a été validé par ${schoolName}. Présentez-vous à l'établissement pour finaliser l'accès au compte.`,
    en: (schoolName: string) => `ZekoulABia: The enrollment file has been validated by ${schoolName}. Please visit the school in person to finalize account access.`,
  },
}

/**
 * Résout la langue du SMS pour un élève : sous-système de l'école, et — en bilingue —
 * la section (FR/EN) de l'élève concerné, afin que le parent reçoive le SMS dans la
 * langue de la section de son enfant.
 */
async function resolveSmsLanguage(schoolId: string, studentId: string): Promise<Language> {
  try {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } })
    if (school?.subsystem !== 'BILINGUAL') return resolveLanguage(school?.subsystem)
    const sp = await prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: {
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { section: { select: { code: true } } } } },
          take: 1,
        },
      },
    })
    return resolveLanguage('BILINGUAL', sp?.enrollmentsYearScoped?.[0]?.class?.section?.code ?? null)
  } catch {
    return 'fr'
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function persistLog(data: {
  schoolId: string
  to: string
  content: string
  type: SmsType
  status: string
  simulated: boolean
}): Promise<void> {
  try {
    await prisma.smsLog.create({
      data: {
        schoolId: data.schoolId,
        to: data.to,
        content: data.content,
        status: data.status,
        type: data.type,
        simulated: data.simulated,
      },
    })
  } catch {
    // Log failures are silent — never block the main flow
  }
}

async function getNotifSettings(schoolId: string): Promise<{
  smsAbsences: boolean
  smsPayments: boolean
  smsBulletins: boolean
}> {
  try {
    const s = await prisma.schoolNotificationSettings.findUnique({
      where: { schoolId },
    })
    // Pas encore de paramètres → on adopte les défauts du schéma (tous à true)
    return s ?? { smsAbsences: true, smsPayments: true, smsBulletins: true }
  } catch {
    return { smsAbsences: true, smsPayments: true, smsBulletins: true }
  }
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\s+/g, '').replace(/^\+/, '')
  return digits.startsWith('237') ? digits : `237${digits}`
}

async function dispatchSms(
  schoolId: string,
  rawPhone: string,
  message: string,
  type: SmsType,
  sensitive = false,
): Promise<void> {
  if (!rawPhone) return
  const phone = normalizePhone(rawPhone)

  if (!isSmsConfigured()) {
    const content = sensitive ? '[contenu sensible masqué]' : message
    console.log(`[SMS-SIMULATION] À: ${phone} | Type: ${type} | Message: ${content}`)
    await persistLog({ schoolId, to: phone, content, type, status: 'simulated', simulated: true })
    return
  }

  const result = await sendSMS(phone, message)
  const loggedContent = sensitive ? '[contenu sensible masqué]' : message
  await persistLog({
    schoolId,
    to: phone,
    content: loggedContent,
    type,
    status: result.success ? 'sent' : 'failed',
    simulated: false,
  })
}

async function getParentPhones(studentId: string): Promise<string[]> {
  try {
    const sp = await prisma.studentProfile.findUnique({ where: { userId: studentId } })
    if (!sp) return []

    const links = await prisma.parentStudent.findMany({
      where: { studentProfileId: sp.id },
      include: { parentProfile: { include: { user: { select: { phone: true } } } } },
    })

    return links
      .map((l) => l.parentProfile.user.phone)
      .filter((p): p is string => Boolean(p))
  } catch {
    return []
  }
}

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
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsAbsences) return

    const phones = opts.phones ?? await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const dateStr = opts.date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const subjectPart = opts.subjectName ? (lang === 'fr' ? ` en ${opts.subjectName}` : ` in ${opts.subjectName}`) : ''
    const message = smsTemplates.absence[lang](opts.studentName, dateStr, subjectPart)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'ABSENCE')))
  } catch (err) {
    console.error('[SMS Absence] Erreur inattendue:', err)
  }
}

export async function notifyPaymentSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  amount: number
  parentPhone?: string
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsPayments) return

    const phones = opts.parentPhone
      ? [opts.parentPhone]
      : await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const amountStr = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(opts.amount)
    const message = smsTemplates.payment[lang](opts.studentName, amountStr)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'PAYMENT')))
  } catch (err) {
    console.error('[SMS Paiement] Erreur inattendue:', err)
  }
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
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsPayments) return

    const phones = opts.phones ?? await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const amountStr = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(opts.amount)
    const message = smsTemplates.overdue[lang](opts.studentName, opts.invoiceLabel, amountStr, opts.daysOverdue)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'PAYMENT')))
  } catch (err) {
    console.error('[SMS Overdue Invoice] Erreur inattendue:', err)
  }
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
  try {
    const phones = opts.phones ?? await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const typeLabel = DISCIPLINE_TYPE_LABELS[opts.type]?.[lang] ?? opts.type
    const message = smsTemplates.discipline[lang](opts.studentName, typeLabel, opts.reason)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'DISCIPLINE')))
  } catch (err) {
    console.error('[SMS Discipline] Erreur inattendue:', err)
  }
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
  try {
    if (opts.phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const message = smsTemplates.libraryOverdue[lang](opts.studentName, opts.bookTitle)

    await Promise.all(opts.phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'LIBRARY')))
  } catch (err) {
    console.error('[SMS Library Overdue] Erreur inattendue:', err)
  }
}

/** Variante de getParentPhones exposant aussi l'userId, pour tenter le push avant le SMS. */
export async function getParentContacts(studentId: string): Promise<{ userId: string; phone: string | null }[]> {
  try {
    const sp = await prisma.studentProfile.findUnique({ where: { userId: studentId } })
    if (!sp) return []

    const links = await prisma.parentStudent.findMany({
      where: { studentProfileId: sp.id },
      include: { parentProfile: { include: { user: { select: { id: true, phone: true } } } } },
    })

    return links.map((l) => ({ userId: l.parentProfile.user.id, phone: l.parentProfile.user.phone }))
  } catch {
    return []
  }
}

export async function notifyAbsenceThresholdSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  count: number
  threshold: number
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsAbsences) return

    const phones = await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const message = smsTemplates.absenceThreshold[lang](opts.studentName, opts.count, opts.threshold)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'ABSENCE')))
  } catch (err) {
    console.error('[SMS Seuil Absences] Erreur inattendue:', err)
  }
}

export async function notifyBulletinSms(opts: {
  schoolId: string
  studentId: string
  studentName: string
  periodName: string
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsBulletins) return

    const phones = await getParentPhones(opts.studentId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const message = smsTemplates.bulletin[lang](opts.studentName, opts.periodName)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'BULLETIN')))
  } catch (err) {
    console.error('[SMS Bulletin] Erreur inattendue:', err)
  }
}

/**
 * Résout la langue pour un candidat au concours d'entrée — celui-ci n'a pas encore de
 * compte élève/classe/section à ce stade, on se limite donc à la langue de base de l'école.
 */
async function resolveSchoolBaseLanguage(schoolId: string): Promise<Language> {
  try {
    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } })
    return resolveLanguage(school?.subsystem)
  } catch {
    return 'fr'
  }
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
  try {
    if (!opts.parentPhone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const schoolName = opts.schoolName || (await prisma.school.findUnique({ where: { id: opts.schoolId }, select: { name: true } }))?.name || 'Établissement'
    const message = smsTemplates.admissionProvisoire[lang](opts.candidateName, schoolName, opts.level, opts.examName, opts.nextStep)
    await dispatchSms(opts.schoolId, opts.parentPhone, message, 'ADMISSION')
  } catch (err) {
    console.error('[SMS Admission Provisoire] Erreur inattendue:', err)
  }
}

export async function notifyConcoursNonAdmisSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  schoolName?: string
  level?: string
}): Promise<void> {
  try {
    if (!opts.parentPhone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const schoolName = opts.schoolName || (await prisma.school.findUnique({ where: { id: opts.schoolId }, select: { name: true } }))?.name || 'Établissement'
    const message = smsTemplates.concoursNonAdmis[lang](opts.candidateName, schoolName, opts.level)
    await dispatchSms(opts.schoolId, opts.parentPhone, message, 'ADMISSION')
  } catch (err) {
    console.error('[SMS Concours Non Admis] Erreur inattendue:', err)
  }
}

export async function notifyConcoursListeAttenteSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  schoolName?: string
  level?: string
  rank?: number
}): Promise<void> {
  try {
    if (!opts.parentPhone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const schoolName = opts.schoolName || (await prisma.school.findUnique({ where: { id: opts.schoolId }, select: { name: true } }))?.name || 'Établissement'
    const message = smsTemplates.concoursListeAttente[lang](opts.candidateName, schoolName, opts.level, opts.rank)
    await dispatchSms(opts.schoolId, opts.parentPhone, message, 'ADMISSION')
  } catch (err) {
    console.error('[SMS Concours Liste Attente] Erreur inattendue:', err)
  }
}

export async function notifyConcoursPromotionSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  schoolName?: string
  level?: string
  examName?: string
}): Promise<void> {
  try {
    if (!opts.parentPhone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const schoolName = opts.schoolName || (await prisma.school.findUnique({ where: { id: opts.schoolId }, select: { name: true } }))?.name || 'Établissement'
    const message = smsTemplates.concoursPromotionListeAttente[lang](opts.candidateName, schoolName, opts.level, opts.examName)
    await dispatchSms(opts.schoolId, opts.parentPhone, message, 'ADMISSION')
  } catch (err) {
    console.error('[SMS Concours Promotion] Erreur inattendue:', err)
  }
}

export async function notifyCepResultSms(opts: {
  schoolId: string
  candidateName: string
  parentPhone: string | null
  result: 'REUSSI' | 'ECHOUE'
}): Promise<void> {
  try {
    if (!opts.parentPhone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = opts.result === 'REUSSI'
      ? smsTemplates.cepConfirme[lang](opts.candidateName)
      : smsTemplates.cepAnnule[lang](opts.candidateName)
    await dispatchSms(opts.schoolId, opts.parentPhone, message, 'ADMISSION')
  } catch (err) {
    console.error('[SMS Résultat CEP] Erreur inattendue:', err)
  }
}

export async function notifyPebsSelectionSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  selected: boolean
}): Promise<void> {
  try {
    const phones = await getParentPhones(opts.studentUserId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentUserId)
    const message = opts.selected
      ? smsTemplates.pebsSelectionne[lang](opts.studentName)
      : smsTemplates.pebsNonSelectionne[lang](opts.studentName)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'PEBS')))
  } catch (err) {
    console.error('[SMS Sélection PEBS] Erreur inattendue:', err)
  }
}

export async function notifyMinesecOverdueSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  amount: number
  typesFrais: string
}): Promise<void> {
  try {
    const settings = await getNotifSettings(opts.schoolId)
    if (!settings.smsPayments) return

    const phones = await getParentPhones(opts.studentUserId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentUserId)
    const amountStr = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US').format(opts.amount)
    const message = smsTemplates.minesecOverdue[lang](opts.studentName, amountStr, opts.typesFrais)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'PAYMENT')))
  } catch (err) {
    console.error('[SMS MINESEC Overdue] Erreur inattendue:', err)
  }
}

export async function notifyLv2WindowOpenSms(opts: {
  schoolId: string
  studentUserId: string
  studentName: string
  level: string
  closeDate: Date
}): Promise<void> {
  try {
    const phones = await getParentPhones(opts.studentUserId)
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentUserId)
    const dateStr = opts.closeDate.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
    const message = smsTemplates.lv2WindowOpen[lang](opts.studentName, opts.level, dateStr)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, 'LV2')))
  } catch (err) {
    console.error('[SMS Fenêtre LV2] Erreur inattendue:', err)
  }
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
  try {
    if (!opts.phone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = smsTemplates.onboardingLink[lang](opts.nomProvisoire, opts.schoolName, opts.expiryDays, opts.formUrl)
    await dispatchSms(opts.schoolId, opts.phone, message, 'ONBOARDING')
  } catch (err) {
    console.error('[SMS Onboarding Lien] Erreur inattendue:', err)
  }
}

export async function notifyOnboardingReminderSms(opts: {
  schoolId: string
  nomProvisoire: string
  schoolName: string
  phone: string | null
  formUrl: string
}): Promise<void> {
  try {
    if (!opts.phone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = smsTemplates.onboardingReminder[lang](opts.nomProvisoire, opts.schoolName, opts.formUrl)
    await dispatchSms(opts.schoolId, opts.phone, message, 'ONBOARDING')
  } catch (err) {
    console.error('[SMS Onboarding Relance] Erreur inattendue:', err)
  }
}

export async function notifyOnboardingActivatedSms(opts: {
  schoolId: string
  schoolName: string
  phone: string | null
  setupUrl: string
}): Promise<void> {
  try {
    if (!opts.phone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = smsTemplates.onboardingActivated[lang](opts.schoolName, opts.setupUrl)
    await dispatchSms(opts.schoolId, opts.phone, message, 'ONBOARDING')
  } catch (err) {
    console.error('[SMS Onboarding Activé] Erreur inattendue:', err)
  }
}

/** accessMode=SMS_ONLY : jamais de lien (le contact n'a aucun dispositif capable de l'ouvrir). */
export async function notifyOnboardingActivatedSmsOnly(opts: {
  schoolId: string
  schoolName: string
  phone: string | null
}): Promise<void> {
  try {
    if (!opts.phone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = smsTemplates.onboardingActivatedSmsOnly[lang](opts.schoolName)
    await dispatchSms(opts.schoolId, opts.phone, message, 'ONBOARDING')
  } catch (err) {
    console.error('[SMS Onboarding Activé (SMS_ONLY)] Erreur inattendue:', err)
  }
}

export async function notifyCredentialsSms(opts: {
  schoolId: string
  phone: string | null
  roleLabel: string
  loginIdentifier: string
  temporaryPassword: string
}): Promise<void> {
  try {
    if (!opts.phone) return
    await dispatchSms(
      opts.schoolId,
      opts.phone,
      `ZekoulABia - ${opts.roleLabel}. Login: ${opts.loginIdentifier}. Mot de passe temporaire: ${opts.temporaryPassword}. Changez-le à la première connexion.`,
      'ONBOARDING',
      true,
    )
  } catch (err) {
    console.error('[SMS Identifiants] Erreur inattendue:', err)
  }
}
