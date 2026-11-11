'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  MoreHorizontal,
  X,
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

  const formatCreatedLabel = (count: number) => {
    if (count === 0) return t('team.created_zero')
    if (count === 1) return t('team.created_one')
    return t('team.created_other', { count })
  }

  const formatAssignedLabel = (count: number) => {
    if (count === 0) return t('team.assigned_zero')
    if (count === 1) return t('team.assigned_one')
    return t('team.assigned_other', { count })
  }

  const [members, setMembers] = useState<MasterTeamMemberDto[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuContainerRef = useRef<HTMLDivElement | null>(null)

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
      onToast(`${member.name} → ${ROLE_LABELS[nextRole].label}`, 'success')
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
      <div style={{ padding: '20px 24px' }}>
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
    <div style={{ height: '100%', overflowY: 'auto', padding: '20px 24px 48px', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* En-tête aligné à gauche sur la grille 24px */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--amber-light)',
                border: '1px solid rgba(217, 119, 6, 0.25)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                {t('team.title')}
              </h1>
              <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--text3)' }}>
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
                padding: '8px 13px',
                borderRadius: 9,
                border: '1px solid var(--border2)',
                background: 'var(--surface)',
                color: 'var(--text2)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
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
                gap: 7,
                padding: '8px 16px',
                borderRadius: 9,
                border: 'none',
                background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
                boxShadow: '0 2px 8px rgba(142,42,58,0.18)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <UserPlus size={15} />
              {showCreateForm ? t('team.close_form_btn') : t('team.new_member_btn')}
            </button>
          </div>
        </div>

        {/* Bandeau de confirmation d'envoi de l'email d'invitation au membre (croix légère + bouton Copier secondaire non concurrent) */}
        {revealedCredentials && (
          <div
            style={{
              background: 'var(--green-light)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 800, color: 'var(--green)' }}>
                <MailCheck size={18} style={{ flexShrink: 0 }} />
                <span>
                  {t('team.email_sent_title', {
                    name: revealedCredentials.name,
                    email: revealedCredentials.email,
                  })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRevealedCredentials(null)}
                aria-label={t('team.dismiss_banner')}
                title={t('team.dismiss_banner')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: 4,
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5 }}>
              {t('team.email_sent_desc')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 2 }}>
              <button
                type="button"
                onClick={() => setShowFallbackPwd((v) => !v)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--surface)',
                  border: '1px solid var(--border2)',
                  borderRadius: 7,
                  padding: '5px 11px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {showFallbackPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                {showFallbackPwd ? t('team.hide_fallback_pwd') : t('team.show_fallback_pwd')}
              </button>

              {showFallbackPwd && (
                <>
                  <code
                    style={{
                      padding: '5px 12px',
                      borderRadius: 7,
                      background: 'var(--surface)',
                      border: '1px solid var(--border2)',
                      fontSize: 13,
                      fontWeight: 800,
                      color: 'var(--text)',
                      letterSpacing: 0.4,
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
                      padding: '5px 11px',
                      borderRadius: 7,
                      border: '1px solid var(--border2)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {copied ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}
                    {copied ? t('team.copied') : t('team.copy')}
                  </button>
                </>
              )}
            </div>
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
              padding: 18,
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
                    fontFamily: 'inherit',
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
                    fontFamily: 'inherit',
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
                    fontFamily: 'inherit',
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
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--border2)',
                  background: 'var(--surface)',
                  color: 'var(--text2)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
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
                  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
                  color: '#fff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: creating ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {creating ? t('team.creating') : t('team.submit_create')}
              </button>
            </div>
          </form>
        )}

        {/* Liste des membres */}
        <div
          ref={menuContainerRef}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 18,
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
                const isMenuOpen = openMenuId === member.id

                return (
                  <div
                    key={member.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '12px 16px',
                      background: member.isActive ? 'var(--bg)' : 'rgba(239, 68, 68, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                      {/* Colonne Infos Membre : aucun badge "Actif" redondant, aucun mot coupé */}
                      <div style={{ minWidth: 240, flex: 1 }}>
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
                              {t('team.owner_badge')}
                            </span>
                          )}
                          {/* Afficher le badge de rôle uniquement si le membre n'a pas de sélecteur de rôle à droite */}
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
                          {/* Afficher le statut uniquement quand le membre N'EST PAS actif */}
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

                        {/* Métadonnées avec pluriel propre et sans coupure au milieu des mots */}
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
                          <span style={{ whiteSpace: 'nowrap' }}>{member.email}</span>
                          <span style={{ color: 'var(--text3)' }}>·</span>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            {formatCreatedLabel(member.createdSchoolsCount)}
                          </span>
                          <span style={{ color: 'var(--text3)' }}>·</span>
                          <span style={{ whiteSpace: 'nowrap' }}>
                            {formatAssignedLabel(member.assignedSchoolIds.length)}
                          </span>
                        </div>
                      </div>

                      {/* Colonne Actions : sélecteur de rôle lisible + menu déroulant ⋯ */}
                      {canModifyTarget && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, position: 'relative' }}>
                          <select
                            disabled={isBusy}
                            value={member.role}
                            onChange={(e) => void handleRoleChange(member, e.target.value as MasterTeamRole)}
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
                            onClick={() => setOpenMenuId(isMenuOpen ? null : member.id)}
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
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    if (editingSchoolsMemberId === member.id) {
                                      setEditingSchoolsMemberId(null)
                                    } else {
                                      setEditingSchoolsMemberId(member.id)
                                      setEditingSchoolIds(member.assignedSchoolIds)
                                    }
                                  }}
                                  style={menuItemStyle}
                                >
                                  <Building2 size={14} />
                                  <span>{t('team.assign_schools')}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => void handleResetPassword(member)}
                                title={t('team.reset_pwd_title')}
                                style={menuItemStyle}
                              >
                                <KeyRound size={14} />
                                <span>{t('team.reset_pwd')}</span>
                              </button>

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => void handleToggleActive(member)}
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
                                    onClick={() => void handleDelete(member)}
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
                              fontFamily: 'inherit',
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
                              fontFamily: 'inherit',
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
