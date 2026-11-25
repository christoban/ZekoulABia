'use client'

import { useState } from 'react'
import { School, X } from 'lucide-react'

const API_BASE = ''

export type EcoleMembre = {
  id: string
  name: string
  city: string | null
  region: string | null
  type: string
  plan: string
  status: string
}

type DetailEcole = EcoleMembre & {
  effectifs: number
  tauxReussite: number
  revenus: number
  tauxAbsenteisme: number
}

function formatXAF(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export default function SectionGroupSchools({ schools }: { schools: EcoleMembre[] }) {
  const [detail, setDetail] = useState<DetailEcole | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const openDetail = async (schoolId: string) => {
    setLoadingId(schoolId)
    try {
      const res = await fetch(`${API_BASE}/api/v2/group/dashboard/schools/${schoolId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) setDetail(data.data)
    } finally {
      setLoadingId(null)
    }
  }

  if (schools.length === 0) {
    return (
      <div style={{ background: 'white', borderRadius: 14, padding: 32, border: '1px solid #e5decf', textAlign: 'center', color: '#6b5c45' }}>
        Aucun établissement rattaché à ce groupe pour le moment.
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209', marginBottom: 16 }}>Établissements du groupe</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {schools.map((s) => (
          <button
            key={s.id}
            onClick={() => openDetail(s.id)}
            disabled={loadingId === s.id}
            style={{ textAlign: 'left', background: 'white', border: '1px solid #e5decf', borderRadius: 14, padding: 18, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f0ece6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <School size={18} color="var(--primary)" />
              </div>
              <div style={{ fontWeight: 800, color: '#1a1209', fontSize: 15 }}>{s.name}</div>
            </div>
            <div style={{ fontSize: 13, color: '#6b5c45' }}>{[s.city, s.region].filter(Boolean).join(', ') || '—'}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.plan}</div>
          </button>
        ))}
      </div>

      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setDetail(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: '90%', maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1209' }}>{detail.name}</div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89478' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}><span style={{ color: '#6b5c45' }}>Effectifs</span><strong>{detail.effectifs}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}><span style={{ color: '#6b5c45' }}>Taux de réussite</span><strong>{detail.tauxReussite}%</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}><span style={{ color: '#6b5c45' }}>Revenus cumulés</span><strong>{formatXAF(detail.revenus)}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}><span style={{ color: '#6b5c45' }}>Absentéisme</span><strong>{detail.tauxAbsenteisme}%</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
