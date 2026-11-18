'use client'

import { ArrowLeft } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { AccountChoice } from '../_helpers/loginConfig'

interface Props {
  accountChoices: AccountChoice[] | null
  loading: boolean
  onBack: () => void
  onSelectAccount: (account: AccountChoice) => void
}

export default function AccountChoiceStep({
  accountChoices,
  loading,
  onBack,
  onSelectAccount,
}: Props) {
  const t = useT('common')

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text3)',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          fontFamily: 'inherit',
          marginBottom: 16,
          padding: 0,
        }}
      >
        <ArrowLeft size={16} /> {t('login.back')}
      </button>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 6px' }}>
          {t('login.choose_account_title')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500, margin: 0 }}>
          {t('login.choose_account_subtitle')}
        </p>
      </div>
      {accountChoices &&
        accountChoices.map((account) => (
          <button
            key={account.userId}
            type="button"
            onClick={() => onSelectAccount(account)}
            disabled={loading}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '14px 16px',
              marginBottom: 10,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{account.schoolName}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
              {t(`login.role_${account.role.toLowerCase()}`) || account.role} · {account.nomComplet}
            </div>
          </button>
        ))}
    </div>
  )
}
