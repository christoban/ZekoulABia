'use client'

import { useT } from '@/lib/i18n'
import { fmtRhDate, rhChipStyle, type LeaveRequestItem, type LeaveStatus } from './types'

interface RhLeavesTabProps {
  leaveRequests: LeaveRequestItem[]
  loadingLeaves: boolean
  onRefresh: () => void
  onApproveLeave: (leaveId: string, statut: Exclude<LeaveStatus, 'PENDING'>) => void
}

export default function RhLeavesTab({
  leaveRequests,
  loadingLeaves,
  onRefresh,
  onApproveLeave,
}: RhLeavesTabProps) {
  const t = useT('admin')
  const pending = leaveRequests.filter(l => l.statut === 'PENDING')
  const history = leaveRequests.filter(l => l.statut !== 'PENDING')

  return (
    <div className="grid grid-cols-1 md:[grid-template-columns:1fr_1fr] gap-3 md:gap-3.5">
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <div className="text-[13px] md:text-[14px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{t('rh.pendingRequests')}</div>
          <button style={{ ...rhChipStyle('var(--bg2)', 'var(--text2)'), border: 'none', cursor: 'pointer' }} onClick={onRefresh}>{t('rh.refresh')}</button>
        </div>
        {loadingLeaves ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('rh.loading')}</div>
        ) : (
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(req => (
              <div key={req.id} style={{ border: '1px solid var(--bg2)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{req.user.firstName} {req.user.lastName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>{req.type} · {fmtRhDate(req.dateDebut)} → {fmtRhDate(req.dateFin)}</div>
                  </div>
                  <span style={rhChipStyle('var(--amber-light)', 'var(--amber)')}>{req.statut}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>{req.motif ?? '—'}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button className="min-h-[38px] px-3.5" style={{ ...rhChipStyle('var(--green-light)', 'var(--green)'), border: 'none', cursor: 'pointer' }} onClick={() => onApproveLeave(req.id, 'APPROVED')}>{t('rh.approve')}</button>
                  <button className="min-h-[38px] px-3.5" style={{ ...rhChipStyle('var(--red-light)', 'var(--red)'), border: 'none', cursor: 'pointer' }} onClick={() => onApproveLeave(req.id, 'REJECTED')}>{t('rh.reject')}</button>
                </div>
              </div>
            ))}
            {pending.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('rh.noPending')}</div>}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div className="text-[13px] md:text-[14px] px-[12px] py-[10px] md:px-[16px] md:py-[11px]" style={{ borderBottom: '1px solid var(--border)', fontWeight: 800, color: 'var(--text)' }}>{t('rh.leaveHistory')}</div>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map(req => (
            <div key={req.id} style={{ border: '1px solid var(--bg2)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{req.user.firstName} {req.user.lastName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>{req.type} · {fmtRhDate(req.dateDebut)} → {fmtRhDate(req.dateFin)}</div>
                </div>
                <span style={rhChipStyle(req.statut === 'APPROVED' ? 'var(--green-light)' : 'var(--red-light)', req.statut === 'APPROVED' ? 'var(--green)' : 'var(--red)')}>{req.statut}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>{t('rh.validatedBy')} {req.validator ? `${req.validator.firstName} ${req.validator.lastName}` : '—'}</div>
            </div>
          ))}
          {history.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>{t('rh.noHistory')}</div>}
        </div>
      </div>
    </div>
  )
}
