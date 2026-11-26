import { useState, useEffect, useRef } from 'react'
import type { ChangeEvent } from 'react'
import type { UserInfo } from '../../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { db, putCachedData, getCachedData } from '@/lib/offline/db'
import type { PendingAction } from '@/lib/offline/db'
import type { CahierEntry, CahierTab, Chapitre, Classe, ScanResult, Subject, TranslateFn } from './types'

interface UseCahierDataParams {
  user: UserInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  t: TranslateFn
}

export function useCahierData({ user, onToast, t }: UseCahierDataParams) {
  const [tab, setTab] = useState<CahierTab>('saisie')
  const { isOnline, addToQueue, pendingCount } = useSyncQueue()

  const [classes, setClasses] = useState<Classe[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapitres, setChapitres] = useState<Chapitre[]>([])
  const [hasProgramme, setHasProgramme] = useState<boolean | null>(null)

  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedChapitre, setSelectedChapitre] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [contenu, setContenu] = useState('')
  const [contenuLibre, setContenuLibre] = useState('')
  const [devoirsOn, setDevoirsOn] = useState(false)
  const [devoirs, setDevoirs] = useState('')
  const [saving, setSaving] = useState(false)

  const [slotBanner, setSlotBanner] = useState<string | null>(null)
  const [prefillSubjectId, setPrefillSubjectId] = useState<string | null>(null)

  const cameraRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [scanBanner, setScanBanner] = useState<string | null>(null)

  const [entries, setEntries] = useState<CahierEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [filterClass, setFilterClass] = useState('')
  const [pendingEntries, setPendingEntries] = useState<PendingAction[]>([])
  const [materialisationEnabled, setMaterialisationEnabled] = useState(false)

  // ── Statut feature flag / école pilote pour l'onglet Programme ────────────
  useEffect(() => {
    const statusCacheKey = `pedagogie:materialisation:status:${user?.id ?? 'default'}`
    getCachedData<{ enabled: boolean }>(statusCacheKey)
      .then((c) => {
        if (c?.data && typeof c.data.enabled === 'boolean') {
          setMaterialisationEnabled(c.data.enabled)
        }
      })
      .catch(() => {})

    if (!isOnline) return
    fetchApi('/api/v2/pedagogie/materialisation/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const enabled = d.data?.enabled === true
          setMaterialisationEnabled(enabled)
          putCachedData(statusCacheKey, { enabled }).catch(() => {})
          if (!enabled) {
            setTab((prev) => (prev === 'programme' ? 'saisie' : prev))
          }
        }
      })
      .catch(() => {})
  }, [isOnline, user?.id])

  // ── Init : classes + slot du jour + pré-sélection rapide ─────────────────
  useEffect(() => {
    let hasQuickPrefill = false
    try {
      const prefillClass = sessionStorage.getItem('zekoulabia_prefill_class')
      const prefillSubject = sessionStorage.getItem('zekoulabia_prefill_subject')
      if (prefillClass) {
        setSelectedClass(prefillClass)
        sessionStorage.removeItem('zekoulabia_prefill_class')
        hasQuickPrefill = true
      }
      if (prefillSubject) {
        setPrefillSubjectId(prefillSubject)
        sessionStorage.removeItem('zekoulabia_prefill_subject')
      }
    } catch { /* ignore */ }

    if (navigator.onLine) {
      fetchApi('/api/v2/classes', { credentials: 'include' })
        .then(r => r.json()).then(async d => {
          if (d.success && Array.isArray(d.data)) {
            setClasses(d.data)
            await putCachedData('teacher:classes', d.data).catch(() => {})
          }
        }).catch(() => {})
    } else {
      getCachedData<Classe[]>('teacher:classes').then(cached => {
        if (cached?.data) setClasses(cached.data)
      }).catch(() => {})
    }

    if (!hasQuickPrefill) {
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
    }
  }, [t])

  // ── Matières selon la classe ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedClass) { setSubjects([]); setSelectedSubject(''); return }
    const assignCacheKey = `teacher:teaching-assignments:${selectedClass}`
    if (navigator.onLine) {
      fetchApi(`/api/v2/teaching-assignments?classId=${selectedClass}`, { credentials: 'include' })
        .then(r => r.json())
        .then(async d => {
          if (d.success && Array.isArray(d.data)) {
            await putCachedData(assignCacheKey, d.data).catch(() => {})
            const myId = user?.id
            interface AssignItem { teacherId?: string; subject: Subject }
            const mine = ((d.data ?? []) as AssignItem[]).filter((a) => a.teacherId === myId)
            const dedup = new Map<string, Subject>()
            for (const a of mine) dedup.set(a.subject.id, a.subject)
            setSubjects([...dedup.values()])
          }
        }).catch(() => {})
    } else {
      interface AssignItem { teacherId?: string; subject: Subject }
      getCachedData<AssignItem[]>(assignCacheKey).then(cached => {
        if (cached?.data) {
          const myId = user?.id
          const mine = cached.data.filter((a) => a.teacherId === myId)
          const dedup = new Map<string, Subject>()
          for (const a of mine) dedup.set(a.subject.id, a.subject)
          setSubjects([...dedup.values()])
        } else {
          getCachedData<Subject[]>('teacher:subjects').then(sCached => {
            if (sCached?.data) setSubjects(sCached.data)
          }).catch(() => {})
        }
      }).catch(() => {})
    }
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
    const progKey = `teacher:has-programme:${selectedSubject}:${selectedClass || 'all'}`
    const url = `/api/v2/pedagogie/subjects/${selectedSubject}/has-programme${selectedClass ? `?classId=${selectedClass}` : ''}`
    if (navigator.onLine) {
      fetchApi(url, { credentials: 'include' })
        .then(r => r.json())
        .then(async d => {
          if (d.success) {
            setHasProgramme(d.data.hasProgramme)
            setChapitres(d.data.chapitres ?? [])
            await putCachedData(progKey, d.data).catch(() => {})
          }
        })
        .catch(() => setHasProgramme(true))
    } else {
      getCachedData<{ hasProgramme: boolean; chapitres?: Chapitre[] }>(progKey).then(cached => {
        if (cached?.data) {
          setHasProgramme(cached.data.hasProgramme)
          setChapitres(cached.data.chapitres ?? [])
        } else {
          setHasProgramme(true)
        }
      }).catch(() => setHasProgramme(true))
    }
    setSelectedChapitre('')
  }, [selectedSubject, selectedClass])

  useEffect(() => { setContenuLibre('') }, [selectedSubject])

  const resetFormFields = () => {
    setContenu('')
    setContenuLibre('')
    setDevoirs('')
    setDevoirsOn(false)
    setSelectedChapitre('')
    setScanBanner(null)
  }

  const handleSave = async () => {
    if (!selectedClass || !selectedSubject) {
      onToast(t('cahier_de_texte.toast_class_subject_required'), 'error'); return
    }
    const realise = hasProgramme === false ? undefined : contenu.trim() || undefined
    const libre = hasProgramme === false ? contenuLibre.trim() || undefined : undefined
    if (!realise && !libre) {
      onToast(t('cahier_de_texte.toast_content_required'), 'error'); return
    }

    const payload = {
      classId: selectedClass, subjectId: selectedSubject,
      chapitreId: selectedChapitre || undefined,
      date, contenuRealise: realise, contenuLibre: libre,
      devoirsDonnes: (devoirsOn && devoirs.trim()) ? devoirs.trim() : undefined,
    }

    const queueOffline = async () => {
      await addToQueue({
        type: 'CAHIER_DE_TEXTE_CREATE',
        endpoint: '/api/v2/pedagogie/cahier-de-texte',
        method: 'POST',
        payload: {
          ...payload,
          _className: classes.find(c => c.id === selectedClass)?.name,
          _subjectName: subjects.find(s => s.id === selectedSubject)?.name,
        },
      })
    }

    if (!isOnline) {
      await queueOffline()
      onToast(t('cahier_de_texte.toast_saved_offline'), 'info')
      resetFormFields()
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
        resetFormFields()
      } else {
        onToast(data.message ?? t('cahier_de_texte.toast_save_error'), 'error')
      }
    } catch {
      try {
        await queueOffline()
        onToast('Connexion perdue : entrée enregistrée hors-ligne (en attente de synchronisation)', 'info')
        resetFormFields()
      } catch {
        onToast(t('cahier_de_texte.toast_network_error'), 'error')
      }
    } finally { setSaving(false) }
  }

  const handleScanClick = () => {
    if (!isOnline) {
      onToast(t('cahier_de_texte.scan_toast_offline'), 'warning')
      return
    }
    cameraRef.current?.click()
  }

  const handleScan = async (e: ChangeEvent<HTMLInputElement>) => {
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

  const loadEntries = async () => {
    setLoadingEntries(true)
    const cacheKey = `teacher:cahierDeTexte:${filterClass || 'all'}`
    try {
      const cached = await getCachedData<CahierEntry[]>(cacheKey)
      if (cached?.data) {
        setEntries(cached.data)
        setLoadingEntries(false)
      }
    } catch { /* ignore */ }

    if (navigator.onLine) {
      const params = new URLSearchParams()
      if (filterClass) params.set('classId', filterClass)
      fetchApi(`/api/v2/pedagogie/cahier-de-texte?${params}`, { credentials: 'include' })
        .then(r => r.json())
        .then(async d => {
          if (d.success) {
            const list = d.data ?? []
            setEntries(list)
            await putCachedData(cacheKey, list).catch(() => {})
          }
        })
        .catch(() => {})
        .finally(() => setLoadingEntries(false))
    } else {
      setLoadingEntries(false)
    }
  }

  useEffect(() => {
    if (tab !== 'historique') return
    db.pendingActions
      .where('type').equals('CAHIER_DE_TEXTE_CREATE')
      .toArray()
      .then(all => setPendingEntries(all.filter(a => a.status === 'PENDING' || a.status === 'FAILED')))
      .catch(() => {})
  }, [tab, pendingCount])

  useEffect(() => { if (tab === 'historique') loadEntries() }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'cahierDeTexte' && tab === 'historique') loadEntries()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const isFormValid = !!selectedClass && !!selectedSubject &&
    (hasProgramme === false ? !!contenuLibre.trim() : !!contenu.trim())

  return {
    tab, setTab, isOnline, materialisationEnabled,
    classes, subjects, chapitres, hasProgramme,
    selectedClass, setSelectedClass,
    selectedSubject, setSelectedSubject,
    selectedChapitre, setSelectedChapitre,
    date, setDate,
    contenu, setContenu,
    contenuLibre, setContenuLibre,
    devoirsOn, setDevoirsOn,
    devoirs, setDevoirs,
    saving, slotBanner, setSlotBanner,
    cameraRef, scanning, scanBanner, setScanBanner,
    entries, loadingEntries, filterClass, setFilterClass,
    pendingEntries, isFormValid,
    handleSave, handleScanClick, handleScan, loadEntries,
  }
}
