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
      className="flex-1 md:flex-none text-[12px] md:text-[14px] px-[4px] md:px-[20px] py-[9px] md:py-[8px] rounded-[12px] md:rounded-[10px]"
      style={{ fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === t ? 'var(--sidebar)' : 'var(--bg2)', color: tab === t ? 'white' : 'var(--text2)', transition: 'all 0.15s' }}>
      {label}
    </button>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
    fontSize: 14, fontWeight: 600, fontFamily: 'inherit', color: 'var(--text)',
    background: 'var(--surface)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block',
  }

  const niveauColor = (n: 'CRITIQUE' | 'MODERE') =>
    n === 'CRITIQUE' ? { bg: 'var(--red-light)', color: 'var(--red)' } : { bg: 'var(--amber-light)', color: 'var(--amber)' }

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflowY: 'auto' }}>
      <div className="mb-[16px] md:mb-[24px]">
        <div className="text-[22px] md:text-[24px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
          {t('pedagogie.title')}
        </div>
        <div className="text-[13px] md:text-[14px]" style={{ color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>
          Programmes, cahiers de texte et suivi des progressions
        </div>
      </div>

      <DelegationSupervisionBanner actorTitle="Animateur Pédagogique" domainLabel="Suivi Pédagogique & Avancement des Programmes" onNav={onNav} />

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 12, padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={18} strokeWidth={2} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--amber)' }}>Mode hors-ligne — les nouveaux programmes/chapitres seront synchronisés à la reconnexion</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {tabBtn('alertes', <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Circle size={10} fill="var(--red)" stroke="none" /> Alertes retard</span>)}
        {tabBtn('progression', <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={15} strokeWidth={2} /> Progression</span>)}
        {tabBtn('programmes', <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={15} strokeWidth={2} /> Programmes</span>)}
      </div>

      {/* ─── Onglet Alertes ─── */}
      {tab === 'alertes' && (
        <div>
          <div className="flex-col sm:flex-row gap-3 sm:gap-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div className="text-[12.5px] md:text-[14px]" style={{ color: 'var(--text2)', fontWeight: 600 }}>
              Classes/matières avec un retard significatif par rapport au calendrier prévu
            </div>
            <button onClick={loadAlertes} className="w-full sm:w-auto flex-shrink-0" style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--sidebar)', color: 'white', border: 'none', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
              Actualiser
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Calcul en cours...</div>
          ) : alertes.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--green)' }}><CheckCircle2 size={40} strokeWidth={1.5} /></div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)', marginBottom: 4 }}>Aucun retard significatif détecté</div>
              <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500 }}>
                Toutes les classes sont dans les délais prévus, ou aucun programme n'est encore défini.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alertes.map((a, i) => {
                const nc = niveauColor(a.niveau)
                return (
                  <div key={i} className="rounded-[16px] md:rounded-[14px] gap-[12px] md:gap-[20px] p-[15px] md:px-[22px] md:py-[18px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none" style={{ background: 'var(--surface)', border: `1.5px solid ${a.niveau === 'CRITIQUE' ? 'var(--red-light)' : 'var(--amber-light)'}`, display: 'flex', alignItems: 'flex-start' }}>
                    <div className="px-[12px] py-[8px] md:px-[14px] md:py-[10px]" style={{ flexShrink: 0, textAlign: 'center', background: nc.bg, borderRadius: 12 }}>
                      <div className="text-[17px] md:text-[22px]" style={{ fontWeight: 900, color: nc.color }}>-{a.retardPct}%</div>
                      <div className="text-[9px] md:text-[11px]" style={{ fontWeight: 800, color: nc.color, textTransform: 'uppercase' }}>{a.niveau}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="gap-[6px] md:gap-[8px] mb-[6px] md:mb-[8px]" style={{ display: 'flex', flexWrap: 'wrap' }}>
                        <span className="text-[10.5px] md:text-[12px] px-[8px] py-[2px] md:px-[10px] md:py-[3px]" style={{ background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: 20, fontWeight: 800 }}>{a.className}</span>
                        <span className="text-[10.5px] md:text-[12px] px-[8px] py-[2px] md:px-[10px] md:py-[3px]" style={{ background: 'var(--amber-light)', color: 'var(--amber)', borderRadius: 20, fontWeight: 800 }}>{a.subjectName}</span>
                      </div>
                      <div className="text-[13px] md:text-[14px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{a.programmeTitre}</div>
                      <div className="gap-[10px] md:gap-[20px] text-[11.5px] md:text-[13px]" style={{ display: 'flex', flexWrap: 'wrap', color: 'var(--text2)', fontWeight: 600 }}>
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

                      {/* Actions RACI Admin : Signaler (par défaut) vs Intervenir directement */}
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
          <div className="grid grid-cols-2 sm:flex" style={{ gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
              style={{ padding: '10px 20px', borderRadius: 10, background: !progClassId || !progSubjectId ? 'var(--text3)' : 'var(--sidebar)', color: 'white', border: 'none', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: !progClassId || !progSubjectId ? 'not-allowed' : 'pointer' }}>
              Voir progression
            </button>
          </div>

          {loadingProg && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Calcul...</div>}

          {!loadingProg && progressionData && (
            <>
              {!progressionData.programme ? (
                <div style={{ padding: 40, textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text3)' }}><Inbox size={36} strokeWidth={1.5} /></div>
                  <div style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600 }}>Aucun programme défini pour cette classe/matière</div>
                  <div style={{ fontSize: 13, color: 'var(--border2)', marginTop: 4 }}>Créez d'abord un programme dans l'onglet Programmes.</div>
                </div>
              ) : (
                <div className="p-[16px] md:p-[28px]" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 18 }}>
                    {progressionData.programme.titre}
                  </div>

                  {/* Métriques */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-[10px] md:gap-[12px] mb-[18px] md:mb-[24px]">
                    {[
                      { label: 'Chapitres réalisés', value: `${progressionData.chapitresRealises}/${progressionData.chapitresTotal}`, color: 'var(--sidebar)' },
                      { label: 'Progression réelle', value: progressionData.progressionPct !== null ? `${progressionData.progressionPct}%` : '—', color: progressionData.progressionPct !== null && progressionData.progressionPct >= (progressionData.attenduPct ?? 0) ? 'var(--green)' : 'var(--red)' },
                      { label: 'Progression attendue', value: progressionData.attenduPct !== null ? `${progressionData.attenduPct}%` : '—', color: 'var(--text3)' },
                      { label: 'Retard', value: progressionData.retardPct !== null ? (progressionData.retardPct > 0 ? `-${progressionData.retardPct}%` : 'À jour') : '—', color: (progressionData.retardPct ?? 0) > 15 ? 'var(--red)' : (progressionData.retardPct ?? 0) > 0 ? 'var(--amber)' : 'var(--green)' },
                    ].map(m => (
                      <div key={m.label} className="rounded-[12px] px-[12px] py-[12px] md:px-[18px] md:py-[14px]" style={{ background: 'var(--bg)', textAlign: 'center' }}>
                        <div className="text-[18px] md:text-[22px]" style={{ fontWeight: 900, color: m.color }}>{m.value}</div>
                        <div className="text-[10px] md:text-[12px]" style={{ fontWeight: 700, color: 'var(--text3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barre double */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>Progression du programme</div>
                    <div style={{ background: 'var(--bg2)', borderRadius: 8, height: 20, overflow: 'hidden', position: 'relative' }}>
                      {progressionData.attenduPct !== null && (
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressionData.attenduPct}%`, background: 'var(--border)', zIndex: 1 }} />
                      )}
                      {progressionData.progressionPct !== null && (
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressionData.progressionPct}%`, background: (progressionData.retardPct ?? 0) > 15 ? 'var(--red)' : 'var(--green)', zIndex: 2, borderRadius: 8, transition: 'width 0.5s ease' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      <span>Vert = réalisé · Gris = attendu à date</span>
                      <span>{progressionData.heuresRealisees}h / {progressionData.totalHeuresPrevu}h</span>
                    </div>
                  </div>

                  {/* Liste des chapitres */}
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text2)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Chapitres
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(progressionData.chapitres ?? []).map((c: Chapitre & { realise: boolean }) => (
                      <div key={c.id} className="gap-[10px] md:gap-[14px] px-[12px] py-[9px] md:px-[16px] md:py-[10px]" style={{ display: 'flex', alignItems: 'center', background: c.realise ? 'var(--green-light)' : 'var(--bg)', borderRadius: 10, border: `1px solid ${c.realise ? 'var(--green-light)' : 'var(--bg2)'}` }}>
                        <div className="w-[22px] h-[22px] md:w-6 md:h-6 text-[11px] md:text-[12px]" style={{ borderRadius: '50%', background: c.realise ? 'var(--green)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.realise ? 'white' : 'var(--text3)', fontWeight: 900, flexShrink: 0 }}>
                          {c.realise ? <Check size={13} strokeWidth={3} /> : c.ordre}
                        </div>
                        <span className="text-[12.5px] md:text-[14px]" style={{ flex: 1, fontWeight: c.realise ? 700 : 600, color: c.realise ? 'var(--green)' : 'var(--text2)' }}>{c.titre}</span>
                        <span className="text-[11px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600 }}>{c.volumeHeuresPrevu}h</span>
                        {c.sequenceCibleFin && (
                          <span className="text-[10.5px] md:text-[11px]" style={{ background: 'var(--purple-light)', color: 'var(--purple)', padding: '2px 8px', borderRadius: 20, fontWeight: 800 }}>
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
          <div className="p-[16px] md:p-[24px]" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', marginBottom: 24 }}>
            <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 16 }}>Nouveau programme</div>
            <div className="grid grid-cols-2 sm:[grid-template-columns:2fr_1fr_1fr]" style={{ gap: 14, marginBottom: 14 }}>
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
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Niveau (si non lié à une classe précise)</label>
                <input value={formLevel} onChange={e => setFormLevel(e.target.value)} placeholder="Ex: 3ème, Terminale..." style={{ ...inputStyle, maxWidth: 300 }} />
              </div>
            )}
            <button onClick={handleCreateProgramme} disabled={saving || !formTitre.trim() || !formSubjectId}
              className="w-full sm:w-auto"
              style={{ padding: '10px 24px', borderRadius: 12, background: saving || !formTitre.trim() || !formSubjectId ? 'var(--text3)' : 'var(--sidebar)', color: 'white', border: 'none', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Création...' : 'Créer le programme'}
            </button>
          </div>

          {/* Liste */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Chargement...</div>
          ) : programmes.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--text3)' }}><Inbox size={36} strokeWidth={1.5} /></div>
              <div style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600 }}>Aucun programme défini</div>
              <div style={{ fontSize: 13, color: 'var(--border2)', marginTop: 4 }}>Créez un programme ci-dessus, puis ajoutez ses chapitres.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {programmes.map(p => (
                <div key={p.id} className="rounded-[16px] md:rounded-[14px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none" style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                  {/* Header prog */}
                  <div className="p-[14px] md:px-[20px] md:py-[16px]" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}
                    onClick={() => setExpandedProg(expandedProg === p.id ? null : p.id)}>
                    <span className="text-[15px] md:text-[18px]">{expandedProg === p.id ? '▼' : '▶'}</span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div className="text-[14px] md:text-[15px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{p.titre}</div>
                      <div className="gap-[6px] md:gap-[8px]" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 4 }}>
                        <span className="text-[10.5px] md:text-[12px]" style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 20, fontWeight: 800 }}>{p.subject.name}</span>
                        {p.class && <span className="text-[10.5px] md:text-[12px]" style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 20, fontWeight: 800 }}>{p.class.name}</span>}
                        {p.level && !p.class && <span className="text-[10.5px] md:text-[12px]" style={{ background: 'var(--bg2)', color: 'var(--text3)', padding: '2px 8px', borderRadius: 20, fontWeight: 800 }}>{p.level}</span>}
                        <span className="text-[10.5px] md:text-[12px]" style={{ background: 'var(--bg2)', color: 'var(--text3)', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>{p.chapitres.length} chapitre{p.chapitres.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteProgramme(p.id) }}
                      className="text-[11px] md:text-[12px] px-[10px] py-[5px] md:px-[12px] md:py-[6px]"
                      style={{ borderRadius: 8, background: 'var(--red-light)', color: 'var(--red)', border: 'none', fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
                      Supprimer
                    </button>
                  </div>

                  {expandedProg === p.id && (
                    <div className="p-[12px] md:px-[20px] md:py-[16px]" style={{ borderTop: '1px solid var(--border)' }}>
                      {/* Chapitres */}
                      {p.chapitres.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          {p.chapitres.map(c => (
                            <div key={c.id} className="gap-[8px] md:gap-[12px] px-[10px] py-[7px] md:px-[12px] md:py-[8px]" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg)', borderRadius: 8, marginBottom: 6 }}>
                              <span className="w-5 h-5 md:w-6 md:h-6 text-[10.5px] md:text-[12px]" style={{ borderRadius: '50%', background: 'var(--sidebar)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, flexShrink: 0 }}>{c.ordre}</span>
                              <span className="text-[12.5px] md:text-[14px]" style={{ flex: 1, minWidth: 120, fontWeight: 700, color: 'var(--text)' }}>{c.titre}</span>
                              <span className="text-[10.5px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600 }}>{c.volumeHeuresPrevu}h</span>
                              {c.sequenceCibleFin && <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--purple-light)', color: 'var(--purple)', padding: '2px 8px', borderRadius: 20, fontWeight: 800 }}>Seq {c.sequenceCibleFin}</span>}
                              <button onClick={() => handleDeleteChapitre(c.id)}
                                className="text-[11px] md:text-[12px]"
                                style={{ padding: '3px 8px', borderRadius: 6, background: 'var(--red-light)', color: 'var(--red)', border: 'none', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulaire ajout chapitre */}
                      {addingChapFor === p.id ? (
                        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div className="grid grid-cols-2 sm:[grid-template-columns:2fr_1fr_1fr]" style={{ gap: 10 }}>
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
                          <div className="flex-col sm:flex-row" style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => handleAddChapitre(p.id)}
                              className="w-full sm:w-auto"
                              style={{ padding: '8px 18px', borderRadius: 10, background: 'var(--sidebar)', color: 'white', border: 'none', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
                              Ajouter
                            </button>
                            <button onClick={() => { setAddingChapFor(null); setChapTitre(''); setChapHeures(2); setChapSeq('') }}
                              className="w-full sm:w-auto"
                              style={{ padding: '8px 18px', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text2)', border: 'none', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setAddingChapFor(p.id)}
                          style={{ padding: '8px 16px', borderRadius: 10, background: 'var(--bg2)', color: 'var(--sidebar)', border: '1.5px dashed var(--border2)', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
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
