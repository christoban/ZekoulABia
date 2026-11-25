'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useT } from '@/lib/i18n'
import { BoolSelect, FieldLabel } from './MinesecFormFields'
import MinesecInfrastructuresCard from './MinesecInfrastructuresCard'
import MinesecEstpCard from './MinesecEstpCard'
import {
  btnPri,
  btnSec,
  btnSmall,
  cardStyle,
  cardStyleCls,
  inputStyle,
  smallInputStyle,
  type ChampManquant,
  type Meta,
  type Supplement,
} from './types'

interface MinesecSupplementTabProps {
  supplement: Supplement | null
  isStale: boolean
  meta: Meta | null
  form: Partial<Supplement>
  setForm: Dispatch<SetStateAction<Partial<Supplement>>>
  champsManquants: ChampManquant[]
  saving: boolean
  onSave: () => void
}

export default function MinesecSupplementTab({
  supplement,
  isStale,
  meta,
  form,
  setForm,
  champsManquants,
  saving,
  onSave,
}: MinesecSupplementTabProps) {
  const t = useT('admin')

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

  return (
    <div>
      {supplement?.lastUpdatedAt && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
            {t('minesecStats.lastUpdated')} : {new Date(supplement.lastUpdatedAt).toLocaleDateString()}
          </span>
          {isStale && (
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#b45309', background: 'rgba(234,179,8,0.12)', padding: '2px 8px', borderRadius: 10 }}>
              {t('minesecStats.staleWarning')}
            </span>
          )}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{t('minesecStats.persistenceExplainer')}</p>

      {/* Identification */}
      <div className={cardStyleCls} style={cardStyle}>
        <h3 className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('minesecStats.sectionIdentification')}</h3>

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
          <div style={{ display: 'flex', gap: 10 }}>
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
        <div className="grid grid-cols-2 sm:flex gap-2 md:gap-2.5">
          {(['moins1km', 'entre1et3km', 'entre4et5km', 'plus5km'] as const).map((key) => (
            <div key={key} className="sm:flex-1">
              <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 3 }}>{t(`minesecStats.ecolesPrimaires_${key}`)}</div>
              <input style={smallInputStyle} type="number"
                value={form.ecolesPrimairesProximite?.[key] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ecolesPrimairesProximite: { ...(f.ecolesPrimairesProximite ?? {}), [key]: e.target.value === '' ? undefined : Number(e.target.value) } }))} />
            </div>
          ))}
        </div>
      </div>

      {/* Historique BIP */}
      <div className={cardStyleCls} style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('minesecStats.sectionBip')}</h3>
          <button onClick={addBip} style={btnSmall}>+ {t('minesecStats.addBip')}</button>
        </div>
        {(form.historiqueBip ?? []).length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t('minesecStats.bipEmpty')}</p>
        )}
        {(form.historiqueBip ?? []).map((bip, idx: number) => (
          <div key={idx} className="flex-wrap md:flex-nowrap" style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
            <input className="flex-1 min-w-[140px]" style={inputStyle} placeholder={t('minesecStats.bipDesignation')} value={bip.designation} onChange={(e) => updateBip(idx, 'designation', e.target.value)} />
            <input style={{ ...inputStyle, maxWidth: 110 }} placeholder={t('minesecStats.bipAnnee')} value={bip.anneeObtention} onChange={(e) => updateBip(idx, 'anneeObtention', e.target.value)} />
            <button onClick={() => removeBip(idx)} style={{ ...btnSec, padding: '5px 10px', fontSize: 12, color: 'var(--red)', borderColor: 'var(--red)' }}>×</button>
          </div>
        ))}
      </div>

      {/* Infrastructures */}
      {meta && <MinesecInfrastructuresCard meta={meta} form={form} setForm={setForm} />}

      {/* Effectifs techniques ESTP */}
      {meta && meta.specialitesTechniques.length > 0 && (
        <MinesecEstpCard meta={meta} form={form} setForm={setForm} />
      )}

      {champsManquants.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)', borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>{t('minesecStats.champsManquantsTitle')}</p>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {champsManquants.map((c) => <li key={c.champ} style={{ fontSize: 12, color: 'var(--text2)' }}>{c.label}</li>)}
          </ul>
        </div>
      )}

      <button onClick={onSave} disabled={saving} style={btnPri}>{saving ? '...' : t('minesecStats.saveSupplement')}</button>
    </div>
  )
}
