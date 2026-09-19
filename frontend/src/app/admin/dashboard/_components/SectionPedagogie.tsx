'use client'
import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { Circle, TrendingUp, BookOpen, CheckCircle2, Inbox, Check, WifiOff } from 'lucide-react'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'

import type { AdminSection } from '../_types'

interface OnToast { (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void }
interface Props { onToast: OnToast; onNav?: (section: AdminSection) => void }

interface Subject { id: string; name: string }
interface Classe  { id: string; name: string; level?: string | null }
interface Chapitre {
  id: string; titre: string; ordre: number; volumeHeuresPrevu: number
  sequenceCibleFin?: number | null; realise?: boolean
}
interface Programme {
  id: string; titre: string
  subject: { id: string; name: string }
  class: { id: string; name: string } | null
  level: string | null
  chapitres: Chapitre[]
}
interface Alerte {
  programmeId: string; programmeTitre: string; subjectName: string; className: string; classId: string
  chapitresTotal: number; chapitresRealises: number; progressionPct: number; attenduPct: number
  retardPct: number; niveau: 'CRITIQUE' | 'MODERE'
}
interface ProgressionData {
  programme: { id: string; titre: string } | null
  chapitresTotal: number; chapitresRealises: number
  totalHeuresPrevu: number; heuresRealisees: number
  progressionPct: number | null; attenduPct: number | null; retardPct: number | null
  chapitres: (Chapitre & { realise: boolean })[]
}

type Tab = 'programmes' | 'progression' | 'alertes' | 'rapports'

export default function SectionPedagogie({ onToast, onNav }: Props) {
  const t = useT('admin')
  const [tab, setTab] = useState<Tab>('alertes')
  const { isOnline, addToQueue } = useSyncQueue()

  // Data
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [loading, setLoading] = useState(false)

  // Prog form
  const [formTitre, setFormTitre] = useState('')
  const [formSubjectId, setFormSubjectId] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedProg, setExpandedProg] = useState<string | null>(null)

  // Chapitre form
  const [chapTitre, setChapTitre] = useState('')
  const [chapHeures, setChapHeures] = useState(2)
  const [chapSeq, setChapSeq] = useState('')
  const [addingChapFor, setAddingChapFor] = useState<string | null>(null)

  // Progression
  const [progClassId, setProgClassId] = useState('')
  const [progSubjectId, setProgSubjectId] = useState('')
  const [progressionData, setProgressionData] = useState<ProgressionData | null>(null)
  const [loadingProg, setLoadingProg] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
    ]).then(([subs, cls]) => {
      if (subs.success) setSubjects(subs.data ?? [])
      if (cls.success) setClasses(cls.data ?? [])
    }).catch(() => {})
  }, [])

  const loadProgrammes = () => {
    setLoading(true)
    fetchApi('/api/v2/pedagogie/programmes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setProgrammes(d.data ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadAlertes = () => {
    setLoading(true)
    fetchApi('/api/v2/pedagogie/alertes-retard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setAlertes(d.data ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (tab === 'programmes') loadProgrammes()
    if (tab === 'alertes') loadAlertes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleCreateProgramme = async () => {
    if (!formTitre.trim() || !formSubjectId) { onToast('Titre et matière requis', 'error'); return }

    const payload = { titre: formTitre.trim(), subjectId: formSubjectId, classId: formClassId || undefined, level: formLevel || undefined }

    if (!isOnline) {
      await addToQueue({ type: 'PEDAGOGY_PROGRAM', endpoint: '/api/v2/pedagogie/programmes', method: 'POST', payload })
      onToast('Programme mis en file d\'attente — synchronisation à la reconnexion', 'success')
      setFormTitre(''); setFormSubjectId(''); setFormClassId(''); setFormLevel('')
      return
    }

    setSaving(true)
    try {
      const r = await fetchApi('/api/v2/pedagogie/programmes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (d.success) {
        onToast('Programme créé', 'success')
        setFormTitre(''); setFormSubjectId(''); setFormClassId(''); setFormLevel('')
        loadProgrammes()
      } else onToast(d.message ?? 'Erreur', 'error')
    } catch { onToast('Erreur réseau', 'error') }
    finally { setSaving(false) }
  }

  const handleDeleteProgramme = async (id: string) => {
    if (!confirm('Supprimer ce programme et tous ses chapitres ?')) return
    const r = await fetchApi(`/api/v2/pedagogie/programmes/${id}`, { method: 'DELETE', credentials: 'include' })
    const d = await r.json()
    if (d.success) { onToast('Programme supprimé', 'success'); loadProgrammes() }
    else onToast(d.message ?? 'Erreur', 'error')
  }

  const handleAddChapitre = async (programmeId: string) => {
    if (!chapTitre.trim()) { onToast('Titre du chapitre requis', 'error'); return }

    const payload = { titre: chapTitre.trim(), volumeHeuresPrevu: chapHeures, sequenceCibleFin: chapSeq ? parseInt(chapSeq) : undefined }

    if (!isOnline) {
      await addToQueue({ type: 'PEDAGOGY_PROGRAM', endpoint: `/api/v2/pedagogie/programmes/${programmeId}/chapitres`, method: 'POST', payload })
      onToast('Chapitre mis en file d\'attente — synchronisation à la reconnexion', 'success')
      setChapTitre(''); setChapHeures(2); setChapSeq(''); setAddingChapFor(null)
      return
    }

    const r = await fetchApi(`/api/v2/pedagogie/programmes/${programmeId}/chapitres`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const d = await r.json()
    if (d.success) {
      onToast('Chapitre ajouté', 'success')
      setChapTitre(''); setChapHeures(2); setChapSeq(''); setAddingChapFor(null)
      loadProgrammes()
    } else onToast(d.message ?? 'Erreur', 'error')
  }

  const handleDeleteChapitre = async (id: string) => {
    const r = await fetchApi(`/api/v2/pedagogie/chapitres/${id}`, { method: 'DELETE', credentials: 'include' })
    const d = await r.json()
    if (d.success) { onToast('Chapitre supprimé', 'success'); loadProgrammes() }
    else onToast(d.message ?? 'Erreur', 'error')
  }

  const loadProgression = () => {
    if (!progClassId || !progSubjectId) return
    setLoadingProg(true)
    fetchApi(`/api/v2/pedagogie/progression?classId=${progClassId}&subjectId=${progSubjectId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setProgressionData(d.data) })
      .catch(() => {})
      .finally(() => setLoadingProg(false))
  }

  const tabBtn = (t: Tab, label: React.ReactNode) => (
    <button onClick={() => setTab(t)}
      className="flex-1 md:flex-none text-xs md:text-sm px-3 md:px-4 py-2 md:py-1.5 rounded-lg"
      style={{ fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === t ? 'var(--sidebar)' : 'var(--bg2)', color: tab === t ? 'white' : 'var(--text2)', transition: 'all 0.15s' }}>
      {label}
    </button>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit', color: 'var(--text)',
    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 3, display: 'block',
  }

  const niveauColor = (n: 'CRITIQUE' | 'MODERE') =>
    n === 'CRITIQUE' ? { bg: 'var(--red-light)', color: 'var(--red)' } : { bg: 'var(--amber-light)', color: 'var(--amber)' }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5 space-y-4 max-w-7xl mx-auto pb-12 font-nunito">
      <div className="pb-1.5 border-b border-[var(--border)]">
        <h1 className="text-[15px] md:text-[17px] font-bold font-spectral" style={{ color: 'var(--text)' }}>
          {t('pedagogie.title')}
        </h1>
        <p className="text-[11px] md:text-[12px] font-medium mt-0.5" style={{ color: 'var(--text3)' }}>
          Programmes, cahiers de texte et suivi des progressions
        </p>
      </div>

      <DelegationSupervisionBanner actorTitle="Animateur Pédagogique" domainLabel="Suivi Pédagogique & Avancement des Programmes" onNav={onNav} />

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>Mode hors-ligne — les nouveaux programmes/chapitres seront synchronisés à la reconnexion</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {tabBtn('alertes', <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Circle size={8} fill="var(--red)" stroke="none" /> Alertes retard</span>)}
        {tabBtn('progression', <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={14} strokeWidth={2} /> Progression</span>)}
        {tabBtn('programmes', <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><BookOpen size={14} strokeWidth={2} /> Programmes</span>)}
      </div>

      {/* ─── Onglet Alertes ─── */}
      {tab === 'alertes' && (
        <div>
          <div className="flex-col sm:flex-row gap-3 sm:gap-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div className="text-xs font-medium" style={{ color: 'var(--text2)' }}>
              Classes/matières avec un retard significatif par rapport au calendrier prévu
            </div>
            <button onClick={loadAlertes} className="w-full sm:w-auto flex-shrink-0" style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--sidebar)', color: 'white', border: 'none', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
              Actualiser
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Calcul en cours...</div>
          ) : alertes.length === 0 ? (
            <div className="px-5 py-8 text-center" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--green)' }}><CheckCircle2 size={32} strokeWidth={1.5} /></div>
              <div className="text-xs md:text-sm font-bold mb-1" style={{ color: 'var(--green)' }}>Aucun retard significatif détecté</div>
              <div className="text-xs font-medium" style={{ color: 'var(--text3)' }}>
                Toutes les classes sont dans les délais prévus, ou aucun programme n'est encore défini.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alertes.map((a, i) => {
                const nc = niveauColor(a.niveau)
                return (
                  <div key={i} className="rounded-xl p-4 md:px-5 md:py-4 border border-[var(--border)] bg-[var(--surface)] shadow-xs flex items-start gap-3.5 md:gap-5" style={{ borderLeft: `4px solid ${a.niveau === 'CRITIQUE' ? 'var(--red)' : 'var(--amber)'}` }}>
                    <div className="px-3 py-2 md:px-3.5 md:py-2.5 flex-shrink-0 text-center rounded-xl" style={{ background: nc.bg }}>
                      <div className="text-base md:text-xl font-black" style={{ color: nc.color }}>-{a.retardPct}%</div>
                      <div className="text-[10px] md:text-xs font-bold uppercase" style={{ color: nc.color }}>{a.niveau}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex flex-wrap gap-2 mb-1.5">
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>{a.className}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>{a.subjectName}</span>
                      </div>
                      <div className="text-xs md:text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>{a.programmeTitre}</div>
                      <div className="flex flex-wrap gap-3 md:gap-5 text-xs font-semibold" style={{ color: 'var(--text2)' }}>
                        <span>Réalisé : {a.progressionPct}%</span>
                        <span>Attendu : {a.attenduPct}%</span>
                        <span>{a.chapitresRealises}/{a.chapitresTotal} chapitres</span>
                      </div>
                      {/* Barre de progression */}
                      <div style={{ marginTop: 10, position: 'relative' }}>
                        <div style={{ background: 'var(--bg2)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${a.attenduPct}%`, background: 'var(--border)', position: 'absolute', left: 0, top: 0, borderRadius: 6 }} />
                          <div style={{ height: '100%', width: `${a.progressionPct}%`, background: a.niveau === 'CRITIQUE' ? 'var(--red)' : 'var(--amber)', borderRadius: 6, position: 'relative', zIndex: 1 }} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                          La barre grise indique le niveau d'avancement attendu à la date d'aujourd'hui.
                        </div>
                      </div>

                      {/* Actions RACI Admin */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onToast(`Signalement d'alerte transmis à l'Animateur Pédagogique et à l'Enseignant (${a.className} — ${a.subjectName})`, 'success')}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          style={{ background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid var(--amber)' }}
                        >
                          <span>🔔 Signaler / Relancer l'Animateur Pédagogique</span>
                        </button>
                        <button
                          onClick={() => { setTab('programmes'); setExpandedProg(a.programmeId) }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                          style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)' }}
                        >
                          <span>✏️ Intervenir (Urgence Admin)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Onglet Progression ─── */}
      {tab === 'progression' && (
        <div>
          <div className="grid grid-cols-2 sm:flex" style={{ gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="col-span-1 sm:w-[200px]">
              <label style={labelStyle}>Classe</label>
              <select value={progClassId} onChange={e => setProgClassId(e.target.value)} className="w-full" style={inputStyle}>
                <option value="">— Choisir —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-1 sm:w-[200px]">
              <label style={labelStyle}>Matière</label>
              <select value={progSubjectId} onChange={e => setProgSubjectId(e.target.value)} className="w-full" style={inputStyle}>
                <option value="">— Choisir —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={loadProgression} disabled={!progClassId || !progSubjectId}
              className="col-span-2 sm:col-span-1"
              style={{ padding: '8px 16px', borderRadius: 8, background: !progClassId || !progSubjectId ? 'var(--text3)' : 'var(--sidebar)', color: 'white', border: 'none', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: !progClassId || !progSubjectId ? 'not-allowed' : 'pointer' }}>
              Voir progression
            </button>
          </div>

          {loadingProg && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Calcul...</div>}

          {!loadingProg && progressionData && (
            <>
              {!progressionData.programme ? (
                <div className="px-5 py-8 text-center" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: 'var(--text3)' }}><Inbox size={32} strokeWidth={1.5} /></div>
                  <div className="text-xs md:text-sm font-bold mb-1" style={{ color: 'var(--text3)' }}>Aucun programme défini pour cette classe/matière</div>
                  <div className="text-xs font-medium" style={{ color: 'var(--text3)' }}>Créez d'abord un programme dans l'onglet Programmes.</div>
                </div>
              ) : (
                <div className="p-4 md:p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <div className="text-sm md:text-base font-bold font-spectral mb-3" style={{ color: 'var(--text)' }}>
                    {progressionData.programme.titre}
                  </div>

                  {/* Métriques */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {[
                      { label: 'Chapitres réalisés', value: `${progressionData.chapitresRealises}/${progressionData.chapitresTotal}`, color: 'var(--sidebar)' },
                      { label: 'Progression réelle', value: progressionData.progressionPct !== null ? `${progressionData.progressionPct}%` : '—', color: progressionData.progressionPct !== null && progressionData.progressionPct >= (progressionData.attenduPct ?? 0) ? 'var(--green)' : 'var(--red)' },
                      { label: 'Progression attendue', value: progressionData.attenduPct !== null ? `${progressionData.attenduPct}%` : '—', color: 'var(--text3)' },
                      { label: 'Retard', value: progressionData.retardPct !== null ? (progressionData.retardPct > 0 ? `-${progressionData.retardPct}%` : 'À jour') : '—', color: (progressionData.retardPct ?? 0) > 15 ? 'var(--red)' : (progressionData.retardPct ?? 0) > 0 ? 'var(--amber)' : 'var(--green)' },
                    ].map(m => (
                      <div key={m.label} className="rounded-lg px-3 py-2.5 md:px-3.5 md:py-3 text-center bg-[var(--bg)]">
                        <div className="text-base md:text-lg font-black" style={{ color: m.color }}>{m.value}</div>
                        <div className="text-[10px] font-bold text-[var(--text3)] mt-0.5 uppercase tracking-wider">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barre double */}
                  <div style={{ marginBottom: 20 }}>
                    <div className="text-xs font-bold mb-1 text-[var(--text3)] uppercase tracking-wider">Progression du programme</div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 8, height: 16, overflow: 'hidden', position: 'relative' }}>
                      {progressionData.attenduPct !== null && (
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressionData.attenduPct}%`, background: 'var(--border)', zIndex: 1 }} />
                      )}
                      {progressionData.progressionPct !== null && (
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressionData.progressionPct}%`, background: (progressionData.retardPct ?? 0) > 15 ? 'var(--red)' : 'var(--green)', zIndex: 2, borderRadius: 8, transition: 'width 0.5s ease' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                      <span>Vert = réalisé · Gris = attendu à date</span>
                      <span>{progressionData.heuresRealisees}h / {progressionData.totalHeuresPrevu}h</span>
                    </div>
                  </div>

                  {/* Liste des chapitres */}
                  <div className="text-[11px] font-bold text-[var(--text3)] mb-2 uppercase tracking-wider">
                    Chapitres
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(progressionData.chapitres ?? []).map((c: Chapitre & { realise: boolean }) => (
                      <div key={c.id} className="gap-2.5 md:gap-3.5 px-3 py-2 md:px-3.5 md:py-2 flex items-center rounded-lg" style={{ background: c.realise ? 'var(--green-light)' : 'var(--bg)', border: `1px solid ${c.realise ? 'var(--green-light)' : 'var(--bg2)'}` }}>
                        <div className="w-5 h-5 text-xs rounded-full flex items-center justify-center font-black flex-shrink-0" style={{ background: c.realise ? 'var(--green)' : 'var(--border)', color: c.realise ? 'white' : 'var(--text3)' }}>
                          {c.realise ? <Check size={12} strokeWidth={3} /> : c.ordre}
                        </div>
                        <span className="text-xs md:text-sm flex-1 font-semibold" style={{ color: c.realise ? 'var(--green)' : 'var(--text2)' }}>{c.titre}</span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>{c.volumeHeuresPrevu}h</span>
                        {c.sequenceCibleFin && (
                          <span className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>
                            Seq {c.sequenceCibleFin}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Onglet Programmes ─── */}
      {tab === 'programmes' && (
        <div>
          {/* Formulaire création */}
          <div className="p-4 md:p-5 mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="text-xs md:text-sm font-bold text-[var(--text)] mb-2.5">Nouveau programme</div>
            <div className="grid grid-cols-2 sm:[grid-template-columns:2fr_1fr_1fr] gap-3 mb-3">
              <div className="col-span-2 sm:col-span-1">
                <label style={labelStyle}>Titre *</label>
                <input value={formTitre} onChange={e => setFormTitre(e.target.value)} placeholder="Ex: Programme Maths 3ème 2025-2026" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Matière *</label>
                <select value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)} style={inputStyle}>
                  <option value="">— Choisir —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Classe (optionnel)</label>
                <select value={formClassId} onChange={e => setFormClassId(e.target.value)} style={inputStyle}>
                  <option value="">— Toutes classes du niveau —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {!formClassId && (
              <div className="mb-3">
                <label style={labelStyle}>Niveau (si non lié à une classe précise)</label>
                <input value={formLevel} onChange={e => setFormLevel(e.target.value)} placeholder="Ex: 3ème, Terminale..." style={{ ...inputStyle, maxWidth: 300 }} />
              </div>
            )}
            <button onClick={handleCreateProgramme} disabled={saving || !formTitre.trim() || !formSubjectId}
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs md:text-sm font-extrabold text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: saving || !formTitre.trim() || !formSubjectId ? 'var(--text3)' : 'var(--sidebar)' }}>
              {saving ? 'Création...' : 'Créer le programme'}
            </button>
          </div>

          {/* Liste */}
          {loading ? (
            <div className="p-8 text-center text-xs md:text-sm text-[var(--text3)]">Chargement...</div>
          ) : programmes.length === 0 ? (
            <div className="px-5 py-8 text-center bg-[var(--surface)] rounded-xl border border-[var(--border)]">
              <div className="flex justify-center mb-2 text-[var(--text3)]"><Inbox size={32} strokeWidth={1.5} /></div>
              <div className="text-sm font-semibold text-[var(--text3)]">Aucun programme défini</div>
              <div className="text-xs text-[var(--border2)] mt-1">Créez un programme ci-dessus, puis ajoutez ses chapitres.</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {programmes.map(p => (
                <div key={p.id} className="rounded-xl shadow-xs md:shadow-none bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                  {/* Header prog */}
                  <div className="p-3 md:px-4 md:py-3.5 flex items-center gap-3 flex-wrap cursor-pointer"
                    onClick={() => setExpandedProg(expandedProg === p.id ? null : p.id)}>
                    <span className="text-xs md:text-sm text-[var(--text2)]">{expandedProg === p.id ? '▼' : '▶'}</span>
                    <div className="flex-1 min-w-[160px]">
                      <div className="text-xs md:text-sm font-bold text-[var(--text)]">{p.titre}</div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full font-extrabold" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>{p.subject.name}</span>
                        {p.class && <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full font-extrabold" style={{ background: 'var(--blue-light)', color: 'var(--blue)' }}>{p.class.name}</span>}
                        {p.level && !p.class && <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full font-extrabold" style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>{p.level}</span>}
                        <span className="text-[11px] md:text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--bg2)', color: 'var(--text3)' }}>{p.chapitres.length} chapitre{p.chapitres.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteProgramme(p.id) }}
                      className="text-xs px-2.5 py-1 rounded-md font-bold bg-[var(--red-light)] text-[var(--red)] border-none cursor-pointer">
                      Supprimer
                    </button>
                  </div>

                  {expandedProg === p.id && (
                    <div className="p-3 md:px-4 md:py-3.5 border-t border-[var(--border)]">
                      {/* Chapitres */}
                      {p.chapitres.length > 0 && (
                        <div className="mb-3 space-y-1.5">
                          {p.chapitres.map(c => (
                            <div key={c.id} className="gap-2 md:gap-3 px-2.5 py-1.5 md:px-3 md:py-2 flex items-center flex-wrap bg-[var(--bg)] rounded-lg">
                              <span className="w-5 h-5 md:w-5.5 md:h-5.5 text-xs rounded-full flex items-center justify-center font-extrabold flex-shrink-0 text-white" style={{ background: 'var(--sidebar)' }}>{c.ordre}</span>
                              <span className="text-xs md:text-sm font-semibold flex-1 min-w-[120px] text-[var(--text)]">{c.titre}</span>
                              <span className="text-xs font-semibold text-[var(--text3)]">{c.volumeHeuresPrevu}h</span>
                              {c.sequenceCibleFin && <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--purple-light)', color: 'var(--purple)' }}>Seq {c.sequenceCibleFin}</span>}
                              <button onClick={() => handleDeleteChapitre(c.id)}
                                className="text-xs px-2 py-0.5 rounded-md font-extrabold bg-[var(--red-light)] text-[var(--red)] border-none cursor-pointer">
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulaire ajout chapitre */}
                      {addingChapFor === p.id ? (
                        <div className="bg-[var(--bg)] rounded-lg p-3 md:p-3.5 flex flex-col gap-2.5">
                          <div className="grid grid-cols-2 sm:[grid-template-columns:2fr_1fr_1fr] gap-2.5">
                            <div className="col-span-2 sm:col-span-1">
                              <label style={labelStyle}>Titre *</label>
                              <input value={chapTitre} onChange={e => setChapTitre(e.target.value)} placeholder="Ex: Fonctions numériques" style={inputStyle} />
                            </div>
                            <div>
                              <label style={labelStyle}>Durée (h)</label>
                              <input type="number" value={chapHeures} min={1} max={50} onChange={e => setChapHeures(parseInt(e.target.value) || 2)} style={inputStyle} />
                            </div>
                            <div>
                              <label style={labelStyle}>Séquence cible</label>
                              <select value={chapSeq} onChange={e => setChapSeq(e.target.value)} style={inputStyle}>
                                <option value="">—</option>
                                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>Séquence {n}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2.5">
                            <button onClick={() => handleAddChapitre(p.id)}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--sidebar)] border-none cursor-pointer">
                              Ajouter
                            </button>
                            <button onClick={() => { setAddingChapFor(null); setChapTitre(''); setChapHeures(2); setChapSeq('') }}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-bold text-[var(--text2)] bg-[var(--bg2)] border-none cursor-pointer">
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setAddingChapFor(p.id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-[var(--sidebar)] bg-[var(--bg2)] border border-dashed border-[var(--border2)] cursor-pointer">
                          + Ajouter un chapitre
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
