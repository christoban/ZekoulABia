'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  AlertCircle,
  Award,
  Download,
  RefreshCw,
  School,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { RapportGlobalData } from './rapports/rapportsTypes'
import RapportsKpiCards from './rapports/RapportsKpiCards'
import RapportsEffectifsTab from './rapports/RapportsEffectifsTab'
import RapportsDossiersTab from './rapports/RapportsDossiersTab'
import RapportsConcoursTab from './rapports/RapportsConcoursTab'

export default function SectionRapportsStaff() {
  const [data, setData] = useState<RapportGlobalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<'EFFECTIFS' | 'DOSSIERS' | 'CONCOURS'>('EFFECTIFS')

  const chargerRapports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi('/api/v2/rapports/global')
      const json = await res.json()
      if (json.success && json.data) {
        setData(json.data)
      } else {
        setError(json.message || 'Impossible de charger les rapports')
      }
    } catch {
      setError('Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    chargerRapports()
  }, [chargerRapports])

  const handleExportExcel = () => {
    window.open('/api/v2/rapports/export-excel', '_blank')
  }

  if (loading && !data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', height: '100%', overflowY: 'auto' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <p>Génération des rapports consolidés en cours...</p>
      </div>
    )
  }

  return (
    <div className="pb-24 md:pb-6" style={{ height: '100%', overflowY: 'auto', padding: '16px', boxSizing: 'border-box', maxWidth: 1280, margin: '0 auto' }}>
      {/* En-tête */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text, #111827)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <BarChart3 size={24} style={{ color: 'var(--amber, #d97706)' }} />
            Rapports & Statistiques de Scolarité
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--text2, #4b5563)' }}>
            Suivi des capacités d’accueil, dossiers d’inscriptions incomplets et résultats des concours.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={chargerRapports}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--surface, #fff)',
              color: 'var(--text, #111827)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <RefreshCw size={14} />
            Actualiser
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
            }}
          >
            <Download size={15} />
            Exporter en Excel (XLSX)
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            color: 'var(--red, #ef4444)',
            marginBottom: 20,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {data && <RapportsKpiCards data={data} />}

      {/* Barre d'onglets */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border, #e5e7eb)',
          paddingBottom: 0,
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        <button
          type="button"
          onClick={() => setOnglet('EFFECTIFS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            fontSize: 13.5,
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: onglet === 'EFFECTIFS' ? 'var(--blue, #2563eb)' : 'var(--text2, #4b5563)',
            borderBottom: `2.5px solid ${onglet === 'EFFECTIFS' ? 'var(--blue, #2563eb)' : 'transparent'}`,
            marginBottom: -1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <School size={16} />
          Effectifs & Capacités
        </button>

        <button
          type="button"
          onClick={() => setOnglet('DOSSIERS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            fontSize: 13.5,
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: onglet === 'DOSSIERS' ? 'var(--blue, #2563eb)' : 'var(--text2, #4b5563)',
            borderBottom: `2.5px solid ${onglet === 'DOSSIERS' ? 'var(--blue, #2563eb)' : 'transparent'}`,
            marginBottom: -1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <AlertCircle size={16} />
          Dossiers Incomplets
          {data && data.dossiersIncomplets.length > 0 && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 7px',
                borderRadius: 10,
                background: 'rgba(217, 119, 6, 0.15)',
                color: '#d97706',
                fontWeight: 800,
              }}
            >
              {data.dossiersIncomplets.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setOnglet('CONCOURS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            fontSize: 13.5,
            fontWeight: 700,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: onglet === 'CONCOURS' ? 'var(--blue, #2563eb)' : 'var(--text2, #4b5563)',
            borderBottom: `2.5px solid ${onglet === 'CONCOURS' ? 'var(--blue, #2563eb)' : 'transparent'}`,
            marginBottom: -1,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <Award size={16} />
          Sessions de Concours
        </button>
      </div>

      {onglet === 'EFFECTIFS' && data && <RapportsEffectifsTab effectifs={data.effectifs} />}
      {onglet === 'DOSSIERS' && data && <RapportsDossiersTab dossiers={data.dossiersIncomplets} />}
      {onglet === 'CONCOURS' && data && <RapportsConcoursTab concours={data.concours} />}
    </div>
  )
}
