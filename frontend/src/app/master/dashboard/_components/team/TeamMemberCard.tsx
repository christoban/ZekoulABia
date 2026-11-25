'use client'

import type React from 'react'
import { Crown, KeyRound, Ban, CheckCircle2, Trash2, Building2, MoreHorizontal } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { MasterTeamMemberDto, MasterTeamRole } from '../../_api'
import type { SchoolRow } from '../../_types'
import TeamAssignedSchoolsEditor from './TeamAssignedSchoolsEditor'

const menuItemStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 7,
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textAlign: 'left',
  width: '100%',
}

interface Props {
  member: MasterTeamMemberDto
  roleMeta: { label: string; desc: string; bg: string; color: string }
  ownerBadgeLabel: string
  createdLabel: string
  assignedLabel: string
  isBusy: boolean
  isSelf: boolean
  canModifyTarget: boolean
  isMenuOpen: boolean
  isEditingSchools: boolean
  editingSchoolIds: string[]
  schools: SchoolRow[]
  onToggleMenu: () => void
  onRoleChange: (nextRole: MasterTeamRole) => void
  onToggleEditSchools: () => void
  onResetPassword: () => void
  onToggleActive: () => void
  onDelete: () => void
  onToggleSchoolSelection: (schoolId: string, checked: boolean) => void
  onCancelEditSchools: () => void
  onSaveAssignedSchools: () => void
}

/** Carte d'un membre de l'équipe Master avec actions de rôle, menu ⋯ et affectation d'écoles */
export default function TeamMemberCard({
  member,
  roleMeta,
  ownerBadgeLabel,
  createdLabel,
  assignedLabel,
  isBusy,
  isSelf,
  canModifyTarget,
  isMenuOpen,
  isEditingSchools,
  editingSchoolIds,
  schools,
  onToggleMenu,
  onRoleChange,
  onToggleEditSchools,
  onResetPassword,
  onToggleActive,
  onDelete,
  onToggleSchoolSelection,
  onCancelEditSchools,
  onSaveAssignedSchools,
}: Props) {
  const t = useT('master')

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        background: member.isActive ? 'var(--bg)' : 'rgba(239, 68, 68, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
              {member.name}
            </span>
            {member.isOwner && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--amber-light)',
                  color: 'var(--amber)',
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Crown size={12} />
                {ownerBadgeLabel}
              </span>
            )}
            {!canModifyTarget && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: roleMeta.bg,
                  color: roleMeta.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {roleMeta.label}
              </span>
            )}
            {!member.isActive && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--red-light)',
                  color: 'var(--red)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('team.suspended')}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
            <span style={{ wordBreak: 'break-all' }}>{member.email}</span>
            <span style={{ color: 'var(--text3)' }}>·</span>
            <span style={{ whiteSpace: 'nowrap' }}>{createdLabel}</span>
            <span style={{ color: 'var(--text3)' }}>·</span>
            <span style={{ whiteSpace: 'nowrap' }}>{assignedLabel}</span>
          </div>
        </div>

        {canModifyTarget && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative' }}>
            <select
              disabled={isBusy}
              value={member.role}
              onChange={(e) => onRoleChange(e.target.value as MasterTeamRole)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--border2)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="PLATFORM_ADMIN">Platform Admin</option>
              <option value="SCHOOL_MANAGER">School Manager</option>
              <option value="SUPPORT">Support</option>
            </select>

            <button
              type="button"
              disabled={isBusy}
              aria-label={t('team.actions_menu')}
              onClick={onToggleMenu}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: '1px solid var(--border2)',
                background: isMenuOpen ? 'var(--bg2)' : 'var(--surface)',
                color: 'var(--text2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <MoreHorizontal size={16} />
            </button>

            {isMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  minWidth: 230,
                  background: 'var(--surface)',
                  border: '1px solid var(--border2)',
                  borderRadius: 10,
                  boxShadow: '0 10px 26px rgba(0, 0, 0, 0.16)',
                  padding: 5,
                  zIndex: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {(member.role === 'SCHOOL_MANAGER' || member.role === 'SUPPORT') && (
                  <button type="button" onClick={onToggleEditSchools} style={menuItemStyle}>
                    <Building2 size={14} />
                    <span>{t('team.assign_schools')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onResetPassword}
                  title={t('team.reset_pwd_title')}
                  style={menuItemStyle}
                >
                  <KeyRound size={14} />
                  <span>{t('team.reset_pwd')}</span>
                </button>

                {!isSelf && (
                  <button
                    type="button"
                    onClick={onToggleActive}
                    style={{
                      ...menuItemStyle,
                      color: member.isActive ? 'var(--amber)' : 'var(--green)',
                    }}
                  >
                    {member.isActive ? <Ban size={14} /> : <CheckCircle2 size={14} />}
                    <span>{member.isActive ? t('team.suspend') : t('team.reactivate')}</span>
                  </button>
                )}

                {!isSelf && (
                  <>
                    <div style={{ height: 1, background: 'var(--border)', margin: '4px 2px' }} />
                    <button
                      type="button"
                      onClick={onDelete}
                      style={{
                        ...menuItemStyle,
                        color: 'var(--red)',
                      }}
                    >
                      <Trash2 size={14} />
                      <span>{t('team.delete')}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {isEditingSchools && (
        <TeamAssignedSchoolsEditor
          memberName={member.name}
          schools={schools}
          selectedIds={editingSchoolIds}
          busy={isBusy}
          onToggleSchool={onToggleSchoolSelection}
          onCancel={onCancelEditSchools}
          onSave={onSaveAssignedSchools}
        />
      )}
    </div>
  )
}
