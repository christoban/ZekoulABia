'use client'

import { Users, UserPlus, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'

interface Props {
  showCreateForm: boolean
  onRefresh: () => void
  onToggleCreateForm: () => void
}

/** En-tête de la section Équipe Master avec actions d'actualisation et d'ajout */
export default function TeamSectionHeader({ showCreateForm, onRefresh, onToggleCreateForm }: Props) {
  const t = useT('master')

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 220px' }}>
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
        <div style={{ minWidth: 0 }}>
          <h1 className="text-[18px] md:text-[20px]" style={{ margin: 0, fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
            {t('team.title')}
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--text3)' }}>
            {t('team.subtitle')}
          </p>
        </div>
      </div>

      <div className="w-full sm:w-auto" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onRefresh}
          aria-label={t('team.refresh')}
          title={t('team.refresh')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 13px',
            minHeight: 38,
            minWidth: 38,
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
          <span className="hidden sm:inline">{t('team.refresh')}</span>
        </button>
        <button
          type="button"
          onClick={onToggleCreateForm}
          className="flex-1 sm:flex-initial justify-center"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '8px 16px',
            minHeight: 38,
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
  )
}
