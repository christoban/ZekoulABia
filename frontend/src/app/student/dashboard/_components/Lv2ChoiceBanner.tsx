'use client'
import { useState, useEffect, useCallback } from 'react'
import { Languages } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface Subject { id: string; name: string }
interface WindowData {
  window: { id: string; level: string; openDate: string; closeDate: string }
  currentChoice: { subjectId: string; subjectName?: string } | null
  availableSubjects: Subject[]
}

export default function Lv2ChoiceBanner({ onToast }: Props) {
  const t = useT('student')
  const [data, setData] = useState<WindowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/students/me/lv2-choice-window', { credentials: 'include' })
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch { /* silencieux — pas de fenêtre active par défaut */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetchApi('/api/v2/students/me/lv2-choice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ chosenSubjectId: selected }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('lv2Choice.toast_submitted'), 'success')
        await load()
      } else {
        onToast(json.message || t('lv2Choice.toast_error'), 'error')
      }
    } catch {
      onToast(t('lv2Choice.toast_error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !data?.window) return null

  const closeDate = new Date(data.window.closeDate).toLocaleDateString()

  return (
    <div style={{ background: 'var(--blue-light)', border: '1px solid var(--blue)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Languages size={16} strokeWidth={2} />
        <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{t('lv2Choice.banner_title')}</span>
      </div>

      {data.currentChoice ? (
        <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>
          {t('lv2Choice.already_submitted').replace('{subject}', data.currentChoice.subjectName || '')}
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginBottom: 10 }}>
            {t('lv2Choice.banner_subtitle').replace('{date}', closeDate)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={selected} onChange={e => setSelected(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600, minWidth: 180 }}>
              <option value="">{t('lv2Choice.select_placeholder')}</option>
              {data.availableSubjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button onClick={handleSubmit} disabled={!selected || submitting}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: 'var(--blue)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: selected && !submitting ? 'pointer' : 'not-allowed', opacity: selected && !submitting ? 1 : 0.6 }}>
              {submitting ? t('lv2Choice.submitting') : t('lv2Choice.submit_btn')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
