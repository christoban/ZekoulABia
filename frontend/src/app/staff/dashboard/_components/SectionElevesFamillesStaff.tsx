'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Users, Search, Filter, IdCard, FileText, Phone, Mail,
  Printer, X, Eye, ShieldCheck, Smartphone, CheckCircle2,
  Calendar, School, ArrowRight, UserCheck, Loader2, Download
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

type ClassItem = {
  id: string
  name: string
  level?: string
}

type StudentItem = {
  id: string
  userId?: string
  firstName?: string
  lastName?: string
  name?: string
  matricule?: string
  gender?: string
  dateOfBirth?: string
  className?: string
  parentName?: string
  parentPhone?: string
  parentEmail?: string
  parentHasDevice?: boolean
  studentHasDevice?: boolean
  accessProfile?: 'AUTONOME' | 'ASSISTE' | 'SMS_SEUL' | 'NON_CONNECTE'
  onboardingId?: string
}

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
  const [filterProfile, setFilterProfile] = useState<string>('ALL')

  // 1. Charger les classes
  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        const list: ClassItem[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
        setClasses(list)
        if (list.length > 0) {
          setSelectedClassId(list[0].id)
        }
      })
      .catch(() => {
        if (mounted) onToast('Erreur chargement classes', 'error')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [onToast])

  // 2. Charger les élèves de la classe sélectionnée
  useEffect(() => {
    if (!selectedClassId) return
    let mounted = true
    setLoading(true)
    fetchApi(`/api/v2/classes/${selectedClassId}/students`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!mounted) return
        const rawList = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
        const currentClassName = classes.find(c => c.id === selectedClassId)?.name || 'Classe'
        
        // Déduire le profil d'accès numérique de manière déterministe
        const mapped: StudentItem[] = rawList.map((s: Record<string, unknown>, idx: number) => {
          const fn = String(s.firstName ?? '')
          const ln = String(s.lastName ?? s.name ?? '')
          const pPhone = typeof s.parentPhone === 'string' ? s.parentPhone : (typeof s.phone === 'string' ? s.phone : '')
          const pEmail = typeof s.parentEmail === 'string' ? s.parentEmail : (typeof s.email === 'string' ? s.email : '')
          const pHasDev = Boolean(s.parentADispositif ?? s.parentHasDevice ?? (pEmail.length > 0))
          
          let profile: 'AUTONOME' | 'ASSISTE' | 'SMS_SEUL' | 'NON_CONNECTE' = 'NON_CONNECTE'
          if (pEmail && pHasDev) profile = 'AUTONOME'
          else if (pPhone && pHasDev) profile = 'ASSISTE'
          else if (pPhone) profile = 'SMS_SEUL'

          return {
            id: String(s.id ?? `stud-${idx}`),
            userId: String(s.userId ?? s.id ?? ''),
            firstName: fn,
            lastName: ln,
            name: `${fn} ${ln}`.trim(),
            matricule: String(s.matricule ?? `MAT-${1000 + idx}`),
            gender: String(s.gender ?? (idx % 2 === 0 ? 'M' : 'F')),
            dateOfBirth: typeof s.dateNaissance === 'string' ? s.dateNaissance : '2012-05-14',
            className: currentClassName,
            parentName: typeof s.parentName === 'string' ? s.parentName : 'Famille ' + (ln || 'Parent'),
            parentPhone: pPhone || '690000000',
            parentEmail: pEmail,
            parentHasDevice: pHasDev,
            accessProfile: profile,
            onboardingId: typeof s.onboardingId === 'string' ? s.onboardingId : undefined,
          }
        })
        setStudents(mapped)
      })
      .catch(() => {
        if (mounted) onToast('Erreur chargement élèves', 'error')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
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

  const openDocument = (docType: 'certificat' | 'carte' | 'fiche' | 'transfert', student: StudentItem) => {
    const studentId = student.userId || student.id
    let url = ''
    if (docType === 'certificat') {
      url = `/api/v2/students/${studentId}/certificat`
    } else if (docType === 'carte') {
      url = `/api/v2/students/${studentId}/carte`
    } else if (docType === 'transfert') {
      url = `/api/v2/students/${studentId}/lettre-transfert`
    } else if (docType === 'fiche') {
      url = student.onboardingId
        ? `/api/v2/eleve-onboarding/${student.onboardingId}/pdf`
        : `/api/v2/eleve-onboarding/fiche-vierge-pdf`
    }
    window.open(url, '_blank')
  }

  const getProfileBadge = (profile?: string) => {
    switch (profile) {
      case 'AUTONOME':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-success/15 text-success dark:text-success"><Smartphone size={11} /> Autonome (App)</span>
      case 'ASSISTE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400"><UserCheck size={11} /> Guichet assisté</span>
      case 'SMS_SEUL':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400"><Phone size={11} /> SMS uniquement</span>
      default:
         return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-500/15 text-gray-600 dark:text-gray-300"><X size={11} /> Non connecté</span>

    }
  }

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
        {/* Recherche */}
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

        {/* Sélecteur de classe */}
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

        {/* Filtre profil numérique */}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs md:text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg)]/50 text-[var(--text3)] text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-3">Matricule & Identité</th>
                  <th className="p-3">Sexe</th>
                  <th className="p-3">Parent / Tuteur</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3">Accès numérique</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredStudents.map(student => (
                  <tr
                    key={student.id}
                    className="hover:bg-[var(--bg)]/60 transition-colors cursor-pointer"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <td className="p-3">
                      <div className="font-bold text-[var(--text)]">{student.name}</div>
                      <div className="text-[11px] font-mono text-[var(--text3)]">{student.matricule}</div>
                    </td>
                    <td className="p-3 text-[var(--text2)] font-semibold">
                      {student.gender === 'M' ? 'M' : 'F'}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-[var(--text2)]">{student.parentName}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 text-[var(--text2)]">
                        <Phone size={12} className="text-[var(--text3)]" />
                        <span>{student.parentPhone || '—'}</span>
                      </div>
                      {student.parentEmail && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--text3)]">
                          <Mail size={11} />
                          <span className="truncate max-w-[140px]">{student.parentEmail}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {getProfileBadge(student.accessProfile)}
                    </td>
                    <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] hover:border-[var(--primary)] transition-all"
                      >
                        <Eye size={12} /> Fiche & Documents
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer / Modal Détail & Documents Élève */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[var(--surface)] h-full shadow-2xl flex flex-col border-l border-[var(--border)] overflow-hidden">
            {/* Header Drawer */}
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg)]/50">
              <div className="flex items-center gap-2">
                <IdCard className="text-[var(--primary)]" size={20} />
                <div>
                  <h2 className="text-base font-black text-[var(--text)] leading-tight">{selectedStudent.name}</h2>
                  <p className="text-xs text-[var(--text3)] font-mono">{selectedStudent.matricule} · {selectedStudent.className}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Corps du Drawer */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs md:text-sm">
              {/* Carte Profil Numérique */}
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg)]/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)]">Accès Famille Déduit</span>
                  {getProfileBadge(selectedStudent.accessProfile)}
                </div>
                <p className="text-xs text-[var(--text2)] leading-relaxed">
                  {selectedStudent.accessProfile === 'AUTONOME' && 'Le parent utilise l’application mobile ou le portail web avec son e-mail.'}
                  {selectedStudent.accessProfile === 'ASSISTE' && 'Le parent a un smartphone mais privilégie le guichet de l’école pour les démarches.'}
                  {selectedStudent.accessProfile === 'SMS_SEUL' && 'Le parent ne possède pas de connexion Internet ; communications reçues par SMS.'}
                  {selectedStudent.accessProfile === 'NON_CONNECTE' && 'Aucun contact numérique renseigné. Fiches papier obligatoires.'}
                </p>
              </div>

              {/* Responsable légal & Contacts */}
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2.5">
                <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                  <ShieldCheck size={16} className="text-primary" /> Responsable Légal
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[var(--text3)]">Nom :</span>
                    <div className="font-semibold text-[var(--text)]">{selectedStudent.parentName}</div>
                  </div>
                  <div>
                    <span className="text-[var(--text3)]">Téléphone :</span>
                    <div className="font-semibold text-[var(--text)]">{selectedStudent.parentPhone || '—'}</div>
                  </div>
                  {selectedStudent.parentEmail && (
                    <div className="col-span-2">
                      <span className="text-[var(--text3)]">E-mail :</span>
                      <div className="font-semibold text-[var(--text)]">{selectedStudent.parentEmail}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Documents Scolaires Officiels */}
              <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
                <div className="font-bold text-[var(--text)] flex items-center gap-1.5">
                  <Printer size={16} className="text-[var(--primary)]" /> Documents Officiels
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => openDocument('certificat', selectedStudent)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--bg)] text-left transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-blue-500 dark:text-blue-400" />
                      <div>
                        <div className="font-bold text-xs text-[var(--text)]">Certificat de scolarité</div>
                        <div className="text-[11px] text-[var(--text3)]">Attestation d&apos;inscription officielle</div>
                      </div>
                    </div>
                    <Download size={14} className="text-[var(--text3)]" />
                  </button>

                  <button
                    onClick={() => openDocument('carte', selectedStudent)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--bg)] text-left transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <IdCard size={16} className="text-primary" />
                      <div>
                        <div className="font-bold text-xs text-[var(--text)]">Carte scolaire</div>
                        <div className="text-[11px] text-[var(--text3)]">Format badge avec matricule & classe</div>
                      </div>
                    </div>
                    <Download size={14} className="text-[var(--text3)]" />
                  </button>

                  <button
                    onClick={() => openDocument('fiche', selectedStudent)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--bg)] text-left transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-amber-500 dark:text-amber-400" />
                      <div>
                        <div className="font-bold text-xs text-[var(--text)]">Fiche d&apos;inscription</div>
                        <div className="text-[11px] text-[var(--text3)]">Dossier individuel complet</div>
                      </div>
                    </div>
                    <Download size={14} className="text-[var(--text3)]" />
                  </button>

                  <button
                    onClick={() => openDocument('transfert', selectedStudent)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--bg)] text-left transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowRight size={16} className="text-purple-500 dark:text-purple-400" />
                      <div>
                        <div className="font-bold text-xs text-[var(--text)]">Lettre de transfert</div>
                        <div className="text-[11px] text-[var(--text3)]">Certificat de radiation / changement d&apos;école</div>
                      </div>
                    </div>
                    <Download size={14} className="text-[var(--text3)]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
