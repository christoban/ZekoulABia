'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import { useT } from '@/lib/i18n'
import { BoolSelect } from './MinesecFormFields'
import { cardStyle, cardStyleCls, smallInputStyle, type InfrastructuresDetailMap, type Meta, type Supplement } from './types'

interface MinesecInfrastructuresCardProps {
  meta: Meta
  form: Partial<Supplement>
  setForm: Dispatch<SetStateAction<Partial<Supplement>>>
}

export default function MinesecInfrastructuresCard({ meta, form, setForm }: MinesecInfrastructuresCardProps) {
  const t = useT('admin')
  const [expandedInfraRow, setExpandedInfraRow] = useState<string | null>(null)

  const setInfraValue = (subsystem: string, code: string, breakdownKey: string, value: number | null) => {
    const detail: InfrastructuresDetailMap = { ...(form.infrastructuresDetail ?? {}) }
    const subMap = (detail[subsystem] as Record<string, Record<string, number | null | undefined> | undefined> | undefined) ?? {}
    const sub = { ...subMap }
    sub[code] = { ...(sub[code] ?? {}), [breakdownKey]: value }
    detail[subsystem] = sub
    setForm((f) => ({ ...f, infrastructuresDetail: detail }))
  }

  const getInfraValue = (subsystem: string, code: string, breakdownKey: string): number | null => {
    const subMap = form.infrastructuresDetail?.[subsystem] as Record<string, Record<string, number | null | undefined> | undefined> | undefined
    return subMap?.[code]?.[breakdownKey] ?? null
  }

  const getInfraRowTotal = (subsystem: string, code: string): number => {
    const subMap = form.infrastructuresDetail?.[subsystem] as Record<string, Record<string, number | null | undefined> | undefined> | undefined
    const row = subMap?.[code]
    if (!row) return 0
    return ['definitifBon', 'definitifAcceptable', 'definitifMauvais', 'provisoireBon', 'provisoireAcceptable', 'provisoireMauvais']
      .reduce((sum, k) => sum + (Number(row[k]) || 0), 0)
  }

  const setCommodite = (code: string, value: boolean | null) => {
    const detail = { ...(form.infrastructuresDetail ?? {}) }
    detail.commodites = { ...(detail.commodites ?? {}), [code]: value }
    setForm((f) => ({ ...f, infrastructuresDetail: detail }))
  }

  const getCommodite = (code: string): boolean | null => form.infrastructuresDetail?.commodites?.[code] ?? null

  return (
    <div className={cardStyleCls} style={cardStyle}>
      <h3 className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{t('minesecStats.sectionInfrastructures')}</h3>
      <p style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 12 }}>{t('minesecStats.infrastructuresHint')}</p>

      {meta.subsystems.map((s) => (
        <div key={s.code} style={{ marginBottom: 16 }}>
          {meta.subsystems.length > 1 && (
            <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{s.label}</h4>
          )}
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {meta.infraRows.map((row) => {
              const total = getInfraRowTotal(s.code, row.code)
              const places = getInfraValue(s.code, row.code, 'placesDisponibles')
              const rowKey = `${s.code}__${row.code}`
              const isOpen = expandedInfraRow === rowKey
              return (
                <div key={row.code} style={{ borderTop: '1px solid var(--bg)' }}>
                  <div onClick={() => setExpandedInfraRow(isOpen ? null : rowKey)}
                    className="flex-wrap gap-[6px]"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text)' }}>{row.label}</span>
                    <span className="gap-[8px] md:gap-[12px]" style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex' }}>
                      <span>{t('minesecStats.infraTotalLocaux')}: <strong style={{ color: 'var(--text)' }}>{total}</strong></span>
                      <span>{isOpen ? '▲' : '▼'}</span>
                    </span>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '4px 12px 12px', background: 'var(--bg2)' }}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 3 }}>{t('minesecStats.infraPlaces')}</div>
                        <input style={{ ...smallInputStyle, maxWidth: 130 }} type="number" min={0}
                          value={places ?? ''}
                          onChange={(e) => setInfraValue(s.code, row.code, 'placesDisponibles', e.target.value === '' ? null : Number(e.target.value))} />
                      </div>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {meta.infraBreakdownKeys.filter((b) => b.key !== 'placesDisponibles').map((b) => (
                          <div key={b.key} style={{ minWidth: 100 }}>
                            <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 3 }}>{b.label}</div>
                            <input style={smallInputStyle} type="number" min={0}
                              value={getInfraValue(s.code, row.code, b.key) ?? ''}
                              onChange={(e) => setInfraValue(s.code, row.code, b.key, e.target.value === '' ? null : Number(e.target.value))} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: '16px 0 8px' }}>{t('minesecStats.sectionCommodites')}</h4>
      {meta.commoditesRows.map((row) => (
        <div key={row.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--bg)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{row.label}</span>
          <div style={{ width: 130 }}>
            <BoolSelect value={getCommodite(row.code)} onChange={(v) => setCommodite(row.code, v)} />
          </div>
        </div>
      ))}
    </div>
  )
}
