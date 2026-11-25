'use client'

import { useT } from '@/lib/i18n'
import type { SuppressedOutboundMessageDto, SchoolDto } from '../../_types'

interface Props {
  messages: SuppressedOutboundMessageDto[]
  loading: boolean
  hasGlobalSchoolView: boolean
  realSchools: SchoolDto[]
  schoolNameById: Map<string, string>
  filtreEcoleMessages: string
  onFilterChange: (schoolId: string) => void
  onRefresh: () => void
}

export default function SuppressedMessagesCard({
  messages,
  loading,
  hasGlobalSchoolView,
  realSchools,
  schoolNameById,
  filtreEcoleMessages,
  onFilterChange,
  onRefresh,
}: Props) {
  const t = useT('master')

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 'clamp(12px, 3.6vw, 18px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
          3. {t('mode_test.supprimes_titre')}
        </div>
        <div className="w-full sm:w-auto" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={filtreEcoleMessages}
            onChange={(e) => onFilterChange(e.target.value)}
            className="flex-1 sm:flex-initial"
            style={{
              padding: '6px 10px',
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            {hasGlobalSchoolView && <option value="">{t('mode_test.all_schools')}</option>}
            {realSchools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={loading}
            onClick={onRefresh}
            style={{
              padding: '6px 10px',
              borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {t('mode_test.rafraichir')}
          </button>
        </div>
      </div>

      {messages.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '12px 0' }}>
          {t('mode_test.supprimes_vide')}
        </div>
      ) : (
        <>
          {/* Vue Mobile (< md) : cartes empilées natives */}
          <div className="flex md:hidden" style={{ flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text)' }}>{m.channel} · {m.eventType}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(m.createdAt).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {m.schoolId ? (schoolNameById.get(m.schoolId) ?? m.schoolId) : t('mode_test.unattached')}
                </div>
                <div style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--text)' }}>
                  {m.recipientMasked}
                </div>
              </div>
            ))}
          </div>

          {/* Vue Desktop (>= md) : tableau */}
          <div className="hidden md:block" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 10px' }}>{t('mode_test.col_date')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('mode_test.col_canal')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('mode_test.col_type')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('mode_test.col_school')}</th>
                  <th style={{ padding: '8px 10px' }}>{t('mode_test.col_destinataire')}</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text)' }}>{m.channel}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>{m.eventType}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>
                      {m.schoolId ? (schoolNameById.get(m.schoolId) ?? m.schoolId) : t('mode_test.unattached')}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text)' }}>{m.recipientMasked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
