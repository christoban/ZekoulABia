'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface Supplement {
  hasTitreFoncier: boolean | null
  siteProvisoire: boolean | null
  distanceEtablissementProchePublic: number | null
  superficieTerrainM2: number | null
  superficieExtensionM2: number | null
  natureVoiesAcces: string | null
  nombreCycles: number | null
  hasInternat: boolean | null
  placesInternatFilles: number | null
  placesInternatGarcons: number | null
  ecolesPrimairesProximite: { moins1km?: number; entre1et3km?: number; entre4et5km?: number; plus5km?: number } | null
  posteComptable: string | null
  historiqueBip: { designation: string; anneeObtention: string }[] | null
  infrastructuresDetail: Record<string, any> | null
  effectifsTechniquesDetail: EstpEntry[] | null
  lastUpdatedAt: string | null
}

interface EstpEntry {
  specialiteAcronyme: string
  anneeEtude: string
  divisions: number
  fillesTotal: number
  garconsTotal: number
  fillesRedoublants: number
  garconsRedoublants: number
}

interface ChampManquant { champ: string; label: string }
interface ChampNonResolu { fieldCode: string; sheetName: string; cellReference: string; fieldLabel: string; raison: string }
interface Submission { id: string; status: string; generatedAt: string; filePath: string | null }
interface InfraRow { code: string; label: string; row: number }
interface InfraBreakdownKey { key: string; label: string }
interface Meta {
  infraRows: InfraRow[]
  infraBreakdownKeys: InfraBreakdownKey[]
  commoditesRows: InfraRow[]
  subsystems: { code: string; label: string }[]
  specialitesTechniques: { acronyme: string; designationFr: string }[]
  anneesEtudeEstp: { anneeEtude: string; capaciteMax: number }[]
}

const btnPri = { padding: '10px 14px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' as const }
const btnSec = { padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' as const }
const btnSmall = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12, cursor: 'pointer' as const }
const inputStyle = { padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, width: '100%', boxSizing: 'border-box' as const }
const smallInputStyle = { ...inputStyle, padding: '6px 10px', fontSize: 13 }
const cardStyleCls = 'rounded-[10px] md:rounded-[8px] p-3 md:p-3.5 mb-[12px] md:mb-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[var(--border)]'
const cardStyle = { background: 'var(--surface)' }

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', margin: '12px 0 6px' }}>{children}</div>
}

function BoolSelect({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const t = useT('admin')
  return (
    <select style={inputStyle} value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
      <option value="">—</option>
      <option value="true">{t('minesecStats.oui')}</option>
      <option value="false">{t('minesecStats.non')}</option>
    </select>
  )
}

export default function SectionMinesecStatistics({ onToast }: Props) {
  const t = useT('admin')
  const [tab, setTab] = useState<'supplement' | 'generer'>('supplement')

  const [supplement, setSupplement] = useState<Supplement | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [champsManquants, setChampsManquants] = useState<ChampManquant[]>([])
  const [champsNonResolus, setChampsNonResolus] = useState<ChampNonResolu[]>([])
  const [generating, setGenerating] = useState(false)
  const [lastSubmission, setLastSubmission] = useState<Submission | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [supRes, subRes, metaRes] = await Promise.all([
        fetchApi('/api/v2/statistical-campaign/supplement', { credentials: 'include' }),
        fetchApi('/api/v2/statistical-campaign/submissions', { credentials: 'include' }),
        fetchApi('/api/v2/statistical-campaign/meta', { credentials: 'include' }),
      ])
      const supData = await supRes.json()
      const subData = await subRes.json()
      const metaData = await metaRes.json()
      if (supData.success) {
        setSupplement(supData.data)
        setForm(supData.data ?? {})
      }
      if (subData.success) setSubmissions(subData.data || [])
      if (metaData.success) setMeta(metaData.data)
    } catch { onToast(t('minesecStats.errorGeneric'), 'error') } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const isStale = useMemo(() => {
    if (!supplement?.lastUpdatedAt) return false
    const days = (Date.now() - new Date(supplement.lastUpdatedAt).getTime()) / 86400000
    return days > 300
  }, [supplement])

  const saveSupplement = async () => {
    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/statistical-campaign/supplement', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        onToast(t('minesecStats.supplementSaved'), 'success')
        setSupplement(data.data)
        setChampsManquants([])
      } else onToast(data.message || t('minesecStats.errorGeneric'), 'error')
    } catch { onToast(t('minesecStats.errorGeneric'), 'error') } finally { setSaving(false) }
  }

  const addBip = () => {
    const list = Array.isArray(form.historiqueBip) ? form.historiqueBip : []
    setForm((f) => ({ ...f, historiqueBip: [...list, { designation: '', anneeObtention: '' }] }))
  }
  const updateBip = (idx: number, key: 'designation' | 'anneeObtention', value: string) => {
    const list = [...(form.historiqueBip ?? [])]
    list[idx] = { ...list[idx], [key]: value }
    setForm((f) => ({ ...f, historiqueBip: list }))
  }
  const removeBip = (idx: number) => {
    const list = [...(form.historiqueBip ?? [])]
    list.splice(idx, 1)
    setForm((f) => ({ ...f, historiqueBip: list }))
  }

  const [expandedInfraRow, setExpandedInfraRow] = useState<string | null>(null)
  const setInfraValue = (subsystem: string, code: string, breakdownKey: string, value: number | null) => {
    const detail = { ...(form.infrastructuresDetail ?? {}) }
    const sub = { ...(detail[subsystem] ?? {}) }
    sub[code] = { ...(sub[code] ?? {}), [breakdownKey]: value }
    detail[subsystem] = sub
    setForm((f) => ({ ...f, infrastructuresDetail: detail }))
  }
  const getInfraValue = (subsystem: string, code: string, breakdownKey: string): number | null => {
    return form.infrastructuresDetail?.[subsystem]?.[code]?.[breakdownKey] ?? null
  }
  const getInfraRowTotal = (subsystem: string, code: string): number => {
    const row = form.infrastructuresDetail?.[subsystem]?.[code]
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

  const addEstpEntry = () => {
    const list: EstpEntry[] = Array.isArray(form.effectifsTechniquesDetail) ? form.effectifsTechniquesDetail : []
    setForm((f) => ({
      ...f,
      effectifsTechniquesDetail: [...list, {
        specialiteAcronyme: meta?.specialitesTechniques[0]?.acronyme ?? '',
        anneeEtude: meta?.anneesEtudeEstp[0]?.anneeEtude ?? '',
        divisions: 1, fillesTotal: 0, garconsTotal: 0, fillesRedoublants: 0, garconsRedoublants: 0,
      }],
    }))
  }
  const updateEstpEntry = (idx: number, patch: Partial<EstpEntry>) => {
    const list = [...(form.effectifsTechniquesDetail ?? [])]
    list[idx] = { ...list[idx], ...patch }
    setForm((f) => ({ ...f, effectifsTechniquesDetail: list }))
  }
  const removeEstpEntry = (idx: number) => {
    const list = [...(form.effectifsTechniquesDetail ?? [])]
    list.splice(idx, 1)
    setForm((f) => ({ ...f, effectifsTechniquesDetail: list }))
  }
  const estpUsageParAnnee = useMemo(() => {
    const usage: Record<string, number> = {}
    for (const e of (form.effectifsTechniquesDetail ?? []) as EstpEntry[]) {
      usage[e.anneeEtude] = (usage[e.anneeEtude] ?? 0) + 1
    }
    return usage
  }, [form.effectifsTechniquesDetail])

  const genererDeclaration = async () => {
    setGenerating(true)
    setChampsManquants([])
    setChampsNonResolus([])
    try {
      const res = await fetchApi('/api/v2/statistical-campaign/generer', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!data.success) { onToast(data.message || t('minesecStats.errorGeneric'), 'error'); return }
      const result = data.data
      if (result.status === 'PENDING_MANUAL_DATA') {
        setChampsManquants(result.champsManquants)
        onToast(t('minesecStats.generationBlocked'), 'error')
        setTab('supplement')
      } else {
        setChampsNonResolus(result.champsNonResolus || [])
        setLastSubmission({ id: result.submissionId, status: result.status, generatedAt: new Date().toISOString(), filePath: result.filePath })
        onToast(t('minesecStats.generationSuccess'), 'success')
        fetchAll()
      }
    } catch { onToast(t('minesecStats.errorGeneric'), 'error') } finally { setGenerating(false) }
  }

  const downloadSubmission = (id: string) => {
    window.open(`/api/v2/statistical-campaign/submissions/${id}/download`, '_blank')
  }

  if (loading) return <div style={{ padding: 26, textAlign: 'center', color: 'var(--text3)' }}>{t('common.loading') || '...'}</div>

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 13 }}>
        <h2 className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>{t('minesecStats.title')}</h2>
        <p className="text-[13px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 4 }}>{t('minesecStats.subtitle')}</p>
      </div>

      <div className="gap-[6px] md:gap-[8px] mb-[16px] md:mb-[16px]" style={{ display: 'flex' }}>
        <button onClick={() => setTab('supplement')} className="flex-1 md:flex-none rounded-[8px] md:rounded-[8px] text-[12.5px] md:text-[12px] py-[10px] px-0 md:px-3.5 md:py-[10px]" style={{ ...(tab === 'supplement' ? btnPri : btnSec), padding: undefined }}>{t('minesecStats.tabSupplement')}</button>
        <button onClick={() => setTab('generer')} className="flex-1 md:flex-none rounded-[8px] md:rounded-[8px] text-[12.5px] md:text-[12px] py-[10px] px-0 md:px-3.5 md:py-[10px]" style={{ ...(tab === 'generer' ? btnPri : btnSec), padding: undefined }}>{t('minesecStats.tabGenerer')}</button>
      </div>

      {tab === 'supplement' && (
        <div>
          {supplement?.lastUpdatedAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                {t('minesecStats.lastUpdated')} : {new Date(supplement.lastUpdatedAt).toLocaleDateString()}
              </span>
              {isStale && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#b45309', background: 'rgba(234,179,8,0.12)', padding: '2px 10px', borderRadius: 8 }}>
                  {t('minesecStats.staleWarning')}
                </span>
              )}
            </div>
          )}
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>{t('minesecStats.persistenceExplainer')}</p>

          <div className={cardStyleCls} style={cardStyle}>
            <h3 className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('minesecStats.sectionIdentification')}</h3>

            <FieldLabel>{t('minesecStats.fieldTitreFoncier')}</FieldLabel>
            <BoolSelect value={form.hasTitreFoncier} onChange={(v) => setForm((f) => ({ ...f, hasTitreFoncier: v }))} />

            <FieldLabel>{t('minesecStats.fieldSiteProvisoire')}</FieldLabel>
            <BoolSelect value={form.siteProvisoire} onChange={(v) => setForm((f) => ({ ...f, siteProvisoire: v }))} />

            <FieldLabel>{t('minesecStats.fieldDistance')}</FieldLabel>
            <input style={inputStyle} type="number" value={form.distanceEtablissementProchePublic ?? ''} onChange={(e) => setForm((f) => ({ ...f, distanceEtablissementProchePublic: e.target.value === '' ? null : Number(e.target.value) }))} />

            <FieldLabel>{t('minesecStats.fieldSuperficie')}</FieldLabel>
            <input style={inputStyle} type="number" value={form.superficieTerrainM2 ?? ''} onChange={(e) => setForm((f) => ({ ...f, superficieTerrainM2: e.target.value === '' ? null : Number(e.target.value) }))} />

            <FieldLabel>{t('minesecStats.fieldSuperficieExtension')}</FieldLabel>
            <input style={inputStyle} type="number" value={form.superficieExtensionM2 ?? ''} onChange={(e) => setForm((f) => ({ ...f, superficieExtensionM2: e.target.value === '' ? null : Number(e.target.value) }))} />

            <FieldLabel>{t('minesecStats.fieldNatureVoiesAcces')}</FieldLabel>
            <input style={inputStyle} value={form.natureVoiesAcces ?? ''} onChange={(e) => setForm((f) => ({ ...f, natureVoiesAcces: e.target.value }))} />

            <FieldLabel>{t('minesecStats.fieldNombreCycles')}</FieldLabel>
            <input style={inputStyle} type="number" value={form.nombreCycles ?? ''} onChange={(e) => setForm((f) => ({ ...f, nombreCycles: e.target.value === '' ? null : Number(e.target.value) }))} />

            <FieldLabel>{t('minesecStats.fieldInternat')}</FieldLabel>
            <BoolSelect value={form.hasInternat} onChange={(v) => setForm((f) => ({ ...f, hasInternat: v }))} />

            {form.hasInternat === true && (
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>{t('minesecStats.fieldPlacesFilles')}</FieldLabel>
                  <input style={inputStyle} type="number" value={form.placesInternatFilles ?? ''} onChange={(e) => setForm((f) => ({ ...f, placesInternatFilles: e.target.value === '' ? null : Number(e.target.value) }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel>{t('minesecStats.fieldPlacesGarcons')}</FieldLabel>
                  <input style={inputStyle} type="number" value={form.placesInternatGarcons ?? ''} onChange={(e) => setForm((f) => ({ ...f, placesInternatGarcons: e.target.value === '' ? null : Number(e.target.value) }))} />
                </div>
              </div>
            )}

            <FieldLabel>{t('minesecStats.fieldPosteComptable')}</FieldLabel>
            <input style={inputStyle} value={form.posteComptable ?? ''} onChange={(e) => setForm((f) => ({ ...f, posteComptable: e.target.value }))} />

            <FieldLabel>{t('minesecStats.fieldEcolesPrimaires')}</FieldLabel>
            <div className="grid grid-cols-2 sm:flex" style={{ gap: 10 }}>
              {(['moins1km', 'entre1et3km', 'entre4et5km', 'plus5km'] as const).map((key) => (
                <div key={key} className="sm:flex-1">
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t(`minesecStats.ecolesPrimaires_${key}`)}</div>
                  <input style={smallInputStyle} type="number"
                    value={form.ecolesPrimairesProximite?.[key] ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, ecolesPrimairesProximite: { ...(f.ecolesPrimairesProximite ?? {}), [key]: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
                </div>
              ))}
            </div>
          </div>

          <div className={cardStyleCls} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h3 className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('minesecStats.sectionBip')}</h3>
              <button onClick={addBip} style={btnSmall}>+ {t('minesecStats.addBip')}</button>
            </div>
            {(form.historiqueBip ?? []).length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>{t('minesecStats.bipEmpty')}</p>
            )}
            {(form.historiqueBip ?? []).map((bip: any, idx: number) => (
              <div key={idx} className="flex-wrap md:flex-nowrap" style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
                <input className="flex-1 min-w-[140px]" style={inputStyle} placeholder={t('minesecStats.bipDesignation')} value={bip.designation} onChange={(e) => updateBip(idx, 'designation', e.target.value)} />
                <input style={{ ...inputStyle, maxWidth: 120 }} placeholder={t('minesecStats.bipAnnee')} value={bip.anneeObtention} onChange={(e) => updateBip(idx, 'anneeObtention', e.target.value)} />
                <button onClick={() => removeBip(idx)} style={{ ...btnSec, padding: '8px 12px', color: 'var(--red)', borderColor: 'var(--red)' }}>×</button>
              </div>
            ))}
          </div>

          {meta && (
            <div className={cardStyleCls} style={cardStyle}>
              <h3 className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('minesecStats.sectionInfrastructures')}</h3>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{t('minesecStats.infrastructuresHint')}</p>

              {meta.subsystems.map((s) => (
                <div key={s.code} style={{ marginBottom: 13 }}>
                  {meta.subsystems.length > 1 && (
                    <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{s.label}</h4>
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
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 11px', cursor: 'pointer' }}>
                            <span style={{ fontSize: 13, color: 'var(--text)' }}>{row.label}</span>
                            <span className="gap-[10px] md:gap-[14px]" style={{ fontSize: 12, color: 'var(--text3)', display: 'flex' }}>
                              <span>{t('minesecStats.infraTotalLocaux')}: <strong style={{ color: 'var(--text)' }}>{total}</strong></span>
                              <span>{isOpen ? '▲' : '▼'}</span>
                            </span>
                          </div>
                          {isOpen && (
                            <div style={{ padding: '4px 11px 11px', background: 'var(--bg2)' }}>
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t('minesecStats.infraPlaces')}</div>
                                <input style={{ ...smallInputStyle, maxWidth: 140 }} type="number" min={0}
                                  value={places ?? ''}
                                  onChange={(e) => setInfraValue(s.code, row.code, 'placesDisponibles', e.target.value === '' ? null : Number(e.target.value))} />
                              </div>
                              <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap' }}>
                                {meta.infraBreakdownKeys.filter((b) => b.key !== 'placesDisponibles').map((b) => (
                                  <div key={b.key} style={{ minWidth: 110 }}>
                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{b.label}</div>
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

              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', margin: '16px 0 10px' }}>{t('minesecStats.sectionCommodites')}</h4>
              {meta.commoditesRows.map((row) => (
                <div key={row.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px', borderBottom: '1px solid var(--bg)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text2)' }}>{row.label}</span>
                  <div style={{ width: 140 }}>
                    <BoolSelect value={getCommodite(row.code)} onChange={(v) => setCommodite(row.code, v)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {meta && meta.specialitesTechniques.length > 0 && (
            <div className={cardStyleCls} style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <h3 className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('minesecStats.sectionEstp')}</h3>
                <button onClick={addEstpEntry} style={btnSmall}>+ {t('minesecStats.addEstp')}</button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{t('minesecStats.estpHint')}</p>

              {(form.effectifsTechniquesDetail ?? []).length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text3)' }}>{t('minesecStats.estpEmpty')}</p>
              )}

              {(form.effectifsTechniquesDetail ?? []).map((entry: EstpEntry, idx: number) => {
                const anneeInfo = meta.anneesEtudeEstp.find((a) => a.anneeEtude === entry.anneeEtude)
                const used = estpUsageParAnnee[entry.anneeEtude] ?? 0
                const overCapacity = anneeInfo ? used > anneeInfo.capaciteMax : false
                return (
                  <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 10 }}>
                    <div className="flex-wrap sm:flex-nowrap" style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                      <div className="flex-1 min-w-[160px] sm:flex-[2]">
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t('minesecStats.estpSpecialite')}</div>
                        <select style={smallInputStyle} value={entry.specialiteAcronyme} onChange={(e) => updateEstpEntry(idx, { specialiteAcronyme: e.target.value })}>
                          {meta.specialitesTechniques.map((s) => (
                            <option key={s.acronyme} value={s.acronyme}>{s.acronyme} — {s.designationFr}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-[100px]">
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t('minesecStats.estpAnnee')}</div>
                        <select style={smallInputStyle} value={entry.anneeEtude} onChange={(e) => updateEstpEntry(idx, { anneeEtude: e.target.value })}>
                          {meta.anneesEtudeEstp.map((a) => (
                            <option key={a.anneeEtude} value={a.anneeEtude}>{a.anneeEtude}</option>
                          ))}
                        </select>
                      </div>
                      <button onClick={() => removeEstpEntry(idx)} style={{ ...btnSec, padding: '6px 12px', color: 'var(--red)', borderColor: 'var(--red)', alignSelf: 'flex-end' }}>×</button>
                    </div>
                    <div className="grid grid-cols-3 sm:flex" style={{ gap: 10 }}>
                      {([
                        ['divisions', 'estpDivisions'],
                        ['fillesTotal', 'estpFillesTotal'],
                        ['garconsTotal', 'estpGarconsTotal'],
                        ['fillesRedoublants', 'estpFillesRedoublants'],
                        ['garconsRedoublants', 'estpGarconsRedoublants'],
                      ] as const).map(([key, labelKey]) => (
                        <div key={key} className="sm:flex-1">
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{t(`minesecStats.${labelKey}`)}</div>
                          <input style={smallInputStyle} type="number" min={0} value={entry[key] ?? 0}
                            onChange={(e) => updateEstpEntry(idx, { [key]: Number(e.target.value) } as Partial<EstpEntry>)} />
                        </div>
                      ))}
                    </div>
                    {overCapacity && (
                      <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 8 }}>{t('minesecStats.estpOverCapacity')}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {champsManquants.length > 0 && (
            <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)', borderRadius: 8, padding: 16, marginBottom: 13 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>{t('minesecStats.champsManquantsTitle')}</p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {champsManquants.map((c) => <li key={c.champ} style={{ fontSize: 13, color: 'var(--text2)' }}>{c.label}</li>)}
              </ul>
            </div>
          )}

          <button onClick={saveSupplement} disabled={saving} style={btnPri}>{saving ? '...' : t('minesecStats.saveSupplement')}</button>
        </div>
      )}

      {tab === 'generer' && (
        <div>
          <div className={cardStyleCls} style={cardStyle}>
            <p className="text-[12.5px] md:text-[12px]" style={{ color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>{t('minesecStats.generateDescription')}</p>
            <button onClick={genererDeclaration} disabled={generating} className="w-full justify-center" style={{ ...btnPri, display: 'inline-flex', alignItems: 'center' }}>
              {generating ? '...' : t('minesecStats.generateBtn')}
            </button>
          </div>

          {lastSubmission && (
            <div className={cardStyleCls} style={{ ...cardStyle, border: '1.5px solid var(--green)' }}>
              <p className="text-[13px] md:text-[12px]" style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>{t('minesecStats.generationSuccess')}</p>
              <button onClick={() => downloadSubmission(lastSubmission.id)} style={btnSec}>{t('minesecStats.downloadBtn')}</button>

              {champsNonResolus.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>
                    {t('minesecStats.champsNonResolusTitle', { count: String(champsNonResolus.length) })}
                  </p>
                  <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
                        <thead>
                          <tr>
                            {[t('minesecStats.colChamp'), t('minesecStats.colFeuille'), t('minesecStats.colRaison')].map((h) => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', background: 'var(--bg2)', color: 'var(--text3)', fontWeight: 700 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {champsNonResolus.map((c, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--bg)' }}>
                              <td style={{ padding: '6px 12px', color: 'var(--text)' }}>{c.fieldLabel}</td>
                              <td style={{ padding: '6px 12px', color: 'var(--text2)' }}>{c.sheetName}</td>
                              <td style={{ padding: '6px 12px', color: 'var(--text3)' }}>{c.raison}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={cardStyleCls} style={cardStyle}>
            <h3 className="text-[12px] md:text-[13px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{t('minesecStats.historyTitle')}</h3>
            {submissions.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>{t('minesecStats.historyEmpty')}</p>
            ) : (
              <>
              <div className="md:hidden flex flex-col" style={{ gap: 8 }}>
                {submissions.map((s) => (
                  <div key={s.id} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: '13px 11px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{new Date(s.generatedAt).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{s.status}</div>
                    </div>
                    {s.filePath && <button onClick={() => downloadSubmission(s.id)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 800, background: 'var(--bg2)', color: 'var(--text)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>{t('minesecStats.downloadBtn')}</button>}
                  </div>
                ))}
              </div>
              <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s.id} style={{ borderTop: '1px solid var(--bg)' }}>
                        <td style={{ padding: '8px 12px', color: 'var(--text2)' }}>{new Date(s.generatedAt).toLocaleString()}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--text2)' }}>{s.status}</td>
                        <td style={{ padding: '8px 12px' }}>
                          {s.filePath && <button onClick={() => downloadSubmission(s.id)} style={{ ...btnSec, padding: '4px 10px', fontSize: 12 }}>{t('minesecStats.downloadBtn')}</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
