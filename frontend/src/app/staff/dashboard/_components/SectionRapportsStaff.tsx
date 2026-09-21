'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Users,
  AlertCircle,
  Award,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ChevronRight,
  TrendingUp,
  School,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface EffectifClasse {
  classId: string
  className: string
  level: string | null
  serie: string | null
  filiere: string | null
  capacity: number
  totalInscrits: number
  garcons: number
  filles: number
  tauxOccupation: number
}

interface RapportEffectifs {
  totalInscrits: number
  totalCapacite: number
  totalGarcons: number
  totalFilles: number
  tauxOccupationGlobal: number
  parClasse: EffectifClasse[]
  parCycle: {
    premierCycle: { inscrits: number; capacite: number; garcons: number; filles: number }
    secondCycle: { inscrits: number; capacite: number; garcons: number; filles: number }
  }
}

interface DossierIncomplet {
  id: string
  nomProvisoire: string
  className: string | null
  contactTelephone: string | null
  completenessScore: number | null
  validableSousReserve: boolean
  status: string
  createdAt: string
  piecesManquantes: string[]
}

interface StatConcours {
  sessionId: string
  sessionName: string
  examDate: string
  capacity: number
  totalCandidats: number
  admis: number
  listeAttente: number
  refuses: number
  tauxReussitePercent: number
  moyenneGenerale: number
}

interface RapportGlobalData {
  effectifs: RapportEffectifs
  dossiersIncomplets: DossierIncomplet[]
  concours: StatConcours[]
}

export default function SectionRapportsStaff() {
  const [data, setData] = useState<RapportGlobalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<'EFFECTIFS' | 'DOSSIERS' | 'CONCOURS'>('EFFECTIFS')
  const [recherche, setRecherche] = useState('')

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
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <p>Génération des rapports consolidés en cours...</p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: '0 auto' }}>
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

      {/* Cartes KPI */}
      {data && (
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
      )}

      {/* Barre d'onglets */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border, #e5e7eb)',
          paddingBottom: 0,
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
          }}
        >
          <Award size={16} />
          Sessions de Concours
        </button>
      </div>

      {/* Contenu Onglet Effectifs */}
      {onglet === 'EFFECTIFS' && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Synthèse par cycle */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.05)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue, #2563eb)', marginBottom: 4 }}>
                Premier Cycle (6e - 3e / Form 1 - 5)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                Inscrits : <strong>{data.effectifs.parCycle.premierCycle.inscrits}</strong> / {data.effectifs.parCycle.premierCycle.capacite} places
                ({data.effectifs.parCycle.premierCycle.capacite > 0 ? Math.round((data.effectifs.parCycle.premierCycle.inscrits / data.effectifs.parCycle.premierCycle.capacite) * 100) : 0}%)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                G: {data.effectifs.parCycle.premierCycle.garcons} • F: {data.effectifs.parCycle.premierCycle.filles}
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'rgba(147, 51, 234, 0.05)',
                border: '1px solid rgba(147, 51, 234, 0.2)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--purple, #9333ea)', marginBottom: 4 }}>
                Second Cycle (2nde - Tle / Lower - Upper Sixth)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text)' }}>
                Inscrits : <strong>{data.effectifs.parCycle.secondCycle.inscrits}</strong> / {data.effectifs.parCycle.secondCycle.capacite} places
                ({data.effectifs.parCycle.secondCycle.capacite > 0 ? Math.round((data.effectifs.parCycle.secondCycle.inscrits / data.effectifs.parCycle.secondCycle.capacite) * 100) : 0}%)
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                G: {data.effectifs.parCycle.secondCycle.garcons} • F: {data.effectifs.parCycle.secondCycle.filles}
              </div>
            </div>
          </div>

          {/* Tableau des classes */}
          <div
            style={{
              background: 'var(--surface, #fff)',
              border: '1px solid var(--border, #e5e7eb)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2, #f9fafb)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Classe</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Niveau</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Série/Filière</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Capacité</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Inscrits</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>G / F</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Occupation</th>
                  </tr>
                </thead>
                <tbody>
                  {data.effectifs.parClasse.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text3)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                          <School size={28} style={{ color: 'var(--text3)' }} />
                          <div style={{ fontWeight: 600 }}>Aucune classe configurée pour cette année scolaire</div>
                          <div style={{ fontSize: 12 }}>Les effectifs et capacités apparaîtront dès que les classes seront créées.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.effectifs.parClasse.map((c) => (
                      <tr key={c.classId} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 600 }}>{c.className}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{c.level || '—'}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{c.serie || c.filiere || '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>{c.capacity}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{c.totalInscrits}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--text2)', fontSize: 12 }}>
                        {c.garcons} G / {c.filles} F
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 8,
                              borderRadius: 4,
                              background: 'var(--border, #e5e7eb)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(c.tauxOccupation, 100)}%`,
                                height: '100%',
                                background:
                                  c.tauxOccupation > 100
                                    ? 'var(--red, #ef4444)'
                                    : c.tauxOccupation >= 90
                                    ? 'var(--amber, #d97706)'
                                    : 'var(--green, #16a34a)',
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color:
                                c.tauxOccupation > 100
                                  ? '#ef4444'
                                  : c.tauxOccupation >= 90
                                  ? '#d97706'
                                  : 'var(--text2)',
                              minWidth: 36,
                              textAlign: 'right',
                            }}
                          >
                            {c.tauxOccupation}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Contenu Onglet Dossiers Incomplets */}
      {onglet === 'DOSSIERS' && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.dossiersIncomplets.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                background: 'var(--surface, #fff)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                color: 'var(--text2)',
              }}
            >
              <CheckCircle2 size={32} style={{ color: '#16a34a', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                Tous les dossiers sont complets !
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Aucune pièce manquante sur les dossiers d’inscription soumis.
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface, #fff)',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2, #f9fafb)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Élève</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Classe</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Téléphone</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Complétude</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Pièces manquantes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dossiersIncomplets.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{d.nomProvisoire}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{d.className || 'Non affectée'}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>{d.contactTelephone || '—'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              (d.completenessScore ?? 0) >= 80
                                ? 'rgba(22, 163, 74, 0.1)'
                                : (d.completenessScore ?? 0) >= 50
                                ? 'rgba(217, 119, 6, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)',
                            color:
                              (d.completenessScore ?? 0) >= 80
                                ? '#16a34a'
                                : (d.completenessScore ?? 0) >= 50
                                ? '#d97706'
                                : '#ef4444',
                          }}
                        >
                          {d.completenessScore ?? 0}%
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {d.piecesManquantes.map((piece, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: 11,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#ef4444',
                              }}
                            >
                              {piece}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Contenu Onglet Concours */}
      {onglet === 'CONCOURS' && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.concours.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                background: 'var(--surface, #fff)',
                borderRadius: 12,
                border: '1px solid var(--border)',
                color: 'var(--text2)',
              }}
            >
              <Award size={32} style={{ color: 'var(--text3)', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                Aucun concours d’entrée enregistré
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                Les statistiques apparaîtront dès la première session de concours configurée.
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface, #fff)',
                border: '1px solid var(--border, #e5e7eb)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2, #f9fafb)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Session</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Date</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Places</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Candidats</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Admis</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Attente</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Refusés</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Réussite</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Moyenne</th>
                  </tr>
                </thead>
                <tbody>
                  {data.concours.map((s) => (
                    <tr key={s.sessionId} style={{ borderBottom: '1px solid var(--border, #f3f4f6)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600 }}>{s.sessionName}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text2)' }}>
                        {new Date(s.examDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>{s.capacity}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600 }}>{s.totalCandidats}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                        {s.admis}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#d97706' }}>{s.listeAttente}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#ef4444' }}>{s.refuses}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                        {s.tauxReussitePercent}%
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                        {s.moyenneGenerale > 0 ? `${s.moyenneGenerale}/20` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
