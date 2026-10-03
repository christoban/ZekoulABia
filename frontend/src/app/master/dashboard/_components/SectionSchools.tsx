'use client'
import { useState } from 'react'
import { Search, Check, X, MoreHorizontal, Eye, Pencil, Ban, Trash2, RotateCw, Mail, Undo2, CheckCircle2 } from 'lucide-react'
import Badge from './Badge'
import type { SchoolTab, SchoolRow, ConfirmActionTarget } from '../_types'

interface Props {
  schools: SchoolRow[]
  loading: boolean
  activeTab: SchoolTab
  onTabChange: (t: SchoolTab) => void
  searchTerm: string
  onSearchChange: (term: string) => void
  onInvite: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onSuspend: (id: string, name: string, subdomain: string) => void
  onDelete: (id: string, name: string) => void
  onViewDetails: (id: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onRefresh: () => void
  onConfirmAction: (target: ConfirmActionTarget) => void
}

const TABS: { id: SchoolTab; label: string; urgent?: boolean }[] = [
  { id: 'all',       label: 'Toutes' },
  { id: 'pending',   label: 'À approuver', urgent: true },
  { id: 'approved',  label: 'Approuvées' },
  { id: 'active',    label: 'Actives' },
  { id: 'suspended', label: 'Suspendues' },
  { id: 'draft',     label: 'Invitations en cours' },
  { id: 'rejected',  label: 'Rejetées' },
]

const STATUS_LABELS: Record<string, string> = {
  active:    'ACTIVE',
  pending:   'À APPROUVER',
  approved:  'APPROUVÉE',
  draft:     'INVITÉE',
  suspended: 'SUSPENDUE',
  rejected:  'REJETÉE',
}

const PLAN_LABELS: Record<string, string> = { deco: 'Découverte', std: 'Standard', prem: 'Premium' }

export default function SectionSchools({ schools, loading, activeTab, onTabChange, searchTerm, onSearchChange, onInvite, onApprove, onReject, onSuspend, onDelete, onViewDetails, onToast, onRefresh, onConfirmAction }: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const countsByTab: Record<SchoolTab, number> = {
    all:       schools.length,
    pending:   schools.filter(s => s.status === 'pending').length,
    approved:  schools.filter(s => s.status === 'approved').length,
    active:    schools.filter(s => s.status === 'active').length,
    suspended: schools.filter(s => s.status === 'suspended').length,
    draft:     schools.filter(s => s.status === 'draft').length,
    rejected:  schools.filter(s => s.status === 'rejected').length,
  }

  const filtered = activeTab === 'all' ? schools : schools.filter(s => s.status === activeTab)

  return (
    <div style={{ padding: '16px', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209' }}>
            Gestion des Écoles
          </div>
          <div style={{ fontSize: 13, color: '#a89478', marginTop: 3 }}>{schools.length} établissements au total</div>
        </div>
        <button onClick={onInvite} style={btnPrimary}>+ Inviter une école</button>
      </div>

      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e8e0d4', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Horizontally scrollable tabs on small screens */}
        <div style={{
          display: 'flex', background: 'white', borderBottom: '2px solid #e8e0d4', padding: '0 10px',
          flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none'
        }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => onTabChange(tab.id)}
              style={{
                padding: '10px 12px', fontSize: 13, fontWeight: 700,
                color: activeTab === tab.id ? 'var(--primary)' : '#a89478',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                fontFamily: 'inherit', transition: 'all 0.12s'
              }}>
              {tab.label}
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                background: activeTab === tab.id ? 'var(--green-light)' : 'var(--bg2)',
                color: activeTab === tab.id ? 'var(--primary-hover)' : tab.urgent && countsByTab[tab.id] > 0 ? '#92400e' : '#a89478'
              }}>{countsByTab[tab.id]}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid #e8e0d4', borderRadius: 8, padding: '7px 12px', flex: 1, minWidth: 200 }}>
            <Search size={15} color="#a89478" />
            <input type="text" value={searchTerm} onChange={e => onSearchChange(e.target.value)} placeholder="Rechercher par nom, sous-domaine, email..."
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: '#1a1209', fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
          </div>
        </div>

        {/* Content list: Mobile cards (< md) and Desktop table (>= md) */}
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {/* Mobile view (< md) */}
          <div className="block md:hidden" style={{ padding: '10px 10px 40px 10px' }}>
            {loading ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: '#a89478', fontSize: 13 }}>Chargement...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: '#a89478', fontSize: 13 }}>Aucune école trouvée</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map((school) => (
                  <div key={school.id} style={{
                    background: 'white', border: '1px solid #e8e0d4', borderRadius: 8,
                    padding: '12px', display: 'flex', flexDirection: 'column', gap: 8
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#1a1209', fontSize: 14 }}>{school.name}</div>
                        <div style={{ fontSize: 12, color: '#a89478', marginTop: 1 }}>{school.subdomain} · {school.type}</div>
                      </div>
                      <Badge type={school.status}>{STATUS_LABELS[school.status] ?? school.status.toUpperCase()}</Badge>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, color: '#6b5c45' }}>
                      <Badge type={`plan-${school.plan}` as any}>{PLAN_LABELS[school.plan] ?? school.plan}</Badge>
                      {school.adminEmail && <span style={{ fontSize: 11, color: '#a89478' }}>✉ {school.adminEmail}</span>}
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onViewDetails(school.id)}
                        style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                          background: 'white', color: '#6b5c45', border: '1px solid #d4c8b8',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 34
                        }}
                      >
                        <Eye size={13} /> Détails
                      </button>

                      {school.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onApprove(school.id)}
                            style={{
                              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                              background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
                              color: 'white', border: 'none', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 34
                            }}
                          >
                            <Check size={13} /> Approuver
                          </button>
                          <button
                            onClick={() => onReject(school.id)}
                            style={{
                              padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                              background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)',
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 34
                            }}
                          >
                            <X size={13} /> Rejeter
                          </button>
                        </>
                      )}

                      {/* Dropdown for other mobile actions */}
                      <div style={{ position: 'relative', marginLeft: 'auto' }}>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === school.id ? null : school.id)}
                          style={{
                            background: 'none', border: '1px solid #d4c8b8', borderRadius: 6,
                            padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: '#6b5c45',
                            display: 'flex', alignItems: 'center', minHeight: 34
                          }}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {openDropdown === school.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                            background: 'white', border: '1px solid #d4c8b8', borderRadius: 8,
                            boxShadow: '0 5px 16px rgba(0,0,0,0.15)', minWidth: 200, zIndex: 100, overflow: 'hidden'
                          }}>
                            {/* Écoles ACTIVES */}
                            {school.status === 'active' && (
                              <>
                                <DropdownItem onClick={() => { onToast('Fonctionnalité à venir', 'info'); setOpenDropdown(null) }}><Pencil size={13} /> Modifier les infos</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onSuspend(school.id, school.name, school.subdomain); setOpenDropdown(null) }} danger><Ban size={13} /> Suspendre</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* Écoles SUSPENDUES */}
                            {school.status === 'suspended' && (
                              <>
                                <DropdownItem onClick={() => {
                                  setOpenDropdown(null)
                                  onConfirmAction({
                                    title: 'Réactiver l\'établissement',
                                    description: `Réactiver «${school.name}» — tous les utilisateurs retrouveront l'accès.`,
                                    icon: CheckCircle2,
                                    successMsg: `${school.name} a été réactivée`,
                                    execute: async (auth) => {
                                      const { reactivateSchool } = await import('../_api')
                                      await reactivateSchool(school.id, auth)
                                      onRefresh()
                                    },
                                  })
                                }} color="var(--primary)"><CheckCircle2 size={13} /> Réactiver</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* Écoles REJETÉES */}
                            {school.status === 'rejected' && (
                              <>
                                <DropdownItem onClick={() => {
                                  setOpenDropdown(null)
                                  onConfirmAction({
                                    title: 'Réexaminer la demande',
                                    description: `Remettre «${school.name}» en file d'attente pour approbation.`,
                                    icon: RotateCw,
                                    successMsg: `La demande de ${school.name} est remise en examen`,
                                    execute: async (auth) => {
                                      const { reexamineSchool } = await import('../_api')
                                      await reexamineSchool(school.id, auth)
                                      onRefresh()
                                    },
                                  })
                                }} color="#1d4ed8"><RotateCw size={13} /> Réexaminer la demande</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* Écoles en INVITATION (draft) */}
                            {school.status === 'draft' && (
                              <>
                                <DropdownItem onClick={() => {
                                  setOpenDropdown(null)
                                  onConfirmAction({
                                    title: 'Renvoyer l\'invitation',
                                    description: `Envoyer un nouveau lien d'invitation à «${school.name}».`,
                                    icon: Mail,
                                    successMsg: 'Invitation renvoyée avec succès',
                                    execute: async (auth) => {
                                      const { resendInvite } = await import('../_api')
                                      await resendInvite(school.id, auth)
                                    },
                                  })
                                }} color="var(--primary)"><Mail size={13} /> Renvoyer l'invitation</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* Écoles APPROUVÉES */}
                            {school.status === 'approved' && (
                              <>
                                <DropdownItem onClick={() => {
                                  setOpenDropdown(null)
                                  onConfirmAction({
                                    title: "Annuler l'approbation",
                                    description: `Remettre «${school.name}» en attente d'approbation. L'admin ne pourra plus se connecter tant que l'école n'est pas ré-approuvée.`,
                                    icon: Undo2,
                                    successMsg: `L'approbation de ${school.name} a été annulée`,
                                    execute: async (auth) => {
                                      const { cancelApproval } = await import('../_api')
                                      await cancelApproval(school.id, auth)
                                      onRefresh()
                                    },
                                  })
                                }} color="#92400e"><Undo2 size={13} /> Annuler l'approbation</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {school.status === 'pending' && (
                              <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop view (>= md) */}
          <div className="hidden md:block">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 850 }}>
            <thead>
              <tr>
                {['École', 'Type', 'Plan', 'Statut', 'Admin', 'Invitation', 'Créée le', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#a89478', background: 'var(--bg2)', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '16px 8px', textAlign: 'center', color: '#a89478', fontSize: 12 }}>Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '16px 8px', textAlign: 'center', color: '#a89478', fontSize: 12 }}>Aucune école trouvée</td></tr>
              ) : filtered.map((school) => (
                <tr key={school.id} style={{ borderBottom: '1px solid #faf7f2' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    <div style={{ fontWeight: 700, color: '#1a1209', fontSize: 13 }}>{school.name}</div>
                    <div style={{ fontSize: 11, color: '#a89478', marginTop: 1, fontWeight: 500 }}>{school.subdomain}</div>
                  </td>
                  <td style={tdStyle}>{school.type}</td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    <Badge type={`plan-${school.plan}` as any}>{PLAN_LABELS[school.plan] ?? school.plan}</Badge>
                  </td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    <Badge type={school.status}>{STATUS_LABELS[school.status] ?? school.status.toUpperCase()}</Badge>
                  </td>
                  <td style={tdStyle}>{school.adminEmail || <span style={{ color: '#c8bfb2' }}>—</span>}</td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    {school.status === 'draft' ? (
                      <>
                        <Badge type="pending">En attente</Badge>
                        {school.inviteExpiry && <div style={{ fontSize: 10, color: '#a89478', marginTop: 1, fontWeight: 500 }}>Expire {school.inviteExpiry}</div>}
                      </>
                    ) : (
                      <span style={{ color: '#c8bfb2', fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>{school.createdAt}</td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', position: 'relative' }}>
                      {school.status === 'pending' && (
                        <>
                          <button onClick={() => onApprove(school.id)} style={{ ...btnPrimary, padding: '5px 10px', fontSize: 11 }}><Check size={13} /></button>
                          <button onClick={() => onReject(school.id)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}><X size={13} /></button>
                        </>
                      )}
                      <div style={{ position: 'relative' }}>
                        <button onClick={() => setOpenDropdown(openDropdown === school.id ? null : school.id)}
                          style={{ background: 'none', border: '1px solid #d4c8b8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#6b5c45', transition: 'all 0.12s', display: 'flex', alignItems: 'center' }}>
                          <MoreHorizontal size={13} />
                        </button>
                        {openDropdown === school.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                            background: 'white', border: '1px solid #d4c8b8', borderRadius: 8,
                            boxShadow: '0 5px 16px rgba(0,0,0,0.1)', minWidth: 190, zIndex: 100, overflow: 'hidden'
                          }}>
                            <DropdownItem onClick={() => { onViewDetails(school.id); setOpenDropdown(null) }}><Eye size={13} /> Voir les détails</DropdownItem>

                            {/* ── Écoles ACTIVES ────────────────────────────── */}
                            {school.status === 'active' && (
                              <>
                                <DropdownItem onClick={() => { onToast('Fonctionnalité à venir', 'info'); setOpenDropdown(null) }}><Pencil size={13} /> Modifier les infos</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onSuspend(school.id, school.name, school.subdomain); setOpenDropdown(null) }} danger><Ban size={13} /> Suspendre</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles SUSPENDUES ─────────────────────────── */}
                            {school.status === 'suspended' && (
                              <>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => {
                                  setOpenDropdown(null)
                                  onConfirmAction({
                                    title: 'Réactiver l\'établissement',
                                    description: `Réactiver «${school.name}» — tous les utilisateurs retrouveront l'accès.`,
                                    icon: CheckCircle2,
                                    successMsg: `${school.name} a été réactivée`,
                                    execute: async (auth) => {
                                      const { reactivateSchool } = await import('../_api')
                                      await reactivateSchool(school.id, auth)
                                      onRefresh()
                                    },
                                  })
                                }} color="var(--primary)"><CheckCircle2 size={13} /> Réactiver</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles REJETÉES ───────────────────────────── */}
                            {school.status === 'rejected' && (
                              <>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => {
                                  setOpenDropdown(null)
                                  onConfirmAction({
                                    title: 'Réexaminer la demande',
                                    description: `Remettre «${school.name}» en file d'attente pour approbation.`,
                                    icon: RotateCw,
                                    successMsg: `La demande de ${school.name} est remise en examen`,
                                    execute: async (auth) => {
                                      const { reexamineSchool } = await import('../_api')
                                      await reexamineSchool(school.id, auth)
                                      onRefresh()
                                    },
                                  })
                                }} color="#1d4ed8"><RotateCw size={13} /> Réexaminer la demande</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles en INVITATION (draft) ─────────────── */}
                            {school.status === 'draft' && (
                              <>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => {
                                  setOpenDropdown(null)
                                  onConfirmAction({
                                    title: 'Renvoyer l\'invitation',
                                    description: `Envoyer un nouveau lien d'invitation à «${school.name}».`,
                                    icon: Mail,
                                    successMsg: 'Invitation renvoyée avec succès',
                                    execute: async (auth) => {
                                      const { resendInvite } = await import('../_api')
                                      await resendInvite(school.id, auth)
                                    },
                                  })
                                }} color="var(--primary)"><Mail size={13} /> Renvoyer l'invitation</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles À APPROUVER (pending) ─────────────── */}
                            {school.status === 'pending' && (
                              <>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles APPROUVÉES (approved) ─────────────── */}
                            {school.status === 'approved' && (
                              <>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => {
                                  setOpenDropdown(null)
                                  onConfirmAction({
                                    title: "Annuler l'approbation",
                                    description: `Remettre «${school.name}» en attente d'approbation. L'admin ne pourra plus se connecter tant que l'école n'est pas ré-approuvée.`,
                                    icon: Undo2,
                                    successMsg: `L'approbation de ${school.name} a été annulée`,
                                    execute: async (auth) => {
                                      const { cancelApproval } = await import('../_api')
                                      await cancelApproval(school.id, auth)
                                      onRefresh()
                                    },
                                  })
                                }} color="#92400e"><Undo2 size={13} /> Annuler l'approbation</DropdownItem>
                                <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function DropdownItem({ children, onClick, danger, color }: { children: React.ReactNode; onClick: () => void; danger?: boolean; color?: string }) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 12px', fontSize: 13, fontWeight: 600,
      color: danger ? '#dc2626' : color ?? '#6b5c45',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      transition: 'background 0.1s'
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = danger ? '#fee2e2' : 'var(--bg2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
      {children}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 800,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 2px 8px rgba(142,42,58,0.18)', display: 'inline-flex', alignItems: 'center', gap: 6
}
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: '#6b5c45', verticalAlign: 'middle' }
