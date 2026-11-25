'use client'
import { useState } from 'react'
import { Star } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { YearModalOverlay, sIn, sInCls, sLb, sLbCls, type YearToastFn } from './academicYearUi'

interface Props {
  initialName: string
  initialStartDate: string
  initialEndDate: string
  previousCurrentYearId: string | null
  onClose: () => void
  onCreated: (targetYearId: string | undefined, targetYearName: string, previousCurrentYearId: string | null) => void
  onToast: YearToastFn
}

export default function CreateYearModal({
  initialName,
  initialStartDate,
  initialEndDate,
  previousCurrentYearId,
  onClose,
  onCreated,
  onToast,
}: Props) {
  const t = useT('admin')
  const [name, setName] = useState(initialName)
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitCreate = async () => {
    if (!name.trim() || !startDate || !endDate) {
      setError(t('academic_year.toast.requiredFields'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi('/api/v2/academic-years', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), startDate, endDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      onToast(t('academic_year.toast.yearCreated', { name }), 'success')
      const targetYearId: string | undefined = data.data?.anneeId
      onCreated(targetYearId, name.trim(), previousCurrentYearId)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academic_year.toast.err'))
      setLoading(false)
    }
  }

  return (
    <YearModalOverlay onClose={onClose}>
      <div className="text-[18px] md:text-[22px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
        Ouverture &amp; Transition vers l&apos;Année N+1
      </div>

      <div className="mb-4 p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs text-[var(--text)] flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 flex-shrink-0 mt-0.5">
          <Star size={16} />
        </div>
        <div>
          <p className="font-bold text-xs">Proposition Automatique N+1 (Pattern Propose / Apply)</p>
          <p className="text-[11.5px] text-[var(--text2)] mt-0.5">
            Le système a déduit la nouvelle année à partir de l’année courante. Validez les dates pré-calculées ou ajustez-les si besoin avant de déclencher la reconduction des tarifs.
          </p>
        </div>
      </div>

      <div className={sLbCls} style={sLb}>{t('academic_year.nameReq')}</div>
      <input className={sInCls} style={sIn} placeholder={t('academic_year.yearPlaceholder')} value={name} onChange={e => setName(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div className={sLbCls} style={sLb}>{t('academic_year.startDateFull')}</div>
          <input type="date" className={sInCls} style={sIn} value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <div className={sLbCls} style={sLb}>{t('academic_year.endDateFull')}</div>
          <input type="date" className={sInCls} style={sIn} value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onClose}>
          {t('academic_year.cancel')}
        </button>
        <button
          style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--amber),var(--amber-dark, #d97706))', color: 'white', border: 'none', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
          onClick={submitCreate}
          disabled={loading}
        >
          {loading ? 'Ouverture en cours…' : 'Valider & Activer N+1'}
        </button>
      </div>
    </YearModalOverlay>
  )
}
