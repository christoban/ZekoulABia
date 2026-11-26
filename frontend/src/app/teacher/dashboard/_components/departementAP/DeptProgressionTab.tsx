'use client'
import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Download, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type { ProgAlerte, TranslateFn } from './types'

interface DeptRapportLigne {
  programmeId: string
  className: string
  subjectName: string
  leconsTotal: number
  leconsRealisees: number
  modulesDesactivesCount: number
  progressionPct: number | null
  retardPct: number | null
  statut: 'A_JOUR' | 'MODERE' | 'CRITIQUE'
}

interface DeptRapportData {
  resumeGlobal: {
    totalProgrammes: number
    leconsActivesTotal: number
    leconsRealiseesTotal: number
    progressionMoyennePct: number | null
    totalModulesDesactives: number
  }
  lignes: DeptRapportLigne[]
}

interface Props {
  departementId: string
  alertes: ProgAlerte[]
  loading: boolean
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  t: TranslateFn
}

export default function DeptProgressionTab({
  departementId,
  alertes,
  loading,
  onShowToast,
  t,
}: Props) {
  const [rapport, setRapport] = useState<DeptRapportData | null>(null)
  const [loadingRapport, setLoadingRapport] = useState(false)

  const loadSyntheseDept = useCallback(async () => {
    if (!departementId) return
    setLoadingRapport(true)
    try {
      const stRes = await fetchApi('/api/v2/pedagogie/materialisation/status', { credentials: 'include' })
      const stJson = await stRes.json()
      if (!stJson?.success || stJson?.data?.enabled !== true) {
        setRapport(null)
        return
      }
      const res = await fetchApi(
        `/api/v2/pedagogie/rapports/avancement?departmentId=${departementId}`,
        { credentials: 'include' },
      )
      const json = await res.json()
      if (res.ok && json.success) {
        setRapport(json.data as DeptRapportData)
      }
    } catch { /* ignore */ }
    finally { setLoadingRapport(false) }
  }, [departementId])

  useEffect(() => {
    void loadSyntheseDept()
  }, [loadSyntheseDept])

  const handleExportCsv = async () => {
    try {
      const res = await fetchApi(
        `/api/v2/pedagogie/rapports/avancement?departmentId=${departementId}&format=csv`,
        { credentials: 'include' },
      )
      if (!res.ok) {
        onShowToast?.("Erreur lors de l'export CSV", 'error')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `avancement-departement-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      onShowToast?.('Export CSV du département téléchargé', 'success')
    } catch {
      onShowToast?.("Erreur réseau lors de l'export CSV", 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '8px 12px', background: 'var(--green-light)', border: '1px solid var(--green-light)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
        {t('department.progression_info')}
      </div>

      {/* Alertes de retard du département */}
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('department.progression_loading')}</div>
      ) : alertes.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><CheckCircle2 size={24} strokeWidth={2} color="var(--green)" /></div>
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>{t('department.progression_no_alerts')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('department.progression_no_alerts_hint')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertes.map((a, i) => {
            const isCritique = a.niveau === 'CRITIQUE'
            return (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, border: `1px solid ${isCritique ? 'var(--red-light)' : 'var(--amber-light)'}`, padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ background: isCritique ? 'var(--red-light)' : 'var(--amber-light)', borderRadius: 7, padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: isCritique ? 'var(--red)' : 'var(--amber)' }}>-{a.retardPct}%</div>
                    <div style={{ fontSize: 9.5, fontWeight: 800, color: isCritique ? 'var(--red)' : 'var(--amber)', textTransform: 'uppercase' }}>{a.niveau}</div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                      <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{a.className}</span>
                      <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{a.subjectName}</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{a.programmeTitre}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <span>
                        {t('department.progression_chapters').replace('{done}', String(a.chapitresRealises)).replace('{total}', String(a.chapitresTotal)).replace('{pct}', String(a.progressionPct)).replace('{expected}', String(a.attenduPct))}
                      </span>
                      {(a.modulesDesactivesCount ?? 0) > 0 && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: 'var(--amber-light)', color: 'var(--amber)' }}>
                          {t('department.progression_disabled_modules').replace('{count}', String(a.modulesDesactivesCount))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Synthèse consolidée du département (toutes classes & matières du département) */}
      {loadingRapport && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>
          <Loader2 size={14} className="animate-spin" style={{ display: 'inline', marginRight: 6 }} />
          Chargement de la synthèse du département...
        </div>
      )}

      {!loadingRapport && rapport && rapport.lignes.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                Synthèse d&apos;avancement du département ({rapport.resumeGlobal.progressionMoyennePct ?? 0}%)
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                {rapport.resumeGlobal.leconsRealiseesTotal}/{rapport.resumeGlobal.leconsActivesTotal} leçons actives
                {rapport.resumeGlobal.totalModulesDesactives > 0
                  ? ` · ${rapport.resumeGlobal.totalModulesDesactives} module(s) désactivé(s)`
                  : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={handleExportCsv}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 800,
                background: 'var(--bg2)', color: 'var(--sidebar)',
                border: '1px solid var(--sidebar)', cursor: 'pointer',
              }}
            >
              <Download size={12} /> Exporter CSV
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rapport.lignes.map((l) => (
              <div key={`${l.programmeId}-${l.className}`} style={{ padding: '7px 10px', borderRadius: 8, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                <div>
                  <strong>{l.className}</strong> · <span>{l.subjectName}</span>
                  {l.modulesDesactivesCount > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: 'var(--amber-light)', color: 'var(--amber)' }}>
                      {l.modulesDesactivesCount} mod. désactivé{l.modulesDesactivesCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <span>{l.leconsRealisees}/{l.leconsTotal} ({l.progressionPct ?? 0}%)</span>
                  <span style={{
                    fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
                    background: l.statut === 'CRITIQUE' ? 'var(--red-light)' : l.statut === 'MODERE' ? 'var(--amber-light)' : 'var(--green-light)',
                    color: l.statut === 'CRITIQUE' ? 'var(--red)' : l.statut === 'MODERE' ? 'var(--amber)' : 'var(--green)',
                  }}>
                    {l.statut === 'A_JOUR' ? 'À jour' : `-${l.retardPct}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
