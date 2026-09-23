'use client'

import { Users, TrendingUp, Wallet, CalendarX } from 'lucide-react'

export type EcoleKpis = {
  schoolId: string
  schoolName: string
  effectifs: number
  tauxReussite: number
  revenus: number
  tauxAbsenteisme: number
}

export type KpisGroupe = {
  parEcole: EcoleKpis[]
  totaux: {
    effectifsTotal: number
    tauxReussiteGlobal: number
    revenusCumules: number
    tauxAbsenteismeGlobal: number
  }
}

function formatXAF(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5decf', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 200 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color="white" />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1209' }}>{value}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#6b5c45' }}>{label}</div>
      </div>
    </div>
  )
}

export default function SectionGroupOverview({ kpis }: { kpis: KpisGroupe }) {
  const maxEffectifs = Math.max(1, ...kpis.parEcole.map((e) => e.effectifs))

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard icon={Users} label="Effectifs totaux" value={String(kpis.totaux.effectifsTotal)} color="#3b82f6" />
        <KpiCard icon={TrendingUp} label="Taux de réussite (moy.)" value={`${kpis.totaux.tauxReussiteGlobal}%`} color="var(--primary)" />
        <KpiCard icon={Wallet} label="Revenus cumulés" value={formatXAF(kpis.totaux.revenusCumules)} color="#f59e0b" />
        <KpiCard icon={CalendarX} label="Absentéisme (moy.)" value={`${kpis.totaux.tauxAbsenteismeGlobal}%`} color="#ef4444" />
      </div>

      {kpis.parEcole.length > 0 && (
        <div style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid #e5decf' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209', marginBottom: 16 }}>Effectifs par établissement</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {kpis.parEcole.map((e) => (
              <div key={e.schoolId} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 160, fontSize: 14, fontWeight: 700, color: '#1a1209', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.schoolName}</div>
                <div style={{ flex: 1, height: 10, borderRadius: 5, background: '#f0ece6', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(e.effectifs / maxEffectifs) * 100}%`, background: 'linear-gradient(90deg,#3b82f6,#60a5fa)', borderRadius: 5 }} />
                </div>
                <div style={{ width: 50, textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#6b5c45' }}>{e.effectifs}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
