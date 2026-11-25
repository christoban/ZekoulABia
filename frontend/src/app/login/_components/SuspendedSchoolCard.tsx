'use client'

import { Ban } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface Props {
  schoolName: string
  onBack: () => void
}

export default function SuspendedSchoolCard({ schoolName, onBack }: Props) {
  const t = useT('common')

  return (
    <div style={{ animation: 'edu-fadeUp 0.25s ease both' }}>
      <div style={{ background: 'var(--red-light)', border: '1px solid rgba(217,72,31,0.2)', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--red)', marginBottom: 8 }}>
          <Ban size={24} strokeWidth={2} />
        </div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--red)', marginBottom: 7, textAlign: 'center' }}>
          {t('login.suspended_title')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, lineHeight: 1.5, marginBottom: 12 }}>
          {t('login.suspended_msg', { school: schoolName })}
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(217,72,31,0.12)', borderRadius: 7, padding: '9px 12px', marginBottom: 12, fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
          {t('login.suspended_support')}{' '}
          <a href="mailto:zekoulabia.noreply@gmail.com" style={{ color: 'var(--primary)', fontWeight: 700 }}>
            zekoulabia.noreply@gmail.com
          </a>
        </div>
        <button
          onClick={onBack}
          style={{
            width: '100%',
            minHeight: 44,
            padding: '9px 0',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--text2)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('login.suspended_back')}
        </button>
      </div>
    </div>
  )
}
