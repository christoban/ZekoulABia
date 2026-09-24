'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { AlertTriangle, WifiOff } from 'lucide-react'

const JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const JOURS_LABELS: Record<string, string> = {
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

const DEFAULT: GridForm = {
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

// Calcul du squelette côté client (identique à la logique backend)
function calculerSquelette(f: GridForm, jour?: string): PeriodeGrille[] {
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m ?? 0) }
  const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const result: PeriodeGrille[] = []
  let cursor = toMins(f.heureDebut)
  let ordre = 1
  const total = f.periodesAvantP1 + f.periodesAvantP2 + f.periodesApresP2
  const demandees = jour === undefined ? total : Math.max(0, Math.min(f.periodesCoursParJour[jour] ?? total, total))
  let restantes = demandees

  const cours = (n: number) => {
    const nombre = Math.min(n, restantes)
    for (let i = 0; i < nombre; i++) {
      const d = toTime(cursor); cursor += f.dureePeriode
      result.push({ ordre: ordre++, debut: d, fin: toTime(cursor), type: 'COURS', duree: f.dureePeriode })
    }
    restantes -= nombre
  }

  cours(f.periodesAvantP1)
  if (f.dureePetitePause > 0 && f.periodesAvantP1 > 0 && demandees > f.periodesAvantP1) {
    const d = toTime(cursor); cursor += f.dureePetitePause
    result.push({ ordre: 0, debut: d, fin: toTime(cursor), type: 'PETITE_PAUSE', duree: f.dureePetitePause })
  }
  const avantGrandePause = f.periodesAvantP1 + f.periodesAvantP2
  cours(f.periodesAvantP2)
  if (f.dureeGrandePause > 0 && f.periodesAvantP2 > 0 && demandees > avantGrandePause) {
    const d = toTime(cursor); cursor += f.dureeGrandePause
    result.push({ ordre: 0, debut: d, fin: toTime(cursor), type: 'GRANDE_PAUSE', duree: f.dureeGrandePause })
  }
  cours(f.periodesApresP2)
  return result
}

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto' }
const sCard: React.CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 18px' }
const sLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sInput: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', boxSizing: 'border-box' }
const sNum: React.CSSProperties = { ...sInput, width: 75 }

export default function SectionGrilleHoraire({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const t = useT('staff')
  const [form, setForm] = useState<GridForm>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingTimetables, setExistingTimetables] = useState(0)
  const [isConfigured, setIsConfigured] = useState(false)
  const { isOnline, addToQueue } = useSyncQueue()

  // Charger la config existante
  useEffect(() => {
    fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
           setForm({ ...DEFAULT, ...d.data.config, periodesCoursParJour: d.data.config.periodesCoursParJour ?? {} })

          setIsConfigured(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const squelette = useMemo(() => {
    try { return calculerSquelette(form) } catch { return [] }
  }, [form])

  const totalPeriodes = (form.periodesAvantP1 ?? 0) + (form.periodesAvantP2 ?? 0) + (form.periodesApresP2 ?? 0)

  const set = useCallback(<K extends keyof GridForm>(k: K, v: GridForm[K]) => {
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
    if (totalPeriodes < 1) { onToast(t('grilleHoraire.validationMinPeriods'), 'error'); return }
    if (form.joursActifs.length === 0) { onToast(t('grilleHoraire.validationMinDays'), 'error'); return }

    if (!isOnline) {
      await addToQueue({ type: 'TIMETABLE_GRID_CONFIG', endpoint: '/api/v2/timetable-grid-config', method: 'POST', payload: form })
      setIsConfigured(true)
      onToast(t('grilleHoraire.saveQueued'), 'success')
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
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      setIsConfigured(true)
      setExistingTimetables(d.data.timetableCount ?? 0)
      onToast(t('grilleHoraire.saveSuccess'), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="px-4 py-4 md:px-7 md:py-6" style={{ ...sScroll, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('grilleHoraire.loading')}</div>
  }

  const derniereHeure = squelette.length > 0 ? squelette[squelette.length - 1].fin : '—'

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={sScroll}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          {t('grilleHoraire.title')}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          {t('grilleHoraire.subtitle')}
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>{t('grilleHoraire.offlineHint')}</span>
        </div>
      )}

      {/* Avertissement EDT existants */}
      {isConfigured && existingTimetables > 0 && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber-light)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={16} strokeWidth={2} /></span>
          <div style={{ fontSize: 12.5, color: 'var(--amber)' }}>
            <span dangerouslySetInnerHTML={{ __html: t('grilleHoraire.warningTitle') }} /> {t('grilleHoraire.warningExisting', { count: existingTimetables })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, alignItems: 'start' }}>
        {/* ── Formulaire ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={sCard}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('grilleHoraire.parameters')}</div>

            {/* Heure de début */}
            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{t('grilleHoraire.startTime')}</div>
              <input type="time" style={{ ...sInput, width: 120 }} value={form.heureDebut}
                onChange={e => set('heureDebut', e.target.value)} />
            </div>

            {/* Durée d'une période */}
            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{t('grilleHoraire.periodDuration')}</div>
              <input type="number" style={sNum} min={30} max={120} value={form.dureePeriode}
                onChange={e => set('dureePeriode', Number(e.target.value))} />
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

            {/* Bloc 1 */}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{t('grilleHoraire.block1Title')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={sLabel}>{t('grilleHoraire.periodsBeforeSmallBreak')}</div>
                <input type="number" style={sNum} min={0} max={6} value={form.periodesAvantP1}
                  onChange={e => set('periodesAvantP1', Number(e.target.value))} />
              </div>
              <div>
                <div style={sLabel}>{t('grilleHoraire.smallBreakDuration')}</div>
                <input type="number" style={sNum} min={0} max={60} value={form.dureePetitePause}
                  onChange={e => set('dureePetitePause', Number(e.target.value))} />
              </div>
            </div>

            {/* Bloc 2 */}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{t('grilleHoraire.block2Title')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={sLabel}>{t('grilleHoraire.periodsBeforeBigBreak')}</div>
                <input type="number" style={sNum} min={0} max={6} value={form.periodesAvantP2}
                  onChange={e => set('periodesAvantP2', Number(e.target.value))} />
              </div>
              <div>
                <div style={sLabel}>{t('grilleHoraire.bigBreakDuration')}</div>
                <input type="number" style={sNum} min={0} max={90} value={form.dureeGrandePause}
                  onChange={e => set('dureeGrandePause', Number(e.target.value))} />
              </div>
            </div>

            {/* Bloc 3 */}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 }}>{t('grilleHoraire.block3Title')}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{t('grilleHoraire.periodsAfterBigBreak')}</div>
              <input type="number" style={sNum} min={0} max={6} value={form.periodesApresP2}
                onChange={e => set('periodesApresP2', Number(e.target.value))} />
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

            {/* Jours actifs */}
            <div style={{ marginBottom: 14 }}>
              <div style={sLabel}>{t('grilleHoraire.activeDays')}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {JOURS.map(j => (
                  <button key={j} onClick={() => toggleJour(j)} style={{
                    padding: '4px 10px', borderRadius: 14, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                    background: form.joursActifs.includes(j) ? 'var(--sidebar)' : 'var(--surface)',
                    color: form.joursActifs.includes(j) ? 'white' : 'var(--text2)',
                    borderColor: form.joursActifs.includes(j) ? 'var(--sidebar)' : 'var(--border)',
                  }}>
                    {JOURS_LABELS[j]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={sLabel}>{t('grilleHoraire.dailyPeriods')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                {JOURS.filter(j => form.joursActifs.includes(j)).map(j => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '6px 8px', background: 'var(--bg)', borderRadius: 7 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>{JOURS_LABELS[j]}</span>
                    <input type="number" min={0} max={totalPeriodes} style={{ ...sNum, width: 58 }} value={form.periodesCoursParJour[j] ?? totalPeriodes} onChange={e => setPeriodesJour(j, Number(e.target.value))} />
                  </div>
                ))}
              </div>
            </div>

            {/* KPI rapide */}
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--text2)' }}>
              <span dangerouslySetInnerHTML={{ __html: t('grilleHoraire.kpiSummary', { total: totalPeriodes }) }} />
              {derniereHeure !== '—' && <span dangerouslySetInnerHTML={{ __html: t('grilleHoraire.endsAt', { time: derniereHeure }) }} />}
              <span dangerouslySetInnerHTML={{ __html: t('grilleHoraire.daysPerWeek', { count: form.joursActifs.length }) }} />
            </div>

            <button onClick={handleSave} disabled={saving || totalPeriodes < 1} style={{
              width: '100%', padding: '9px 0', borderRadius: 8, border: 'none', cursor: saving ? 'wait' : 'pointer',
              background: saving ? 'var(--text3)' : 'var(--sidebar)', color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            }}>
              {saving ? t('grilleHoraire.saving') : t('grilleHoraire.save')}
            </button>
          </div>
        </div>

        {/* ── Aperçu squelette ── */}
        <div style={sCard}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('grilleHoraire.preview')}</div>
          {squelette.length === 0 ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '30px 0', fontSize: 12.5 }}>
              {t('grilleHoraire.previewEmpty')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', width: 50 }}>{t('grilleHoraire.tableHeaderNum')}</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{t('grilleHoraire.tableHeaderStart')}</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{t('grilleHoraire.tableHeaderEnd')}</th>
                    <th style={{ textAlign: 'center', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', width: 60 }}>{t('grilleHoraire.tableHeaderDuration')}</th>
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{t('grilleHoraire.tableHeaderType')}</th>
                  </tr>
                </thead>
                <tbody>
                  {squelette.map((p, i) => {
                    const isPause = p.type !== 'COURS'
                    const bg = p.type === 'GRANDE_PAUSE' ? 'var(--amber-light)' : p.type === 'PETITE_PAUSE' ? 'var(--green-light)' : 'var(--surface)'
                    const label = p.type === 'COURS' ? t('grilleHoraire.periodLabel', { ordre: p.ordre }) : p.type === 'PETITE_PAUSE' ? t('grilleHoraire.petitePauseLabel') : t('grilleHoraire.grandePauseLabel')
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2)', background: bg }}>
                        <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                          {isPause ? '—' : p.ordre}
                        </td>
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
