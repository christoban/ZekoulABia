'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertTriangle, WifiOff, Package } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { putCachedData, getCachedData } from '@/lib/offline/db'

const JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'] as const
const JOURS_SHORT: Record<string, string> = {
  LUNDI: 'LUN', MARDI: 'MAR', MERCREDI: 'MER', JEUDI: 'JEU', VENDREDI: 'VEN', SAMEDI: 'SAM',
}

interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

interface GridForm {
  heureDebut: string
  dureePeriode: number
  periodesAvantP1: number
  dureePetitePause: number
  periodesAvantP2: number
  dureeGrandePause: number
  periodesApresP2: number
  joursActifs: string[]
  periodesCoursParJour: Record<string, number>
}

interface GrilleHoraireProps {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  namespace?: 'admin' | 'staff'
}

const DEFAULT_FORM: GridForm = {
  heureDebut: '07:30',
  dureePeriode: 55,
  periodesAvantP1: 2,
  dureePetitePause: 15,
  periodesAvantP2: 3,
  dureeGrandePause: 30,
  periodesApresP2: 2,
  joursActifs: ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'],
  periodesCoursParJour: {},
}

function calculerSquelette(f: GridForm, jour?: string): PeriodeGrille[] {
  const toMins = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + (m ?? 0)
  }
  const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const result: PeriodeGrille[] = []
  let cursor = toMins(f.heureDebut)
  let ordre = 1
  const total = f.periodesAvantP1 + f.periodesAvantP2 + f.periodesApresP2
  const demandees = jour === undefined ? total : Math.max(0, Math.min(f.periodesCoursParJour[jour] ?? total, total))
  let restantes = demandees

  const addCours = (n: number) => {
    const nombre = Math.min(n, restantes)
    for (let i = 0; i < nombre; i++) {
      const debut = toTime(cursor)
      cursor += f.dureePeriode
      result.push({ ordre: ordre++, debut, fin: toTime(cursor), type: 'COURS', duree: f.dureePeriode })
    }
    restantes -= nombre
  }

  addCours(f.periodesAvantP1)
  if (f.dureePetitePause > 0 && f.periodesAvantP1 > 0 && demandees > f.periodesAvantP1) {
    const debut = toTime(cursor)
    cursor += f.dureePetitePause
    result.push({ ordre: 0, debut, fin: toTime(cursor), type: 'PETITE_PAUSE', duree: f.dureePetitePause })
  }
  const avantGrandePause = f.periodesAvantP1 + f.periodesAvantP2
  addCours(f.periodesAvantP2)
  if (f.dureeGrandePause > 0 && f.periodesAvantP2 > 0 && demandees > avantGrandePause) {
    const debut = toTime(cursor)
    cursor += f.dureeGrandePause
    result.push({ ordre: 0, debut, fin: toTime(cursor), type: 'GRANDE_PAUSE', duree: f.dureeGrandePause })
  }
  addCours(f.periodesApresP2)
  return result
}

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto' }
const sCard: React.CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px' }
const sLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sInput: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', boxSizing: 'border-box' }
const sNum: React.CSSProperties = { ...sInput, width: 78 }

export default function GrilleHoraireView({ onToast, namespace = 'staff' }: GrilleHoraireProps) {
  const tAdmin = useT('admin')
  const tStaff = useT('staff')
  const isAdmin = namespace === 'admin'
  const cacheKey = `${namespace}:timetable-grid-config`

  const [form, setForm] = useState<GridForm>(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingTimetables, setExistingTimetables] = useState(0)
  const [isConfigured, setIsConfigured] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    let mounted = true
    getCachedData<{ config: GridForm; timetableCount?: number }>(cacheKey).then(cached => {
      if (mounted && cached?.data?.config) {
        setForm({ ...DEFAULT_FORM, ...cached.data.config, periodesCoursParJour: cached.data.config.periodesCoursParJour ?? {} })
        if (typeof cached.data.timetableCount === 'number') setExistingTimetables(cached.data.timetableCount)
        setIsConfigured(true)
        setFromCache(true)
        setCachedAt(cached.cachedAt)
      }
    }).catch(() => {})

    fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { success?: boolean; data?: { config?: GridForm; timetableCount?: number } }) => {
        if (!mounted || !d.success || !d.data?.config) return
        setForm({ ...DEFAULT_FORM, ...d.data.config, periodesCoursParJour: d.data.config.periodesCoursParJour ?? {} })
        if (typeof d.data.timetableCount === 'number') setExistingTimetables(d.data.timetableCount)
        setIsConfigured(true)
        setFromCache(false)
        setCachedAt(null)
        void putCachedData(cacheKey, d.data)
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [cacheKey])

  const squelette = useMemo(() => {
    try { return calculerSquelette(form) } catch { return [] }
  }, [form])

  const totalPeriodes = (form.periodesAvantP1 ?? 0) + (form.periodesAvantP2 ?? 0) + (form.periodesApresP2 ?? 0)

  const setField = useCallback(<K extends keyof GridForm>(k: K, v: GridForm[K]) => {
    setForm(f => ({ ...f, [k]: v }))
  }, [])

  const setPeriodesJour = (jour: string, nombre: number) => {
    setForm(f => ({ ...f, periodesCoursParJour: { ...f.periodesCoursParJour, [jour]: nombre } }))
  }

  const toggleJour = (jour: string) => {
    setForm(f => ({
      ...f,
      joursActifs: f.joursActifs.includes(jour)
        ? f.joursActifs.filter(j => j !== jour)
        : [...f.joursActifs, jour],
    }))
  }

  const handleSave = async () => {
    if (totalPeriodes < 1) {
      onToast(isAdmin ? tAdmin('grille_horaire.toast.minPeriod') : tStaff('grilleHoraire.validationMinPeriods'), 'error')
      return
    }
    if (form.joursActifs.length === 0) {
      onToast(isAdmin ? tAdmin('grille_horaire.toast.minDay') : tStaff('grilleHoraire.validationMinDays'), 'error')
      return
    }

    if (!isOnline) {
      await addToQueue({ type: 'TIMETABLE_GRID_CONFIG', endpoint: '/api/v2/timetable-grid-config', method: 'POST', payload: form })
      setIsConfigured(true)
      onToast(isAdmin ? tAdmin('grille_horaire.toast.queued') : tStaff('grilleHoraire.saveQueued'), 'success')
      return
    }

    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/timetable-grid-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json() as { message?: string; data?: { timetableCount?: number } }
      if (!res.ok) throw new Error(d.message || tAdmin('grille_horaire.toast.err'))
      setIsConfigured(true)
      setExistingTimetables(d.data?.timetableCount ?? 0)
      onToast(isAdmin ? tAdmin('grille_horaire.toast.saved') : tStaff('grilleHoraire.saveSuccess'), 'success')
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : tAdmin('grille_horaire.toast.err'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const txt = {
    loading: isAdmin ? tAdmin('grille_horaire.loading') : tStaff('grilleHoraire.loading'),
    title: isAdmin ? tAdmin('grille_horaire.title') : tStaff('grilleHoraire.title'),
    subtitle: isAdmin ? tAdmin('grille_horaire.subtitle') : tStaff('grilleHoraire.subtitle'),
    offlineHint: isAdmin ? tAdmin('grille_horaire.offlineHint') : tStaff('grilleHoraire.offlineHint'),
    parameters: isAdmin ? tAdmin('grille_horaire.settings') : tStaff('grilleHoraire.parameters'),
    startTime: isAdmin ? tAdmin('grille_horaire.startTime') : tStaff('grilleHoraire.startTime'),
    periodDuration: isAdmin ? tAdmin('grille_horaire.periodDuration') : tStaff('grilleHoraire.periodDuration'),
    block1: isAdmin ? tAdmin('grille_horaire.block1') : tStaff('grilleHoraire.block1Title'),
    beforeSmall: isAdmin ? tAdmin('grille_horaire.periodsBeforeSmall') : tStaff('grilleHoraire.periodsBeforeSmallBreak'),
    smallDur: isAdmin ? tAdmin('grille_horaire.smallBreakDuration') : tStaff('grilleHoraire.smallBreakDuration'),
    block2: isAdmin ? tAdmin('grille_horaire.block2') : tStaff('grilleHoraire.block2Title'),
    beforeBig: isAdmin ? tAdmin('grille_horaire.periodsBeforeBig') : tStaff('grilleHoraire.periodsBeforeBigBreak'),
    bigDur: isAdmin ? tAdmin('grille_horaire.bigBreakDuration') : tStaff('grilleHoraire.bigBreakDuration'),
    block3: isAdmin ? tAdmin('grille_horaire.block3') : tStaff('grilleHoraire.block3Title'),
    afterBig: isAdmin ? tAdmin('grille_horaire.periodsAfterBig') : tStaff('grilleHoraire.periodsAfterBigBreak'),
    activeDays: isAdmin ? tAdmin('grille_horaire.activeDays') : tStaff('grilleHoraire.activeDays'),
    dailyPeriods: isAdmin ? tAdmin('grille_horaire.dailyPeriods') : tStaff('grilleHoraire.dailyPeriods'),
    saving: isAdmin ? tAdmin('grille_horaire.saving') : tStaff('grilleHoraire.saving'),
    save: isAdmin ? tAdmin('grille_horaire.save') : tStaff('grilleHoraire.save'),
    preview: isAdmin ? tAdmin('grille_horaire.previewTitle') : tStaff('grilleHoraire.preview'),
    previewEmpty: isAdmin ? tAdmin('grille_horaire.configureToPreview') : tStaff('grilleHoraire.previewEmpty'),
    colNum: isAdmin ? 'N°' : tStaff('grilleHoraire.tableHeaderNum'),
    colStart: isAdmin ? tAdmin('grille_horaire.colStart') : tStaff('grilleHoraire.tableHeaderStart'),
    colEnd: isAdmin ? tAdmin('grille_horaire.colEnd') : tStaff('grilleHoraire.tableHeaderEnd'),
    colDur: isAdmin ? tAdmin('grille_horaire.colDuration') : tStaff('grilleHoraire.tableHeaderDuration'),
    colType: isAdmin ? tAdmin('grille_horaire.colType') : tStaff('grilleHoraire.tableHeaderType'),
  }

  if (loading) {
    return <div className="px-4 py-4 md:px-7 md:py-6" style={{ ...sScroll, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>{txt.loading}</div>
  }

  const derniereHeure = squelette.length > 0 ? squelette[squelette.length - 1].fin : '—'

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={sScroll}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{txt.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{txt.subtitle}</div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <Package size={12} strokeWidth={2} /> Données du {new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — hors-ligne
          </div>
        )}
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOff size={16} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>{txt.offlineHint}</span>
        </div>
      )}

      {isConfigured && existingTimetables > 0 && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} strokeWidth={2} />
          <div style={{ fontSize: 12.5, color: 'var(--amber)' }}>
            {isAdmin
              ? <><strong>{tAdmin('grille_horaire.warnStrong')}</strong> {tAdmin('grille_horaire.warnBody', { n: existingTimetables })}</>
              : <><span dangerouslySetInnerHTML={{ __html: tStaff('grilleHoraire.warningTitle') }} /> {tStaff('grilleHoraire.warningExisting', { count: existingTimetables })}</>}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={sCard}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{txt.parameters}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{txt.startTime}</div>
              <input type="time" style={{ ...sInput, width: 120 }} value={form.heureDebut} onChange={e => setField('heureDebut', e.target.value)} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{txt.periodDuration}</div>
              <input type="number" style={sNum} min={30} max={120} value={form.dureePeriode} onChange={e => setField('dureePeriode', Number(e.target.value))} />
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{txt.block1}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={sLabel}>{txt.beforeSmall}</div>
                <input type="number" style={sNum} min={0} max={6} value={form.periodesAvantP1} onChange={e => setField('periodesAvantP1', Number(e.target.value))} />
              </div>
              <div>
                <div style={sLabel}>{txt.smallDur}</div>
                <input type="number" style={sNum} min={0} max={60} value={form.dureePetitePause} onChange={e => setField('dureePetitePause', Number(e.target.value))} />
              </div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{txt.block2}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={sLabel}>{txt.beforeBig}</div>
                <input type="number" style={sNum} min={0} max={6} value={form.periodesAvantP2} onChange={e => setField('periodesAvantP2', Number(e.target.value))} />
              </div>
              <div>
                <div style={sLabel}>{txt.bigDur}</div>
                <input type="number" style={sNum} min={0} max={90} value={form.dureeGrandePause} onChange={e => setField('dureeGrandePause', Number(e.target.value))} />
              </div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{txt.block3}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{txt.afterBig}</div>
              <input type="number" style={sNum} min={0} max={6} value={form.periodesApresP2} onChange={e => setField('periodesApresP2', Number(e.target.value))} />
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

            <div style={{ marginBottom: 14 }}>
              <div style={sLabel}>{txt.activeDays}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {JOURS.map(j => {
                  const active = form.joursActifs.includes(j)
                  return (
                    <button key={j} type="button" onClick={() => toggleJour(j)} style={{
                      padding: '5px 11px', borderRadius: 14, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                      background: active ? 'var(--sidebar)' : 'var(--surface)',
                      color: active ? 'white' : 'var(--text2)',
                      borderColor: active ? 'var(--sidebar)' : 'var(--border)',
                    }}>
                      {isAdmin ? tAdmin(`grille_horaire.days.${j}`) : JOURS_SHORT[j]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={sLabel}>{txt.dailyPeriods}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                {JOURS.filter(j => form.joursActifs.includes(j)).map(j => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '6px 8px', background: 'var(--bg)', borderRadius: 7 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>{isAdmin ? tAdmin(`grille_horaire.days.${j}`) : JOURS_SHORT[j]}</span>
                    <input type="number" min={0} max={totalPeriodes} style={{ ...sNum, width: 58 }} value={form.periodesCoursParJour[j] ?? totalPeriodes} onChange={e => setPeriodesJour(j, Number(e.target.value))} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--text2)' }}>
              {isAdmin ? (
                <>
                  <strong>{totalPeriodes}</strong> {tAdmin('grille_horaire.periodsPerDay')}
                  {derniereHeure !== '—' && <> · {tAdmin('grille_horaire.endAt')} <strong>{derniereHeure}</strong></>}
                  {' · '}<strong>{form.joursActifs.length}</strong> {tAdmin('grille_horaire.daysPerWeek')}
                </>
              ) : (
                <>
                  <span dangerouslySetInnerHTML={{ __html: tStaff('grilleHoraire.kpiSummary', { total: totalPeriodes }) }} />
                  {derniereHeure !== '—' && <span dangerouslySetInnerHTML={{ __html: tStaff('grilleHoraire.endsAt', { time: derniereHeure }) }} />}
                  <span dangerouslySetInnerHTML={{ __html: tStaff('grilleHoraire.daysPerWeek', { count: form.joursActifs.length }) }} />
                </>
              )}
            </div>

            <button type="button" onClick={handleSave} disabled={saving || totalPeriodes < 1} style={{
              width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: saving ? 'wait' : 'pointer',
              background: saving ? 'var(--text3)' : 'var(--sidebar)', color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            }}>
              {saving ? txt.saving : txt.save}
            </button>
          </div>
        </div>

        <div style={sCard}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{txt.preview}</div>
          {squelette.length === 0 ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '30px 0', fontSize: 12.5 }}>{txt.previewEmpty}</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', width: 50 }}>{txt.colNum}</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{txt.colStart}</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{txt.colEnd}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', width: 60 }}>{txt.colDur}</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{txt.colType}</th>
                  </tr>
                </thead>
                <tbody>
                  {squelette.map((p, i) => {
                    const isPause = p.type !== 'COURS'
                    const bg = p.type === 'GRANDE_PAUSE' ? 'var(--amber-light)' : p.type === 'PETITE_PAUSE' ? 'var(--green-light)' : 'var(--surface)'
                    const label = isAdmin
                      ? (p.type === 'COURS' ? tAdmin('grille_horaire.periodN', { n: p.ordre }) : p.type === 'PETITE_PAUSE' ? tAdmin('grille_horaire.smallBreak') : tAdmin('grille_horaire.bigBreak'))
                      : (p.type === 'COURS' ? tStaff('grilleHoraire.periodLabel', { ordre: p.ordre }) : p.type === 'PETITE_PAUSE' ? tStaff('grilleHoraire.petitePauseLabel') : tStaff('grilleHoraire.grandePauseLabel'))
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2)', background: bg }}>
                        <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: isPause ? 'var(--text3)' : 'var(--text)' }}>{isPause ? '—' : p.ordre}</td>
                        <td style={{ padding: '7px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{p.debut}</td>
                        <td style={{ padding: '7px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{p.fin}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{p.duree} min</td>
                        <td style={{ padding: '7px 10px', fontSize: 12, color: isPause ? 'var(--text)' : 'var(--text2)' }}>{label}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

