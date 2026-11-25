'use client'

import { Camera, Eye, Mail, Phone } from 'lucide-react'
import { StudentProfileBadge, type StudentItem } from './elevesFamillesUtils'

interface Props {
  students: StudentItem[]
  onSelectStudent: (s: StudentItem) => void
  onOpenPhotoStudio: (s: StudentItem) => void
}

export default function ElevesDesktopTable({ students, onSelectStudent, onOpenPhotoStudio }: Props) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-left text-xs md:text-sm border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg)]/50 text-[var(--text3)] text-[11px] font-bold uppercase tracking-wider">
            <th className="p-3 w-12">Photo</th>
            <th className="p-3">Matricule & Identité</th>
            <th className="p-3">Sexe</th>
            <th className="p-3">Parent / Tuteur</th>
            <th className="p-3">Contact</th>
            <th className="p-3">Accès numérique</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {students.map(student => (
            <tr
              key={student.id}
              className="hover:bg-[var(--bg)]/60 transition-colors cursor-pointer"
              onClick={() => onSelectStudent(student)}
            >
              <td className="p-3" onClick={e => e.stopPropagation()}>
                <div
                  onClick={() => onOpenPhotoStudio(student)}
                  className="w-8 h-10 rounded-md border overflow-hidden shrink-0 flex items-center justify-center relative group shadow-2xs cursor-pointer"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                  title={student.photoUrl ? 'Cliquer pour modifier la photo' : 'Aucune photo - Cliquer pour prendre une photo'}
                >
                  {student.photoUrl ? (
                    <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={14} className="text-amber-500 opacity-80 group-hover:scale-110 transition-transform" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                    <Camera size={11} />
                  </div>
                </div>
              </td>
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
                <StudentProfileBadge profile={student.accessProfile} />
              </td>
              <td className="p-3 text-right" onClick={e => e.stopPropagation()}>
                <div className="inline-flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenPhotoStudio(student)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text2)] hover:text-[var(--text)] hover:border-[var(--blue)] transition-all"
                    title="Ouvrir le studio photo pour cet élève"
                  >
                    <Camera size={12} className="text-[var(--blue)]" />
                    <span>Photo</span>
                  </button>
                  <button
                    onClick={() => onSelectStudent(student)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] hover:border-[var(--primary)] transition-all"
                  >
                    <Eye size={12} />
                    <span>Fiche</span>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
