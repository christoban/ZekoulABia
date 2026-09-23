'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Building2 } from 'lucide-react'
import SectionGroupOverview, { type KpisGroupe } from './_components/SectionGroupOverview'
import SectionGroupSchools, { type EcoleMembre } from './_components/SectionGroupSchools'
import SectionGroupTransfers from './_components/SectionGroupTransfers'

const API_BASE = ''

type GroupOwner = {
  id: string
  email: string
  name: string
  groupId: string | null
  schoolIds: string[]
}

export default function GroupDashboardPage() {
  const router = useRouter()
  const [owner, setOwner] = useState<GroupOwner | null>(null)
  const [kpis, setKpis] = useState<KpisGroupe | null>(null)
  const [schools, setSchools] = useState<EcoleMembre[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'transfers'>('overview')

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v2/group/auth/me`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok || !data.success || !data.data) {
          router.replace('/group/login')
          return
        }
        setOwner(data.data)

        const [kpisRes, schoolsRes] = await Promise.all([
          fetch(`${API_BASE}/api/v2/group/dashboard/kpis`, { credentials: 'include' }),
          fetch(`${API_BASE}/api/v2/group/dashboard/schools`, { credentials: 'include' }),
        ])
        const kpisData = await kpisRes.json()
        const schoolsData = await schoolsRes.json()
        if (kpisData.success) setKpis(kpisData.data)
        if (schoolsData.success) setSchools(schoolsData.data)
      } catch {
        router.replace('/group/login')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/v2/group/auth/logout`, { method: 'POST', credentials: 'include' })
    router.replace('/group/login')
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #d4c8b8', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!owner) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', background: 'white', borderBottom: '1px solid #e5decf' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,var(--primary),var(--accent))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={20} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1a1209' }}>ZekoulABia · Groupe Scolaire</div>
            <div style={{ fontSize: 14, color: '#6b5c45' }}>{owner.name} — {owner.email}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'none', border: '1.5px solid #d4c8b8', borderRadius: 10, color: '#6b5c45', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <LogOut size={16} /> Déconnexion
        </button>
      </div>

      <div style={{ padding: '0 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 4, paddingTop: 20 }}>
          {(['overview', 'transfers'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '10px 18px', border: 'none', borderRadius: '10px 10px 0 0', cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 700, fontSize: 14, background: tab === t ? 'white' : 'transparent',
                color: tab === t ? 'var(--primary)' : '#6b5c45',
              }}>
              {t === 'overview' ? "Vue d'ensemble" : 'Transferts'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
        {tab === 'overview' && (
          <>
            {kpis && <SectionGroupOverview kpis={kpis} />}
            <SectionGroupSchools schools={schools} />
          </>
        )}
        {tab === 'transfers' && <SectionGroupTransfers schools={schools} />}
      </div>
    </div>
  )
}
