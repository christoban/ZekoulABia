'use client'

import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface OptionItem {
  id: string
  name: string
}

interface AcademicYearResponseItem {
  isCurrent?: boolean
  periods?: OptionItem[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function CouncilCreateModal({ isOpen, onClose, onCreated, onToast }: Props) {
  const t = useT('staff')
  const [loading, setLoading] = useState(false)
  const [fetchingFormData, setFetchingFormData] = useState(false)
  const [classId, setClassId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [error, setError] = useState('')
  const [classList, setClassList] = useState<OptionItem[]>([])
  const [periodList, setPeriodList] = useState<OptionItem[]>([])

  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    setFetchingFormData(true)
    setError('')
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json() as Promise<{ data?: OptionItem[] }>),
      fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json() as Promise<{ data?: AcademicYearResponseItem[] }>),
    ])
      .then(([cRes, yRes]) => {
        if (!mounted) return
        const classes = (cRes.data || []).map(c => ({ id: c.id, name: c.name }))
        setClassList(classes)
        if (classes.length > 0) setClassId(classes[0].id)
        const years = yRes.data || []
        const current = years.find(y => y.isCurrent) ?? years[0]
        const periods = current ? (current.periods || []).map(p => ({ id: p.id, name: p.name })) : []
        setPeriodList(periods)
        if (periods.length > 0) setPeriodId(periods[0].id)
      })
      .catch(() => {
        if (mounted) onToast('Erreur chargement formulaire', 'error')
      })
      .finally(() => {
        if (mounted) setFetchingFormData(false)
      })
    return () => { mounted = false }
  }, [isOpen, onToast])

  if (!isOpen) return null

  const handleCreate = async () => {
    if (!classId) { setError(t('council.selectClassError')); return }
    if (!periodId) { setError(t('council.selectPeriodError')); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi('/api/v2/class-councils', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, academicPeriodId: periodId }),
      })
      const data = await res.json() as { message?: string }
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Conseil de classe créé', 'success')
      onClose()
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div onClick={() => !loading && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-4 py-5 md:px-6 md:py-6" style={{ background: 'var(--surface)', borderRadius: 14, width: 400, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
          {t('council.newCouncilModalTitle')}
        </div>

        {fetchingFormData ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div style={{ width: 24, height: 24, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', marginBottom: 5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('council.classLabel')}</div>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer', marginBottom: 14, boxSizing: 'border-box' }}
            >
              <option value="">{t('council.classPlaceholder')}</option>
              {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text2)', marginBottom: 5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('council.periodLabel')}</div>
            <select
              value={periodId}
              onChange={e => setPeriodId(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer', marginBottom: 14, boxSizing: 'border-box' }}
            >
              <option value="">{t('council.periodPlaceholder')}</option>
              {periodList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>

            {error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 7, padding: '8px 12px', fontSize: 12, fontWeight: 600, marginBottom: 14, lineHeight: 1.4 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={onClose}
                disabled={loading}
              >
                {t('council.cancel')}
              </button>
              <button
                type="button"
                style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12.5, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}
                onClick={() => void handleCreate()}
                disabled={loading}
              >
                {loading ? t('council.creating') : t('council.createCouncil')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

