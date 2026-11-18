import type { MasterTeamRole } from '../../_api'

export type TeamTranslateFn = (key: string, params?: Record<string, string | number>) => string

export interface RoleLabelMeta {
  label: string
  desc: string
  bg: string
  color: string
}

export function getRoleLabels(t: TeamTranslateFn): Record<MasterTeamRole, RoleLabelMeta> {
  return {
    SUPER_ADMIN: {
      label: 'Super Admin',
      desc: t('team.role_super_desc'),
      bg: 'var(--amber-light)',
      color: 'var(--primary)',
    },
    PLATFORM_ADMIN: {
      label: 'Platform Admin',
      desc: t('team.role_platform_desc'),
      bg: 'rgba(59, 130, 246, 0.14)',
      color: 'var(--blue)',
    },
    SCHOOL_MANAGER: {
      label: 'School Manager',
      desc: t('team.role_school_desc'),
      bg: 'rgba(217, 119, 6, 0.14)',
      color: 'var(--amber)',
    },
    SUPPORT: {
      label: 'Support',
      desc: t('team.role_support_desc'),
      bg: 'rgba(100, 116, 139, 0.14)',
      color: 'var(--text2)',
    },
  }
}

export function formatCreatedLabel(t: TeamTranslateFn, count: number): string {
  if (count === 0) return t('team.created_zero')
  if (count === 1) return t('team.created_one')
  return t('team.created_other', { count })
}

export function formatAssignedLabel(t: TeamTranslateFn, count: number): string {
  if (count === 0) return t('team.assigned_zero')
  if (count === 1) return t('team.assigned_one')
  return t('team.assigned_other', { count })
}
