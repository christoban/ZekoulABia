'use client'

import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { useT } from '@/lib/i18n'
import { btnSec, btnSmall, cardStyle, cardStyleCls, smallInputStyle, type EstpEntry, type Meta, type Supplement } from './types'

interface MinesecEstpCardProps {
  meta: Meta
  form: Partial<Supplement>
  setForm: Dispatch<SetStateAction<Partial<Supplement>>>
}

export default function MinesecEstpCard({ meta, form, setForm }: MinesecEstpCardProps) {
  const t = useT('admin')

  const addEstpEntry = () => {
    const list: EstpEntry[] = Array.isArray(form.effectifsTechniquesDetail) ? form.effectifsTechniquesDetail : []
    setForm((f) => ({
      ...f,
      effectifsTechniquesDetail: [...list, {
        specialiteAcronyme: meta.specialitesTechniques[0]?.acronyme ?? '',
        anneeEtude: meta.anneesEtudeEstp[0]?.anneeEtude ?? '',
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

  return (
    <div className={cardStyleCls} style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <h3 className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('minesecStats.sectionEstp')}</h3>
        <button onClick={addEstpEntry} style={btnSmall}>+ {t('minesecStats.addEstp')}</button>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 12 }}>{t('minesecStats.estpHint')}</p>

      {(form.effectifsTechniquesDetail ?? []).length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>{t('minesecStats.estpEmpty')}</p>
      )}

      {(form.effectifsTechniquesDetail ?? []).map((entry: EstpEntry, idx: number) => {
        const anneeInfo = meta.anneesEtudeEstp.find((a) => a.anneeEtude === entry.anneeEtude)
        const used = estpUsageParAnnee[entry.anneeEtude] ?? 0
        const overCapacity = anneeInfo ? used > anneeInfo.capaciteMax : false
        return (
          <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <div className="flex-wrap sm:flex-nowrap" style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <div className="flex-1 min-w-[150px] sm:flex-[2]">
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 3 }}>{t('minesecStats.estpSpecialite')}</div>
                <select style={smallInputStyle} value={entry.specialiteAcronyme} onChange={(e) => updateEstpEntry(idx, { specialiteAcronyme: e.target.value })}>
                  {meta.specialitesTechniques.map((s) => (
                    <option key={s.acronyme} value={s.acronyme}>{s.acronyme} — {s.designationFr}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[90px]">
                <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 3 }}>{t('minesecStats.estpAnnee')}</div>
                <select style={smallInputStyle} value={entry.anneeEtude} onChange={(e) => updateEstpEntry(idx, { anneeEtude: e.target.value })}>
                  {meta.anneesEtudeEstp.map((a) => (
                    <option key={a.anneeEtude} value={a.anneeEtude}>{a.anneeEtude}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => removeEstpEntry(idx)} style={{ ...btnSec, padding: '4px 10px', fontSize: 11.5, color: 'var(--red)', borderColor: 'var(--red)', alignSelf: 'flex-end' }}>×</button>
            </div>
            <div className="grid grid-cols-3 sm:flex gap-2">
              {([
                ['divisions', 'estpDivisions'],
                ['fillesTotal', 'estpFillesTotal'],
                ['garconsTotal', 'estpGarconsTotal'],
                ['fillesRedoublants', 'estpFillesRedoublants'],
                ['garconsRedoublants', 'estpGarconsRedoublants'],
              ] as const).map(([key, labelKey]) => (
                <div key={key} className="sm:flex-1">
                  <div style={{ fontSize: 10.5, color: 'var(--text3)', marginBottom: 3 }}>{t(`minesecStats.${labelKey}`)}</div>
                  <input style={smallInputStyle} type="number" min={0} value={entry[key] ?? 0}
                    onChange={(e) => updateEstpEntry(idx, { [key]: Number(e.target.value) } as Partial<EstpEntry>)} />
                </div>
              ))}
            </div>
            {overCapacity && (
              <p style={{ fontSize: 10.5, color: 'var(--red)', marginTop: 6 }}>{t('minesecStats.estpOverCapacity')}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
