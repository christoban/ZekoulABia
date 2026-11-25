'use client'

import { Search, Building2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { SchoolDto } from '../../_types'

interface Props {
  schools: SchoolDto[]
  modeTest: boolean | null
  disabledSchoolIds: string[]
  schoolSearch: string
  schoolBusyId: string | null
  onSearchChange: (q: string) => void
  onToggleSchool: (schoolId: string, schoolName: string, prochainEtatEnvoiActif: boolean) => void
}

export default function ModeTestSchoolsCard({
  schools,
  modeTest,
  disabledSchoolIds,
  schoolSearch,
  schoolBusyId,
  onSearchChange,
  onToggleSchool,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Building2 size={16} />
            <span>{t('mode_test.per_school_title')}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                background: disabledSchoolIds.length > 0 ? 'var(--red-light)' : 'var(--bg2)',
                color: disabledSchoolIds.length > 0 ? 'var(--red)' : 'var(--text2)',
              }}
            >
              {t('mode_test.per_school_badge', { count: disabledSchoolIds.length })}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>
            {t('mode_test.per_school_desc')}
          </div>
        </div>

        <div className="w-full sm:w-auto" style={{ position: 'relative', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            type="text"
            value={schoolSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('mode_test.search_school')}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 10px 8px 30px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg2)',
              fontSize: 12.5,
              color: 'var(--text)',
            }}
          />
        </div>
      </div>

      {schools.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '12px 0' }}>
          {t('mode_test.no_school')}
        </div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {schools.map((school) => {
            const ecoleEnModeTest = disabledSchoolIds.includes(school.id)
            const effectifEnModeTest = modeTest === false || ecoleEnModeTest
            const busy = schoolBusyId === school.id

            return (
              <div
                key={school.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${ecoleEnModeTest ? 'var(--red)' : 'var(--border)'}`,
                  background: ecoleEnModeTest ? 'var(--red-light)' : 'var(--bg)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 180, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{school.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                      ({school.subdomain})
                    </span>
                    {effectifEnModeTest && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: 999,
                          background: 'var(--surface)',
                          color: 'var(--red)',
                        }}
                      >
                        {modeTest === false ? t('mode_test.via_global') : t('mode_test.active_badge')}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                    {school.city ?? t('mode_test.city_unknown')} · {t('mode_test.status_label')} : {school.status}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onToggleSchool(school.id, school.name, ecoleEnModeTest)}
                  className="w-full sm:w-auto"
                  style={{
                    padding: '7px 12px',
                    minHeight: 36,
                    borderRadius: 8,
                    border: ecoleEnModeTest ? 'none' : '1px solid var(--red)',
                    background: ecoleEnModeTest ? 'var(--green)' : 'var(--surface)',
                    color: ecoleEnModeTest ? '#fff' : 'var(--red)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {ecoleEnModeTest ? t('mode_test.btn_enable_school_sends') : t('mode_test.btn_put_in_test')}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
