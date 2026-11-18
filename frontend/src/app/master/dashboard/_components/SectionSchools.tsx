'use client'
import { useState } from 'react'
import { Search, Check, X } from 'lucide-react'
import Badge from './Badge'
import type { SchoolTab, SchoolRow, ConfirmActionTarget } from '../_types'
import { useT } from '@/lib/i18n'
import { STATUS_LABELS, PLAN_LABELS, btnPrimary, tdStyle } from './schools/schoolConstants'
import SchoolActionsDropdown from './schools/SchoolActionsDropdown'
import SchoolMobileList from './schools/SchoolMobileList'

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

export default function SectionSchools({ schools, loading, activeTab, onTabChange, searchTerm, onSearchChange, onInvite, onApprove, onReject, onSuspend, onDelete, onViewDetails, onToast, onRefresh, onConfirmAction }: Props) {
  const t = useT('master')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const toggleDropdown = (id: string) => {
    setOpenDropdown(prev => (prev === id ? null : id))
  }

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
          <SchoolMobileList
            schools={filtered}
            loading={loading}
            openDropdown={openDropdown}
            onToggleDropdown={toggleDropdown}
            onCloseDropdown={() => setOpenDropdown(null)}
            onApprove={onApprove}
            onReject={onReject}
            onSuspend={onSuspend}
            onDelete={onDelete}
            onViewDetails={onViewDetails}
            onToast={onToast}
            onRefresh={onRefresh}
            onConfirmAction={onConfirmAction}
          />

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
                        <SchoolActionsDropdown
                          school={school}
                          isOpen={openDropdown === school.id}
                          variant="desktop"
                          onToggle={() => toggleDropdown(school.id)}
                          onClose={() => setOpenDropdown(null)}
                          onViewDetails={onViewDetails}
                          onToast={onToast}
                          onSuspend={onSuspend}
                          onDelete={onDelete}
                          onRefresh={onRefresh}
                          onConfirmAction={onConfirmAction}
                        />
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
