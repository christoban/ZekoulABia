'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useT } from '@/lib/i18n'
import {
  fetchMasterTeam,
  createMasterTeamMember,
  updateMasterTeamMember,
  resetMasterTeamMemberPassword,
  deleteMasterTeamMember,
  type MasterTeamMemberDto,
  type MasterTeamRole,
} from '../_api'
import type { MasterUserDto, SchoolRow } from '../_types'
import { formatAssignedLabel, formatCreatedLabel, getRoleLabels } from './team/teamHelpers'
import TeamSectionHeader from './team/TeamSectionHeader'
import TeamCredentialsBanner, { type RevealedTeamCredentials } from './team/TeamCredentialsBanner'
import TeamCreateMemberForm from './team/TeamCreateMemberForm'
import TeamMemberCard from './team/TeamMemberCard'

interface Props {
  user: MasterUserDto | null
  schools: SchoolRow[]
  onToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export default function SectionTeam({ user, schools, onToast }: Props) {
  const t = useT('master')
  const isSuperAdmin = user?.role === 'super_admin'
  const isOwner = Boolean(user?.isOwner)
  const roleLabels = getRoleLabels(t)

  const [members, setMembers] = useState<MasterTeamMemberDto[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuContainerRef = useRef<HTMLDivElement | null>(null)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<MasterTeamRole>('PLATFORM_ADMIN')
  const [newAssignedSchools, setNewAssignedSchools] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const [revealedCredentials, setRevealedCredentials] = useState<RevealedTeamCredentials | null>(null)
  const [showFallbackPwd, setShowFallbackPwd] = useState(false)
  const [copied, setCopied] = useState(false)

  const [editingSchoolsMemberId, setEditingSchoolsMemberId] = useState<string | null>(null)
  const [editingSchoolIds, setEditingSchoolIds] = useState<string[]>([])

  const chargerEquipe = useCallback(async () => {
    if (!isSuperAdmin) return
    setLoading(true)
    try {
      const list = await fetchMasterTeam()
      setMembers(list)
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Erreur lors du chargement de l'équipe Master", 'error')
    } finally {
      setLoading(false)
    }
  }, [isSuperAdmin, onToast])

  useEffect(() => {
    void chargerEquipe()
  }, [chargerEquipe])

  useEffect(() => {
    if (!openMenuId) return
    const handleOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [openMenuId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim()) {
      onToast('Nom et email requis', 'error')
      return
    }
    setCreating(true)
    try {
      const res = await createMasterTeamMember({
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        assignedSchoolIds: newAssignedSchools,
      })
      const sent = res.emailSent !== false
      setRevealedCredentials({
        email: res.member.email,
        name: res.member.name,
        temporaryPassword: res.temporaryPassword,
        emailSent: sent,
      })
      setShowFallbackPwd(!sent)
      setCopied(false)
      setNewName('')
      setNewEmail('')
      setNewRole('PLATFORM_ADMIN')
      setNewAssignedSchools([])
      setShowCreateForm(false)
      onToast(
        t('team.email_sent_title', { name: res.member.name, email: res.member.email }),
        'success',
      )
      await chargerEquipe()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur lors de la création', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleRoleChange = async (member: MasterTeamMemberDto, nextRole: MasterTeamRole) => {
    if (member.role === nextRole) return
    setBusyId(member.id)
    try {
      await updateMasterTeamMember(member.id, { role: nextRole })
      onToast(`${member.name} → ${roleLabels[nextRole].label}`, 'success')
      await chargerEquipe()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur lors du changement de rôle', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleActive = async (member: MasterTeamMemberDto) => {
    setOpenMenuId(null)
    setBusyId(member.id)
    try {
      const nextActive = !member.isActive
      await updateMasterTeamMember(member.id, { isActive: nextActive })
      onToast(
        nextActive ? `${member.name} : ${t('team.active')}` : `${member.name} : ${t('team.suspended')}`,
        nextActive ? 'success' : 'warning',
      )
      await chargerEquipe()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur lors du changement de statut', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleResetPassword = async (member: MasterTeamMemberDto) => {
    setOpenMenuId(null)
    setBusyId(member.id)
    try {
      const res = await resetMasterTeamMemberPassword(member.id)
      const sent = res.emailSent !== false
      setRevealedCredentials({
        email: res.member.email,
        name: res.member.name,
        temporaryPassword: res.temporaryPassword,
        emailSent: sent,
      })
      setShowFallbackPwd(!sent)
      setCopied(false)
      onToast(
        t('team.email_sent_title', { name: res.member.name, email: res.member.email }),
        'success',
      )
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (member: MasterTeamMemberDto) => {
    setOpenMenuId(null)
    setBusyId(member.id)
    try {
      await deleteMasterTeamMember(member.id)
      onToast(`${member.name} supprimé`, 'warning')
      await chargerEquipe()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur lors de la suppression', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleSaveAssignedSchools = async (memberId: string) => {
    setBusyId(memberId)
    try {
      await updateMasterTeamMember(memberId, { assignedSchoolIds: editingSchoolIds })
      setEditingSchoolsMemberId(null)
      onToast('Établissements assignés mis à jour', 'success')
      await chargerEquipe()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const copyPassword = async (pwd: string) => {
    try {
      await navigator.clipboard.writeText(pwd)
      setCopied(true)
      onToast(t('team.copied'), 'info')
    } catch {
      onToast('Impossible de copier automatiquement', 'warning')
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="px-3.5 py-3.5 md:px-6 md:py-5">
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            color: 'var(--text2)',
            fontSize: 13,
          }}
        >
          Accès strictement réservé au Fondateur (Super Admin).
        </div>
      </div>
    )
  }

  return (
    <div
      className="px-3.5 pt-3.5 pb-6 md:px-6 md:pt-5 md:pb-12"
      style={{ height: '100%', overflowY: 'auto', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <TeamSectionHeader
          showCreateForm={showCreateForm}
          onRefresh={() => void chargerEquipe()}
          onToggleCreateForm={() => setShowCreateForm((v) => !v)}
        />

        {revealedCredentials && (
          <TeamCredentialsBanner
            credentials={revealedCredentials}
            showFallbackPwd={showFallbackPwd}
            copied={copied}
            onToggleFallbackPwd={() => setShowFallbackPwd((v) => !v)}
            onCopyPassword={(pwd) => void copyPassword(pwd)}
            onDismiss={() => setRevealedCredentials(null)}
          />
        )}

        {showCreateForm && (
          <TeamCreateMemberForm
            name={newName}
            email={newEmail}
            role={newRole}
            roleDescription={roleLabels[newRole].desc}
            creating={creating}
            onNameChange={setNewName}
            onEmailChange={setNewEmail}
            onRoleChange={setNewRole}
            onCancel={() => setShowCreateForm(false)}
            onSubmit={(e) => void handleCreate(e)}
          />
        )}

        <div
          ref={menuContainerRef}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 'clamp(12px, 3.6vw, 18px)',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
            {t('team.members_title', { count: members.length })}
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '16px 0' }}>{t('team.loading')}</div>
          ) : members.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: '16px 0' }}>{t('team.empty')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map((member) => {
                const roleMeta = roleLabels[member.role] ?? roleLabels.SUPPORT
                const isMenuOpen = openMenuId === member.id
                return (
                  <TeamMemberCard
                    key={member.id}
                    member={member}
                    roleMeta={roleMeta}
                    ownerBadgeLabel={t('team.owner_badge')}
                    createdLabel={formatCreatedLabel(t, member.createdSchoolsCount)}
                    assignedLabel={formatAssignedLabel(t, member.assignedSchoolIds.length)}
                    isBusy={busyId === member.id}
                    isSelf={member.id === user?.id}
                    canModifyTarget={!member.isOwner && (member.role !== 'SUPER_ADMIN' || isOwner)}
                    isMenuOpen={isMenuOpen}
                    isEditingSchools={editingSchoolsMemberId === member.id}
                    editingSchoolIds={editingSchoolIds}
                    schools={schools}
                    onToggleMenu={() => setOpenMenuId(isMenuOpen ? null : member.id)}
                    onRoleChange={(nextRole) => void handleRoleChange(member, nextRole)}
                    onToggleEditSchools={() => {
                      setOpenMenuId(null)
                      if (editingSchoolsMemberId === member.id) {
                        setEditingSchoolsMemberId(null)
                      } else {
                        setEditingSchoolsMemberId(member.id)
                        setEditingSchoolIds(member.assignedSchoolIds)
                      }
                    }}
                    onResetPassword={() => void handleResetPassword(member)}
                    onToggleActive={() => void handleToggleActive(member)}
                    onDelete={() => void handleDelete(member)}
                    onToggleSchoolSelection={(schoolId, checked) => {
                      if (checked) {
                        setEditingSchoolIds((prev) => [...prev, schoolId])
                      } else {
                        setEditingSchoolIds((prev) => prev.filter((id) => id !== schoolId))
                      }
                    }}
                    onCancelEditSchools={() => setEditingSchoolsMemberId(null)}
                    onSaveAssignedSchools={() => void handleSaveAssignedSchools(member.id)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
