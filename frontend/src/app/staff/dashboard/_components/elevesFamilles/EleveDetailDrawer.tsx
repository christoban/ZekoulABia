'use client'

import {
  ArrowRight, Camera, Download, FileText, IdCard, Printer, ShieldCheck, X,
} from 'lucide-react'
import {
  openStudentDocument,
  StudentProfileBadge,
  type StudentItem,
} from './elevesFamillesUtils'

interface Props {
  student: StudentItem
  onClose: () => void
  onOpenPhotoStudio: (s: StudentItem) => void
}

export default function EleveDetailDrawer({ student, onClose, onOpenPhotoStudio }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[var(--surface)] h-full shadow-2xl flex flex-col border-l border-[var(--border)] overflow-hidden">
        {/* Header Drawer */}
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg)]/50">
          <div className="flex items-center gap-3">
            <div
              onClick={() => onOpenPhotoStudio(student)}
              className="w-12 h-14 rounded-lg border overflow-hidden shrink-0 flex items-center justify-center relative group shadow-xs cursor-pointer"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              title="Modifier la photo d'identité officielle"
            >
              {student.photoUrl ? (
                <img src={student.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera size={18} className="text-amber-500" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                <Camera size={14} />
              </div>
            </div>
            <div>
              <h2 className="text-base font-black text-[var(--text)] leading-tight">{student.name}</h2>
              <p className="text-xs text-[var(--text3)] font-mono">{student.matricule} · {student.className}</p>
              <button
                onClick={() => onOpenPhotoStudio(student)}
                className="text-[11px] font-bold text-[var(--blue)] border-0 bg-transparent p-0 cursor-pointer hover:underline mt-0.5 inline-flex items-center gap-1"
              >
                <Camera size={11} /> {student.photoUrl ? 'Modifier photo officielle' : 'Prendre photo d\'identité'}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
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
              <StudentProfileBadge profile={student.accessProfile} />
            </div>
            <p className="text-xs text-[var(--text2)] leading-relaxed">
              {student.accessProfile === 'AUTONOME' && 'Le parent utilise l’application mobile ou le portail web avec son e-mail.'}
              {student.accessProfile === 'ASSISTE' && 'Le parent a un smartphone mais privilégie le guichet de l’école pour les démarches.'}
              {student.accessProfile === 'SMS_SEUL' && 'Le parent ne possède pas de connexion Internet ; communications reçues par SMS.'}
              {student.accessProfile === 'NON_CONNECTE' && 'Aucun contact numérique renseigné. Fiches papier obligatoires.'}
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
                <div className="font-semibold text-[var(--text)]">{student.parentName}</div>
              </div>
              <div>
                <span className="text-[var(--text3)]">Téléphone :</span>
                <div className="font-semibold text-[var(--text)]">{student.parentPhone || '—'}</div>
              </div>
              {student.parentEmail && (
                <div className="col-span-2">
                  <span className="text-[var(--text3)]">E-mail :</span>
                  <div className="font-semibold text-[var(--text)]">{student.parentEmail}</div>
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
                onClick={() => openStudentDocument('certificat', student)}
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
                onClick={() => openStudentDocument('carte', student)}
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
                onClick={() => openStudentDocument('fiche', student)}
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
                onClick={() => openStudentDocument('transfert', student)}
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
  )
}
