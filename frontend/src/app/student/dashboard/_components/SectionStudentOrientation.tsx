'use client'

import type { UserInfo } from '../_types'
import { useStudentOrientation } from './orientation/useStudentOrientation'
import IneligibleOrientationView from './orientation/IneligibleOrientationView'
import Lv2OrientationView from './orientation/Lv2OrientationView'
import CheckpointOrientationView from './orientation/CheckpointOrientationView'

interface Props {
  user: UserInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function SectionStudentOrientation({ user, onToast }: Props) {
  const {
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
  } = useStudentOrientation({ user, onToast })

  // ── Cas 1 : Classe non éligible à l'orientation (ex: 6e, 2nde A, 1ère, Terminale) ──
  if (!eligibility.isEligible) {
    const currentClass = user?.studentProfile?.class?.name || 'actuelle'
    return <IneligibleOrientationView currentClass={currentClass} />
  }

  // ── Cas 2 : Palier Choix LV2 (5e / 4e selon école) ──
  if (eligibility.checkpointKey === 'LV2') {
    return (
      <Lv2OrientationView
        titleFr={eligibility.titleFr}
        subtitleFr={eligibility.subtitleFr}
        lv2Data={lv2Data}
        lv2Loading={lv2Loading}
        selectedLv2={selectedLv2}
        onSelectLv2={setSelectedLv2}
        submittingLv2={submittingLv2}
        onSaveLv2={handleSaveLv2}
      />
    )
  }

  // ── Cas 3 : Palier Fin de 3ème OU Fin de 2nde C ──
  return (
    <CheckpointOrientationView
      titleFr={eligibility.titleFr}
      subtitleFr={eligibility.subtitleFr}
      activeCheckpoint={activeCheckpoint}
      reco={reco}
      loading={loading}
      selectedTrack={selectedTrack}
      onSelectTrack={setSelectedTrack}
      submittingChoice={submittingChoice}
      onConfirmTrack={handleChoisirPiste}
      desiredTrack={desiredTrack}
      onChangeDesiredTrack={setDesiredTrack}
      careerInterest={careerInterest}
      onChangeCareerInterest={setCareerInterest}
      savingAspiration={savingAspiration}
      aspirationSaved={aspirationSaved}
      onSaveAspiration={handleSaveAspiration}
    />
  )
}
