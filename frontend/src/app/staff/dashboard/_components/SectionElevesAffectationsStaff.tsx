'use client'

import { useEffect, useState } from 'react'
import { Users, ArrowRightLeft, School, Search, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

type ClassItem = {
  id: string
  name: string
  level?: string
}

type StudentItem = {
  id: string
  userId?: string
  name?: string
  firstName?: string
  lastName?: string
  matricule?: string
}

type Props = {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function SectionElevesAffectationsStaff({ onToast }: Props) {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [students, setStudents] = useState<StudentItem[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [search, setSearch] = useState('')

  // Transfer Modal state
  const [transferTarget, setTransferTarget] = useState<StudentItem | null>(null)
  const [targetClassId, setTargetClassId] = useState<string>('')
  const [transferring, setTransferring] = useState(false)

  // 1. Charger les classes
  useEffect(() => {
    setLoadingClasses(true)
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list: ClassItem[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
        setClasses(list)
        if (list.length > 0) setSelectedClassId(list[0].id)
      })
      .catch(() => onToast('Erreur réseau classes', 'error'))
      .finally(() => setLoadingClasses(false))
  }, [])

  // 2. Charger les élèves de la classe sélectionnée
  const loadStudents = (classId: string) => {
    if (!classId) return
    setLoadingStudents(true)
    fetchApi(`/api/v2/classes/${classId}/students`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const studentList = d.data ?? d ?? []
        setStudents(Array.isArray(studentList) ? studentList : [])
      })
      .catch(() => onToast('Erreur lors du chargement des élèves', 'error'))
      .finally(() => setLoadingStudents(false))
  }

  useEffect(() => {
    if (selectedClassId) loadStudents(selectedClassId)
  }, [selectedClassId])

  // 3. Effectuer le transfert
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transferTarget || !targetClassId) return
    if (targetClassId === selectedClassId) {
      onToast("L'élève est déjà dans cette classe", 'warning')
      return
    }

    const studentIdToTransfer = transferTarget.userId || transferTarget.id

    setTransferring(true)
    try {
      const res = await fetchApi(`/api/v2/users/students/${studentIdToTransfer}/transfer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newClassId: targetClassId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Erreur lors du transfert')

      const targetClassName = classes.find(c => c.id === targetClassId)?.name || 'la nouvelle classe'
      onToast(`Élève transféré vers ${targetClassName} avec succès`, 'success')

      setTransferTarget(null)
      setTargetClassId('')
      loadStudents(selectedClassId)
    } catch (err: any) {
      onToast(err.message || 'Erreur lors du transfert de l’élève', 'error')
    } finally {
      setTransferring(false)
    }
  }

  const filteredStudents = students.filter(s => {
    const fullName = s.name || `${s.firstName || ''} ${s.lastName || ''}`
    return fullName.toLowerCase().includes(search.toLowerCase()) ||
           (s.matricule && s.matricule.toLowerCase().includes(search.toLowerCase()))
  })

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-spectral),Spectral,serif' }}>
          <Users size={20} style={{ color: 'var(--amber)' }} />
          Affectations & Transferts d'Élèves
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: '3px 0 0 0' }}>
          Consultation des élèves par classe et changement de classe (Censeur / Vice-Principal)
        </p>
      </div>

      {/* Selecteur de classe + Barre de recherche */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <School size={15} style={{ color: 'var(--text3)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Classe :</span>
          <select
            value={selectedClassId}
            onChange={e => setSelectedClassId(e.target.value)}
            disabled={loadingClasses}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 700,
              outline: 'none',
              minWidth: 150,
            }}
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.level ? `(${c.level})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: 8, color: 'var(--text3)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un élève..."
            style={{
              width: '100%',
              padding: '5px 10px 5px 28px',
              borderRadius: 8,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Liste des élèves */}
      {loadingStudents ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
          <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 6px' }} />
          Chargement de la liste des élèves...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: 'var(--surface)', borderRadius: 10, border: '1px dashed var(--border)' }}>
          <Users size={28} style={{ color: 'var(--text3)', marginBottom: 6 }} />
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text3)' }}>Aucun élève dans cette classe</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: 'var(--text)' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)' }}>Nom & Prénom</th>
                <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)' }}>Matricule</th>
                <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--text3)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((st, idx) => {
                const displayName = st.name || `${st.firstName || ''} ${st.lastName || ''}`.trim() || 'Élève'
                return (
                  <tr key={st.id || idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{displayName}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>{st.matricule || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setTransferTarget(st)
                          const otherClass = classes.find(c => c.id !== selectedClassId)
                          setTargetClassId(otherClass ? otherClass.id : '')
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'rgba(245,158,11,0.12)',
                          border: '1px solid rgba(245,158,11,0.25)',
                          color: 'var(--amber)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <ArrowRightLeft size={11} />
                        Changer de classe
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de transfert */}
      {transferTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text)' }}>
              Transfert d'élève
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>
              Transférer <strong>{transferTarget.name || `${transferTarget.firstName || ''} ${transferTarget.lastName || ''}`}</strong> vers une autre classe :
            </p>

            <form onSubmit={handleTransfer} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                  Classe de destination *
                </label>
                <select
                  required
                  value={targetClassId}
                  onChange={e => setTargetClassId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                     background: 'var(--bg2)',
                     border: '1px solid var(--border2)',
                     color: 'var(--text)',

                    fontSize: 12,
                  }}
                >
                  {classes
                    .filter(c => c.id !== selectedClassId)
                    .map(c => (
                       <option key={c.id} value={c.id} style={{ background: 'var(--surface)', color: 'var(--text)' }}>

                        {c.name} {c.level ? `(${c.level})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setTransferTarget(null)}
                   style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}

                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={transferring || !targetClassId}
                  style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--amber)', border: 'none', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                >
                  {transferring ? 'Transfert...' : 'Confirmer le transfert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
