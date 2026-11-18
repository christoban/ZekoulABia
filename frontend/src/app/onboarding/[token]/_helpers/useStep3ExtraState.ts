'use client'

import { useState } from 'react'
import type {
  AppelFrequency,
  BulletinFrequency,
  EnGradingSystem,
  EnStreamStartLevel,
  EvalSystemPrimaire,
  TechnicalSubtype,
} from './types'

export function useStep3ExtraState() {
  const [customLv2, setCustomLv2] = useState('')
  const [customA4, setCustomA4] = useState('')
  const [customFiliere, setCustomFiliere] = useState('')
  const [customTech, setCustomTech] = useState('')
  const [sousTypeTechnique, setSousTypeTechnique] = useState<TechnicalSubtype>('')
  const [cetifMode, setCetifMode] = useState(false)
  const [sarMetiers, setSarMetiers] = useState<string[]>([])
  const [cfmFilieres, setCfmFilieres] = useState<string[]>([])
  const [maternelleSections, setMaternelleSections] = useState<string[]>(['Petite section', 'Moyenne section', 'Grande section'])
  const [nurseryLevels, setNurseryLevels] = useState<string[]>(['PreNursery', 'Nursery 1', 'Nursery 2'])
  const [customSarMetier, setCustomSarMetier] = useState('')
  const [customCfmFiliere, setCustomCfmFiliere] = useState('')
  const [enGradingSystem, setEnGradingSystem] = useState<EnGradingSystem>('')
  const [bulletinFrequency, setBulletinFrequency] = useState<BulletinFrequency>('MONTHLY')
  const [evalSystemPrimaire, setEvalSystemPrimaire] = useState<EvalSystemPrimaire>('')
  const [appelFrequency, setAppelFrequency] = useState<AppelFrequency>('')
  const [hasPEBSFrancophone, setHasPEBSFrancophone] = useState(false)
  const [hasPEBSAnglophone, setHasPEBSAnglophone] = useState(false)
  const [enStreamStartLevel, setEnStreamStartLevel] = useState<EnStreamStartLevel>('')
  const [bilingualEnLevels, setBilingualEnLevels] = useState<string[]>([])
  const [bilingualEnFilieres, setBilingualEnFilieres] = useState<string[]>([])

  return {
    customLv2,
    setCustomLv2,
    customA4,
    setCustomA4,
    customFiliere,
    setCustomFiliere,
    customTech,
    setCustomTech,
    sousTypeTechnique,
    setSousTypeTechnique,
    cetifMode,
    setCetifMode,
    sarMetiers,
    setSarMetiers,
    cfmFilieres,
    setCfmFilieres,
    maternelleSections,
    setMaternelleSections,
    nurseryLevels,
    setNurseryLevels,
    customSarMetier,
    setCustomSarMetier,
    customCfmFiliere,
    setCustomCfmFiliere,
    enGradingSystem,
    setEnGradingSystem,
    bulletinFrequency,
    setBulletinFrequency,
    evalSystemPrimaire,
    setEvalSystemPrimaire,
    appelFrequency,
    setAppelFrequency,
    hasPEBSFrancophone,
    setHasPEBSFrancophone,
    hasPEBSAnglophone,
    setHasPEBSAnglophone,
    enStreamStartLevel,
    setEnStreamStartLevel,
    bilingualEnLevels,
    setBilingualEnLevels,
    bilingualEnFilieres,
    setBilingualEnFilieres,
  }
}
