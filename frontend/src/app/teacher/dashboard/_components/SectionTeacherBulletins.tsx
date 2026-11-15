'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FileText, Eye, PenLine, RefreshCw } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { TeacherSection } from '../_types'

interface OnToast {
  (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void
}

interface ClassOption {
  id: string
  name: string
}

interface PeriodOption {
  id: string
  name: string
  isCurrent?: boolean
}

interface ReportCardRow {
  id: string
  generalAverage?: number | null
  rank?: number | null
  status?: string
  student?: { firstName?: string; lastName?: string }
}

export default function SectionTeacherBulletins({
  onNav,
  onToast,
}: {
  onNav: (s: TeacherSection) => void
  onToast: OnToast
}) {
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [periods, setPeriods] = useState<PeriodOption[]>([])
  const [classId, setClassId] = useState('')
  const [periodId, setPeriodId] = useState('')
  const [reportCards, setReportCards] = useState<ReportCardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingList, setLoadingList] = useState(false)

  const onToastRef = useRef(onToast)
  useEffect(() => {
    onToastRef.current = onToast
  })

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetchApi('/api/v2/academic-years?isCurrent=true', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
    ])
      .then(([cData, yData]) => {
        const cls: ClassOption[] = Array.isArray(cData?.data) ? cData.data : []
        setClasses(cls)
        if (cls.length > 0) setClassId(cls[0].id)

        const years = Array.isArray(yData?.data) ? yData.data : Array.isArray(yData) ? yData : []
        const pers: PeriodOption[] = Array.isArray(years[0]?.periods) ? years[0].periods : []
        setPeriods(pers)
        const currentPer = pers.find((p) => p.isCurrent) ?? pers[0]
        if (currentPer) setPeriodId(currentPer.id)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadReportCards = useCallback(async () => {
    if (!classId) return
    setLoadingList(true)
    try {
      const qs = new URLSearchParams({ classId, limit: '50' })
      if (periodId) qs.set('periodId', periodId)
      const r = await fetchApi(`/api/v2/report-cards?${qs.toString()}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.message ?? 'Erreur chargement bulletins')
      setReportCards(Array.isArray(d.reportCards) ? d.reportCards : [])
    } catch (err) {
      onToastRef.current(err instanceof Error ? err.message : 'Erreur chargement bulletins', 'error')
      setReportCards([])
    } finally {
      setLoadingList(false)
    }
  }, [classId, periodId])

  useEffect(() => {
    if (classId) void loadReportCards()
  }, [classId, periodId, loadReportCards])

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            Bulletins des classes
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            Consultez les bulletins générés et téléchargez les PDF individuels.
          </div>
        </div>
        <button type="button" onClick={() => onNav('pp-appreciations')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
          <PenLine size={14} /> Appréciations PP
        </button>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 12, marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={loading} style={sel}>
          <option value="">Sélectionner une classe</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {periods.length > 0 && (
          <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={loading} style={sel}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <button type="button" onClick={loadReportCards} disabled={loadingList || !classId}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {loading || loadingList ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Chargement des bulletins…</div>
      ) : reportCards.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          <FileText size={28} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
          <div>Aucun bulletin généré pour cette classe et période.</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Élève</th>
                <th style={th}>Moyenne</th>
                <th style={th}>Rang</th>
                <th style={th}>Statut</th>
                <th style={th}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {reportCards.map((rc) => (
                <tr key={rc.id}>
                  <td style={td}><strong>{rc.student ? `${rc.student.lastName ?? ''} ${rc.student.firstName ?? ''}`.trim() : 'Élève'}</strong></td>
                  <td style={td}>
                    <strong style={{ color: (rc.generalAverage ?? 0) < 10 ? 'var(--red)' : 'var(--green)' }}>
                      {rc.generalAverage != null ? `${rc.generalAverage.toFixed(2)}/20` : '—'}
                    </strong>
                  </td>
                  <td style={td}>{rc.rank != null ? `${rc.rank}e` : '—'}</td>
                  <td style={td}>{rc.status ?? '—'}</td>
                  <td style={td}>
                    <button type="button" onClick={() => window.open(`/api/v2/report-cards/${rc.id}/pdf`, '_blank')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Eye size={13} /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const sel: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }
const th: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--border)' }

