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
} from 'lucide-react'
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

const ROLE_LABELS: Record<MasterTeamRole, { label: string; desc: string; bg: string; color: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    desc: 'Accès total (équipe, mode test global, toutes les écoles, journaux)',
    bg: 'rgba(168, 85, 247, 0.14)',
    color: '#7e22ce',
  },
  PLATFORM_ADMIN: {
    label: 'Platform Admin',
    desc: 'Coéquipier testeur / Opérateur : crée et gère ses écoles + référentiels + mode test sur ses écoles',
    bg: 'rgba(37, 99, 235, 0.12)',
    color: '#1d4ed8',
  },
  SCHOOL_MANAGER: {
    label: 'School Manager',
    desc: 'Intégration / Commercial : crée et gère uniquement ses écoles et celles qui lui sont assignées',
    bg: 'rgba(217, 119, 6, 0.14)',
    color: '#b45309',
  },
  SUPPORT: {
    label: 'Support',
    desc: 'Assistance aux écoles : lecture seule et déblocage MFA, aucune modification destructrice',
    bg: 'rgba(100, 116, 139, 0.14)',
    color: '#475569',
  },
}

export default function SectionTeam({ user, schools, onToast }: Props) {
  const isSuperAdmin = user?.role === 'super_admin'
  const isOwner = Boolean(user?.isOwner)

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

  // Affichage unique du mot de passe temporaire
  const [revealedCredentials, setRevealedCredentials] = useState<{
    email: string
    name: string
    temporaryPassword: string
    title: string
  } | null>(null)
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
      setRevealedCredentials({
        email: res.member.email,
        name: res.member.name,
        temporaryPassword: res.temporaryPassword,
        title: 'Compte Master créé — Mot de passe temporaire (affiché une seule fois)',
      })
      setCopied(false)
      setNewName('')
      setNewEmail('')
      setNewRole('PLATFORM_ADMIN')
      setNewAssignedSchools([])
      setShowCreateForm(false)
      onToast(`Compte Master créé pour ${res.member.name}`, 'success')
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
      onToast(`Rôle de ${member.name} mis à jour (${ROLE_LABELS[nextRole].label})`, 'success')
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
        nextActive ? `Compte de ${member.name} réactivé` : `Compte de ${member.name} suspendu`,
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
      setRevealedCredentials({
        email: res.member.email,
        name: res.member.name,
        temporaryPassword: res.temporaryPassword,
        title: `Nouveau mot de passe temporaire pour ${res.member.name} (affiché une seule fois)`,
      })
      setCopied(false)
      onToast(`Mot de passe temporaire régénéré pour ${member.name}`, 'success')
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
      onToast(`Compte Master de ${member.name} supprimé`, 'warning')
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
      onToast('Mot de passe temporaire copié dans le presse-papiers', 'info')
    } catch {
      onToast('Impossible de copier automatiquement', 'warning')
    }
  }

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            color: 'var(--text-secondary)',
            fontSize: 13,
          }}
        >
          Accès strictement réservé aux Super Administrateurs (`super_admin`).
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 20px 48px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1020, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(168, 85, 247, 0.14)',
                color: '#7e22ce',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                Équipe Master & Gouvernance des Rôles
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Créez des comptes dédiés pour vos coéquipiers testeurs ou opérateurs sans partager votre compte Fondateur.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} />
              Rafraîchir
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
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
              {showCreateForm ? 'Fermer le formulaire' : '+ Nouveau membre Master'}
            </button>
          </div>
        </div>

        {/* Bandeau d'affichage unique du mot de passe temporaire */}
        {revealedCredentials && (
          <div
            style={{
              background: '#fef3c7',
              border: '1.5px solid #d97706',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#92400e' }}>
                {revealedCredentials.title}
              </div>
              <button
                type="button"
                onClick={() => setRevealedCredentials(null)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(146, 64, 14, 0.3)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#92400e',
                  cursor: 'pointer',
                }}
              >
                J’ai noté ce mot de passe
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: '#78350f', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span>
                Membre : <strong>{revealedCredentials.name}</strong> ({revealedCredentials.email})
              </span>
              <code
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid #f59e0b',
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#1a1209',
                  letterSpacing: 0.6,
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
                  background: '#92400e',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copié' : 'Copier'}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: '#92400e' }}>
              Important : la connexion au portail Master (`/master/login`) envoie toujours un code OTP par email. Chaque membre doit utiliser une vraie adresse email.
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
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              Créer un nouveau compte Master
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Jean-Marc Testeur"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Adresse email réelle (pour OTP Master) *
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="coequipier@domaine.com"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Rôle Master *
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
                    background: 'var(--bg)',
                    fontSize: 13,
                  }}
                >
                  <option value="PLATFORM_ADMIN">PLATFORM_ADMIN (Coéquipier testeur / Opérateur)</option>
                  <option value="SCHOOL_MANAGER">SCHOOL_MANAGER (Écoles créées ou assignées)</option>
                  <option value="SUPPORT">SUPPORT (Lecture & assistance MFA)</option>
                  {isOwner && <option value="SUPER_ADMIN">SUPER_ADMIN (Co-administrateur)</option>}
                </select>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {ROLE_LABELS[newRole].desc}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Annuler
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
                {creating ? 'Création...' : 'Créer et générer le mot de passe'}
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
            padding: 18,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>
            Membres de l’équipe Master ({members.length})
          </div>

          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Chargement...</div>
          ) : members.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Aucun membre trouvé.</div>
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
                      background: member.isActive ? 'var(--bg)' : 'rgba(239, 68, 68, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
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
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid rgba(180, 83, 9, 0.25)',
                              }}
                            >
                              <Crown size={12} />
                              Propriétaire (Fondateur)
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
                            {member.isActive ? 'Actif' : 'Suspendu'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                          {member.email} · {member.createdSchoolsCount} école(s) créée(s) ·{' '}
                          {member.assignedSchoolIds.length} école(s) assignée(s)
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                            <option value="SCHOOL_MANAGER">SCHOOL_MANAGER</option>
                            <option value="SUPPORT">SUPPORT</option>
                            {isOwner && <option value="SUPER_ADMIN">SUPER_ADMIN</option>}
                          </select>
                        )}

                        {member.role !== 'SUPER_ADMIN' && (
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
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Building2 size={13} />
                            Assigner écoles
                          </button>
                        )}

                        {canModifyTarget && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleResetPassword(member)}
                              title="Régénérer un mot de passe temporaire"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                padding: '6px 10px',
                                borderRadius: 7,
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <KeyRound size={13} />
                              Mdp temp.
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
                                  color: member.isActive ? '#d97706' : 'var(--green)',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                {member.isActive ? <Ban size={13} /> : <CheckCircle2 size={13} />}
                                {member.isActive ? 'Suspendre' : 'Réactiver'}
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
                                Supprimer
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
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Établissements supplémentaires assignés à {member.name} (en plus de ceux qu’il/elle a créés) :
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 140, overflowY: 'auto' }}>
                          {schools.map((s) => {
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
                              background: 'var(--bg)',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Annuler
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
                            Enregistrer
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

