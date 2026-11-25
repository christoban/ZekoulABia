import { prisma } from '@infrastructure/persistence/prisma/prisma.client'
import { sendSMS, isSmsConfigured } from './SmsService.ts'
import { resolveLanguage, type Language } from '../../../domain/policies/LanguagePolicy.ts'
import type { SmsType } from './smsNotificationTemplates.ts'

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

export async function resolveSchoolName(schoolId: string, providedName?: string): Promise<string> {
  if (providedName) return providedName
  return (await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } }))?.name || 'Établissement'
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
    console.info(`[SMS-SIMULATION] À: ${phone} | Type: ${type} | Message: ${content}`)
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

// ── Shared notification orchestration helpers ──────────────────────────────

export async function sendStudentNotification(opts: {
  schoolId: string
  studentId: string
  type: SmsType
  settingKey?: 'smsAbsences' | 'smsPayments' | 'smsBulletins'
  phones?: string[]
  logLabel: string
  buildMessage: (lang: Language) => string
}): Promise<void> {
  try {
    if (opts.settingKey) {
      const settings = await getNotifSettings(opts.schoolId)
      if (!settings[opts.settingKey]) return
    }

    const phones = opts.phones ?? (await getParentPhones(opts.studentId))
    if (phones.length === 0) return

    const lang = await resolveSmsLanguage(opts.schoolId, opts.studentId)
    const message = opts.buildMessage(lang)

    await Promise.all(phones.map((phone) => dispatchSms(opts.schoolId, phone, message, opts.type)))
  } catch (err) {
    console.error(`[${opts.logLabel}] Erreur inattendue:`, err)
  }
}

export async function sendSchoolNotification(opts: {
  schoolId: string
  phone: string | null
  type: SmsType
  logLabel: string
  buildMessage: (lang: Language) => Promise<string> | string
}): Promise<void> {
  try {
    if (!opts.phone) return
    const lang = await resolveSchoolBaseLanguage(opts.schoolId)
    const message = await opts.buildMessage(lang)
    await dispatchSms(opts.schoolId, opts.phone, message, opts.type)
  } catch (err) {
    console.error(`[${opts.logLabel}] Erreur inattendue:`, err)
  }
}

export async function sendRawSms(opts: {
  schoolId: string
  phone: string | null
  message: string
  type: SmsType
  sensitive?: boolean
  logLabel: string
}): Promise<void> {
  try {
    if (!opts.phone) return
    await dispatchSms(opts.schoolId, opts.phone, opts.message, opts.type, opts.sensitive)
  } catch (err) {
    console.error(`[${opts.logLabel}] Erreur inattendue:`, err)
  }
}

export async function sendGenericAlertBatch(opts: {
  schoolId: string
  phones: string[]
  message: string
  logLabel: string
}): Promise<void> {
  try {
    const phones = [...new Set(opts.phones.filter(Boolean))]
    for (const phone of phones) {
      await dispatchSms(opts.schoolId, phone, opts.message, 'ABSENCE')
    }
  } catch (err) {
    console.error(`[${opts.logLabel}] Erreur inattendue:`, err)
  }
}
