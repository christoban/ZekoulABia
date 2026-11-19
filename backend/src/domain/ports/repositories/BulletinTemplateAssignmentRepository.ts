import type { BulletinGroupingScheme, BulletinPeriodKind, BulletinTemplate } from '@domain/types/enums';
import type { BulletinTemplateAssignmentRule } from '@domain/policies/BulletinTemplatePolicy';

export interface SaveBulletinTemplateAssignmentInput {
  schoolId: string;
  classLevel?: string | null;
  classId?: string | null;
  periodKind: BulletinPeriodKind;
  template: BulletinTemplate;
  templateSpecId: string;
  templateVersion?: number;
  groupingScheme?: BulletinGroupingScheme | null;
  isActive?: boolean;
}

export interface BulletinTemplateAssignmentRepository {
  findBySchool(schoolId: string): Promise<BulletinTemplateAssignmentRule[]>;
  save(input: SaveBulletinTemplateAssignmentInput): Promise<BulletinTemplateAssignmentRule>;
  delete(id: string, schoolId: string): Promise<void>;
}
