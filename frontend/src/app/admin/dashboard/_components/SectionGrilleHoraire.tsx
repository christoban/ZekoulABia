'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { AlertTriangle, WifiOff } from 'lucide-react'

const JOURS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']

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
}

function calculerSquelette(f: GridForm): PeriodeGrille[] {
  const toMins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m ?? 0) }
  const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const result: PeriodeGrille[] = []
  let cursor = toMins(f.heureDebut)
  let ordre = 1

  const cours = (n: number) => {
    for (let i = 0; i < n; i++) {
      const d = toTime(cursor); cursor += f.dureePeriode
      result.push({ ordre: ordre++, debut: d, fin: toTime(cursor), type: 'COURS', duree: f.dureePeriode })
    }
  }

  cours(f.periodesAvantP1)
  if (f.dureePetitePause > 0 && f.periodesAvantP1 > 0) {
    const d = toTime(cursor); cursor += f.dureePetitePause
    result.push({ ordre: 0, debut: d, fin: toTime(cursor), type: 'PETITE_PAUSE', duree: f.dureePetitePause })
  }
  cours(f.periodesAvantP2)
  if (f.dureeGrandePause > 0 && f.periodesAvantP2 > 0) {
    const d = toTime(cursor); cursor += f.dureeGrandePause
    result.push({ ordre: 0, debut: d, fin: toTime(cursor), type: 'GRANDE_PAUSE', duree: f.dureeGrandePause })
  }
  cours(f.periodesApresP2)
  return result
}

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto', padding: '12px 14px' }
const sCardCls = 'rounded-[10px] p-3 md:px-5 md:py-4 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]'
const sCard: React.CSSProperties = { background: 'var(--surface)' }
const sLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sInput: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box' }
const sNum: React.CSSProperties = { ...sInput, width: 80 }

export default function SectionGrilleHoraire({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const t = useT('admin')
  const [form, setForm] = useState<GridForm>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingTimetables, setExistingTimetables] = useState(0)
  const [isConfigured, setIsConfigured] = useState(false)
  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    fetchApi('/api/v2/timetable-grid-config')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setForm({ ...d.data.config })
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

  const toggleJour = (jour: string) => {
    setForm(f => ({
      ...f,
      joursActifs: f.joursActifs.includes(jour)
        ? f.joursActifs.filter(j => j !== jour)
        : [...f.joursActifs, jour],
    }))
  }

  const handleSave = async () => {
    if (totalPeriodes < 1) { onToast(t('grille_horaire.toast.minPeriod'), 'error'); return }
    if (form.joursActifs.length === 0) { onToast(t('grille_horaire.toast.minDay'), 'error'); return }

    if (!isOnline) {
      await addToQueue({ type: 'TIMETABLE_GRID_CONFIG', endpoint: '/api/v2/timetable-grid-config', method: 'POST', payload: form })
      setIsConfigured(true)
      onToast(t('grille_horaire.toast.queued'), 'success')
      return
    }

    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/timetable-grid-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || t('grille_horaire.toast.err'))
      setIsConfigured(true)
      setExistingTimetables(d.data.timetableCount ?? 0)
      onToast(t('grille_horaire.toast.saved'), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('grille_horaire.toast.err'), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ ...sScroll, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>{t('grille_horaire.loading')}</div>
  }

  const derniereHeure = squelette.length > 0 ? squelette[squelette.length - 1].fin : '—'

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ ...sScroll, padding: undefined }}>
      <div style={{ marginBottom: 10 }}>
        <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {t('grille_horaire.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {t('grille_horaire.subtitle')}
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 8, padding: '10px 12px', marginBottom: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={15} strokeWidth={2} /></span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{t('grille_horaire.offlineHint')}</span>
        </div>
      )}

      {isConfigured && existingTimetables > 0 && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber-light)', borderRadius: 8, padding: '10px 12px', marginBottom: 11, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={15} strokeWidth={2} />
          <div style={{ fontSize: 12, color: 'var(--amber)' }}>
            <strong>{t('grille_horaire.warnStrong')}</strong> {t('grille_horaire.warnBody', { n: existingTimetables })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:[grid-template-columns:1fr_1fr]" style={{ gap: 10, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className={sCardCls} style={sCard}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 13 }}>{t('grille_horaire.settings')}</div>

            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{t('grille_horaire.startTime')}</div>
              <input type="time" style={{ ...sInput, width: 120 }} value={form.heureDebut}
                onChange={e => set('heureDebut', e.target.value)} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{t('grille_horaire.periodDuration')}</div>
              <input type="number" style={sNum} min={30} max={120} value={form.dureePeriode}
                onChange={e => set('dureePeriode', Number(e.target.value))} />
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>{t('grille_horaire.block1')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={sLabel}>{t('grille_horaire.periodsBeforeSmall')}</div>
                <input type="number" style={sNum} min={0} max={6} value={form.periodesAvantP1}
                  onChange={e => set('periodesAvantP1', Number(e.target.value))} />
              </div>
              <div>
                <div style={sLabel}>{t('grille_horaire.smallBreakDuration')}</div>
                <input type="number" style={sNum} min={0} max={60} value={form.dureePetitePause}
                  onChange={e => set('dureePetitePause', Number(e.target.value))} />
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>{t('grille_horaire.block2')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div>
                <div style={sLabel}>{t('grille_horaire.periodsBeforeBig')}</div>
                <input type="number" style={sNum} min={0} max={6} value={form.periodesAvantP2}
                  onChange={e => set('periodesAvantP2', Number(e.target.value))} />
              </div>
              <div>
                <div style={sLabel}>{t('grille_horaire.bigBreakDuration')}</div>
                <input type="number" style={sNum} min={0} max={90} value={form.dureeGrandePause}
                  onChange={e => set('dureeGrandePause', Number(e.target.value))} />
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12 }}>{t('grille_horaire.block3')}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={sLabel}>{t('grille_horaire.periodsAfterBig')}</div>
              <input type="number" style={sNum} min={0} max={6} value={form.periodesApresP2}
                onChange={e => set('periodesApresP2', Number(e.target.value))} />
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />

            <div style={{ marginBottom: 13 }}>
              <div style={sLabel}>{t('grille_horaire.activeDays')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {JOURS.map(j => (
                  <button key={j} onClick={() => toggleJour(j)} style={{
                    padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid',
                    background: form.joursActifs.includes(j) ? 'var(--sidebar)' : 'white',
                    color: form.joursActifs.includes(j) ? 'white' : 'var(--text2)',
                    borderColor: form.joursActifs.includes(j) ? 'var(--sidebar)' : 'var(--border)',
                  }}>
                    {t(`grille_horaire.days.${j}`)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 13, fontSize: 12, color: 'var(--text2)' }}>
              <strong>{totalPeriodes}</strong> {t('grille_horaire.periodsPerDay')}
              {derniereHeure !== '—' && <> · {t('grille_horaire.endAt')} <strong>{derniereHeure}</strong></>}
              {' · '}<strong>{form.joursActifs.length}</strong> {t('grille_horaire.daysPerWeek')}
            </div>

            <button onClick={handleSave} disabled={saving || totalPeriodes < 1} style={{
              width: '100%', padding: '11px', borderRadius: 8, border: 'none', cursor: saving ? 'wait' : 'pointer',
              background: saving ? 'var(--text3)' : 'var(--sidebar)', color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            }}>
              {saving ? t('grille_horaire.saving') : t('grille_horaire.save')}
            </button>
          </div>
        </div>

        <div className={sCardCls} style={sCard}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 13 }}>{t('grille_horaire.previewTitle')}</div>
          {squelette.length === 0 ? (
            <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '18px' }}>
              {t('grille_horaire.configureToPreview')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', width: 28 }}>N°</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>{t('grille_horaire.colStart')}</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>{t('grille_horaire.colEnd')}</th>
                    <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', width: 28 }}>{t('grille_horaire.colDuration')}</th>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase' }}>{t('grille_horaire.colType')}</th>
                  </tr>
                </thead>
                <tbody>
                  {squelette.map((p, i) => {
                    const isPause = p.type !== 'COURS'
                    const bg = p.type === 'GRANDE_PAUSE' ? 'var(--amber-light)' : p.type === 'PETITE_PAUSE' ? 'var(--green-light)' : 'white'
                    const label = p.type === 'COURS' ? t('grille_horaire.periodN', { n: p.ordre }) : p.type === 'PETITE_PAUSE' ? t('grille_horaire.smallBreak') : t('grille_horaire.bigBreak')
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bg2)', background: bg }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: isPause ? 'var(--text3)' : 'var(--text)' }}>
                          {isPause ? '—' : p.ordre}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{p.debut}</td>
                        <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{p.fin}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{p.duree} min</td>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: isPause ? 'var(--green)' : 'var(--text2)' }}>{label}</td>
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
