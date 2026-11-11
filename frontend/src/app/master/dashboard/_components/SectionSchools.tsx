'use client'
import { useState } from 'react'
import { Search, Check, X, MoreHorizontal, Eye, Pencil, Ban, Trash2, RotateCw, Mail, Undo2, CheckCircle2 } from 'lucide-react'
import Badge from './Badge'
import type { SchoolTab, SchoolRow, ConfirmActionTarget } from '../_types'
import { useT } from '@/lib/i18n'

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
  const t = useT('master')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const TABS: { id: SchoolTab; label: string; urgent?: boolean }[] = [
    { id: 'all',       label: t('schools.tab_all') },
    { id: 'pending',   label: t('schools.tab_pending'), urgent: true },
    { id: 'approved',  label: t('schools.tab_approved') },
    { id: 'active',    label: t('schools.tab_active') },
    { id: 'suspended', label: t('schools.tab_suspended') },
    { id: 'draft',     label: t('schools.tab_draft') },
    { id: 'rejected',  label: t('schools.tab_rejected') },
  ]

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
    <div
      className="px-3.5 py-3 md:px-6 md:py-5"
      style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ minWidth: 0, flex: '1 1 200px' }}>
          <div className="text-[18px] md:text-[20px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
            {t('schools.title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t('schools.subtitle', { count: schools.length })}</div>
        </div>
        <button className="w-full sm:w-auto justify-center" onClick={onInvite} style={btnPrimary}>{t('schools.invite_btn')}</button>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Horizontally scrollable tabs on small screens */}
        <div style={{
          display: 'flex', background: 'var(--surface)', borderBottom: '2px solid var(--border)', padding: '0 8px',
          flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none'
        }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => onTabChange(tab.id)}
              style={{
                padding: '10px 11px', fontSize: 12.5, fontWeight: 700,
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text3)',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                fontFamily: 'inherit', transition: 'all 0.12s'
              }}>
              {tab.label}
              <span style={{
                fontSize: 11, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                background: activeTab === tab.id ? 'var(--amber-light)' : 'var(--bg2)',
                color: activeTab === tab.id ? 'var(--primary)' : tab.urgent && countsByTab[tab.id] > 0 ? 'var(--amber)' : 'var(--text3)'
              }}>{countsByTab[tab.id]}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px', flex: 1, minWidth: 180 }}>
            <Search size={15} color="var(--text3)" />
            <input type="text" value={searchTerm} onChange={e => onSearchChange(e.target.value)} placeholder={t('schools.search_placeholder')}
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
          </div>
        </div>

        {/* Content list: Mobile cards (< md) and Desktop table (>= md) */}
        <div style={{ overflow: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {/* Mobile view (< md) */}
          <div className="block md:hidden" style={{ padding: '10px 10px 32px 10px' }}>
            {loading ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('schools.loading')}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('schools.empty')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map((school) => (
                  <div key={school.id} style={{
                    background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12,
                    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, color: 'var(--text)', fontSize: 14, lineHeight: 1.3 }}>{school.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text2)', fontWeight: 600 }}>{school.subdomain}</span>
                          <span>·</span>
                          <span>{school.type}</span>
                          {school.createdByMaster ? (
                            <>
                              <span>·</span>
                              <span>{t('schools.created_by', { name: school.createdByMaster.name })}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <Badge type={school.status}>{STATUS_LABELS[school.status] ?? school.status.toUpperCase()}</Badge>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--text2)' }}>
                      <Badge type={`plan-${school.plan}` as 'plan-deco' | 'plan-std' | 'plan-prem'}>{PLAN_LABELS[school.plan] ?? school.plan}</Badge>
                      {school.adminEmail && (
                        <span style={{ fontSize: 11.5, color: 'var(--text2)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          ✉ {school.adminEmail}
                        </span>
                      )}
                      {school.createdAt && (
                        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
                          {school.createdAt}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6, paddingTop: 6, borderTop: '1px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => onViewDetails(school.id)}
                        style={{
                          padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border2)',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 36, flex: school.status === 'pending' ? '0 0 auto' : 1
                        }}
                      >
                        <Eye size={13} /> {t('schools.details_btn')}
                      </button>

                      {school.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onApprove(school.id)}
                            style={{
                              padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                              background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
                              color: 'white', border: 'none', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 36, flex: 1
                            }}
                          >
                            <Check size={13} /> {t('schools.approve_btn')}
                          </button>
                          <button
                            onClick={() => onReject(school.id)}
                            style={{
                              padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                              background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.28)',
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 36
                            }}
                          >
                            <X size={13} /> {t('schools.reject_btn')}
                          </button>
                        </>
                      )}

                      {/* Dropdown for other mobile actions */}
                      <div style={{ position: 'relative', marginLeft: 'auto' }}>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === school.id ? null : school.id)}
                          style={{
                            background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8,
                            padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--text2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 36, minWidth: 36
                          }}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        {openDropdown === school.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                            background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8,
                            boxShadow: '0 5px 16px rgba(0,0,0,0.15)', minWidth: 200, zIndex: 100, overflow: 'hidden'
                          }}>
                            {/* Écoles ACTIVES */}
                            {school.status === 'active' && (
                              <>
                                <DropdownItem onClick={() => { onToast('Fonctionnalité à venir', 'info'); setOpenDropdown(null) }}><Pencil size={13} /> Modifier les infos</DropdownItem>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onSuspend(school.id, school.name, school.subdomain); setOpenDropdown(null) }} danger><Ban size={13} /> Suspendre</DropdownItem>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                {[t('schools.col_school'), t('schools.col_type'), t('schools.col_plan'), t('schools.col_status'), t('schools.col_admin'), t('schools.col_invite'), t('schools.col_created'), t('schools.col_actions')].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('schools.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('schools.empty')}</td></tr>
              ) : filtered.map((school) => (
                <tr key={school.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{school.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1, fontWeight: 500 }}>
                      {school.subdomain}
                      {school.createdByMaster ? ` · ${t('schools.created_by', { name: school.createdByMaster.name })}` : ''}
                    </div>
                  </td>
                  <td style={tdStyle}>{school.type}</td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    <Badge type={`plan-${school.plan}` as 'plan-deco' | 'plan-std' | 'plan-prem'}>{PLAN_LABELS[school.plan] ?? school.plan}</Badge>
                  </td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    <Badge type={school.status}>{STATUS_LABELS[school.status] ?? school.status.toUpperCase()}</Badge>
                  </td>
                  <td style={tdStyle}>{school.adminEmail || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td style={{ padding: '6px 8px', verticalAlign: 'middle' }}>
                    {school.status === 'draft' ? (
                      <>
                        <Badge type="pending">{t('schools.pending_badge')}</Badge>
                        {school.inviteExpiry && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1, fontWeight: 500 }}>{t('schools.expires', { date: school.inviteExpiry })}</div>}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
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
                          style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: 'var(--text2)', transition: 'all 0.12s', display: 'flex', alignItems: 'center' }}>
                          <MoreHorizontal size={13} />
                        </button>
                        {openDropdown === school.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                            background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8,
                            boxShadow: '0 5px 16px rgba(0,0,0,0.1)', minWidth: 190, zIndex: 100, overflow: 'hidden'
                          }}>
                            <DropdownItem onClick={() => { onViewDetails(school.id); setOpenDropdown(null) }}><Eye size={13} /> Voir les détails</DropdownItem>

                            {/* ── Écoles ACTIVES ────────────────────────────── */}
                            {school.status === 'active' && (
                              <>
                                <DropdownItem onClick={() => { onToast('Fonctionnalité à venir', 'info'); setOpenDropdown(null) }}><Pencil size={13} /> Modifier les infos</DropdownItem>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onSuspend(school.id, school.name, school.subdomain); setOpenDropdown(null) }} danger><Ban size={13} /> Suspendre</DropdownItem>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles SUSPENDUES ─────────────────────────── */}
                            {school.status === 'suspended' && (
                              <>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles REJETÉES ───────────────────────────── */}
                            {school.status === 'rejected' && (
                              <>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles en INVITATION (draft) ─────────────── */}
                            {school.status === 'draft' && (
                              <>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles À APPROUVER (pending) ─────────────── */}
                            {school.status === 'pending' && (
                              <>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                                <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger><Trash2 size={13} /> Supprimer définitivement</DropdownItem>
                              </>
                            )}

                            {/* ── Écoles APPROUVÉES (approved) ─────────────── */}
                            {school.status === 'approved' && (
                              <>
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
                                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
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
      padding: '9px 12px', fontSize: 13, fontWeight: 600,
      color: danger ? 'var(--red)' : color ?? 'var(--text2)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      transition: 'background 0.1s'
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = danger ? 'var(--red-light)' : 'var(--bg2)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
      {children}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 800,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit', minHeight: 38,
  boxShadow: '0 2px 8px rgba(142,42,58,0.18)', display: 'inline-flex', alignItems: 'center', gap: 6
}
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: 'var(--text2)', verticalAlign: 'middle' }
