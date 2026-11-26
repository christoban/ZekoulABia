'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Bell, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { inputStyle, labelStyle, type OnToast } from './types'

interface AgregeItem {
  cle: string
  libelle: string
  programmesCount: number
  leconsTotal: number
  leconsRealisees: number
  progressionPct: number | null
  modulesDesactivesCount: number
  enRetardCount: number
}

interface RapportLigne {
  programmeId: string
  programmeTitre: string
  source: string
  className: string
  level: string
  subjectName: string
  departmentName: string
  leconsTotal: number
  leconsRealisees: number
  modulesDesactivesCount: number
  progressionPct: number | null
  attenduPct: number | null
  retardPct: number | null
  statut: 'A_JOUR' | 'MODERE' | 'CRITIQUE'
}

interface RapportData {
  attenduPct: number | null
  resumeGlobal: {
    totalProgrammes: number
    programmesNationaux: number
    leconsActivesTotal: number
    leconsRealiseesTotal: number
    progressionMoyennePct: number | null
    totalModulesDesactives: number
    programmesEnRetard: number
  }
  parNiveau: AgregeItem[]
  parDepartement: AgregeItem[]
  lignes: RapportLigne[]
}

interface RelancePreview {
  totalAlertes: number
  totalDestinataires: number
  alertesSansDestinataire: number
  destinataires: Array<{
    userId: string
    nomComplet: string
    roleCible: 'ENSEIGNANT' | 'ANIMATEUR_PEDAGOGIQUE'
    className: string
    subjectName: string
    niveau: 'CRITIQUE' | 'MODERE'
    retardPct: number
  }>
}

interface Props {
  onToast: OnToast
}

export default function PedagogieRapportAvancementTab({ onToast }: Props) {
  const [rapport, setRapport] = useState<RapportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [filterLevel, setFilterLevel] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [relancePreview, setRelancePreview] = useState<RelancePreview | null>(null)
  const [loadingRelance, setLoadingRelance] = useState(false)
  const [sendingRelance, setSendingRelance] = useState(false)

  const loadRapport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterLevel) params.set('level', filterLevel)
      if (filterSource) params.set('source', filterSource)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetchApi(`/api/v2/pedagogie/rapports/avancement${qs}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setRapport(json.data as RapportData)
      } else {
        onToast(json.message ?? 'Erreur lors du chargement de la synthèse', 'error')
      }
    } catch {
      onToast('Erreur réseau lors du chargement de la synthèse', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterLevel, filterSource, onToast])

  useEffect(() => {
    loadRapport()
  }, [loadRapport])

  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams({ format: 'csv' })
      if (filterLevel) params.set('level', filterLevel)
      if (filterSource) params.set('source', filterSource)
      const res = await fetchApi(`/api/v2/pedagogie/rapports/avancement?${params.toString()}`, {
        credentials: 'include',
      })
      if (!res.ok) {
        onToast("Erreur lors de l'export CSV", 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rapport-avancement-programmes-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onToast('Export CSV téléchargé', 'success')
    } catch {
      onToast("Erreur réseau lors de l'export CSV", 'error')
    }
  }

  const handlePreviewRelances = async () => {
    setLoadingRelance(true)
    try {
      const res = await fetchApi('/api/v2/pedagogie/alertes-retard/notifier/propose', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setRelancePreview(json.data as RelancePreview)
      } else {
        onToast(json.message ?? 'Impossible de préparer les relances', 'error')
      }
    } catch {
      onToast('Erreur réseau lors de la préparation des relances', 'error')
    } finally {
      setLoadingRelance(false)
    }
  }

  const handleSendRelances = async () => {
    setSendingRelance(true)
    try {
      const res = await fetchApi('/api/v2/pedagogie/alertes-retard/notifier/apply', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        onToast(`${json.data.notificationsEnvoyees} notification(s) ciblée(s) envoyée(s)`, 'success')
        setRelancePreview(null)
      } else {
        onToast(json.message ?? "Erreur lors de l'envoi des relances", 'error')
      }
    } catch {
      onToast("Erreur réseau lors de l'envoi des relances", 'error')
    } finally {
      setSendingRelance(false)
    }
  }

  const levelsDisponibles = rapport?.parNiveau.map((n) => n.libelle) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Barre actions + filtres */}
      <div
        className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ minWidth: 150 }}>
            <label style={labelStyle}>Niveau</label>
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={inputStyle}>
              <option value="">Tous niveaux</option>
              {levelsDisponibles.map((lv) => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          </div>
          <div style={{ minWidth: 150 }}>
            <label style={labelStyle}>Source</label>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={inputStyle}>
              <option value="">Toutes</option>
              <option value="national">Officiels nationaux</option>
              <option value="manuel">Manuels école</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" onClick={loadRapport} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 8, background: 'var(--bg2)', color: 'var(--text2)', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={13} /> Actualiser
          </button>
          <button type="button" onClick={handleExportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--sidebar)', border: '1px solid var(--sidebar)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            <Download size={13} /> Exporter CSV
          </button>
          <button type="button" onClick={handlePreviewRelances} disabled={loadingRelance} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 14px', borderRadius: 8, background: 'var(--sidebar)', color: 'white', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            <Bell size={13} /> {loadingRelance ? 'Préparation...' : 'Relancer les retards ciblés'}
          </button>
        </div>
      </div>

      {/* Prévisualisation dry-run des relances ciblées */}
      {relancePreview && (
        <div style={{ padding: 14, borderRadius: 12, border: '1px solid var(--amber)', background: 'var(--amber-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} />
              Aperçu relances ciblées : {relancePreview.totalDestinataires} notification(s) pour {relancePreview.totalAlertes} retard(s)
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setRelancePreview(null)} style={{ padding: '6px 12px', borderRadius: 7, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="button" disabled={sendingRelance || relancePreview.totalDestinataires === 0} onClick={handleSendRelances} style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--amber)', color: 'white', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                {sendingRelance ? 'Envoi...' : `Confirmer et envoyer (${relancePreview.totalDestinataires})`}
              </button>
            </div>
          </div>
          {relancePreview.totalDestinataires === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Aucun destinataire à relancer actuellement.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
              {relancePreview.destinataires.map((d, idx) => (
                <div key={idx} style={{ fontSize: 12, background: 'var(--surface)', padding: '5px 10px', borderRadius: 7, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span><strong>{d.nomComplet}</strong> ({d.roleCible === 'ANIMATEUR_PEDAGOGIQUE' ? 'AP' : 'Enseignant'}) — {d.className} · {d.subjectName}</span>
                  <span style={{ fontWeight: 800, color: d.niveau === 'CRITIQUE' ? 'var(--red)' : 'var(--amber)' }}>-{d.retardPct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />
          Calcul de la synthèse...
        </div>
      )}

      {!loading && rapport && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Avancement moyen', value: rapport.resumeGlobal.progressionMoyennePct !== null ? `${rapport.resumeGlobal.progressionMoyennePct}%` : '—', color: 'var(--green)' },
              { label: 'Leçons actives faites', value: `${rapport.resumeGlobal.leconsRealiseesTotal}/${rapport.resumeGlobal.leconsActivesTotal}`, color: 'var(--sidebar)' },
              { label: 'Programmes en retard', value: String(rapport.resumeGlobal.programmesEnRetard), color: rapport.resumeGlobal.programmesEnRetard > 0 ? 'var(--red)' : 'var(--green)' },
              { label: 'Modules désactivés', value: String(rapport.resumeGlobal.totalModulesDesactives), color: 'var(--amber)' },
            ].map((k) => (
              <div key={k.label} className="rounded-xl p-3.5 text-center border border-[var(--border)] bg-[var(--surface)]">
                <div style={{ fontSize: 20, fontWeight: 900, color: k.color }}>{k.value}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Agrégats Niveau & Département */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { title: 'Avancement par niveau', items: rapport.parNiveau },
              { title: 'Avancement par département', items: rapport.parDepartement },
            ].map((bloc) => (
              <div key={bloc.title} className="rounded-xl p-4 border border-[var(--border)] bg-[var(--surface)]">
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 10, textTransform: 'uppercase' }}>{bloc.title}</div>
                {bloc.items.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune donnée</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {bloc.items.map((it) => (
                      <div key={it.cle} style={{ fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 3 }}>
                          <span>{it.libelle} <span style={{ color: 'var(--text3)', fontWeight: 600 }}>({it.programmesCount} prog.)</span></span>
                          <span>{it.leconsRealisees}/{it.leconsTotal} ({it.progressionPct ?? 0}%)</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'var(--bg2)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${it.progressionPct ?? 0}%`, background: it.enRetardCount > 0 ? 'var(--amber)' : 'var(--green)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Détail par classe × matière */}
          <div className="rounded-xl p-4 border border-[var(--border)] bg-[var(--surface)]">
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 10, textTransform: 'uppercase' }}>
              Détail par classe et matière ({rapport.lignes.length})
            </div>
            {rapport.lignes.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
                <CheckCircle2 size={20} style={{ display: 'inline', marginBottom: 4 }} />
                <div>Aucun programme correspondant aux filtres.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rapport.lignes.map((l) => (
                  <div key={`${l.programmeId}-${l.className}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg)', fontSize: 12 }}>
                    <div>
                      <strong>{l.className}</strong> · <span>{l.subjectName}</span>{' '}
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>({l.departmentName})</span>
                      {l.modulesDesactivesCount > 0 && (
                        <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: 999, background: 'var(--amber-light)', color: 'var(--amber)' }}>
                          {l.modulesDesactivesCount} mod. désactivé{l.modulesDesactivesCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                      <span>{l.leconsRealisees}/{l.leconsTotal} ({l.progressionPct ?? 0}%)</span>
                      <span style={{
                        fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                        background: l.statut === 'CRITIQUE' ? 'var(--red-light)' : l.statut === 'MODERE' ? 'var(--amber-light)' : 'var(--green-light)',
                        color: l.statut === 'CRITIQUE' ? 'var(--red)' : l.statut === 'MODERE' ? 'var(--amber)' : 'var(--green)',
                      }}>
                        {l.statut === 'A_JOUR' ? 'À jour' : `-${l.retardPct}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
