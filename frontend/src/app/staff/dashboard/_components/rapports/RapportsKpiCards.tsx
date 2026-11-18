'use client'

import { Users, TrendingUp, AlertCircle, Award } from 'lucide-react'
import type { RapportGlobalData } from './rapportsTypes'

interface Props {
  data: RapportGlobalData
}

export default function RapportsKpiCards({ data }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          padding: 18,
          borderRadius: 12,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>TOTAL ÉLÈVES INSCRITS</span>
          <Users size={18} style={{ color: 'var(--blue, #2563eb)' }} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
          {data.effectifs.totalInscrits}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
          Garçons : <strong>{data.effectifs.totalGarcons}</strong> • Filles : <strong>{data.effectifs.totalFilles}</strong>
        </div>
      </div>

      <div
        style={{
          padding: 18,
          borderRadius: 12,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>TAUX D’OCCUPATION GLOBAL</span>
          <TrendingUp size={18} style={{ color: 'var(--green, #16a34a)' }} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
          {data.effectifs.tauxOccupationGlobal}%
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
          Capacité totale : <strong>{data.effectifs.totalCapacite}</strong> places
        </div>
      </div>

      <div
        style={{
          padding: 18,
          borderRadius: 12,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>DOSSIERS EN ATTENTE / INCOMPLETS</span>
          <AlertCircle size={18} style={{ color: 'var(--amber, #d97706)' }} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#d97706' }}>
          {data.dossiersIncomplets.length}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
          Formulaires en cours de saisie ou validation en attente
        </div>
      </div>

      <div
        style={{
          padding: 18,
          borderRadius: 12,
          background: 'var(--surface, #fff)',
          border: '1px solid var(--border, #e5e7eb)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>CONCOURS D’ENTRÉE</span>
          <Award size={18} style={{ color: 'var(--purple, #9333ea)' }} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)' }}>
          {data.concours.reduce((acc, s) => acc + s.totalCandidats, 0)} candidats
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
          Sur {data.concours.length} session(s) organisée(s)
        </div>
      </div>
    </div>
  )
}
