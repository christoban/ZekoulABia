'use client'
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Upload, AlertTriangle, Loader2, FileText } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface BulletinSession {
  id: string
  status: 'SUBMITTED' | 'VALIDATED' | 'PUBLISHED'
  submittedAt: string
  class: { id: string; name: string }
  academicPeriod: { id: string; name: string }
  submittedBy?: { id: string; firstName: string; lastName: string } | null
}

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  SUBMITTED: { color: 'var(--amber)', bg: 'var(--amber-light)' },
  VALIDATED: { color: 'var(--green)', bg: 'var(--green-light)' },
  PUBLISHED: { color: 'var(--blue)', bg: 'var(--blue-light)' },
}

export default function SectionBulletinValidation({ onToast }: Props) {
  const t = useT('staff')
  const [submitted, setSubmitted] = useState<BulletinSession[]>([])
  const [validated, setValidated] = useState<BulletinSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'SUBMITTED' | 'VALIDATED'>('SUBMITTED')

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const [subRes, valRes] = await Promise.all([
        fetchApi('/api/v2/bulletin-validations?status=SUBMITTED', { credentials: 'include' }),
        fetchApi('/api/v2/bulletin-validations?status=VALIDATED', { credentials: 'include' }),
      ])
      const subData = await subRes.json()
      const valData = await valRes.json()
      if (!subRes.ok || !valRes.ok) throw new Error(subData.message || valData.message || 'Erreur serveur')
      setSubmitted(subData.data || [])
      setValidated(valData.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const handleValidate = async (sessionId: string) => {
    setActionLoading(prev => new Set(prev).add(sessionId))
    try {
      const res = await fetchApi(`/api/v2/bulletin-validations/${sessionId}/validate`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Session validée avec succès', 'success')
      fetchSessions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de validation', 'error')
    } finally { setActionLoading(prev => { const s = new Set(prev); s.delete(sessionId); return s }) }
  }

  const handlePublish = async (sessionId: string) => {
    setActionLoading(prev => new Set(prev).add(sessionId))
    try {
      const res = await fetchApi(`/api/v2/bulletin-validations/${sessionId}/publish`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Bulletins publiés avec succès', 'success')
      fetchSessions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de publication', 'error')
    } finally { setActionLoading(prev => { const s = new Set(prev); s.delete(sessionId); return s }) }
  }

  const currentSessions = activeTab === 'SUBMITTED' ? submitted : validated

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={sTitle}>{t('bulletinValidation.title') || 'Validation des bulletins'}</div>
          <div style={sSub}>{loading ? '…' : `${submitted.length} en attente · ${validated.length} validé(s)`}</div>
        </div>
        <button style={btnSec} onClick={fetchSessions}>Actualiser</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setActiveTab('SUBMITTED')}
          style={{ padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            background: activeTab === 'SUBMITTED' ? 'var(--amber)' : 'var(--surface)', color: activeTab === 'SUBMITTED' ? 'white' : 'var(--text2)' }}>
          En attente ({submitted.length})
        </button>
        <button onClick={() => setActiveTab('VALIDATED')}
          style={{ padding: '8px 18px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            background: activeTab === 'VALIDATED' ? 'var(--green)' : 'var(--surface)', color: activeTab === 'VALIDATED' ? 'white' : 'var(--text2)' }}>
          Validés ({validated.length})
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="var(--red)" /><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchSessions} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && currentSessions.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><CheckCircle2 size={52} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            {activeTab === 'SUBMITTED' ? 'Aucune session en attente' : 'Aucune session validée'}
          </div>
          <div style={{ fontSize: 16, color: 'var(--text3)' }}>
            {activeTab === 'SUBMITTED' ? 'Les soumissions apparaîtront ici.' : 'Les sessions validées seront publiées par un admin.'}
          </div>
        </div>
      )}

      {!loading && !error && currentSessions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentSessions.map(s => {
            const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.SUBMITTED
            const isLoading = actionLoading.has(s.id)
            return (
              <div key={s.id} className="rounded-[16px] md:rounded-[14px] p-[14px] md:px-[18px] md:py-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none"
                style={{ background: 'var(--surface)', border: '1.5px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{s.class.name}</div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: st.bg, color: st.color }}>
                    {s.status === 'SUBMITTED' ? 'En attente' : 'Validé'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 4 }}>{s.academicPeriod.name}</div>
                {s.submittedBy && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                    Soumis par {s.submittedBy.firstName} {s.submittedBy.lastName}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {s.status === 'SUBMITTED' && (
                    <button
                      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={() => handleValidate(s.id)}
                      disabled={isLoading}>
                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      {isLoading ? '…' : 'Valider'}
                    </button>
                  )}
                  {s.status === 'VALIDATED' && (
                    <button
                      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      onClick={() => handlePublish(s.id)}
                      disabled={isLoading}>
                      {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {isLoading ? '…' : 'Publier'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }