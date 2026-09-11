'use client'
import { useState, useEffect, useCallback } from 'react'
import { ArrowRightLeft, Check, X } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface Demande {
  id: string
  type: 'STUDENT' | 'STAFF'
  sourceSchoolName: string
  sourceUserName: string
  createdAt: string
}

const btnPri = { padding: '8px 11px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' as const, display: 'flex', alignItems: 'center', gap: 6 }
const btnDanger = { padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--red)', fontWeight: 600, fontSize: 12, cursor: 'pointer' as const, display: 'flex', alignItems: 'center', gap: 6 }

export default function SectionAdminGroupTransfers({ onToast }: Props) {
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchApi('/api/v2/group-transfers/incoming', { credentials: 'include' })
      const data = await res.json()
      if (data.success) setDemandes(data.data)
    } catch { /* empty */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAccept = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetchApi(`/api/v2/group-transfers/${id}/accept`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast('Transfert accepté.', 'success')
      load()
    } catch (err: any) {
      onToast(err.message || 'Erreur', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetchApi(`/api/v2/group-transfers/${id}/reject`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast('Demande de transfert rejetée.', 'info')
      load()
    } catch (err: any) {
      onToast(err.message || 'Erreur', 'error')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) return <div style={{ padding: 14 }}>Chargement…</div>

  return (
    <div style={{ padding: 14, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Transferts entrants du groupe scolaire</h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 13 }}>
        Demandes initiées par le Fondateur de Groupe pour transférer un élève ou un enseignant vers votre établissement.
      </p>

      {demandes.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
          Aucune demande en attente.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {demandes.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowRightLeft size={15} color="var(--green)" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{d.sourceUserName}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {d.type === 'STUDENT' ? 'Élève' : 'Enseignant'} · depuis {d.sourceSchoolName}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={btnDanger} disabled={processingId === d.id} onClick={() => handleReject(d.id)}>
                  <X size={14} /> Rejeter
                </button>
                <button style={btnPri} disabled={processingId === d.id} onClick={() => handleAccept(d.id)}>
                  <Check size={14} /> Accepter
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
