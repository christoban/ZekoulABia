'use client'
import { useState, useEffect, useRef } from 'react'
import { Calendar, AlertTriangle, Loader2, RotateCcw, X, Inbox, Camera, Save, WifiOff, Check, Pencil, ClipboardList } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { db } from '@/lib/offline/db'
import type { PendingAction } from '@/lib/offline/db'

interface Props {
  user: UserInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface Classe    { id: string; name: string }
interface Subject   { id: string; name: string }
interface Chapitre  { id: string; titre: string; ordre: number; volumeHeuresPrevu: number }
interface Programme { id: string; titre: string; chapitres: Chapitre[] }
interface CahierEntry {
  id: string; date: string; contenuRealise: string | null; contenuLibre?: string | null
  devoirsDonnes: string | null
  class: { id: string; name: string }; subject: { id: string; name: string }
  chapitre: { id: string; titre: string; ordre: number } | null
}
interface ScanResult {
  chapitreDetecte: string | null; contenuRealise: string | null
  devoirsDonnes: string | null; confidence: number; error?: string
}

type Tab = 'saisie' | 'historique'

// ── Styles ────────────────────────────────────────────────────────────────────
const SEL: React.CSSProperties = {
  width: '100%', padding: '7px 11px', borderRadius: 7, border: '1px solid var(--border)',
  fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', color: 'var(--text)',
  background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a89478' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
}
const LBL: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: 3, display: 'block',
}
const AREA: React.CSSProperties = {
  width: '100%', padding: '7px 11px', borderRadius: 7, border: '1px solid var(--border)',
  fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', color: 'var(--text)',
  background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', resize: 'vertical',
}

export default function SectionCahierDeTexte({ user, onToast }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [tab, setTab] = useState<Tab>('saisie')
  const { isOnline, addToQueue, pendingCount } = useSyncQueue()

  // Données
  const [classes,  setClasses]  = useState<Classe[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapitres, setChapitres] = useState<Chapitre[]>([])
  const [hasProgramme, setHasProgramme] = useState<boolean | null>(null)

  // Sélections formulaire
  const [selectedClass,    setSelectedClass]    = useState('')
  const [selectedSubject,  setSelectedSubject]  = useState('')
  const [selectedChapitre, setSelectedChapitre] = useState('')
  const [date,         setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [contenu,      setContenu]      = useState('')  // contenuRealise
  const [contenuLibre, setContenuLibre] = useState('')  // matières sans programme
  const [devoirsOn,    setDevoirsOn]    = useState(false)
  const [devoirs,      setDevoirs]      = useState('')
  const [saving,       setSaving]       = useState(false)

  // Pré-remplissage depuis l'emploi du temps
  const [slotBanner,       setSlotBanner]       = useState<string | null>(null)
  const [prefillSubjectId, setPrefillSubjectId] = useState<string | null>(null)

  // Scan photo
  const cameraRef = useRef<HTMLInputElement>(null)
  const [scanning,   setScanning]   = useState(false)
  const [scanBanner, setScanBanner] = useState<string | null>(null)

  // Historique
  const [entries,        setEntries]        = useState<CahierEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [filterClass,    setFilterClass]    = useState('')
  const [pendingEntries, setPendingEntries] = useState<PendingAction[]>([])

  // ── Init : classes + slot du jour ──────────────────────────────────────────
  useEffect(() => {
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setClasses(d.data ?? []) }).catch(() => {})

    fetchApi('/api/v2/pedagogie/today-slot', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const { classId, className, subjectId, subjectName, startTime, endTime } = d.data
          setSelectedClass(classId)
          setPrefillSubjectId(subjectId)
          setSlotBanner(t('cahier_de_texte.slot_banner').replace('{info}', `${className ?? ''} — ${subjectName ?? ''} (${startTime}–${endTime})`))
        }
      }).catch(() => {})
  }, [])

  // ── Matières selon la classe ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedClass) { setSubjects([]); setSelectedSubject(''); return }
    fetchApi(`/api/v2/teaching-assignments?classId=${selectedClass}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const myId = user?.id
          const mine = (d.data ?? []).filter((a: any) => a.teacherId === myId)
          const dedup = new Map<string, Subject>()
          for (const a of mine) dedup.set(a.subject.id, a.subject)
          setSubjects([...dedup.values()])
        }
      }).catch(() => {})
    setSelectedSubject(''); setChapitres([]); setSelectedChapitre(''); setHasProgramme(null)
  }, [selectedClass, user?.id])

  // ── Appliquer pré-remplissage matière après chargement ─────────────────────
  useEffect(() => {
    if (!prefillSubjectId || subjects.length === 0) return
    if (subjects.find(s => s.id === prefillSubjectId)) {
      setSelectedSubject(prefillSubjectId)
      setPrefillSubjectId(null)
    }
  }, [subjects, prefillSubjectId])

  // ── Vérification programme + chapitres selon matière ──────────────────────
  useEffect(() => {
    if (!selectedSubject) { setChapitres([]); setSelectedChapitre(''); setHasProgramme(null); return }
    const url = `/api/v2/pedagogie/subjects/${selectedSubject}/has-programme${selectedClass ? `?classId=${selectedClass}` : ''}`
    fetchApi(url, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setHasProgramme(d.data.hasProgramme)
          setChapitres(d.data.chapitres ?? [])
        }
      })
      .catch(() => setHasProgramme(true)) // fallback safe : afficher le dropdown
    setSelectedChapitre('')
  }, [selectedSubject, selectedClass])

  // ── Réinitialiser contenu libre quand matière change ──────────────────────
  useEffect(() => { setContenuLibre('') }, [selectedSubject])

  // ── Enregistrement (online ou offline) ────────────────────────────────────
  const handleSave = async () => {
    if (!selectedClass || !selectedSubject) {
      onToast(t('cahier_de_texte.toast_class_subject_required'), 'error'); return
    }
    const realise = hasProgramme === false ? undefined : contenu.trim() || undefined
    const libre   = hasProgramme === false ? contenuLibre.trim() || undefined : undefined
    if (!realise && !libre) {
      onToast(t('cahier_de_texte.toast_content_required'), 'error'); return
    }

    const payload = {
      classId: selectedClass, subjectId: selectedSubject,
      chapitreId: selectedChapitre || undefined,
      date, contenuRealise: realise, contenuLibre: libre,
      devoirsDonnes: (devoirsOn && devoirs.trim()) ? devoirs.trim() : undefined,
    }

    if (!isOnline) {
      await addToQueue({
        type: 'CAHIER_DE_TEXTE_CREATE',
        endpoint: '/api/v2/pedagogie/cahier-de-texte',
        method: 'POST',
        payload: {
          ...payload,
          _className:   classes.find(c => c.id === selectedClass)?.name,
          _subjectName: subjects.find(s => s.id === selectedSubject)?.name,
        },
      })
      onToast(t('cahier_de_texte.toast_saved_offline'), 'info')
      setContenu(''); setContenuLibre(''); setDevoirs(''); setDevoirsOn(false)
      setSelectedChapitre(''); setScanBanner(null)
      return
    }

    setSaving(true)
    try {
      const r = await fetchApi('/api/v2/pedagogie/cahier-de-texte', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (data.success) {
        onToast(t('cahier_de_texte.toast_saved'), 'success')
        setContenu(''); setContenuLibre(''); setDevoirs(''); setDevoirsOn(false)
        setSelectedChapitre(''); setScanBanner(null)
      } else {
        onToast(data.message ?? t('cahier_de_texte.toast_save_error'), 'error')
      }
    } catch { onToast(t('cahier_de_texte.toast_network_error'), 'error') }
    finally { setSaving(false) }
  }

  // ── Scan photo ─────────────────────────────────────────────────────────────
  const handleScanClick = () => {
    if (!isOnline) {
      onToast(t('cahier_de_texte.scan_toast_offline'), 'warning')
      return
    }
    cameraRef.current?.click()
  }

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true); setScanBanner(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const r = await fetchApi('/api/v2/pedagogie/scan', {
        method: 'POST', credentials: 'include', body: formData,
      })
      const d = await r.json()
      const result: ScanResult = d.data ?? { chapitreDetecte: null, contenuRealise: null, devoirsDonnes: null, confidence: 0 }

      if (result.error || result.confidence < 0.6) {
        onToast(t('cahier_de_texte.scan_toast_unreadable'), 'warning')
      } else {
        const texte = result.contenuRealise ?? ''
        if (hasProgramme === false) { if (texte) setContenuLibre(texte) }
        else { if (texte) setContenu(texte) }
        if (result.devoirsDonnes) { setDevoirsOn(true); setDevoirs(result.devoirsDonnes) }
        if (result.chapitreDetecte && chapitres.length > 0) {
          const lc = result.chapitreDetecte.toLowerCase()
          const match = chapitres.find(c =>
            c.titre.toLowerCase().includes(lc) || lc.includes(c.titre.toLowerCase())
          )
          if (match) setSelectedChapitre(match.id)
        }
        setScanBanner(t('cahier_de_texte.scan_banner_ok'))
      }
    } catch { onToast(t('cahier_de_texte.scan_toast_error'), 'error') }
    finally { setScanning(false); if (cameraRef.current) cameraRef.current.value = '' }
  }

  // ── Historique ─────────────────────────────────────────────────────────────
  const loadEntries = () => {
    setLoadingEntries(true)
    const params = new URLSearchParams()
    if (filterClass) params.set('classId', filterClass)
    fetchApi(`/api/v2/pedagogie/cahier-de-texte?${params}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setEntries(d.data ?? []) })
      .catch(() => {}).finally(() => setLoadingEntries(false))
  }

  // Entrées en attente de synchronisation (Dexie)
  useEffect(() => {
    if (tab !== 'historique') return
    db.pendingActions
      .where('type').equals('CAHIER_DE_TEXTE_CREATE')
      .toArray()
      .then(all => setPendingEntries(all.filter(a => a.status === 'PENDING' || a.status === 'FAILED')))
      .catch(() => {})
  }, [tab, pendingCount]) // pendingCount change après chaque sync → recharge

  useEffect(() => { if (tab === 'historique') loadEntries() }, [tab]) // eslint-disable-line

  // Rafraîchissement temps réel quand l'assistant IA ajoute une entrée au cahier de texte.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'cahierDeTexte' && tab === 'historique') loadEntries()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [tab])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dérivé UX ──────────────────────────────────────────────────────────────
  const isFormValid = !!selectedClass && !!selectedSubject &&
    (hasProgramme === false ? !!contenuLibre.trim() : !!contenu.trim())

  const tabBtn = (tabId: Tab, label: string, Icon: typeof Calendar) => (
    <button key={tabId} onClick={() => setTab(tabId)} style={{
      padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700,
      fontFamily: 'inherit', cursor: 'pointer', border: 'none',
      background: tab === tabId ? 'var(--sidebar)' : 'var(--bg2)',
      color: tab === tabId ? 'white' : 'var(--text2)', transition: 'all 0.15s',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}><Icon size={13} strokeWidth={2} />{label}</button>
  )

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--bg)' }}>

      {/* Indicateur hors-ligne */}
      {!isOnline && (
        <div style={{
          background: 'var(--orange-light)', border: '1px solid var(--orange)', borderRadius: 8,
          padding: '7px 12px', marginBottom: 12, fontSize: 12, color: 'var(--orange)', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <WifiOff size={15} strokeWidth={2} />
          {t('cahier_de_texte.offline_banner')}
        </div>
      )}

      {/* Titre */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
          {t('cahier_de_texte.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
          {t('cahier_de_texte.subtitle')}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {tabBtn('saisie', t('cahier_de_texte.tab_new_entry'), Pencil)}
        {tabBtn('historique', t('cahier_de_texte.tab_history'), ClipboardList)}
      </div>

      {/* ── Onglet Saisie ── */}
      {tab === 'saisie' && (
        <div style={{ maxWidth: 480, width: '100%' }}>

          {/* Bannière slot du jour */}
          {slotBanner && (
            <div style={{
              background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 8,
              padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--green)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ display: 'flex', alignItems: 'center' }}><Calendar size={14} strokeWidth={2} /></span>
              <span style={{ flex: 1 }}>{slotBanner}</span>
              <button onClick={() => setSlotBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Bannière qualité scan */}
          {scanBanner && (
            <div style={{
              background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8,
              padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--amber)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <span style={{ display: 'flex', alignItems: 'center' }}><AlertTriangle size={14} strokeWidth={2} /></span>
              <span style={{ flex: 1 }}>{scanBanner}</span>
              <button onClick={() => setScanBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* ── CAS 1 : Formulaire principal — toujours visible en premier ── */}
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Classe */}
            <div>
              <label style={LBL}>{t('cahier_de_texte.class_label')}</label>
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={SEL}>
                <option value="">{t('cahier_de_texte.class_placeholder')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Matière */}
            <div>
              <label style={LBL}>{t('cahier_de_texte.subject_label')}</label>
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                style={{ ...SEL, opacity: !selectedClass ? 0.5 : 1 }} disabled={!selectedClass}>
                <option value="">{t('cahier_de_texte.subject_placeholder')}</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* ── CAS 2 : Chapitre si programme, texte libre sinon ── */}
            {selectedSubject && hasProgramme !== null && (
              hasProgramme ? (
                <div>
                  <label style={LBL}>{t('cahier_de_texte.chapter_label')}</label>
                  <select value={selectedChapitre} onChange={e => setSelectedChapitre(e.target.value)} style={SEL}>
                    <option value="">{t('cahier_de_texte.chapter_placeholder')}</option>
                    {chapitres.map(c => (
                      <option key={c.id} value={c.id}>Ch.{c.ordre} — {c.titre} ({c.volumeHeuresPrevu}h)</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={LBL}>{t('cahier_de_texte.free_text_label')}</label>
                  <textarea
                    value={contenuLibre} onChange={e => setContenuLibre(e.target.value)}
                    placeholder={t('cahier_de_texte.free_text_placeholder')}
                    rows={3} style={AREA}
                    autoFocus
                  />
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, fontWeight: 600 }}>
                    {t('cahier_de_texte.free_text_hint')}
                  </div>
                </div>
              )
            )}

            {/* Contenu réalisé (affiché uniquement si la matière a un programme ou si pas encore déterminé) */}
            {hasProgramme !== false && (
              <div>
                <label style={LBL}>{t('cahier_de_texte.content_label')}{hasProgramme === null ? '' : '*'}</label>
                <textarea
                  value={contenu} onChange={e => setContenu(e.target.value)}
                  placeholder={t('cahier_de_texte.content_placeholder')}
                  rows={3} style={{ ...AREA, minHeight: 70 }}
                />
              </div>
            )}

            {/* Devoirs — toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: devoirsOn ? 8 : 0 }}>
                <label style={{ ...LBL, marginBottom: 0, flex: 1 }}>{t('cahier_de_texte.homework_label')}</label>
                <button
                  onClick={() => { setDevoirsOn(v => !v); if (devoirsOn) setDevoirs('') }}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: devoirsOn ? 'var(--sidebar)' : 'var(--border)', transition: 'background 0.2s',
                    position: 'relative', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: devoirsOn ? 22 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: 'var(--surface)',
                    transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
              {devoirsOn && (
                <textarea
                  value={devoirs} onChange={e => setDevoirs(e.target.value)}
                  placeholder={t('cahier_de_texte.homework_placeholder')}
                  rows={2} style={AREA} autoFocus
                />
              )}
            </div>

            {/* Date */}
            <div>
              <label style={LBL}>{t('cahier_de_texte.date_label')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...SEL, paddingTop: 6, paddingBottom: 6 }} />
            </div>
          </div>

          {/* ── CAS 1 : Scan optionnel — secondaire, sous le formulaire ── */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={handleScanClick}
              disabled={scanning}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px dashed var(--border2)', background: 'transparent',
                color: 'var(--text3)', fontSize: 12, fontWeight: 700,
                fontFamily: 'inherit', cursor: scanning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {scanning
                ? <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> {t('cahier_de_texte.scan_scanning')}</>
                : <><Camera size={14} strokeWidth={2} /> {t('cahier_de_texte.scan_idle')}</>
              }
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }} onChange={handleScan} />
          </div>

          {/* ── Bouton Enregistrer — sticky ── */}
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 8, paddingBottom: 16 }}>
            <button
              onClick={handleSave}
              disabled={saving || !isFormValid}
              style={{
                width: '100%', padding: '10px 16px', borderRadius: 8,
                background: (saving || !isFormValid) ? 'var(--border)' : 'var(--sidebar)',
                color: 'white', border: 'none', fontSize: 13, fontWeight: 700,
                fontFamily: 'inherit', cursor: (saving || !isFormValid) ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {saving ? <Save size={15} strokeWidth={2} /> : !isOnline ? <WifiOff size={15} strokeWidth={2} /> : <Check size={15} strokeWidth={2} />}
              {saving ? t('cahier_de_texte.save_saving') : !isOnline ? t('cahier_de_texte.save_offline') : t('cahier_de_texte.save_online')}
            </button>
          </div>
        </div>
      )}

      {/* ── Onglet Historique ── */}
      {tab === 'historique' && (
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={LBL}>{t('cahier_de_texte.history_filter_label')}</label>
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={SEL}>
                <option value="">{t('cahier_de_texte.history_filter_all')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={loadEntries} style={{
              padding: '7px 12px', borderRadius: 7, background: 'var(--sidebar)', color: 'white',
              border: 'none', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}><RotateCcw size={14} strokeWidth={2} /></button>
          </div>

          {/* ── CAS 3 : Entrées hors-ligne en attente ── */}
          {pendingEntries.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                {t('cahier_de_texte.history_pending_title').replace('{count}', String(pendingEntries.length))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingEntries.map(entry => {
                  const p = entry.payload as any
                  const isFailed = entry.status === 'FAILED'
                  return (
                    <div key={entry.id} style={{
                      background: isFailed ? 'var(--red-light)' : 'var(--amber-light)',
                      border: `1px solid ${isFailed ? 'var(--red-light)' : 'var(--amber)'}`,
                      borderRadius: 10, padding: '10px 12px', position: 'relative',
                    }}>
                      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex' }}>
                        {isFailed ? <X size={14} strokeWidth={2} /> : <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 6px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                          {p._className ?? p.classId}
                        </span>
                        <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                          {p._subjectName ?? p.subjectId}
                        </span>
                        <span style={{
                          background: isFailed ? 'var(--red-light)' : 'var(--amber-light)', color: isFailed ? 'var(--red)' : 'var(--amber)',
                          padding: '1px 6px', borderRadius: 12, fontSize: 10.5, fontWeight: 700,
                        }}>
                          {isFailed ? t('cahier_de_texte.history_pending_failed') : t('cahier_de_texte.history_pending_pending')}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600 }}>
                        {p.contenuRealise ?? p.contenuLibre ?? '—'}
                      </div>
                      {p.devoirsDonnes && (
                        <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4, fontStyle: 'italic' }}>
                          {t('cahier_de_texte.history_pending_homework').replace('{text}', p.devoirsDonnes ?? '')}
                        </div>
                      )}
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 4 }}>
                        {p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Entrées synchronisées (API) */}
          {loadingEntries ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('cahier_de_texte.history_loading')}</div>
          ) : entries.length === 0 && pendingEntries.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('cahier_de_texte.history_empty')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.map(e => (
                <div key={e.id} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center', flexShrink: 0, minWidth: 38 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>
                        {new Date(e.date).toLocaleDateString('fr-FR', { month: 'short' })}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                        {new Date(e.date).getDate()}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 7px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                          {e.class.name}
                        </span>
                        <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 7px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                          {e.subject.name}
                        </span>
                        {e.chapitre && (
                          <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 7px', borderRadius: 12, fontSize: 10.5, fontWeight: 700 }}>
                            Ch.{e.chapitre.ordre} — {e.chapitre.titre}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, marginBottom: (e.devoirsDonnes || e.contenuLibre) ? 6 : 0 }}>
                        {e.contenuRealise ?? e.contenuLibre ?? '—'}
                      </div>
                      {e.contenuLibre && e.contenuRealise && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>{e.contenuLibre}</div>
                      )}
                      {e.devoirsDonnes && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', padding: '6px 10px', background: 'var(--amber-light)', borderRadius: 8, borderLeft: '3px solid var(--amber)' }}>
                          {t('cahier_de_texte.history_pending_homework').replace('{text}', e.devoirsDonnes)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
