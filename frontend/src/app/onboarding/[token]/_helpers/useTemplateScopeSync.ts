'use client'

import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { OfferFlag } from '@/lib/onboarding/phase1Profile'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import {
  showPremierCycle,
  showDeuxiemeCycle,
  showTechniqueBlocks,
  showPrimaire,
  isPebsFrEligible,
  isPebsEnEligible,
} from '@/lib/onboarding/templateGates'
import type { EnGradingSystem, EnStreamStartLevel, FormData, TechnicalSubtype } from './types'

interface Params {
  template: TemplateCatalogEntry | null
  offers: OfferFlag[]
  setForm: Dispatch<SetStateAction<FormData>>
  setMaternelleSections: Dispatch<SetStateAction<string[]>>
  setNurseryLevels: Dispatch<SetStateAction<string[]>>
  enStreamStartLevel: EnStreamStartLevel
  setEnStreamStartLevel: Dispatch<SetStateAction<EnStreamStartLevel>>
  bilingualEnLevels: string[]
  setBilingualEnLevels: Dispatch<SetStateAction<string[]>>
  bilingualEnFilieres: string[]
  setBilingualEnFilieres: Dispatch<SetStateAction<string[]>>
  enGradingSystem: EnGradingSystem
  setEnGradingSystem: Dispatch<SetStateAction<EnGradingSystem>>
  hasPEBSFrancophone: boolean
  setHasPEBSFrancophone: Dispatch<SetStateAction<boolean>>
  hasPEBSAnglophone: boolean
  setHasPEBSAnglophone: Dispatch<SetStateAction<boolean>>
  sarMetiers: string[]
  setSarMetiers: Dispatch<SetStateAction<string[]>>
  cfmFilieres: string[]
  setCfmFilieres: Dispatch<SetStateAction<string[]>>
  sousTypeTechnique: TechnicalSubtype
  setSousTypeTechnique: Dispatch<SetStateAction<TechnicalSubtype>>
  cetifMode: boolean
  setCetifMode: Dispatch<SetStateAction<boolean>>
  niveaux2eCycle: string[]
}

export function useTemplateScopeSync({
  template,
  offers,
  setForm,
  setMaternelleSections,
  setNurseryLevels,
  enStreamStartLevel,
  setEnStreamStartLevel,
  bilingualEnLevels,
  setBilingualEnLevels,
  bilingualEnFilieres,
  setBilingualEnFilieres,
  enGradingSystem,
  setEnGradingSystem,
  hasPEBSFrancophone,
  setHasPEBSFrancophone,
  hasPEBSAnglophone,
  setHasPEBSAnglophone,
  sarMetiers,
  setSarMetiers,
  cfmFilieres,
  setCfmFilieres,
  sousTypeTechnique,
  setSousTypeTechnique,
  cetifMode,
  setCetifMode,
  niveaux2eCycle,
}: Params) {
  useEffect(() => {
    if (template?.code !== 'MATERNELLE_FR' && !template?.isComplexe) setMaternelleSections([])
    if (template?.code !== 'NURSERY_EN') setNurseryLevels([])
  }, [template?.code, template?.isComplexe, setMaternelleSections, setNurseryLevels])

  useEffect(() => {
    if (!template) return
    if (!showPremierCycle(template)) {
      setForm((f) =>
        f.niveaux1erCycle.length === 0 && Object.keys(f.classesParNiveau).length === 0
          ? f
          : { ...f, niveaux1erCycle: [], classesParNiveau: {} }
      )
    }
    if (!showDeuxiemeCycle(template)) {
      setForm((f) =>
        f.niveaux2eCycle.length === 0 && f.filieres.length === 0
          ? f
          : { ...f, niveaux2eCycle: [], filieres: [], a4Languages: [] }
      )
      if (enStreamStartLevel) setEnStreamStartLevel('')
      if (bilingualEnLevels.length) setBilingualEnLevels([])
      if (bilingualEnFilieres.length) setBilingualEnFilieres([])
      if (enGradingSystem) setEnGradingSystem('')
    }
    if (!isPebsFrEligible(template.code) && hasPEBSFrancophone) setHasPEBSFrancophone(false)
    if (!isPebsEnEligible(template.code) && hasPEBSAnglophone) setHasPEBSAnglophone(false)
    if (!showTechniqueBlocks(template, offers)) {
      setForm((f) => (f.filieresTechniques.length === 0 ? f : { ...f, filieresTechniques: [] }))
      if (sarMetiers.length) setSarMetiers([])
      if (cfmFilieres.length) setCfmFilieres([])
      if (sousTypeTechnique) setSousTypeTechnique('')
      if (cetifMode) setCetifMode(false)
    }
    if (!showPrimaire(template)) {
      setForm((f) =>
        f.niveauxPrimaire.length === 0 && Object.keys(f.classesParNiveauPrimaire).length === 0
          ? f
          : { ...f, niveauxPrimaire: [], classesParNiveauPrimaire: {} }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.code])

  useEffect(() => {
    setForm((f) => {
      const abiEntry = 'ABI — A Bilingue (Intensive English)'
      const hasABI = f.filieres.includes(abiEntry)
      const hasSecondCycle = f.niveaux2eCycle.length > 0
      if (hasPEBSFrancophone && hasSecondCycle && !hasABI) {
        return { ...f, filieres: [...f.filieres, abiEntry] }
      }
      if ((!hasPEBSFrancophone || !hasSecondCycle) && hasABI) {
        return { ...f, filieres: f.filieres.filter((x) => x !== abiEntry) }
      }
      return f
    })
  }, [hasPEBSFrancophone, niveaux2eCycle, setForm])
}
