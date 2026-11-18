'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import {
  btnSecSm,
  sIn,
  sInCls,
  sLb,
  sLbCls,
  toDateInput,
  type AcademicYear,
  type CalPeriode,
  type CalSequence,
  type YearToastFn,
} from './academicYearUi'

interface Props {
  year: AcademicYear
  onClose: () => void
  onSaved: () => void
  onToast: YearToastFn
}

export default function AcademicCalendarModal({ year, onClose, onSaved, onToast }: Props) {
  const t = useT('admin')
  const [periodes, setPeriodes] = useState<CalPeriode[]>(() =>
    year.periods.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type as 'TRIMESTER' | 'SEMESTER',
      orderIndex: p.orderIndex,
      startDate: toDateInput(p.startDate),
      endDate: toDateInput(p.endDate),
      sequences: p.sequences.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        orderIndex: s.orderIndex,
        startDate: toDateInput(s.startDate),
        endDate: toDateInput(s.endDate),
      })),
    }))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const updP = <K extends keyof CalPeriode>(pi: number, field: K, val: CalPeriode[K]) => {
    setPeriodes(prev => prev.map((p, i) => i === pi ? { ...p, [field]: val } : p))
  }

  const updS = <K extends keyof CalSequence>(pi: number, si: number, field: K, val: CalSequence[K]) => {
    setPeriodes(prev =>
      prev.map((p, i) => i !== pi ? p : {
        ...p,
        sequences: p.sequences.map((s, j) => j !== si ? s : { ...s, [field]: val }),
      })
    )
  }

  const addPeriode = () => setPeriodes(prev => [
    ...prev,
    { name: '', type: 'TRIMESTER', orderIndex: prev.length + 1, startDate: '', endDate: '', sequences: [] },
  ])

  const remPeriode = (pi: number) => setPeriodes(prev => prev.filter((_, i) => i !== pi))

  const addSeq = (pi: number) => setPeriodes(prev =>
    prev.map((p, i) => i !== pi ? p : {
      ...p,
      sequences: [...p.sequences, { name: '', type: '', orderIndex: p.sequences.length + 1, startDate: '', endDate: '' }],
    })
  )

  const remSeq = (pi: number, si: number) => setPeriodes(prev =>
    prev.map((p, i) => i !== pi ? p : { ...p, sequences: p.sequences.filter((_, j) => j !== si) })
  )

  const submitCalendar = async () => {
    for (const p of periodes) {
      if (!p.name.trim() || !p.startDate || !p.endDate) {
        setError(t('academic_year.toast.fillPeriods'))
        return
      }
      if (p.startDate >= p.endDate) {
        setError(t('academic_year.toast.invalidDates', { name: p.name }))
        return
      }
      for (const s of p.sequences) {
        if (!s.name.trim() || !s.type.trim()) {
          setError(t('academic_year.toast.fillSequences'))
          return
        }
      }
    }
    setLoading(true)
    setError('')
    try {
      const body = {
        periodes: periodes.map(p => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name.trim(),
          type: p.type,
          orderIndex: p.orderIndex,
          startDate: p.startDate,
          endDate: p.endDate,
          sequences: p.sequences.map(s => ({
            ...(s.id ? { id: s.id } : {}),
            name: s.name.trim(),
            type: s.type.trim(),
            orderIndex: s.orderIndex,
            ...(s.startDate ? { startDate: s.startDate } : {}),
            ...(s.endDate ? { endDate: s.endDate } : {}),
          })),
        })),
      }
      const res = await fetchApi(`/api/v2/academic-years/${year.id}/calendar`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        let errMsg = data.message || t('academic_year.toast.errServer')
        if (res.status === 422 && errMsg.toLowerCase().includes('archiv')) {
          errMsg = t('academic_year.toast.yearArchived')
        } else if (res.status === 422) {
          errMsg = t('academic_year.toast.invalidPeriodDates')
        }
        setError(errMsg)
        setLoading(false)
        return
      }
      onToast(t('academic_year.toast.calendarUpdated'), 'success')
      onClose()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academic_year.toast.err'))
      setLoading(false)
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 18, width: 720, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="text-[18px] md:text-[22px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('academic_year.calModalTitle')}</div>
        <div className="text-[13.5px] md:text-[15px]" style={{ color: 'var(--text3)', marginBottom: 24 }}>{year.name}</div>

        {periodes.map((p, pi) => (
          <div key={pi} style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: 16 }}>{t('academic_year.periodN', { n: pi + 1 })}</span>
              <button onClick={() => remPeriode(pi)} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{t('academic_year.delete')}</button>
            </div>
            <div className="grid grid-cols-2 sm:[grid-template-columns:1fr_1fr_80px]" style={{ gap: 10 }}>
              <div>
                <div className={sLbCls} style={sLb}>{t('academic_year.nameReq')}</div>
                <input className={sInCls} style={sIn} value={p.name} onChange={e => updP(pi, 'name', e.target.value)} placeholder={t('academic_year.trimesterPlaceholder')} />
              </div>
              <div>
                <div className={sLbCls} style={sLb}>{t('academic_year.typeReq')}</div>
                <select className={sInCls} style={sIn} value={p.type} onChange={e => updP(pi, 'type', e.target.value as 'TRIMESTER' | 'SEMESTER')}>
                  <option value="TRIMESTER">{t('academic_year.trimester')}</option>
                  <option value="SEMESTER">{t('academic_year.semester')}</option>
                </select>
              </div>
              <div>
                <div className={sLbCls} style={sLb}>{t('academic_year.order')}</div>
                <input className={sInCls} style={sIn} type="number" min={1} value={p.orderIndex} onChange={e => updP(pi, 'orderIndex', parseInt(e.target.value) || 1)} />
              </div>
            </div>
            <div className="grid grid-cols-2" style={{ gap: 10 }}>
              <div>
                <div className={sLbCls} style={sLb}>{t('academic_year.startDateReq')}</div>
                <input className={sInCls} style={sIn} type="date" value={p.startDate} onChange={e => updP(pi, 'startDate', e.target.value)} />
              </div>
              <div>
                <div className={sLbCls} style={sLb}>{t('academic_year.endDateReq')}</div>
                <input className={sInCls} style={sIn} type="date" value={p.endDate} onChange={e => updP(pi, 'endDate', e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
              <div style={{ fontWeight: 800, color: 'var(--text2)', fontSize: 14, marginBottom: 10 }}>{t('academic_year.sequences')}</div>
              {p.sequences.map((seq, si) => (
                <div key={si} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid var(--bg2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 14 }}>{t('academic_year.sequenceN', { n: si + 1 })}</span>
                    <button onClick={() => remSeq(pi, si)} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                  </div>
                  <div className="grid grid-cols-2 sm:[grid-template-columns:1fr_1fr_70px]" style={{ gap: 8 }}>
                    <div>
                      <div className={sLbCls} style={sLb}>{t('academic_year.nameReq')}</div>
                      <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} value={seq.name} onChange={e => updS(pi, si, 'name', e.target.value)} placeholder={t('academic_year.assignmentPlaceholder')} />
                    </div>
                    <div>
                      <div className={sLbCls} style={sLb}>{t('academic_year.typeReq')}</div>
                      <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} value={seq.type} onChange={e => updS(pi, si, 'type', e.target.value)} placeholder="DS1" />
                    </div>
                    <div>
                      <div className={sLbCls} style={sLb}>{t('academic_year.order')}</div>
                      <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} type="number" min={1} value={seq.orderIndex} onChange={e => updS(pi, si, 'orderIndex', parseInt(e.target.value) || 1)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2" style={{ gap: 8, marginTop: 8 }}>
                    <div>
                      <div className={sLbCls} style={sLb}>{t('academic_year.startOptional')}</div>
                      <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} type="date" value={seq.startDate} onChange={e => updS(pi, si, 'startDate', e.target.value)} />
                    </div>
                    <div>
                      <div className={sLbCls} style={sLb}>{t('academic_year.endOptional')}</div>
                      <input className={sInCls} style={{ ...sIn, marginBottom: 0 }} type="date" value={seq.endDate} onChange={e => updS(pi, si, 'endDate', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <button style={btnSecSm} onClick={() => addSeq(pi)}>{t('academic_year.addSequence')}</button>
            </div>
          </div>
        ))}

        <button style={{ ...btnSecSm, width: '100%', marginBottom: 22 }} onClick={addPeriode}>{t('academic_year.addPeriod')}</button>

        {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onClose}>{t('academic_year.cancel')}</button>
          <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }} onClick={submitCalendar} disabled={loading}>
            {loading ? t('academic_year.saving') : t('academic_year.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
