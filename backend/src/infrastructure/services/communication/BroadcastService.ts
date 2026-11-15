import type { PrismaClient, Prisma, UserRole } from '@prisma/client';
import { sendSMS, isSmsConfigured } from '../../services/sms/SmsService.ts';
import { sendTransactionalEmail } from '../../services/email/EmailService.ts';
import { whereProfilesParClasse, whereProfilesParClasses } from '@application/shared/studentEnrollment';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BroadcastChannel = 'SMS' | 'EMAIL' | 'BOTH';

export interface BroadcastTarget {
  role?: 'STUDENT' | 'PARENT' | 'TEACHER' | 'STAFF';
  classId?: string;
  level?: string;
  paymentStatus?: 'OVERDUE' | 'PENDING' | 'PARTIAL' | 'PAID';
}

export interface Recipient {
  name: string;
  phone?: string | null;
  email?: string | null;
  userId?: string;
  className?: string;
  balance?: number;
}

export interface BroadcastResultat {
  total: number;
  sent: number;
  failed: number;
}

// ─── Variable interpolation ───────────────────────────────────────────────────

const VARS_RE = /\{(nom_eleve|classe|solde)\}/g;

function interpolate(
  template: string,
  vars: { nom_eleve?: string; classe?: string; solde?: string },
): string {
  return template.replace(VARS_RE, (_, key: string) => {
    if (key === 'nom_eleve') return vars.nom_eleve ?? '{nom_eleve}';
    if (key === 'classe') return vars.classe ?? '{classe}';
    if (key === 'solde') return vars.solde ?? '{solde}';
    return `{${key}}`;
  });
}

// ─── Phone normalization ──────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s+]/g, '');
  return digits.startsWith('237') ? digits : `237${digits}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class BroadcastService {
  constructor(private readonly prisma: PrismaClient) {}

  async resolveRecipients(schoolId: string, target: BroadcastTarget): Promise<Recipient[]> {
    const recipients: Recipient[] = [];

    if (target.classId || target.level || target.paymentStatus) {
      const studentWhere: Prisma.StudentProfileWhereInput = { user: { schoolId } };
      if (target.classId) Object.assign(studentWhere, whereProfilesParClasse(target.classId));
      if (target.level) {
        const classes = await this.prisma.class.findMany({
          where: { schoolId, level: target.level },
          select: { id: true },
        });
        Object.assign(studentWhere, whereProfilesParClasses(classes.map((c) => c.id)));
      }

      const students = await this.prisma.studentProfile.findMany({
        where: studentWhere,
        include: {
          user: { select: { firstName: true, lastName: true } },
          enrollmentsYearScoped: {
            where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
            select: { class: { select: { name: true } } },
            take: 1,
          },
          parents: {
            include: {
              parentProfile: {
                include: { user: { select: { id: true, phone: true, email: true } } },
              },
            },
          },
        },
      });

      for (const student of students) {
        if (target.paymentStatus) {
          const latestInvoice = await this.prisma.invoice.findFirst({
            where: { schoolId, studentId: student.userId },
            orderBy: { createdAt: 'desc' },
            select: { status: true },
          });
          if (!latestInvoice) continue;
          if (target.paymentStatus === 'OVERDUE' && latestInvoice.status !== 'OVERDUE') continue;
          if (target.paymentStatus === 'PENDING' && latestInvoice.status !== 'PENDING') continue;
          if (target.paymentStatus === 'PARTIAL' && latestInvoice.status !== 'PARTIAL') continue;
          if (target.paymentStatus === 'PAID' && latestInvoice.status !== 'PAID') continue;
        }

        const studentName = `${student.user.lastName} ${student.user.firstName}`;
        const className = student.enrollmentsYearScoped?.[0]?.class?.name ?? '';

        const invoices = await this.prisma.invoice.findMany({
          where: { schoolId, studentId: student.userId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
          select: { amount: true, payments: { where: { status: 'SUCCESS' }, select: { amount: true } } },
        });
        const balance: number = invoices.reduce((acc, inv) => {
          const paye = inv.payments.reduce((s, p) => s + p.amount, 0);
          return acc + Math.max(0, inv.amount - paye);
        }, 0);

        for (const link of student.parents) {
          const parentUser = link.parentProfile.user;
          recipients.push({
            name: studentName,
            phone: parentUser.phone,
            email: parentUser.email,
            userId: parentUser.id,
            className,
            balance,
          });
        }
      }

      return recipients;
    }

    if (target.role) {
      const users = await this.prisma.user.findMany({
        where: { schoolId, role: target.role as UserRole, isActive: true },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      });
      for (const u of users) {
        recipients.push({
          name: `${u.lastName} ${u.firstName}`,
          phone: u.phone,
          email: u.email,
          userId: u.id,
        });
      }
      return recipients;
    }

    return recipients;
  }

  async executer(
    schoolId: string,
    createdById: string | undefined,
    target: BroadcastTarget,
    channel: BroadcastChannel,
    message: string,
  ): Promise<BroadcastResultat> {
    const recipients = await this.resolveRecipients(schoolId, target);
    if (recipients.length === 0) {
      return { total: 0, sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const r of recipients) {
      const vars = {
        nom_eleve: r.name,
        classe: r.className,
        solde: r.balance != null ? new Intl.NumberFormat('fr-FR').format(r.balance) + ' XAF' : undefined,
      };
      const personalizedMsg = interpolate(message, vars);

      if ((channel === 'SMS' || channel === 'BOTH') && r.phone) {
        const result = await this.dispatchSmsToOne(schoolId, r.phone, personalizedMsg);
        result === 'failed' ? failed++ : sent++;
      }
      if ((channel === 'EMAIL' || channel === 'BOTH') && r.email) {
        const result = await this.dispatchEmailToOne(schoolId, r.email, personalizedMsg, r.userId);
        result === 'failed' ? failed++ : sent++;
      }
      if (!r.phone && !r.email) failed++;
    }

    await this.prisma.broadcastLog.create({
      data: {
        schoolId,
        channel,
        target: target as unknown as Prisma.InputJsonValue,
        message,
        recipientCount: recipients.length,
        sentCount: sent,
        failedCount: failed,
        status: failed === 0 ? 'completed' : sent === 0 ? 'failed' : 'partial',
        createdById,
      },
    });

    return { total: recipients.length, sent, failed };
  }

  async listHistory(
    schoolId: string,
    page = 1,
    limit = 20,
  ): Promise<{ logs: unknown[]; total: number; page: number; limit: number }> {
    const safePage = Math.max(1, Math.trunc(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit) || 20));
    const skip = (safePage - 1) * safeLimit;
    const [logs, total] = await Promise.all([
      this.prisma.broadcastLog.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.broadcastLog.count({ where: { schoolId } }),
    ]);
    return { logs, total, page: safePage, limit: safeLimit };
  }

  private async dispatchSmsToOne(
    schoolId: string,
    rawPhone: string,
    message: string,
  ): Promise<'sent' | 'simulated' | 'failed'> {
    const phone = normalizePhone(rawPhone);
    try {
      if (!isSmsConfigured()) {
        console.info(`[SMS-BROADCAST-SIM] À: ${phone} | ${message}`);
        await this.prisma.smsLog.create({
          data: { schoolId, to: phone, content: message, type: 'BROADCAST', status: 'simulated', simulated: true },
        });
        return 'simulated';
      }
      const result = await sendSMS(phone, message);
      await this.prisma.smsLog.create({
        data: {
          schoolId,
          to: phone,
          content: message,
          type: 'BROADCAST',
          status: result.success ? 'sent' : 'failed',
          simulated: false,
        },
      });
      return result.success ? 'sent' : 'failed';
    } catch {
      return 'failed';
    }
  }

  private async dispatchEmailToOne(
    schoolId: string,
    recipientEmail: string,
    message: string,
    recipientUserId?: string,
  ): Promise<'sent' | 'failed'> {
    try {
      const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">${message.replace(/\n/g, '<br>')}</div>`;
      const result = await sendTransactionalEmail({
        recipientEmail,
        recipientUserId,
        subject: 'Message de votre établissement',
        html,
        text: message,
        template: 'broadcast',
        eventType: 'discipline_notification',
        metadata: { schoolId },
      });
      await this.prisma.emailLog.create({
        data: {
          schoolId,
          to: recipientEmail,
          subject: 'Message de votre établissement',
          status: result.status,
          provider: 'broadcast',
        },
      });
      return result.status;
    } catch {
      return 'failed';
    }
  }
}

// ─── Compat wrappers (preserve exported `executerBroadcast`/`resolveRecipients` for core.ts) ─

export async function executerBroadcast(
  prisma: PrismaClient,
  schoolId: string,
  createdById: string | undefined,
  target: BroadcastTarget,
  channel: BroadcastChannel,
  message: string,
): Promise<BroadcastResultat> {
  return new BroadcastService(prisma).executer(schoolId, createdById, target, channel, message);
}

export async function resolveRecipients(
  prisma: PrismaClient,
  schoolId: string,
  target: BroadcastTarget,
): Promise<Recipient[]> {
  return new BroadcastService(prisma).resolveRecipients(schoolId, target);
}
