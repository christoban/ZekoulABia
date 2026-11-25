'use client'

import { useT } from '@/lib/i18n'

interface Props {
  modeTest: boolean
  isSuperAdmin: boolean
  modeTestBusy: boolean
  confirmDesactivation: boolean
  reservedFounderLabel: string
  onRequestDisable: () => void
  onCancelDisable: () => void
  onToggleGlobal: (nextEnabled: boolean) => void
}

export default function ModeTestGlobalCard({
  modeTest,
  isSuperAdmin,
  modeTestBusy,
  confirmDesactivation,
  reservedFounderLabel,
  onRequestDisable,
  onCancelDisable,
  onToggleGlobal,
}: Props) {
  const t = useT('master')

  return (
    <div
      style={{
        background: modeTest ? 'var(--surface)' : 'var(--red-light)',
        border: `1.5px solid ${modeTest ? 'var(--border)' : 'var(--red)'}`,
        borderRadius: 12,
        padding: 'clamp(12px, 3.6vw, 18px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{t('mode_test.global_title')}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: modeTest ? 'var(--green-light)' : 'var(--surface)',
                color: modeTest ? 'var(--green)' : 'var(--red)',
              }}
            >
              {modeTest ? t('mode_test.statut_actif') : t('mode_test.statut_inactif')}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
            {modeTest ? t('mode_test.desc_actif') : t('mode_test.desc_inactif')}
          </div>
        </div>

        {isSuperAdmin ? (
          modeTest ? (
            <button
              type="button"
              disabled={modeTestBusy}
              onClick={onRequestDisable}
              className="w-full sm:w-auto"
              style={{
                padding: '8px 14px',
                minHeight: 38,
                borderRadius: 9,
                border: '1px solid var(--red)',
                background: 'var(--surface)',
                color: 'var(--red)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: modeTestBusy ? 'wait' : 'pointer',
              }}
            >
              {t('mode_test.btn_desactiver')}
            </button>
          ) : (
            <button
              type="button"
              disabled={modeTestBusy}
              onClick={() => onToggleGlobal(true)}
              className="w-full sm:w-auto"
              style={{
                padding: '8px 14px',
                minHeight: 38,
                borderRadius: 9,
                border: 'none',
                background: 'var(--green)',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: modeTestBusy ? 'wait' : 'pointer',
              }}
            >
              {t('mode_test.btn_activer')}
            </button>
          )
        ) : (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: 'var(--text2)',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              padding: '6px 10px',
              borderRadius: 8,
            }}
          >
            {/* Réservé au Fondateur (super_admin) */}
            {reservedFounderLabel}
          </span>
        )}
      </div>

      {/* Confirmation avant désactivation globale */}
      {confirmDesactivation && modeTest && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 10,
            background: 'var(--red-light)',
            border: '1px solid var(--red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>
            {t('mode_test.confirm_texte')}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={modeTestBusy}
              onClick={onCancelDisable}
              style={{
                padding: '6px 12px',
                borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('mode_test.confirm_annuler')}
            </button>
            <button
              type="button"
              disabled={modeTestBusy}
              onClick={() => onToggleGlobal(false)}
              style={{
                padding: '6px 12px',
                borderRadius: 7,
                border: 'none',
                background: 'var(--red)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: modeTestBusy ? 'wait' : 'pointer',
              }}
            >
              {t('mode_test.confirm_oui')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
