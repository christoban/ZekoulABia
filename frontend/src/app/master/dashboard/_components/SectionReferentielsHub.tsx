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
    <div style={{
      height: '100%', overflowY: 'auto', padding: '24px 32px',
      background: 'var(--bg)', color: '#1f2937',
      fontFamily: 'var(--font-nunito), Nunito, sans-serif'
    }}>
      {/* ── Entête Hub ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                boxShadow: '0 4px 10px rgba(37,99,235,0.25)'
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 style={{ fontFamily: 'var(--font-spectral), Spectral, serif', fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>
                  Référentiels Nationaux
                </h1>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>
                  Données de référence ministérielles & templates nationaux • Éditables sans redéploiement
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8,
              padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--green2)',
              display: 'flex', alignItems: 'center', gap: 6
            }}>
              <CheckCircle size={15} color="var(--primary)" />
              <span>Garde-fou : Local toujours gagnant (zéro écrasement rétroactif)</span>
            </div>
            <button
              onClick={handleOpenCreate}
              style={{
                background: 'var(--sidebar-bg)', color: 'white', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}
            >
              <Plus size={16} />
              <span>Ajouter une entrée</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Alerte Proactive Annuelle (Rentrée approchante sans arrêté) ───────── */}
      {summary?.upcomingYearAlert && (
        <div style={{
          background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12,
          padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 14, boxShadow: '0 2px 8px rgba(245,158,11,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: '#fef3c7',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706'
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#92400e' }}>
                Rappel Annuel : Arrêté ministériel attendu ({summary.nextAcademicYear})
              </div>
              <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
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
            style={{
              background: '#d97706', color: 'white', border: 'none', borderRadius: 8,
              padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <Calendar size={14} />
            Saisir le calendrier {summary.nextAcademicYear}
          </button>
        </div>
      )}

      {/* ── Cartes KPI Synthèse ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ background: '#ffffff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>CALENDRIERS ARRÊTÉS</span>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 6 }}>
            {summary?.counts.calendars ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} />
            <span>En cours : {summary?.currentAcademicYear ?? '2026-2027'}</span>
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>COEFFICIENTS BAC</span>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 6 }}>
            {summary?.counts.bacCoefficients ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginTop: 4 }}>
            Arrêté N° 92/22 (A1 à TI)
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>VOLUMES PAR TEMPLATE</span>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--green-light)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 6 }}>
            {summary?.counts.cycleSubjects ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginTop: 4 }}>
            {summary?.counts.templates ?? 19} templates officiels
          </div>
        </div>

        <div style={{ background: '#ffffff', borderRadius: 12, padding: '14px 18px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>TARIFS RÉGLEMENTAIRES</span>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coins size={16} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 6 }}>
            {summary?.counts.tarifs ?? '—'}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginTop: 4 }}>
            Scolarité publique & Examens
          </div>
        </div>
      </div>

      {/* ── Sélecteur de Module (Les 5 Piliers) ──────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e5e7eb',
        paddingBottom: 8, overflowX: 'auto'
      }}>
        {[
          { id: 'calendar', label: '1. Calendrier Scolaire Officiel', icon: Calendar },
          { id: 'bac', label: '2. Coefficients BAC (Arrêté 92/22)', icon: GraduationCap },
          { id: 'templates', label: '3. Matières & Volumes par Template', icon: Layers },
          { id: 'progressions', label: '4. Programmes & Progressions Types', icon: BookOpen },
          { id: 'tarifs', label: '5. Tarifs MINESEC Réglementaires', icon: Coins },
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
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: isActive ? 'var(--sidebar-bg)' : '#ffffff',
                color: isActive ? 'white' : '#4b5563',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
                whiteSpace: 'nowrap', transition: 'all 0.15s'
              }}
            >
              <Icon size={16} />
              <span>{mod.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Zone Filtres & Recherche ─────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff', borderRadius: 12, padding: '14px 18px',
        border: '1px solid #e5e7eb', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
            <Search size={16} color="#9ca3af" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher une matière, référence..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px 7px 32px', borderRadius: 8,
                border: '1px solid #d1d5db', fontSize: 13, outline: 'none'
              }}
            />
          </div>

          {/* Filtres contextuels selon le module */}
          {activeModule === 'bac' && (
            <>
              <select
                value={filterSerie}
                onChange={e => setFilterSerie(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, fontWeight: 600, background: 'white' }}
              >
                <option value="">Toutes séries</option>
                {['A1', 'A2', 'A3', 'A4', 'A5', 'ABI', 'C', 'D', 'E', 'TI', 'SH', 'AC'].map(s => (
                  <option key={s} value={s}>Série {s}</option>
                ))}
              </select>
              <select
                value={filterNiveau}
                onChange={e => setFilterNiveau(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, fontWeight: 600, background: 'white' }}
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
                style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12, fontWeight: 600, background: 'white' }}
              >
                <option value="FRANCOPHONE">Système Francophone</option>
                <option value="ANGLOPHONE">Système Anglophone</option>
              </select>
              <input
                type="text"
                placeholder="Template (ex. LYCEE_FR)"
                value={filterTemplate}
                onChange={e => setFilterTemplate(e.target.value.toUpperCase())}
                style={{ width: 140, padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}
              />
            </>
          )}

          {activeModule === 'progressions' && (
            <input
              type="text"
              placeholder="Template (ex. LYCEE_FR)"
              value={filterTemplate}
              onChange={e => setFilterTemplate(e.target.value.toUpperCase())}
              style={{ width: 150, padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}
            />
          )}

          {activeModule === 'tarifs' && (
            <input
              type="text"
              placeholder="Année (ex. 2026-2027)"
              value={filterAnnee}
              onChange={e => setFilterAnnee(e.target.value)}
              style={{ width: 140, padding: '7px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12 }}
            />
          )}
        </div>

        <button
          onClick={handleOpenCreate}
          style={{
            background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
            borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          <Plus size={14} />
          <span>Nouvelle ligne</span>
        </button>
      </div>

      {/* ── Tableaux des Données ────────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb',
        overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
            Chargement des référentiels...
          </div>
        ) : (
          <>
            {/* 1. Calendrier Scolaire Officiel */}
            {activeModule === 'calendar' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>
                    <th style={{ padding: '12px 16px' }}>Année Scolaire</th>
                    <th style={{ padding: '12px 16px' }}>Arrêté Ministériel</th>
                    <th style={{ padding: '12px 16px' }}>Rentrée Officielle</th>
                    <th style={{ padding: '12px 16px' }}>Clôture Officielle</th>
                    <th style={{ padding: '12px 16px' }}>Périodes & Vacances</th>
                    <th style={{ padding: '12px 16px' }}>Statut</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {calendars.map(cal => (
                    <tr key={cal.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#111827' }}>
                        {cal.academicYear}
                        <span style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: '#f3f4f6', borderRadius: 4, color: '#4b5563' }}>
                          {cal.establishmentType}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4b5563', maxWidth: 220 }}>
                        {cal.arreteReference || 'Arrêté conjoint MINESEC/MINEDUB'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--primary)' }}>
                        {new Date(cal.dateRentreeOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#b91c1c' }}>
                        {new Date(cal.dateClotureOfficielle).toLocaleDateString('fr-CM', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                        {cal.trimestres?.length || 3} trimestres • {cal.periodesVacances?.length || 2} congés
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                          background: cal.active ? 'var(--green-light)' : '#fee2e2',
                          color: cal.active ? '#15803d' : '#b91c1c'
                        }}>
                          {cal.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handleToggleCalendar(cal.id)}
                            title={cal.active ? 'Désactiver' : 'Activer'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}
                          >
                            {cal.active ? <ToggleRight size={18} color="#15803d" /> : <ToggleLeft size={18} color="#9ca3af" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(cal as unknown as Record<string, unknown>)}
                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#374151', fontSize: 12, fontWeight: 600 }}
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {calendars.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                        Aucun calendrier enregistré. Cliquez sur « Ajouter une entrée ».
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 2. Coefficients BAC */}
            {activeModule === 'bac' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>
                    <th style={{ padding: '12px 16px' }}>Matière</th>
                    <th style={{ padding: '12px 16px' }}>Série</th>
                    <th style={{ padding: '12px 16px' }}>Niveau</th>
                    <th style={{ padding: '12px 16px' }}>Coefficient</th>
                    <th style={{ padding: '12px 16px' }}>Groupe</th>
                    <th style={{ padding: '12px 16px' }}>Source Arrêté</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bacCoeffs.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827' }}>
                        {b.subjectName}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '2px 8px', background: '#eff6ff', color: '#1e40af', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                          {b.serie}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                        {b.niveau}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#111827' }}>
                        {b.coefficient}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: b.groupe === 1 ? '#fef3c7' : '#f3f4f6',
                          color: b.groupe === 1 ? '#92400e' : '#4b5563'
                        }}>
                          {b.groupe === 1 ? 'G1 - Principale' : 'G2 - Transversale'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280' }}>
                        {b.source}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handleOpenEdit(b as unknown as Record<string, unknown>)}
                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#374151' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteBac(b.id)}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bacCoeffs.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                        Aucun coefficient BAC correspondant aux filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 3. Matières & Volumes par Template */}
            {activeModule === 'templates' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>
                    <th style={{ padding: '12px 16px' }}>Template</th>
                    <th style={{ padding: '12px 16px' }}>Niveau</th>
                    <th style={{ padding: '12px 16px' }}>Filière</th>
                    <th style={{ padding: '12px 16px' }}>Matière</th>
                    <th style={{ padding: '12px 16px' }}>Coeff</th>
                    <th style={{ padding: '12px 16px' }}>Heures/Semaine</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templateSubjects.map(ts => (
                    <tr key={ts.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e40af' }}>
                        {ts.templateCode}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {ts.classLevel}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                        {ts.filiere}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827' }}>
                        {ts.subjectName}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800 }}>
                        {ts.coefficient}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                        {ts.weeklyPeriods ? `${ts.weeklyPeriods}h` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handleOpenEdit({ ...ts, subsystem: filterSubsystem })}
                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#374151' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplateSubject(ts.id)}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {templateSubjects.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                        Aucune matière trouvée pour ce template et ces filtres.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 4. Programmes & Progressions Types */}
            {activeModule === 'progressions' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>
                    <th style={{ padding: '12px 16px' }}>Template</th>
                    <th style={{ padding: '12px 16px' }}>Niveau</th>
                    <th style={{ padding: '12px 16px' }}>Matière</th>
                    <th style={{ padding: '12px 16px' }}>Titre du Programme</th>
                    <th style={{ padding: '12px 16px' }}>Chapitres Types</th>
                    <th style={{ padding: '12px 16px' }}>Statut</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {progressions.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e40af' }}>
                        {p.templateCode}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {p.level}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827' }}>
                        {p.subjectName}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>
                        {p.titre}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                        {p.chapitres?.length || 0} chapitres configurés
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                          background: p.active ? 'var(--green-light)' : '#fee2e2',
                          color: p.active ? '#15803d' : '#b91c1c'
                        }}>
                          {p.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handleOpenEdit(p as unknown as Record<string, unknown>)}
                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#374151' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteProgression(p.id)}
                            style={{ background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#dc2626' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {progressions.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                        Aucun programme configuré. Cliquez sur « Ajouter une entrée ».
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 5. Tarifs MINESEC Réglementaires */}
            {activeModule === 'tarifs' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 700 }}>
                    <th style={{ padding: '12px 16px' }}>Type de Frais</th>
                    <th style={{ padding: '12px 16px' }}>Année Scolaire</th>
                    <th style={{ padding: '12px 16px' }}>Niveau</th>
                    <th style={{ padding: '12px 16px' }}>Montant Réglementaire</th>
                    <th style={{ padding: '12px 16px' }}>Description / Base Légale</th>
                    <th style={{ padding: '12px 16px' }}>Statut</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tarifs.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#111827' }}>
                        {t.typeFrais}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {t.anneeScolaire}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4b5563' }}>
                        {t.niveau || 'Tous'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--primary)', fontSize: 14 }}>
                        {t.montantFCFA.toLocaleString('fr-FR')} FCFA
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280', maxWidth: 220 }}>
                        {t.description || 'Barème officiel MINESEC'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                          background: t.actif ? 'var(--green-light)' : '#fee2e2',
                          color: t.actif ? '#15803d' : '#b91c1c'
                        }}>
                          {t.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => handleToggleTarif(t.id)}
                            title={t.actif ? 'Désactiver' : 'Activer'}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}
                          >
                            {t.actif ? <ToggleRight size={18} color="#15803d" /> : <ToggleLeft size={18} color="#9ca3af" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(t as unknown as Record<string, unknown>)}
                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#374151' }}
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tarifs.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                        Aucun tarif MINESEC configuré. Cliquez sur « Ajouter une entrée ».
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
