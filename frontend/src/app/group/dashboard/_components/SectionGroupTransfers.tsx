'use client'

import { useEffect, useState } from 'react'
import { ArrowRightLeft, Search } from 'lucide-react'
import type { EcoleMembre } from './SectionGroupSchools'

const API_BASE = ''

type Personne = { id: string; name: string }

type Demande = {
  id: string
  type: 'STUDENT' | 'STAFF'
  status: 'PENDING_TARGET_ADMIN' | 'ACCEPTED' | 'REJECTED'
  sourceSchoolName: string
  targetSchoolName: string
  sourceUserName: string
  createdAt: string
}

const STATUS_LABEL: Record<Demande['status'], { label: string; color: string }> = {
  PENDING_TARGET_ADMIN: { label: 'En attente', color: '#d97706' },
  ACCEPTED: { label: 'Acceptée', color: 'var(--primary)' },
  REJECTED: { label: 'Rejetée', color: '#dc2626' },
}

export default function SectionGroupTransfers({ schools }: { schools: EcoleMembre[] }) {
  const [demandes, setDemandes] = useState<Demande[]>([])
  const [type, setType] = useState<'STUDENT' | 'STAFF'>('STUDENT')
  const [sourceSchoolId, setSourceSchoolId] = useState('')
  const [targetSchoolId, setTargetSchoolId] = useState('')
  const [recherche, setRecherche] = useState('')
  const [resultats, setResultats] = useState<Personne[]>([])
  const [selected, setSelected] = useState<Personne | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const loadDemandes = () => {
    fetch(`${API_BASE}/api/v2/group/transfers`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (d.success) setDemandes(d.data) })
  }

  useEffect(() => { loadDemandes() }, [])

  useEffect(() => {
    setSelected(null)
    setResultats([])
    if (!sourceSchoolId || recherche.trim().length < 2) return
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ schoolId: sourceSchoolId, role: type === 'STUDENT' ? 'STUDENT' : 'TEACHER', q: recherche })
      fetch(`${API_BASE}/api/v2/group/transfers/search?${params}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => { if (d.success) setResultats(d.data) })
    }, 300)
    return () => clearTimeout(timeout)
  }, [sourceSchoolId, recherche, type])

  const handleSubmit = async () => {
    if (!sourceSchoolId || !targetSchoolId || !selected) return
    setSubmitting(true)
    setMessage(null)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/transfers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type, sourceSchoolId, targetSchoolId, sourceUserId: selected.id }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      setMessage({ text: 'Demande de transfert créée — en attente de validation par l\'école cible.', type: 'success' })
      setSelected(null); setRecherche(''); setResultats([])
      loadDemandes()
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d4c8b8', fontSize: 14, fontFamily: 'inherit', background: 'white',
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209', marginBottom: 16 }}>Transferts entre établissements</div>

      <div style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid #e5decf', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', display: 'block', marginBottom: 4 }}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'STUDENT' | 'STAFF')} style={selectStyle}>
              <option value="STUDENT">Élève</option>
              <option value="STAFF">Enseignant</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', display: 'block', marginBottom: 4 }}>École source</label>
            <select value={sourceSchoolId} onChange={(e) => setSourceSchoolId(e.target.value)} style={selectStyle}>
              <option value="">Sélectionner…</option>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', display: 'block', marginBottom: 4 }}>École cible</label>
            <select value={targetSchoolId} onChange={(e) => setTargetSchoolId(e.target.value)} style={selectStyle}>
              <option value="">Sélectionner…</option>
              {schools.filter((s) => s.id !== sourceSchoolId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        {sourceSchoolId && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#6b5c45', display: 'block', marginBottom: 4 }}>
              Rechercher {type === 'STUDENT' ? 'un élève' : 'un enseignant'}
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#a89478' }} />
              <input
                value={selected ? selected.name : recherche}
                onChange={(e) => { setRecherche(e.target.value); setSelected(null) }}
                placeholder="Nom ou prénom…"
                style={{ ...selectStyle, paddingLeft: 36 }}
              />
            </div>
            {!selected && resultats.length > 0 && (
              <div style={{ marginTop: 6, border: '1px solid #e5decf', borderRadius: 10, overflow: 'hidden' }}>
                {resultats.map((p) => (
                  <button key={p.id} onClick={() => { setSelected(p); setResultats([]) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', background: 'white', border: 'none', borderBottom: '1px solid #f0ece6', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {message && (
          <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: 14, fontWeight: 600, background: message.type === 'error' ? '#fee2e2' : 'var(--green-light)', color: message.type === 'error' ? '#b91c1c' : 'var(--green2)' }}>
            {message.text}
          </div>
        )}

        <button onClick={handleSubmit} disabled={!sourceSchoolId || !targetSchoolId || !selected || submitting}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!sourceSchoolId || !targetSchoolId || !selected || submitting) ? 0.5 : 1 }}>
          <ArrowRightLeft size={16} /> Initier le transfert
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5decf', overflow: 'hidden' }}>
        {demandes.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#6b5c45' }}>Aucune demande de transfert pour le moment.</div>
        ) : (
          demandes.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f0ece6' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1209' }}>{d.sourceUserName} ({d.type === 'STUDENT' ? 'Élève' : 'Enseignant'})</div>
                <div style={{ fontSize: 13, color: '#6b5c45' }}>{d.sourceSchoolName} → {d.targetSchoolName}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: STATUS_LABEL[d.status].color }}>{STATUS_LABEL[d.status].label}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
