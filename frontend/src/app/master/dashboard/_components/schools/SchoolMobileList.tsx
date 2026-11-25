'use client'
import { Check, X, Eye } from 'lucide-react'
import { useT } from '@/lib/i18n'
import Badge from '../Badge'
import type { SchoolRow, ConfirmActionTarget } from '../../_types'
import { STATUS_LABELS, PLAN_LABELS } from './schoolConstants'
import SchoolActionsDropdown from './SchoolActionsDropdown'

interface Props {
  schools: SchoolRow[]
  loading: boolean
  openDropdown: string | null
  onToggleDropdown: (id: string) => void
  onCloseDropdown: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onSuspend: (id: string, name: string, subdomain: string) => void
  onDelete: (id: string, name: string) => void
  onViewDetails: (id: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onRefresh: () => void
  onConfirmAction: (target: ConfirmActionTarget) => void
}

export default function SchoolMobileList({
  schools, loading, openDropdown, onToggleDropdown, onCloseDropdown,
  onApprove, onReject, onSuspend, onDelete, onViewDetails, onToast, onRefresh, onConfirmAction,
}: Props) {
  const t = useT('master')

  return (
    <div className="block md:hidden" style={{ padding: '10px 10px 32px 10px' }}>
      {loading ? (
        <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('schools.loading')}</div>
      ) : schools.length === 0 ? (
        <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('schools.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {schools.map((school) => (
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

                <SchoolActionsDropdown
                  school={school}
                  isOpen={openDropdown === school.id}
                  variant="mobile"
                  onToggle={() => onToggleDropdown(school.id)}
                  onClose={onCloseDropdown}
                  onViewDetails={onViewDetails}
                  onToast={onToast}
                  onSuspend={onSuspend}
                  onDelete={onDelete}
                  onRefresh={onRefresh}
                  onConfirmAction={onConfirmAction}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
