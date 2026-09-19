import type { LucideIcon } from 'lucide-react'
import type { MasterUserDto, SchoolDto, AuditLogDto, SchoolDetailDto } from './_api'

export type { MasterUserDto, SchoolDto, AuditLogDto, SchoolDetailDto }

export type Section = 'overview' | 'schools' | 'referentiels' | 'logs'
export type ReferentielModule = 'calendar' | 'bac' | 'templates' | 'progressions' | 'tarifs'
export type SchoolTab = 'all' | 'pending' | 'approved' | 'active' | 'suspended' | 'draft' | 'rejected'
export type LogTab = 'emails' | 'auth' | 'security'
export type ModalId =
  | 'invite' | 'approve' | 'reject' | 'suspend' | 'delete'
  | 'changePwd' | 'enableMfa' | 'disableMfa' | 'regenCodes' | 'recoveryCodes'
  | 'confirmAction'
  | null

export interface ConfirmActionTarget {
  title: string
  description: string
  icon: LucideIcon
  danger?: boolean
  execute: (sensitiveAuth: { password: string; code?: string }) => Promise<void>
  successMsg: string
}

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface SchoolRow {
  id: string
  name: string
  subdomain: string
  type: string
  plan: 'deco' | 'std' | 'prem'
  status: 'active' | 'pending' | 'approved' | 'suspended' | 'draft' | 'rejected'
  adminEmail: string
  inviteStatus: string
  inviteExpiry?: string
  createdAt: string
}

export interface KpiData {
  activeSchools: number
  pendingSchools: number
  pendingInvites: number
  newThisMonth: number
  totalSchools: number
  suspendedCount: number
}

export interface ActivityRow {
  date: string
  badge: 'active' | 'pending' | 'suspended' | 'approved' | 'rejected'
  action: string
  school: string
  operator: string
}
