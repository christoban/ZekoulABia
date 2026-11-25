'use client'

import { useState, useCallback, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import { resolveOrientationEligibility } from '@/lib/orientationEligibility'
import type { UserInfo } from '../../_types'
import type { ActiveCheckpointKey, Lv2WindowData, Recommandation } from './types'

interface UseStudentOrientationParams {
  user: UserInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export function useStudentOrientation({ user, onToast }: UseStudentOrientationParams) {
  const t = useT('student')

  const eligibility = resolveOrientationEligibility(
    user?.studentProfile?.class?.name,
    user?.studentProfile?.class?.level,
    user?.studentProfile?.class?.serie
  )

  const activeCheckpoint: ActiveCheckpointKey | null =
    eligibility.checkpointKey === 'FIN_TROISIEME' || eligibility.checkpointKey === 'FIN_SECONDE_C'
      ? eligibility.checkpointKey
      : null

  // ── Cas Palier 3e ou 2nde C ──
  const [selectedTrack, setSelectedTrack] = useState('')
  const [submittingChoice, setSubmittingChoice] = useState(false)
  const [desiredTrack, setDesiredTrack] = useState('')
  const [careerInterest, setCareerInterest] = useState('')
  const [savingAspiration, setSavingAspiration] = useState(false)
  const [aspirationSaved, setAspirationSaved] = useState(false)

  // ── Cas Palier LV2 ──
  const [lv2Data, setLv2Data] = useState<Lv2WindowData | null>(null)
  const [lv2Loading, setLv2Loading] = useState(false)
  const [selectedLv2, setSelectedLv2] = useState('')
  const [submittingLv2, setSubmittingLv2] = useState(false)

  const cacheKey = user && activeCheckpoint ? `student:orientation:${user.id}:${activeCheckpoint}` : ''

  const fetchFn = useCallback(async (): Promise<Recommandation | null> => {
    if (!activeCheckpoint) return null
    try {
      const res = await fetchApi(`/api/v2/orientation/ma-recommandation/${activeCheckpoint}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data) {
        return json.data
      }
    } catch {
      // aucune recommandation active
    }
    return null
  }, [activeCheckpoint])

  const { data: reco, loading, refetch } = useCachedFetch<Recommandation | null>(cacheKey, fetchFn)

  // Chargement spécifique si éligible LV2 (avec résilience Dexie hors-ligne)
  useEffect(() => {
    if (eligibility.checkpointKey === 'LV2') {
      setLv2Loading(true)
      const uid = user?.id

      if (uid) {
        getCachedData<Lv2WindowData>(`student:lv2-choice:${uid}`)
          .then((cached) => {
            if (cached?.data) {
              setLv2Data(cached.data)
              if (cached.data.currentChoice?.subjectId) {
                setSelectedLv2(cached.data.currentChoice.subjectId)
              }
            }
          })
          .catch(() => {})
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setLv2Loading(false)
        return
      }

      fetchApi('/api/v2/students/me/lv2-choice-window', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data) {
            setLv2Data(d.data)
            if (uid) putCachedData(`student:lv2-choice:${uid}`, d.data).catch(() => {})
            if (d.data.currentChoice?.subjectId) {
              setSelectedLv2(d.data.currentChoice.subjectId)
            }
          }
        })
        .catch(() => {})
        .finally(() => setLv2Loading(false))
    }
  }, [eligibility.checkpointKey, user?.id])

  const handleChoisirPiste = async () => {
    if (!reco || !selectedTrack) return
    setSubmittingChoice(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/recommandations/${reco.id}/choisir-piste`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ track: selectedTrack }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('orientationCheckpoint.toast_choice_saved') || 'Votre choix a été enregistré avec succès !', 'success')
        refetch()
      } else {
        onToast(json.message || 'Erreur lors de l\'enregistrement', 'error')
      }
    } catch {
      onToast('Erreur de connexion', 'error')
    } finally {
      setSubmittingChoice(false)
    }
  }

  const handleSaveAspiration = async () => {
    setSavingAspiration(true)
    try {
      const res = await fetchApi('/api/v2/orientation/aspirations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          checkpointType: activeCheckpoint,
          desiredTrack: desiredTrack || undefined,
          careerInterest: careerInterest || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        onToast(t('orientationCheckpoint.toast_aspiration_saved') || 'Vos aspirations ont été transmises au conseiller !', 'success')
        setAspirationSaved(true)
      } else {
        onToast(json.message || 'Erreur lors de l\'enregistrement', 'error')
      }
    } catch {
      onToast('Erreur de communication', 'error')
    } finally {
      setSavingAspiration(false)
    }
  }

  const handleSaveLv2 = async () => {
    if (!selectedLv2) return
    setSubmittingLv2(true)
    try {
      const res = await fetchApi('/api/v2/students/me/lv2-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chosenSubjectId: selectedLv2 }),
      })
      const json = await res.json()
      if (json.success) {
        onToast('Votre choix de Langue Vivante 2 a été enregistré avec succès !', 'success')
        const refreshed = await fetchApi('/api/v2/students/me/lv2-choice-window', { credentials: 'include' }).then((r) => r.json())
        if (refreshed.success && refreshed.data) setLv2Data(refreshed.data)
      } else {
        onToast(json.message || 'Erreur lors de l\'enregistrement', 'error')
      }
    } catch {
      onToast('Erreur de communication', 'error')
    } finally {
      setSubmittingLv2(false)
    }
  }

  return {
    eligibility,
    activeCheckpoint,
    reco,
    loading,
    selectedTrack,
    setSelectedTrack,
    submittingChoice,
    desiredTrack,
    setDesiredTrack,
    careerInterest,
    setCareerInterest,
    savingAspiration,
    aspirationSaved,
    lv2Data,
    lv2Loading,
    selectedLv2,
    setSelectedLv2,
    submittingLv2,
    handleChoisirPiste,
    handleSaveAspiration,
    handleSaveLv2,
  }
}
