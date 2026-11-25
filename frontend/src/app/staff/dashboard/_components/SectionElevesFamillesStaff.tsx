'use client'

import { useState, useEffect, useMemo } from 'react'
import { Users, Search, Filter, Printer, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import StudentPhotoStudioModal from './StudentPhotoStudioModal'
import {
  mapDirectoryStudents,
  mapLegacyStudents,
  type ClassItem,
  type StudentItem,
} from './elevesFamilles/elevesFamillesUtils'
import ElevesMobileList from './elevesFamilles/ElevesMobileList'
import ElevesDesktopTable from './elevesFamilles/ElevesDesktopTable'
import EleveDetailDrawer from './elevesFamilles/EleveDetailDrawer'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export default function SectionElevesFamillesStaff({ onToast }: Props) {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [students, setStudents] = useState<StudentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null)
  const [photoStudioStudent, setPhotoStudioStudent] = useState<StudentItem | null>(null)
  const [filterProfile, setFilterProfile] = useState<string>('ALL')

  // 1. Charger les classes avec cache Dexie offline-first
  useEffect(() => {
    let mounted = true
    setLoading(true)

    const loadClasses = async () => {
      const cached = await getCachedData<ClassItem[]>('staff:classes')
      if (mounted && cached?.data && cached.data.length > 0) {
        setClasses(cached.data)
        setSelectedClassId(prev => prev || cached.data[0].id)
        setLoading(false)
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (mounted) setLoading(false)
        return
      }

      try {
        const r = await fetchApi('/api/v2/classes', { credentials: 'include' })
        const d = await r.json()
        if (!mounted) return
        const list: ClassItem[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
        if (list.length > 0) {
          setClasses(list)
          await putCachedData('staff:classes', list)
          await putCachedData('staff:classes:list', list)
          setSelectedClassId(prev => prev || list[0].id)
        }
      } catch {
        if (!cached?.data || cached.data.length === 0) {
          if (mounted) onToast('Erreur chargement classes', 'error')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadClasses()
    return () => { mounted = false }
  }, [onToast])

  // 2. Charger les élèves de la classe sélectionnée via l'annuaire complet avec cache Dexie offline-first
  useEffect(() => {
    if (!selectedClassId) return
    let mounted = true
    setLoading(true)

    const loadStudents = async () => {
      const cacheKey = `staff:students-directory:${selectedClassId}`
      const cached = await getCachedData<StudentItem[]>(cacheKey)
      if (mounted && cached?.data && cached.data.length > 0) {
        setStudents(cached.data)
        setLoading(false)
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (mounted) setLoading(false)
        return
      }

      const currentClassName = classes.find(c => c.id === selectedClassId)?.name || 'Classe'
      try {
        const r = await fetchApi(`/api/v2/classes/${selectedClassId}/students-directory`, { credentials: 'include' })
        const d = await r.json()
        if (!mounted) return
        const rawList = Array.isArray(d?.data) ? d.data : []
        const mapped = mapDirectoryStudents(rawList, currentClassName)
        setStudents(mapped)
        await putCachedData(cacheKey, mapped)
      } catch {
        // Fallback gracieux sur l'ancienne route
        try {
          const r2 = await fetchApi(`/api/v2/classes/${selectedClassId}/students`, { credentials: 'include' })
          const d2 = await r2.json()
          if (!mounted) return
          const rawList = Array.isArray(d2?.data) ? d2.data : []
          const mappedLegacy = mapLegacyStudents(rawList, currentClassName)
          setStudents(mappedLegacy)
          await putCachedData(cacheKey, mappedLegacy)
        } catch {
          if (!cached?.data || cached.data.length === 0) {
            if (mounted) onToast('Erreur chargement élèves', 'error')
          }
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadStudents()
    return () => { mounted = false }
  }, [selectedClassId, classes, onToast])

  // Filtrage combiné recherche + profil d'accès
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = search.trim().toLowerCase()
      const matchSearch = !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.matricule && s.matricule.toLowerCase().includes(q)) ||
        (s.parentPhone && s.parentPhone.includes(q)) ||
        (s.parentName && s.parentName.toLowerCase().includes(q))

      const matchProfile = filterProfile === 'ALL' || s.accessProfile === filterProfile
      return matchSearch && matchProfile
    })
  }, [students, search, filterProfile])

  return (
    <div className="h-full overflow-y-auto w-full">
      <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto pb-20">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-[var(--text)] flex items-center gap-2">
              <Users className="text-[var(--primary)]" size={24} />
              Élèves & familles
            </h1>
            <p className="text-xs md:text-sm text-[var(--text3)]">
              Consultation des effectifs inscrits, coordonnées parentales, profils d&apos;accès et documents scolaires officiels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open('/api/v2/eleve-onboarding/fiche-vierge-pdf', '_blank')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] hover:border-[var(--primary)] transition-all"
            >
              <Printer size={14} /> Fiche vierge PDF
            </button>
          </div>
        </div>

        {/* Barre de filtres */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="sm:col-span-5 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, matricule ou tél parent..."
              className="w-full pl-9 pr-3 py-1.5 text-xs md:text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <Filter size={15} className="text-[var(--text3)] flex-shrink-0" />
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full py-1.5 px-2 text-xs md:text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} {c.level ? `(${c.level})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={filterProfile}
              onChange={e => setFilterProfile(e.target.value)}
              className="w-full py-1.5 px-2 text-xs md:text-sm rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              <option value="ALL">Tous les accès</option>
              <option value="AUTONOME">Autonome (App)</option>
              <option value="ASSISTE">Guichet assisté</option>
              <option value="SMS_SEUL">SMS uniquement</option>
              <option value="NON_CONNECTE">Non connecté</option>
            </select>
          </div>
        </div>

        {/* Tableau des élèves */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-[var(--text3)]">
              <Loader2 className="animate-spin mb-2" size={28} />
              <p className="text-xs font-semibold">Chargement des élèves...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center p-12 text-[var(--text3)]">
              <Users size={36} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold text-[var(--text)]">Aucun élève trouvé</p>
              <p className="text-xs mt-1">Modifiez vos critères de recherche ou sélectionnez une autre classe.</p>
            </div>
          ) : (
            <>
              <ElevesMobileList
                students={filteredStudents}
                onSelectStudent={setSelectedStudent}
                onOpenPhotoStudio={setPhotoStudioStudent}
              />
              <ElevesDesktopTable
                students={filteredStudents}
                onSelectStudent={setSelectedStudent}
                onOpenPhotoStudio={setPhotoStudioStudent}
              />
            </>
          )}
        </div>

        {selectedStudent && (
          <EleveDetailDrawer
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
            onOpenPhotoStudio={setPhotoStudioStudent}
          />
        )}

        {photoStudioStudent && (
          <StudentPhotoStudioModal
            student={photoStudioStudent}
            onClose={() => setPhotoStudioStudent(null)}
            onSuccess={(newPhotoUrl) => {
              setStudents(prev => prev.map(s => s.id === photoStudioStudent.id ? { ...s, photoUrl: newPhotoUrl } : s))
              if (selectedStudent && selectedStudent.id === photoStudioStudent.id) {
                setSelectedStudent(prev => prev ? { ...prev, photoUrl: newPhotoUrl } : null)
              }
            }}
            onToast={onToast}
          />
        )}
      </div>
    </div>
  )
}
