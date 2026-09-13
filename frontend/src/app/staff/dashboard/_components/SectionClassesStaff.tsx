'use client'

import { useEffect, useState } from 'react'
import { Plus, School, Edit2, Users, Search, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

type ClassItem = {
  id: string
  name: string
  level?: string
  filiere?: string
  serie?: string
  capacity?: number
  roomAssignment?: { roomName?: string }
  mainTeacher?: { nomComplet?: string; firstName?: string; lastName?: string }
  _count?: { students?: number }
}

type Props = {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

type AcademicYearItem = {
  id: string
  name: string
  isCurrent?: boolean
  status?: string
}

export default function SectionClassesStaff({ onToast }: Props) {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [formCapacity, setFormCapacity] = useState('40')
  const [saving, setSaving] = useState(false)

  // Propose N+1 Structure Modal state
  const [proposeOpen, setProposeOpen] = useState(false)
  const [anneeActuelleId, setAnneeActuelleId] = useState('')
  const [anneeSuivanteId, setAnneeSuivanteId] = useState('')
  const [proposing, setProposing] = useState(false)

  const loadClassesAndYears = () => {
    setLoading(true)
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).catch(() => null),
    ])
      .then(([classData, ayData]) => {
        if (classData?.success) {
          setClasses(classData.data ?? [])
        } else {
          onToast(classData?.error || 'Erreur lors du chargement des classes', 'error')
        }

        if (ayData?.success && Array.isArray(ayData.data)) {
          const years: AcademicYearItem[] = ayData.data
          setAcademicYears(years)
          const current = years.find(y => y.isCurrent)
          if (current) setAnneeActuelleId(current.id)
          const next = years.find(y => !y.isCurrent && y.status !== 'ARCHIVED')
          if (next) setAnneeSuivanteId(next.id)
        }
      })
      .catch(() => onToast('Erreur réseau lors du chargement des données', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadClassesAndYears()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) {
      onToast('Le nom de la classe est obligatoire', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/classes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          level: formLevel.trim() || undefined,
          capacity: parseInt(formCapacity) || 40,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Erreur création classe')

      onToast(`Classe ${formName.trim()} créée avec succès`, 'success')
      setCreateOpen(false)
      setFormName('')
      setFormLevel('')
      setFormCapacity('40')
      loadClassesAndYears()
    } catch (err: any) {
      onToast(err.message || 'Erreur lors de la création de la classe', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!anneeActuelleId.trim() || !anneeSuivanteId.trim()) {
      onToast("Veuillez sélectionner l'année actuelle et l'année cible", 'error')
      return
    }

    setProposing(true)
    try {
      const res = await fetchApi(`/api/v2/academic-years/${encodeURIComponent(anneeActuelleId.trim())}/propose-next-structure`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anneeSuivanteId: anneeSuivanteId.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Erreur lors de la proposition de la structure')

      onToast('Structure N+1 proposée avec succès (classes DRAFT créées)', 'success')
      setProposeOpen(false)
    } catch (err: any) {
      onToast(err.message || 'Erreur lors de la proposition de la structure', 'error')
    } finally {
      setProposing(false)
    }
  }

  const filtered = classes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.level && c.level.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <School size={22} style={{ color: 'var(--amber)' }} />
            Gestion des Classes
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0' }}>
            Organisation pédagogique et effectifs des classes
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setProposeOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--fg)',
              fontWeight: 600,
              fontSize: 12,
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
            }}
          >
            <School size={16} />
            Proposer structure N+1
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--amber), #d97706)',
              color: '#000',
              fontWeight: 700,
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Nouvelle classe
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'rgba(255,255,255,0.4)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une classe..."
            style={{
              width: '100%',
              padding: '6px 12px 6px 32px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Grille / Liste des classes */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
          Chargement des classes...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px border-dashed rgba(255,255,255,0.1)' }}>
          <School size={32} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: 8 }} />
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Aucune classe trouvée</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {filtered.map(cls => (
            <div
              key={cls.id}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{cls.name}</span>
                  {cls.level && (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 700 }}>
                      {cls.level}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={12} />
                    <span>Effectif : {cls._count?.students ?? 0} {cls.capacity ? `/ ${cls.capacity}` : ''} élèves</span>
                  </div>
                  {cls.mainTeacher && (
                    <div>
                      PP : {cls.mainTeacher.nomComplet || `${cls.mainTeacher.firstName} ${cls.mainTeacher.lastName}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Créer classe */}
      {createOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', color: '#fff' }}>
              Nouvelle classe
            </h2>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  Nom de la classe (ex: 6ème A) *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="ex: 6ème A, 2nde C"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  Niveau (ex: 6eme, 2nde)
                </label>
                <input
                  type="text"
                  value={formLevel}
                  onChange={e => setFormLevel(e.target.value)}
                  placeholder="ex: 6eme"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  Capacité d'accueil
                </label>
                <input
                  type="number"
                  value={formCapacity}
                  onChange={e => setFormCapacity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontSize: 12,
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--amber)', border: 'none', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  {saving ? 'Création...' : 'Créer la classe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Proposer Structure N+1 */}
      {proposeOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: 24, width: 420, maxWidth: '90%' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px 0', color: '#fff' }}>Proposer la structure d'année N+1</h2>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 16px 0' }}>
              Duplique les classes actives de l'année actuelle vers l'année cible sous forme de classes DRAFT. La validation finale relève du Proviseur (ADMIN).
            </p>

            <form onSubmit={handlePropose} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  Année Actuelle (Source) *
                </label>
                {academicYears.length > 0 ? (
                  <select
                    value={anneeActuelleId}
                    onChange={e => setAnneeActuelleId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: '#27272a',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  >
                    <option value="">-- Sélectionner l'année source --</option>
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? '(Actuelle)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={anneeActuelleId}
                    onChange={e => setAnneeActuelleId(e.target.value)}
                    placeholder="ID de l'année actuelle"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                  Année Cible N+1 *
                </label>
                {academicYears.length > 0 ? (
                  <select
                    value={anneeSuivanteId}
                    onChange={e => setAnneeSuivanteId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: '#27272a',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  >
                    <option value="">-- Sélectionner l'année cible N+1 --</option>
                    {academicYears.map(y => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.isCurrent ? '(Actuelle)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={anneeSuivanteId}
                    onChange={e => setAnneeSuivanteId(e.target.value)}
                    placeholder="ID de l'année suivante N+1"
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setProposeOpen(false)}
                  style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, cursor: 'pointer' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={proposing}
                  style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--amber)', border: 'none', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  {proposing ? 'Envoi...' : 'Proposer la structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
