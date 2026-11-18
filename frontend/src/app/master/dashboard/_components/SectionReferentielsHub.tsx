'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import type { ReferentielModule } from '../_types'
import {
  fetchReferentielsSummary,
  fetchOfficialCalendars,
  toggleOfficialCalendarActive,
  fetchBacCoefficients,
  deleteBacCoefficient,
  fetchTemplateSubjects,
  deleteTemplateSubject,
  fetchOfficialProgressions,
  deleteOfficialProgression,
  fetchTarifsMinesec,
  toggleTarifMinesecActive,
  type ReferentielsSummaryDto,
  type OfficialAcademicCalendarDto,
  type BacCoefficientDto,
  type TemplateSubjectDto,
  type OfficialProgressionDto,
  type TarifMinesecDto,
} from '../_api'
import ReferentielEditModal from './ReferentielEditModal'
import ReferentielsSummaryHeader from './referentiels/ReferentielsSummaryHeader'
import ReferentielsFiltersBar from './referentiels/ReferentielsFiltersBar'
import ReferentielCalendarView from './referentiels/ReferentielCalendarView'
import ReferentielBacView from './referentiels/ReferentielBacView'
import ReferentielTemplatesView from './referentiels/ReferentielTemplatesView'
import ReferentielProgressionsView from './referentiels/ReferentielProgressionsView'
import ReferentielTarifsView from './referentiels/ReferentielTarifsView'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function SectionReferentielsHub({ onToast }: Props) {
  const [activeModule, setActiveModule] = useState<ReferentielModule>('calendar')
  const [summary, setSummary] = useState<ReferentielsSummaryDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Données par module
  const [calendars, setCalendars] = useState<OfficialAcademicCalendarDto[]>([])
  const [bacCoeffs, setBacCoeffs] = useState<BacCoefficientDto[]>([])
  const [templateSubjects, setTemplateSubjects] = useState<TemplateSubjectDto[]>([])
  const [progressions, setProgressions] = useState<OfficialProgressionDto[]>([])
  const [tarifs, setTarifs] = useState<TarifMinesecDto[]>([])

  // Filtres
  const [filterSerie, setFilterSerie] = useState('')
  const [filterNiveau, setFilterNiveau] = useState('')
  const [filterTemplate, setFilterTemplate] = useState('')
  const [filterSubsystem, setFilterSubsystem] = useState<'FRANCOPHONE' | 'ANGLOPHONE'>('FRANCOPHONE')
  const [filterAnnee, setFilterAnnee] = useState('')

  // Modale
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null)

  const loadSummary = useCallback(async () => {
    try {
      const s = await fetchReferentielsSummary()
      setSummary(s)
    } catch {
      // Silencieux
    }
  }, [])

  const loadCurrentModule = useCallback(async () => {
    setLoading(true)
    try {
      if (activeModule === 'calendar') {
        setCalendars(await fetchOfficialCalendars())
      } else if (activeModule === 'bac') {
        setBacCoeffs(await fetchBacCoefficients({
          serie: filterSerie || undefined,
          niveau: filterNiveau || undefined,
          search: searchTerm || undefined,
        }))
      } else if (activeModule === 'templates') {
        const res = await fetchTemplateSubjects({
          templateCode: filterTemplate || undefined,
          subsystem: filterSubsystem,
          search: searchTerm || undefined,
        })
        setTemplateSubjects(res.data)
      } else if (activeModule === 'progressions') {
        setProgressions(await fetchOfficialProgressions({
          templateCode: filterTemplate || undefined,
          search: searchTerm || undefined,
        }))
      } else if (activeModule === 'tarifs') {
        setTarifs(await fetchTarifsMinesec({
          anneeScolaire: filterAnnee || undefined,
        }))
      }
    } catch {
      onToast('Erreur de chargement des données de référence', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeModule, filterSerie, filterNiveau, filterTemplate, filterSubsystem, filterAnnee, searchTerm, onToast])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    loadCurrentModule()
  }, [loadCurrentModule])

  const handleOpenCreate = () => {
    setEditItem(null)
    setModalOpen(true)
  }

  const handleOpenEdit = (item: Record<string, unknown>) => {
    setEditItem(item)
    setModalOpen(true)
  }

  const handleToggleCalendar = async (id: string) => {
    try {
      const updated = await toggleOfficialCalendarActive(id)
      setCalendars(prev => prev.map(c => c.id === id ? updated : c))
      onToast(`Statut du calendrier ${updated.academicYear} actualisé.`, 'success')
      loadSummary()
    } catch {
      onToast('Erreur lors du changement de statut', 'error')
    }
  }

  const handleDeleteBac = async (id: string) => {
    if (!(await confirmAction('Supprimer cette entrée de référence BAC ?'))) return
    try {
      await deleteBacCoefficient(id)
      setBacCoeffs(prev => prev.filter(c => c.id !== id))
      onToast('Entrée BAC supprimée.', 'info')
      loadSummary()
    } catch {
      onToast('Erreur lors de la suppression', 'error')
    }
  }

  const handleDeleteTemplateSubject = async (id: string) => {
    if (!(await confirmAction('Supprimer cette matière de référence ?'))) return
    try {
      await deleteTemplateSubject(id, filterSubsystem)
      setTemplateSubjects(prev => prev.filter(s => s.id !== id))
      onToast('Matière supprimée du template.', 'info')
      loadSummary()
    } catch {
      onToast('Erreur lors de la suppression', 'error')
    }
  }

  const handleDeleteProgression = async (id: string) => {
    if (!(await confirmAction('Supprimer ce programme officiel ?'))) return
    try {
      await deleteOfficialProgression(id)
      setProgressions(prev => prev.filter(p => p.id !== id))
      onToast('Programme supprimé.', 'info')
      loadSummary()
    } catch {
      onToast('Erreur lors de la suppression', 'error')
    }
  }

  const handleToggleTarif = async (id: string) => {
    try {
      const updated = await toggleTarifMinesecActive(id)
      setTarifs(prev => prev.map(t => t.id === id ? updated : t))
      onToast(`Tarif ${updated.typeFrais} actualisé.`, 'success')
      loadSummary()
    } catch {
      onToast('Erreur lors de la mise à jour', 'error')
    }
  }

  const handleSaved = (msg: string) => {
    onToast(msg, 'success')
    loadCurrentModule()
    loadSummary()
  }

  return (
    <div
      className="px-3.5 pt-3.5 pb-6 md:px-6 md:pt-5 md:pb-12"
      style={{
        height: '100%', overflowY: 'auto',
        background: 'var(--bg)', color: 'var(--text)', boxSizing: 'border-box',
        WebkitOverflowScrolling: 'touch',
        fontFamily: 'var(--font-nunito), Nunito, sans-serif',
      }}
    >
      <ReferentielsSummaryHeader
        summary={summary}
        onCreate={handleOpenCreate}
        onCreateUpcomingCalendar={() => {
          setActiveModule('calendar')
          setEditItem(null)
          setModalOpen(true)
        }}
      />

      <ReferentielsFiltersBar
        activeModule={activeModule}
        onSelectModule={mod => {
          setActiveModule(mod)
          setSearchTerm('')
        }}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterSerie={filterSerie}
        onFilterSerieChange={setFilterSerie}
        filterNiveau={filterNiveau}
        onFilterNiveauChange={setFilterNiveau}
        filterTemplate={filterTemplate}
        onFilterTemplateChange={setFilterTemplate}
        filterSubsystem={filterSubsystem}
        onFilterSubsystemChange={setFilterSubsystem}
        filterAnnee={filterAnnee}
        onFilterAnneeChange={setFilterAnnee}
      />

      {/* ── Données : Cartes Mobiles Natives (< md) & Tableaux Desktop (>= md) ── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            Chargement des référentiels...
          </div>
        ) : (
          <>
            {activeModule === 'calendar' && (
              <ReferentielCalendarView
                calendars={calendars}
                onToggle={handleToggleCalendar}
                onEdit={handleOpenEdit}
              />
            )}
            {activeModule === 'bac' && (
              <ReferentielBacView
                bacCoeffs={bacCoeffs}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteBac}
              />
            )}
            {activeModule === 'templates' && (
              <ReferentielTemplatesView
                templateSubjects={templateSubjects}
                filterSubsystem={filterSubsystem}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteTemplateSubject}
              />
            )}
            {activeModule === 'progressions' && (
              <ReferentielProgressionsView
                progressions={progressions}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteProgression}
              />
            )}
            {activeModule === 'tarifs' && (
              <ReferentielTarifsView
                tarifs={tarifs}
                onToggle={handleToggleTarif}
                onEdit={handleOpenEdit}
              />
            )}
          </>
        )}
      </div>

      <ReferentielEditModal
        open={modalOpen}
        module={activeModule}
        item={editItem}
        onClose={() => {
          setModalOpen(false)
          setEditItem(null)
        }}
        onSaved={handleSaved}
      />
    </div>
  )
}
