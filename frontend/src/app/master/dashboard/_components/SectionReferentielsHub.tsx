'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Calendar,
  GraduationCap,
  BookOpen,
  Layers,
  Coins,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from 'lucide-react'
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

  // Chargement synthèse
  const loadSummary = useCallback(async () => {
    try {
      const s = await fetchReferentielsSummary()
      setSummary(s)
    } catch {
      // Silencieux
    }
  }, [])

  // Chargement module courant
  const loadCurrentModule = useCallback(async () => {
    setLoading(true)
    try {
      if (activeModule === 'calendar') {
        const data = await fetchOfficialCalendars()
        setCalendars(data)
      } else if (activeModule === 'bac') {
        const data = await fetchBacCoefficients({
          serie: filterSerie || undefined,
          niveau: filterNiveau || undefined,
          search: searchTerm || undefined,
        })
        setBacCoeffs(data)
      } else if (activeModule === 'templates') {
        const res = await fetchTemplateSubjects({
          templateCode: filterTemplate || undefined,
          subsystem: filterSubsystem,
          search: searchTerm || undefined,
        })
        setTemplateSubjects(res.data)
      } else if (activeModule === 'progressions') {
        const data = await fetchOfficialProgressions({
          templateCode: filterTemplate || undefined,
          search: searchTerm || undefined,
        })
        setProgressions(data)
      } else if (activeModule === 'tarifs') {
        const data = await fetchTarifsMinesec({
          anneeScolaire: filterAnnee || undefined,
        })
        setTarifs(data)
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
    if (!confirm('Supprimer cette entrée de référence BAC ?')) return
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
    if (!confirm('Supprimer cette matière de référence ?')) return
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
    if (!confirm('Supprimer ce programme officiel ?')) return
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
        fontFamily: 'var(--font-nunito), Nunito, sans-serif'
      }}
    >
      {/* ── Entête Hub ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 220px' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'var(--amber-light)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
              flexShrink: 0
            }}>
              <ShieldCheck size={20} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 className="text-[18px] md:text-[20px]" style={{ fontFamily: 'var(--font-spectral), Spectral, serif', fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                Référentiels Nationaux
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--text3)', margin: '2px 0 0' }}>
                Données ministérielles & templates nationaux • Éditables sans redéploiement
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="hidden lg:inline-flex" style={{
              background: 'var(--green-light)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: 8,
              padding: '6px 11px', fontSize: 11.5, fontWeight: 700, color: 'var(--green)',
              alignItems: 'center', gap: 6
            }}>
              <CheckCircle size={14} />
              <span>Garde-fou : Local toujours gagnant</span>
            </div>
            <button
              onClick={handleOpenCreate}
              className="w-full sm:w-auto justify-center"
              style={{
                background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', borderRadius: 9,
                padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', minHeight: 38,
                display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(142,42,58,0.18)'
              }}
            >
              <Plus size={15} />
              <span>Ajouter une entrée</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Alerte Proactive Annuelle (Rentrée approchante sans arrêté) ───────── */}
      {summary?.upcomingYearAlert && (
        <div style={{
          background: 'var(--amber-light)', border: '1px solid rgba(217, 119, 6, 0.35)', borderRadius: 12,
          padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 220px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, background: 'rgba(217, 119, 6, 0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)', flexShrink: 0
            }}>
              <AlertTriangle size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber)' }}>
                Rappel Annuel : Arrêté ministériel attendu ({summary.nextAcademicYear})
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {summary.alertMessage}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveModule('calendar')
              setEditItem(null)
              setModalOpen(true)
            }}
            className="w-full sm:w-auto justify-center"
            style={{
              background: 'var(--amber)', color: '#1c120c', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36
            }}
          >
            <Calendar size={14} />
            Saisir le calendrier {summary.nextAcademicYear}
          </button>
        </div>
      )}

      {/* ── Cartes KPI Synthèse (2x2 sur mobile, 4 colonnes sur desktop) ──────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5 mb-4">
        <div className="p-3 md:p-4" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.3px' }}>CALENDRIERS</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(59, 130, 246, 0.14)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={14} />
            </div>
          </div>
          <div className="text-[20px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.1 }}>
            {summary?.counts.calendars ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} />
            <span className="truncate">{summary?.currentAcademicYear ?? '2026-2027'}</span>
          </div>
        </div>

        <div className="p-3 md:p-4" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.3px' }}>COEFFS BAC</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(236, 72, 153, 0.14)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <GraduationCap size={14} />
            </div>
          </div>
          <div className="text-[20px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.1 }}>
            {summary?.counts.bacCoefficients ?? '—'}
          </div>
          <div className="truncate" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
            Arrêté N° 92/22 (A1 à TI)
          </div>
        </div>

        <div className="p-3 md:p-4" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.3px' }}>MATIÈRES</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Layers size={14} />
            </div>
          </div>
          <div className="text-[20px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.1 }}>
            {summary?.counts.cycleSubjects ?? '—'}
          </div>
          <div className="truncate" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
            {summary?.counts.templates ?? 19} templates officiels
          </div>
        </div>

        <div className="p-3 md:p-4" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', letterSpacing: '0.3px' }}>TARIFS MINESEC</span>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--amber-light)', color: 'var(--amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Coins size={14} />
            </div>
          </div>
          <div className="text-[20px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)', marginTop: 4, lineHeight: 1.1 }}>
            {summary?.counts.tarifs ?? '—'}
          </div>
          <div className="truncate" style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
            Scolarité & Examens
          </div>
        </div>
      </div>

      {/* ── Sélecteur de Module (Les 5 Piliers) ──────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 14, background: 'var(--bg2)', padding: 4, borderRadius: 10,
        overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none'
      }}>
        {[
          { id: 'calendar', label: '1. Calendrier Officiel', icon: Calendar },
          { id: 'bac', label: '2. Coeffs BAC (92/22)', icon: GraduationCap },
          { id: 'templates', label: '3. Matières par Template', icon: Layers },
          { id: 'progressions', label: '4. Progressions Types', icon: BookOpen },
          { id: 'tarifs', label: '5. Tarifs MINESEC', icon: Coins },
        ].map(mod => {
          const Icon = mod.icon
          const isActive = activeModule === mod.id
          return (
            <button
              key={mod.id}
              onClick={() => {
                setActiveModule(mod.id as ReferentielModule)
                setSearchTerm('')
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 13px', borderRadius: 8, border: 'none',
                background: isActive ? 'var(--surface)' : 'transparent',
                color: isActive ? 'var(--text)' : 'var(--text3)',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.15s'
              }}
            >
              <Icon size={15} />
              <span>{mod.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Zone Filtres & Recherche ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, padding: '12px 14px',
        border: '1px solid var(--border)', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 220, flexWrap: 'wrap' }}>
          <div className="w-full sm:w-auto sm:flex-1" style={{ position: 'relative', minWidth: 180, maxWidth: 340 }}>
            <Search size={15} color="var(--text3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher une matière, référence..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px 8px 32px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)',
                fontSize: 13, outline: 'none', fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Filtres contextuels selon le module */}
          {activeModule === 'bac' && (
            <>
              <select
                value={filterSerie}
                onChange={e => setFilterSerie(e.target.value)}
                className="flex-1 sm:flex-initial"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit' }}
              >
                <option value="">Toutes séries</option>
                {['A1', 'A2', 'A3', 'A4', 'A5', 'ABI', 'C', 'D', 'E', 'TI', 'SH', 'AC'].map(s => (
                  <option key={s} value={s}>Série {s}</option>
                ))}
              </select>
              <select
                value={filterNiveau}
                onChange={e => setFilterNiveau(e.target.value)}
                className="flex-1 sm:flex-initial"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit' }}
              >
                <option value="">Tous niveaux</option>
                <option value="SECONDE">Seconde</option>
                <option value="PREMIERE">Première</option>
                <option value="TERMINALE">Terminale</option>
              </select>
            </>
          )}

          {activeModule === 'templates' && (
            <>
              <select
                value={filterSubsystem}
                onChange={e => setFilterSubsystem(e.target.value as 'FRANCOPHONE' | 'ANGLOPHONE')}
                className="flex-1 sm:flex-initial"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, fontWeight: 700, background: 'var(--bg2)', color: 'var(--text)', fontFamily: 'inherit' }}
              >
                <option value="FRANCOPHONE">Système Francophone</option>
                <option value="ANGLOPHONE">Système Anglophone</option>
              </select>
              <input
                type="text"
                placeholder="Template (ex. LYCEE_FR)"
                value={filterTemplate}
                onChange={e => setFilterTemplate(e.target.value.toUpperCase())}
                className="flex-1 sm:flex-initial"
                style={{ minWidth: 130, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
              />
            </>
          )}

          {activeModule === 'progressions' && (
            <input
              type="text"
              placeholder="Template (ex. LYCEE_FR)"
              value={filterTemplate}
              onChange={e => setFilterTemplate(e.target.value.toUpperCase())}
              className="flex-1 sm:flex-initial"
              style={{ minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
            />
          )}

          {activeModule === 'tarifs' && (
            <input
              type="text"
              placeholder="Année (ex. 2026-2027)"
              value={filterAnnee}
              onChange={e => setFilterAnnee(e.target.value)}
              className="flex-1 sm:flex-initial"
              style={{ minWidth: 140, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit' }}
            />
          )}
        </div>
      </div>

      {/* ── Données : Cartes Mobiles Natives (< md) & Tableaux Desktop (>= md) ── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: 36, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            Chargement des référentiels...
          </div>
        ) : (
          <>
            {/* 1. Calendrier Scolaire Officiel */}
            {activeModule === 'calendar' && (
              <>
                <div className="block md:hidden" style={{ padding: 10 }}>
                  {calendars.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                      Aucun calendrier enregistré. Cliquez sur « Ajouter une entrée ».
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {calendars.map(cal => (
                        <div key={cal.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{cal.academicYear}</span>
                              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}>
                                {cal.establishmentType}
                              </span>
                            </div>
                            <span style={{
                              padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 800,
                              background: cal.active ? 'var(--green-light)' : 'var(--red-light)',
                              color: cal.active ? 'var(--green)' : 'var(--red)'
                            }}>
                              {cal.active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                            {cal.arreteReference || 'Arrêté conjoint MINESEC/MINEDUB'}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--surface)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 11.5 }}>
                            <div>
                              <div style={{ color: 'var(--text3)', fontSize: 10.5, fontWeight: 700 }}>RENTRÉE</div>
                              <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 2 }}>
                                {new Date(cal.dateRentreeOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text3)', fontSize: 10.5, fontWeight: 700 }}>CLÔTURE</div>
                              <div style={{ fontWeight: 700, color: 'var(--red)', marginTop: 2 }}>
                                {new Date(cal.dateClotureOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>
                              {cal.trimestres?.length || 3} trimestres • {cal.periodesVacances?.length || 2} congés
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                onClick={() => handleToggleCalendar(cal.id)}
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', padding: '5px 9px', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--text2)' }}
                              >
                                {cal.active ? <ToggleRight size={16} color="var(--green)" /> : <ToggleLeft size={16} color="var(--text3)" />}
                              </button>
                              <button
                                onClick={() => handleOpenEdit(cal as unknown as Record<string, unknown>)}
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700 }}
                              >
                                <Edit2 size={13} /> Modifier
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 16px' }}>Année Scolaire</th>
                        <th style={{ padding: '10px 16px' }}>Arrêté Ministériel</th>
                        <th style={{ padding: '10px 16px' }}>Rentrée Officielle</th>
                        <th style={{ padding: '10px 16px' }}>Clôture Officielle</th>
                        <th style={{ padding: '10px 16px' }}>Périodes & Vacances</th>
                        <th style={{ padding: '10px 16px' }}>Statut</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendars.map(cal => (
                        <tr key={cal.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text)' }}>
                            {cal.academicYear}
                            <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: 'var(--bg2)', borderRadius: 4, color: 'var(--text2)' }}>
                              {cal.establishmentType}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text2)', maxWidth: 220 }}>
                            {cal.arreteReference || 'Arrêté conjoint MINESEC/MINEDUB'}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                            {new Date(cal.dateRentreeOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--red)' }}>
                            {new Date(cal.dateClotureOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>
                            {cal.trimestres?.length || 3} trimestres • {cal.periodesVacances?.length || 2} congés
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                              background: cal.active ? 'var(--green-light)' : 'var(--red-light)',
                              color: cal.active ? 'var(--green)' : 'var(--red)'
                            }}>
                              {cal.active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                onClick={() => handleToggleCalendar(cal.id)}
                                title={cal.active ? 'Désactiver' : 'Activer'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4 }}
                              >
                                {cal.active ? <ToggleRight size={18} color="var(--green)" /> : <ToggleLeft size={18} color="var(--text3)" />}
                              </button>
                              <button
                                onClick={() => handleOpenEdit(cal as unknown as Record<string, unknown>)}
                                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)', fontSize: 12, fontWeight: 600 }}
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {calendars.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                            Aucun calendrier enregistré. Cliquez sur « Ajouter une entrée ».
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 2. Coefficients BAC */}
            {activeModule === 'bac' && (
              <>
                <div className="block md:hidden" style={{ padding: 10 }}>
                  {bacCoeffs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                      Aucun coefficient BAC correspondant aux filtres.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {bacCoeffs.map(b => (
                        <div key={b.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{b.subjectName}</div>
                            <span style={{ padding: '2px 8px', background: 'var(--amber-light)', color: 'var(--primary)', borderRadius: 6, fontWeight: 800, fontSize: 11.5, whiteSpace: 'nowrap' }}>
                              Coeff {b.coefficient}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5 }}>
                            <span style={{ padding: '2px 7px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 700, color: 'var(--text)' }}>
                              Série {b.serie}
                            </span>
                            <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{b.niveau}</span>
                            <span style={{
                              padding: '2px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                              background: b.groupe === 1 ? 'var(--amber-light)' : 'var(--surface)',
                              color: b.groupe === 1 ? 'var(--amber)' : 'var(--text2)'
                            }}>
                              {b.groupe === 1 ? 'G1 - Principale' : 'G2 - Transversale'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{b.source}</span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleOpenEdit(b as unknown as Record<string, unknown>)}
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700 }}
                              >
                                <Edit2 size={12} /> Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteBac(b.id)}
                                style={{ background: 'var(--red-light)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--red)', display: 'inline-flex', alignItems: 'center' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 16px' }}>Matière</th>
                        <th style={{ padding: '10px 16px' }}>Série</th>
                        <th style={{ padding: '10px 16px' }}>Niveau</th>
                        <th style={{ padding: '10px 16px' }}>Coefficient</th>
                        <th style={{ padding: '10px 16px' }}>Groupe</th>
                        <th style={{ padding: '10px 16px' }}>Source Arrêté</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bacCoeffs.map(b => (
                        <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                            {b.subjectName}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '2px 8px', background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                              {b.serie}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                            {b.niveau}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text)' }}>
                            {b.coefficient}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: b.groupe === 1 ? 'var(--amber-light)' : 'var(--bg2)',
                              color: b.groupe === 1 ? 'var(--amber)' : 'var(--text2)'
                            }}>
                              {b.groupe === 1 ? 'G1 - Principale' : 'G2 - Transversale'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                            {b.source}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                onClick={() => handleOpenEdit(b as unknown as Record<string, unknown>)}
                                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteBac(b.id)}
                                style={{ background: 'var(--red-light)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--red)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {bacCoeffs.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                            Aucun coefficient BAC correspondant aux filtres.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 3. Matières & Volumes par Template */}
            {activeModule === 'templates' && (
              <>
                <div className="block md:hidden" style={{ padding: 10 }}>
                  {templateSubjects.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                      Aucune matière trouvée pour ce template et ces filtres.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {templateSubjects.map(ts => (
                        <div key={ts.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{ts.subjectName}</span>
                            <span style={{ fontSize: 11.5, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'var(--amber-light)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                              Coeff {ts.coefficient} {ts.weeklyPeriods ? `· ${ts.weeklyPeriods}h` : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text2)' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{ts.templateCode}</span>
                              <span>·</span>
                              <span style={{ fontWeight: 700 }}>{ts.classLevel}</span>
                              <span>·</span>
                              <span>{ts.filiere}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleOpenEdit({ ...ts, subsystem: filterSubsystem })}
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700 }}
                              >
                                <Edit2 size={12} /> Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteTemplateSubject(ts.id)}
                                style={{ background: 'var(--red-light)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--red)', display: 'inline-flex', alignItems: 'center' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 16px' }}>Template</th>
                        <th style={{ padding: '10px 16px' }}>Niveau</th>
                        <th style={{ padding: '10px 16px' }}>Filière</th>
                        <th style={{ padding: '10px 16px' }}>Matière</th>
                        <th style={{ padding: '10px 16px' }}>Coeff</th>
                        <th style={{ padding: '10px 16px' }}>Heures/Semaine</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateSubjects.map(ts => (
                        <tr key={ts.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                            {ts.templateCode}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                            {ts.classLevel}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                            {ts.filiere}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                            {ts.subjectName}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text)' }}>
                            {ts.coefficient}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>
                            {ts.weeklyPeriods ? `${ts.weeklyPeriods}h` : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                onClick={() => handleOpenEdit({ ...ts, subsystem: filterSubsystem })}
                                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteTemplateSubject(ts.id)}
                                style={{ background: 'var(--red-light)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--red)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {templateSubjects.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                            Aucune matière trouvée pour ce template et ces filtres.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 4. Programmes & Progressions Types */}
            {activeModule === 'progressions' && (
              <>
                <div className="block md:hidden" style={{ padding: 10 }}>
                  {progressions.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                      Aucun programme configuré. Cliquez sur « Ajouter une entrée ».
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {progressions.map(p => (
                        <div key={p.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{p.subjectName}</div>
                              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 1 }}>{p.titre}</div>
                            </div>
                            <span style={{
                              padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                              background: p.active ? 'var(--green-light)' : 'var(--red-light)',
                              color: p.active ? 'var(--green)' : 'var(--red)'
                            }}>
                              {p.active ? 'Actif' : 'Inactif'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                            <div style={{ fontSize: 11.5, color: 'var(--text3)', display: 'flex', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{p.templateCode}</span>
                              <span>·</span>
                              <span style={{ fontWeight: 700, color: 'var(--text2)' }}>{p.level}</span>
                              <span>·</span>
                              <span>{p.chapitres?.length || 0} ch.</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleOpenEdit(p as unknown as Record<string, unknown>)}
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700 }}
                              >
                                <Edit2 size={12} /> Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteProgression(p.id)}
                                style={{ background: 'var(--red-light)', border: 'none', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', color: 'var(--red)', display: 'inline-flex', alignItems: 'center' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 16px' }}>Template</th>
                        <th style={{ padding: '10px 16px' }}>Niveau</th>
                        <th style={{ padding: '10px 16px' }}>Matière</th>
                        <th style={{ padding: '10px 16px' }}>Titre du Programme</th>
                        <th style={{ padding: '10px 16px' }}>Chapitres Types</th>
                        <th style={{ padding: '10px 16px' }}>Statut</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressions.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                            {p.templateCode}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                            {p.level}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                            {p.subjectName}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                            {p.titre}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>
                            {p.chapitres?.length || 0} chapitres configurés
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                              background: p.active ? 'var(--green-light)' : 'var(--red-light)',
                              color: p.active ? 'var(--green)' : 'var(--red)'
                            }}>
                              {p.active ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                onClick={() => handleOpenEdit(p as unknown as Record<string, unknown>)}
                                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteProgression(p.id)}
                                style={{ background: 'var(--red-light)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--red)' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {progressions.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                            Aucun programme configuré. Cliquez sur « Ajouter une entrée ».
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* 5. Tarifs MINESEC Réglementaires */}
            {activeModule === 'tarifs' && (
              <>
                <div className="block md:hidden" style={{ padding: 10 }}>
                  {tarifs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
                      Aucun tarif MINESEC configuré. Cliquez sur « Ajouter une entrée ».
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tarifs.map(t => (
                        <div key={t.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>{t.typeFrais}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>
                                {t.anneeScolaire} · {t.niveau || 'Tous niveaux'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)' }}>
                                {t.montantFCFA.toLocaleString('fr-FR')} FCFA
                              </div>
                              <span style={{
                                display: 'inline-block', marginTop: 2, padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 800,
                                background: t.actif ? 'var(--green-light)' : 'var(--red-light)',
                                color: t.actif ? 'var(--green)' : 'var(--red)'
                              }}>
                                {t.actif ? 'Actif' : 'Inactif'}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                            <span style={{ fontSize: 11.5, color: 'var(--text2)' }}>
                              {t.description || 'Barème officiel MINESEC'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              <button
                                onClick={() => handleToggleTarif(t.id)}
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: '5px 8px', display: 'inline-flex', alignItems: 'center' }}
                              >
                                {t.actif ? <ToggleRight size={16} color="var(--green)" /> : <ToggleLeft size={16} color="var(--text3)" />}
                              </button>
                              <button
                                onClick={() => handleOpenEdit(t as unknown as Record<string, unknown>)}
                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700 }}
                              >
                                <Edit2 size={12} /> Modifier
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>
                        <th style={{ padding: '10px 16px' }}>Type de Frais</th>
                        <th style={{ padding: '10px 16px' }}>Année Scolaire</th>
                        <th style={{ padding: '10px 16px' }}>Niveau</th>
                        <th style={{ padding: '10px 16px' }}>Montant Réglementaire</th>
                        <th style={{ padding: '10px 16px' }}>Description / Base Légale</th>
                        <th style={{ padding: '10px 16px' }}>Statut</th>
                        <th style={{ padding: '10px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tarifs.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text)' }}>
                            {t.typeFrais}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>
                            {t.anneeScolaire}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>
                            {t.niveau || 'Tous'}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>
                            {t.montantFCFA.toLocaleString('fr-FR')} FCFA
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text3)', maxWidth: 220 }}>
                            {t.description || 'Barème officiel MINESEC'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                              background: t.actif ? 'var(--green-light)' : 'var(--red-light)',
                              color: t.actif ? 'var(--green)' : 'var(--red)'
                            }}>
                              {t.actif ? 'Actif' : 'Inactif'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                onClick={() => handleToggleTarif(t.id)}
                                title={t.actif ? 'Désactiver' : 'Activer'}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4 }}
                              >
                                {t.actif ? <ToggleRight size={18} color="var(--green)" /> : <ToggleLeft size={18} color="var(--text3)" />}
                              </button>
                              <button
                                onClick={() => handleOpenEdit(t as unknown as Record<string, unknown>)}
                                style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: 'var(--text)' }}
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {tarifs.length === 0 && (
                        <tr>
                          <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                            Aucun tarif MINESEC configuré. Cliquez sur « Ajouter une entrée ».
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Modale d'Édition / Création ─────────────────────────────────────── */}
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
