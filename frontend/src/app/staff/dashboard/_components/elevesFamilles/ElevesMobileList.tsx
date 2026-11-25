'use client'

import { Camera, Eye, Mail, Phone } from 'lucide-react'
import { StudentProfileBadge, type StudentItem } from './elevesFamillesUtils'

interface Props {
  students: StudentItem[]
  onSelectStudent: (s: StudentItem) => void
  onOpenPhotoStudio: (s: StudentItem) => void
}

export default function ElevesMobileList({ students, onSelectStudent, onOpenPhotoStudio }: Props) {
  return (
    <div className="md:hidden divide-y divide-[var(--border)]">
      {students.map(student => (
        <div
          key={student.id}
          className="p-3.5 space-y-2.5 cursor-pointer hover:bg-[var(--bg)]/50 transition-colors"
          onClick={() => onSelectStudent(student)}
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenPhotoStudio(student)
                }}
                className="w-10 h-12 rounded-lg border overflow-hidden shrink-0 flex items-center justify-center relative group shadow-xs cursor-pointer"
                style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
                title="Cliquer pour capturer/modifier la photo officielle"
              >
                {student.photoUrl ? (
                  <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[9px] font-bold text-[var(--text3)]">
                    <Camera size={14} className="mb-0.5 text-amber-500" />
                    <span>Sans</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                  <Camera size={12} />
                </div>
              </div>

              <div className="min-w-0">
                <div className="font-bold text-sm text-[var(--text)] truncate">{student.name}</div>
                <div className="text-xs font-mono text-[var(--text3)] mt-0.5">{student.matricule} · Sexe : {student.gender === 'M' ? 'M' : 'F'}</div>
              </div>
            </div>
            <StudentProfileBadge profile={student.accessProfile} />
          </div>

          <div className="text-xs space-y-1 bg-[var(--bg)]/50 p-2.5 rounded-lg border border-[var(--border)]">
            <div className="text-[var(--text2)] font-semibold">
              Parent : <strong>{student.parentName || 'Non renseigné'}</strong>
            </div>
            {student.parentPhone && (
              <div className="flex items-center gap-2 pt-0.5" onClick={e => e.stopPropagation()}>
                <Phone size={12} className="text-[var(--primary)]" />
                <a href={`tel:${student.parentPhone}`} className="text-[var(--primary)] font-bold hover:underline">
                  {student.parentPhone}
                </a>
              </div>
            )}
            {student.parentEmail && (
              <div className="flex items-center gap-1.5 text-[var(--text3)] text-[11px]">
                <Mail size={11} />
                <span className="truncate">{student.parentEmail}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onOpenPhotoStudio(student)}
              className="min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--blue)] transition-all"
            >
              <Camera size={13} className="text-[var(--blue)]" /> Photo
            </button>
            <button
              onClick={() => onSelectStudent(student)}
              className="min-h-[38px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border border-[var(--border)] bg-[var(--surface)] text-[var(--primary)] hover:border-[var(--primary)] transition-all"
            >
              <Eye size={13} /> Documents
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
