'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users,
  UserPlus,
  RefreshCw,
  Crown,
  KeyRound,
  Ban,
  CheckCircle2,
  Trash2,
  Copy,
  Check,
  Building2,
  MailCheck,
  Eye,
  EyeOff,
} from 'lucide-react'
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

interface Props {
  user: MasterUserDto | null
  schools: SchoolRow[]
  onToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export default function SectionTeam({ user, schools, onToast }: Props) {
  const t = useT('master')
  const isSuperAdmin = user?.role === 'super_admin'
  const isOwner = Boolean(user?.isOwner)

  const ROLE_LABELS: Record<MasterTeamRole, { label: string; desc: string; bg: string; color: string }> = {
    SUPER_ADMIN: {
      label: 'Super Admin',
      desc: t('team.role_super_desc'),
      bg: 'rgba(168, 85, 247, 0.14)',
      color: '#a855f7',
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

  const [members, setMembers] = useState<MasterTeamMemberDto[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Création d'un membre
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<MasterTeamRole>('PLATFORM_ADMIN')
  const [newAssignedSchools, setNewAssignedSchools] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  // Confirmation d'envoi par email + mot de passe de secours optionnel
  const [revealedCredentials, setRevealedCredentials] = useState<{
    email: string
    name: string
    temporaryPassword: string
    emailSent: boolean
  } | null>(null)
  const [showFallbackPwd, setShowFallbackPwd] = useState(false)
  const [copied, setCopied] = useState(false)

  // Édition des écoles assignées d'un membre existant
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
      onToast(`${member.name} → ${ROLE_LABELS[nextRole].label}`, 'success')
      await chargerEquipe()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur lors du changement de rôle', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleToggleActive = async (member: MasterTeamMemberDto) => {
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
      <div style={{ padding: 16 }}>
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
          Accès strictement réservé au Fondateur (`super_admin`).
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 14px 48px', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ maxWidth: 1020, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(168, 85, 247, 0.14)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                {t('team.title')}
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text2)' }}>
                {t('team.subtitle')}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void chargerEquipe()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
              {t('team.refresh')}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex-1 sm:flex-initial justify-center"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={15} />
              {showCreateForm ? t('team.close_form_btn') : t('team.new_member_btn')}
            </button>
          </div>
        </div>

        {/* Bandeau de confirmation d'envoi de l'email d'invitation au membre */}
        {revealedCredentials && (
          <div
            style={{
              background: 'var(--green-light)',
              border: '1.5px solid var(--green)',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 800, color: 'var(--green)' }}>
                <MailCheck size={18} />
                <span>
                  {t('team.email_sent_title', {
                    name: revealedCredentials.name,
                    email: revealedCredentials.email,
                  })}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowFallbackPwd((v) => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  {showFallbackPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showFallbackPwd ? t('team.hide_fallback_pwd') : t('team.show_fallback_pwd')}
                </button>
                <button
                  type="button"
                  onClick={() => setRevealedCredentials(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--green)',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--green)',
                    cursor: 'pointer',
                  }}
                >
                  {t('team.dismiss_banner')}
                </button>
              </div>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--text)' }}>
              {t('team.email_sent_desc')}
            </div>

            {showFallbackPwd && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
                <code
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: 'var(--text)',
                    letterSpacing: 0.5,
                  }}
                >
                  {revealedCredentials.temporaryPassword}
                </code>
                <button
                  type="button"
                  onClick={() => void copyPassword(revealedCredentials.temporaryPassword)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? t('team.copied') : t('team.copy')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Formulaire de création */}
        {showCreateForm && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
              {t('team.form_title')}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                  {t('team.label_name')}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('team.placeholder_name')}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text)',
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                  {t('team.label_email')}
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={t('team.placeholder_email')}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text)',
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                  {t('team.label_role')}
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as MasterTeamRole)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg2)',
                    color: 'var(--text)',
                    fontSize: 13,
                  }}
                >
                  <option value="PLATFORM_ADMIN">{t('team.role_platform_option')}</option>
                  <option value="SCHOOL_MANAGER">{t('team.role_school_option')}</option>
                  <option value="SUPPORT">{t('team.role_support_option')}</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {ROLE_LABELS[newRole].desc}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t('team.cancel')}
              </button>
              <button
                type="submit"
                disabled={creating}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--green)',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: creating ? 'wait' : 'pointer',
                }}
              >
                {creating ? t('team.creating') : t('team.submit_create')}
              </button>
            </div>
          </form>
        )}

        {/* Liste des membres */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
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
                const roleMeta = ROLE_LABELS[member.role] ?? ROLE_LABELS.SUPPORT
                const isBusy = busyId === member.id
                const isSelf = member.id === user?.id
                const canModifyTarget =
                  !member.isOwner && (member.role !== 'SUPER_ADMIN' || isOwner)

                return (
                  <div
                    key={member.id}
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 200, flex: 1 }}>
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
                              }}
                            >
                              <Crown size={12} />
                              {/* Propriétaire (Fondateur) */}
                              {t('team.owner_badge')}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: roleMeta.bg,
                              color: roleMeta.color,
                            }}
                          >
                            {roleMeta.label}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: member.isActive ? 'var(--green-light)' : 'var(--red-light)',
                              color: member.isActive ? 'var(--green)' : 'var(--red)',
                            }}
                          >
                            {member.isActive ? t('team.active') : t('team.suspended')}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4, wordBreak: 'break-all' }}>
                          {member.email} ·{' '}
                          {t('team.schools_stats', {
                            created: member.createdSchoolsCount,
                            assigned: member.assignedSchoolIds.length,
                          })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="w-full sm:w-auto" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {canModifyTarget && (
                          <select
                            disabled={isBusy}
                            value={member.role}
                            onChange={(e) => void handleRoleChange(member, e.target.value as MasterTeamRole)}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 7,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                            <option value="SCHOOL_MANAGER">SCHOOL_MANAGER</option>
                            <option value="SUPPORT">SUPPORT</option>
                          </select>
                        )}

                        {(member.role === 'SCHOOL_MANAGER' || member.role === 'SUPPORT') && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              if (editingSchoolsMemberId === member.id) {
                                setEditingSchoolsMemberId(null)
                              } else {
                                setEditingSchoolsMemberId(member.id)
                                setEditingSchoolIds(member.assignedSchoolIds)
                              }
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '6px 10px',
                              borderRadius: 7,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Building2 size={13} />
                            {t('team.assign_schools')}
                          </button>
                        )}

                        {canModifyTarget && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleResetPassword(member)}
                              title={t('team.reset_pwd_title')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '6px 10px',
                                borderRadius: 7,
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <KeyRound size={13} />
                              {t('team.reset_pwd')}
                            </button>

                            {!isSelf && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleToggleActive(member)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '6px 10px',
                                  borderRadius: 7,
                                  border: '1px solid var(--border)',
                                  background: 'var(--surface)',
                                  color: member.isActive ? 'var(--amber)' : 'var(--green)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {member.isActive ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                                {member.isActive ? t('team.suspend') : t('team.reactivate')}
                              </button>
                            )}

                            {!isSelf && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDelete(member)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '6px 10px',
                                  borderRadius: 7,
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  background: 'var(--red-light)',
                                  color: 'var(--red)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={13} />
                                {t('team.delete')}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Sélecteur d'écoles assignées */}
                    {editingSchoolsMemberId === member.id && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                          {t('team.assign_schools_label', { name: member.name })}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
                          {schools
                            .filter((s) => s.subdomain !== 'system' && !s.subdomain.startsWith('fixture-'))
                            .map((s) => {
                              const checked = editingSchoolIds.includes(s.id)
                              return (
                                <label
                                  key={s.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 9px',
                                    borderRadius: 6,
                                    border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                                    background: checked ? 'var(--green-light)' : 'var(--bg)',
                                    color: 'var(--text)',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditingSchoolIds((prev) => [...prev, s.id])
                                      } else {
                                        setEditingSchoolIds((prev) => prev.filter((id) => id !== s.id))
                                      }
                                    }}
                                  />
                                  {s.name}
                                </label>
                              )
                            })}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => setEditingSchoolsMemberId(null)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--bg2)',
                              color: 'var(--text)',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            {t('team.cancel')}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleSaveAssignedSchools(member.id)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: 'none',
                              background: 'var(--primary)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {t('team.save')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
