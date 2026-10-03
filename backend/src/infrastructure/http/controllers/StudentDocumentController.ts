import type { Request, Response, NextFunction } from 'express';
import type { StudentProfileRepository } from '@domain/ports/repositories/StudentProfileRepository';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { StudentDocumentRepository } from '@domain/ports/repositories/StudentDocumentRepository';
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import {
  generateCertificatPdf,
  generateCarteScolairepdf,
  generateLettreTransfertPdf,
} from '../../pdf/school-documents/SchoolDocumentPdfRenderer';
import { resolveLanguage } from '../../../domain/policies/LanguagePolicy';

const VERIFY_BASE = process.env.CLIENT_URL || 'http://localhost:3000';

function classeActuelle(student: { enrollmentsYearScoped: { class: { name: string; section: { code: string } | null } | null }[] | undefined }) {
  return student?.enrollmentsYearScoped?.[0]?.class ?? null;
}

export class StudentDocumentController {
  constructor(
    private readonly studentProfileRepository: StudentProfileRepository,
    private readonly schoolRepository: SchoolRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly bulletinRepository: BulletinRepository,
    private readonly documentRepository: StudentDocumentRepository,
    private readonly parentRepository?: ParentRepository,
  ) {}

  private async fetchStudent(userId: string, schoolId: string) {
    return this.studentProfileRepository.findForDocument(userId, schoolId);
  }

  private async fetchSchool(schoolId: string) {
    const school = await this.schoolRepository.findById(schoolId);
    return school
      ? { name: school.name, city: undefined, phone: undefined, logoUrl: undefined, subsystem: school.subsystem }
      : null;
  }

  private async fetchCurrentYear(schoolId: string) {
    return this.anneeRepository.findCourante(schoolId);
  }

  // ─── GET /api/v2/students/my/certificat (Accès direct élève connecté) ──
  getMyCertificat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    req.params.id = req.user.userId;
    return this.getCertificat(req, res, next);
  };

  // ─── GET /api/v2/students/my/carte (Accès direct élève connecté) ──────
  getMyCarte = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    req.params.id = req.user.userId;
    return this.getCarte(req, res, next);
  };

  // ─── GET /api/v2/students/:id/certificat ─────────────────────
  getCertificat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const studentUserId = req.params.id as string;

      if (user.role === 'PARENT' && this.parentRepository) {
        const aAcces = await this.parentRepository.aAccesEleve(user.userId, studentUserId);
        if (!aAcces) {
          res.status(403).json({ success: false, message: 'Accès non autorisé : cet élève ne fait pas partie de vos enfants' });
          return;
        }
      }

      const student = await this.fetchStudent(studentUserId, user.schoolId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      const [school, year] = await Promise.all([
        this.fetchSchool(user.schoolId),
        this.fetchCurrentYear(user.schoolId),
      ]);

      const studentName = `${student.user.lastName} ${student.user.firstName}`;

      const doc = await this.documentRepository.create({
        type: 'CERTIFICATE',
        studentId: student.id,
        schoolId: user.schoolId,
        dataSnapshot: {
          studentName,
          matricule: student.matricule ?? null,
          className: classeActuelle(student)?.name ?? '—',
          yearName: year?.name ?? '—',
          status: student.studentStatus,
        },
      });

      const lang = resolveLanguage(school?.subsystem, classeActuelle(student)?.section?.code ?? null)
      const pdf = await generateCertificatPdf({
        documentId: doc.id,
        school: {
          name: school?.name ?? 'Établissement',
          ville: school?.city ?? undefined,
          tel: school?.phone ?? undefined,
        },
        studentName,
        matricule: student.matricule ?? undefined,
        className: classeActuelle(student)?.name ?? '—',
        yearName: year?.name ?? '—',
        dateOfBirth: student.dateOfBirth
          ? student.dateOfBirth.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { timeZone: 'UTC' })
          : undefined,
        gender: student.gender ?? undefined,
        status: student.studentStatus,
        generatedAt: new Date(),
        verifyUrl: `${VERIFY_BASE}/verify/${doc.id}`,
        language: lang,
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="certificat-${student.matricule ?? studentUserId}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err) {
      next(err);
    }
  };

  // ─── GET /api/v2/students/:id/carte ──────────────────────────
  getCarte = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const studentUserId = req.params.id as string;

      if (user.role === 'PARENT' && this.parentRepository) {
        const aAcces = await this.parentRepository.aAccesEleve(user.userId, studentUserId);
        if (!aAcces) {
          res.status(403).json({ success: false, message: 'Accès non autorisé : cet élève ne fait pas partie de vos enfants' });
          return;
        }
      }

      const student = await this.fetchStudent(studentUserId, user.schoolId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      const [school, year] = await Promise.all([
        this.fetchSchool(user.schoolId),
        this.fetchCurrentYear(user.schoolId),
      ]);

      const studentName = `${student.user.lastName} ${student.user.firstName}`;
      const parent = student.parents[0]?.parentProfile?.user;

      const doc = await this.documentRepository.create({
        type: 'STUDENT_CARD',
        studentId: student.id,
        schoolId: user.schoolId,
        dataSnapshot: {
          studentName,
          matricule: student.matricule ?? null,
          className: classeActuelle(student)?.name ?? '—',
          yearName: year?.name ?? '—',
        },
      });

      const lang = resolveLanguage(school?.subsystem, classeActuelle(student)?.section?.code ?? null)
      const pdf = await generateCarteScolairepdf({
        documentId: doc.id,
        school: {
          name: school?.name ?? 'Établissement',
          ville: school?.city ?? undefined,
        },
        studentName,
        matricule: student.matricule ?? undefined,
        className: classeActuelle(student)?.name ?? '—',
        yearName: year?.name ?? '—',
        photoUrl: student.photoUrl ?? undefined,
        emergencyContact: parent ? `${parent.lastName} ${parent.firstName}` : undefined,
        emergencyPhone: parent?.phone ?? student.user.phone ?? undefined,
        generatedAt: new Date(),
        verifyUrl: `${VERIFY_BASE}/verify/${doc.id}`,
        language: lang,
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="carte-scolaire-${student.matricule ?? studentUserId}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err) {
      next(err);
    }
  };

  // ─── GET /api/v2/students/:id/lettre-transfert ───────────────
  getLettreTransfert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const studentUserId = req.params.id as string;
      const motif = (req.query.motif as string | undefined) ?? '';

      const student = await this.fetchStudent(studentUserId, user.schoolId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      if (!['TRANSFERRED', 'LEFT', 'GRADUATED'].includes(student.studentStatus)) {
        res.status(400).json({
          success: false,
          message: "La lettre de transfert n'est disponible que pour les élèves transférés ou sortis.",
        });
        return;
      }

      const [school, year, lastBulletin] = await Promise.all([
        this.fetchSchool(user.schoolId),
        this.fetchCurrentYear(user.schoolId),
        this.bulletinRepository.findPreviousByStudent(studentUserId, user.schoolId),
      ]);

      const studentName = `${student.user.lastName} ${student.user.firstName}`;

      const doc = await this.documentRepository.create({
        type: 'TRANSFER_LETTER',
        studentId: student.id,
        schoolId: user.schoolId,
        dataSnapshot: {
          studentName,
          matricule: student.matricule ?? null,
          className: classeActuelle(student)?.name ?? '—',
          yearName: year?.name ?? '—',
          motif: motif || student.studentStatus,
        },
      });

      const lang = resolveLanguage(school?.subsystem, classeActuelle(student)?.section?.code ?? null)
      const pdf = await generateLettreTransfertPdf({
        documentId: doc.id,
        school: {
          name: school?.name ?? 'Établissement',
          ville: school?.city ?? undefined,
          tel: school?.phone ?? undefined,
        },
        studentName,
        matricule: student.matricule ?? undefined,
        className: classeActuelle(student)?.name ?? '—',
        yearName: year?.name ?? '—',
        motif: motif || student.studentStatus,
        lastAverage: lastBulletin?.generalAverage ?? undefined,
        generatedAt: new Date(),
        verifyUrl: `${VERIFY_BASE}/verify/${doc.id}`,
        language: lang,
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="transfert-${student.matricule ?? studentUserId}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err) {
      next(err);
    }
  };

  // ─── GET /api/v2/verify/:documentId (PUBLIC) ─────────────────
  verifyDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const documentId = req.params.documentId as string;

      const doc = await this.documentRepository.findById(documentId);

      if (!doc) {
        // Recherche dans les bulletins de notes (ReportCard)
        const bulletin = await this.bulletinRepository.findById(documentId);
        if (bulletin) {
          const bObj = bulletin.toObject();
          const school = await this.schoolRepository.findById(bObj.schoolId);
          const studentProfile = await this.studentProfileRepository.findForDocument(bObj.studentId, bObj.schoolId);
          const studentName = studentProfile?.user
            ? `${studentProfile.user.lastName} ${studentProfile.user.firstName}`
            : 'Élève';

          res.json({
            success: true,
            document: {
              id: bObj.id.slice(0, 8).toUpperCase(),
              type: 'Bulletin de notes',
              school: school?.name ?? '—',
              generatedAt: bObj.createdAt,
              data: {
                studentName,
                matricule: studentProfile?.matricule ?? null,
                className: classeActuelle(studentProfile)?.name ?? '—',
                generalAverage: bObj.generalAverage != null ? `${bObj.generalAverage.toFixed(2)} / 20` : '—',
                rank: bObj.rank && bObj.totalStudents ? `${bObj.rank} / ${bObj.totalStudents}` : bObj.rank ?? '—',
                mention: bObj.mention ?? '—',
              },
              authentic: true,
            },
          });
          return;
        }

        res.status(404).json({ success: false, message: 'Document introuvable ou invalide.' });
        return;
      }

      const school = await this.schoolRepository.findById(doc.schoolId);

      const typeLabel: Record<string, string> = {
        CERTIFICATE: 'Certificat de scolarité',
        STUDENT_CARD: "Carte d'identité scolaire",
        TRANSFER_LETTER: 'Lettre de transfert',
        REPORT_CARD: 'Bulletin de notes',
      };

      res.json({
        success: true,
        document: {
          id: doc.id.slice(0, 8).toUpperCase(),
          type: typeLabel[doc.type] ?? doc.type,
          school: school?.name ?? '—',
          generatedAt: doc.generatedAt,
          data: doc.dataSnapshot,
          authentic: true,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
