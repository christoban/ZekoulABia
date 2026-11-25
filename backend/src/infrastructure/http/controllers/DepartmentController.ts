import type { Request, Response, NextFunction } from 'express';
import type { DepartmentRepository } from '@domain/ports/repositories/DepartmentRepository';
import type { StaffProfileRepository } from '@domain/ports/repositories/StaffProfileRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import { getPermissionsPourTitre } from '@domain/rules/StaffPermissionRules';

export class DepartmentController {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly staffProfileRepository: StaffProfileRepository,
    private readonly userRepository: UserRepository,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const departments = await this.departmentRepository.findBySchool(user.schoolId);
      res.json({ success: true, data: departments });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { name, color } = req.body as { name?: string; color?: string };
      if (!name?.trim()) {
        res.status(400).json({ success: false, message: 'Le nom du département est requis' });
        return;
      }

      const existing = await this.departmentRepository.findByName(user.schoolId, name.trim());
      if (existing) {
        res.status(409).json({ success: false, message: `Le département '${name}' existe déjà` });
        return;
      }

      const department = await this.departmentRepository.create({
        schoolId: user.schoolId, name: name.trim(), color: color ?? '#6b7280',
      });
      res.status(201).json({ success: true, data: department });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const departmentId = req.params.id as string;
      const { name, color, headId, subjectIds } = req.body as {
        name?: string; color?: string; headId?: string | null; subjectIds?: string[];
      };

      const department = await this.departmentRepository.findByIdAndSchool(departmentId, user.schoolId);
      if (!department) {
        res.status(404).json({ success: false, message: 'Département introuvable' });
        return;
      }

      const data: { name?: string; color?: string; headId?: string | null } = {};
      if (name?.trim()) data.name = name.trim();
      if (color) data.color = color;

      const apPermissions = getPermissionsPourTitre('Animateur Pédagogique');

      if (headId !== undefined) {
        const newHeadId = headId || null;
        const headChanged = newHeadId !== department.headId;

        if (headChanged && department.headId) {
          await this.staffProfileRepository.retirerAP(department.headId, apPermissions);
        }

        if (headChanged && newHeadId) {
          // Vérifier que le nouveau head est un enseignant
          const newHead = await this.userRepository.findEmployeeById(newHeadId, user.schoolId);
          if (!newHead || newHead.role !== 'TEACHER') {
            res.status(400).json({ success: false, message: 'L\'Animateur Pédagogique doit être un enseignant (TEACHER).' });
            return;
          }

          // Un enseignant ne peut être Animateur Pédagogique que d'un seul département
          const deptExistant = await this.departmentRepository.findDepartmentHeadingByHead(newHeadId, departmentId);
          if (deptExistant) {
            res.status(409).json({
              success: false,
              message: `${newHead.firstName} ${newHead.lastName} est déjà Animateur Pédagogique du département "${deptExistant.name}". Un enseignant ne peut être AP que d'un seul département.`,
            });
            return;
          }
        }

        data.headId = newHeadId;
      }

      if (Array.isArray(subjectIds)) {
        await this.departmentRepository.detacherMatieres(departmentId);
        if (subjectIds.length > 0) {
          await this.departmentRepository.rattacherMatieres(departmentId, subjectIds);
        }
      }

      const effectiveHeadId = headId !== undefined ? (headId || null) : department.headId;
      const effectiveSubjectIds = Array.isArray(subjectIds) ? subjectIds : (department.subjects ?? []).map(s => s.id);
      if (effectiveHeadId) {
        await this.staffProfileRepository.assignerAP(effectiveHeadId, user.schoolId, apPermissions, effectiveSubjectIds);
      }

      const updated = await this.departmentRepository.updateWithHead(departmentId, data);
      res.json({ success: true, data: updated });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const departmentId = req.params.id as string;

      const department = await this.departmentRepository.findByIdAndSchool(departmentId, user.schoolId);
      if (!department) {
        res.status(404).json({ success: false, message: 'Département introuvable' });
        return;
      }
      if ((department.subjects ?? []).length > 0) {
        res.status(400).json({ success: false, message: 'Supprimez d\'abord les matières de ce département' });
        return;
      }

      await this.departmentRepository.delete(departmentId);
      res.json({ success: true, message: 'Département supprimé' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  // GET /:id/performance — moyennes par enseignant·matière·classe dans ce département
  performance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const departmentId = req.params.id as string;

      const dept = await this.departmentRepository.findByIdAndSchool(departmentId, user.schoolId);
      if (!dept) {
        res.status(404).json({ success: false, message: 'Département introuvable' });
        return;
      }

      const subjectIds = (dept.subjects ?? []).map(s => s.id);
      if (subjectIds.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }

      const assignments = await this.departmentRepository.findAssignmentsForSubjectIds(user.schoolId, subjectIds);

      const grades = await this.departmentRepository.findGradesForSubjectIds(user.schoolId, subjectIds);

      const gradeIndex = new Map<string, number[]>();
      for (const g of grades) {
        const key = `${g.subjectId}__${g.classId}`;
        if (!gradeIndex.has(key)) gradeIndex.set(key, []);
        if (g.sequenceAverage !== null) gradeIndex.get(key)!.push(g.sequenceAverage);
      }

      const data = assignments.map(a => {
        const key = `${a.subjectId}__${a.classId}`;
        const avgs = gradeIndex.get(key) ?? [];
        // ponytail: simple avg, stdlib 1-liner — centralize when weighted coeffs diverge
        const moyenne = avgs.length > 0 ? Math.round((avgs.reduce((s, v) => s + v, 0) / avgs.length) * 100) / 100 : null;
        return {
          teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
          subjectName: a.subject.name,
          className: a.class.name,
          moyenne,
          nbEleves: avgs.length,
        };
      });

      res.json({ success: true, data });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
