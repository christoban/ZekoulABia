'use client'

import {
  FileText, Award, AlertTriangle, Clock, ArrowRight,
  UserCheck, Users, Mail, Printer, MessageCircle, AlertCircle,
} from 'lucide-react'
import type { StaffSection } from '../../_types'
import type { AdmissionsSummary } from './staffDashboardTypes'

interface Props {
  admissions: AdmissionsSummary
  onNav: (s: StaffSection) => void
}

export default function StaffSecretarySection({ admissions, onNav }: Props) {
  return (
    <div className="space-y-4">
      {/* Bandeau Événement en cours */}
      {admissions.activeEvent ? (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 flex items-center justify-center flex-shrink-0">
              <Award size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm md:text-base text-[var(--text)]">{admissions.activeEvent.title}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  Phase : {admissions.activeEvent.phase}
                </span>
              </div>
              <p className="text-xs text-[var(--text3)] mt-0.5">
                {admissions.activeEvent.candidatsCount} candidats inscrits sur {admissions.activeEvent.placesCount} places ouvertes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNav('concours')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--primary)] text-white hover:opacity-95 transition-all"
            >
              Ouvrir le concours
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex items-center justify-between text-xs text-[var(--text3)]">
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span>Aucune session de concours actif. Prochaine étape : Inscriptions annuelles ordinaires.</span>
          </div>
          <button onClick={() => onNav('inscriptions')} className="font-bold text-[var(--primary)] hover:underline">
            Voir les dossiers &rarr;
          </button>
        </div>
      )}

      {/* 5 Cartes d'action Inscriptions */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
        <div
          onClick={() => onNav('inscriptions')}
          className="p-3 rounded-xl border border-orange-500/40 bg-orange-500/10 cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-orange-600 dark:text-orange-400 mb-1">
            <span className="text-xs font-extrabold">À compléter</span>
            <AlertTriangle size={15} />
          </div>
          <div className="text-2xl font-black text-orange-600 dark:text-orange-400">{admissions.aCompleter}</div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">Renvoyés par la direction</div>
        </div>

        <div
          onClick={() => onNav('concours')}
          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-success mb-1">
            <span className="text-xs font-bold">Admis à finaliser</span>
            <UserCheck size={15} />
          </div>
          <div className="text-2xl font-black text-[var(--text)]">{admissions.admisAFinaliser}</div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">Issus du concours</div>
        </div>

        <div
          onClick={() => onNav('inscriptions')}
          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-1">
            <span className="text-xs font-bold">Brouillons</span>
            <FileText size={15} />
          </div>
          <div className="text-2xl font-black text-[var(--text)]">{admissions.brouillons}</div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">Saisie guichet en cours</div>
        </div>

        <div
          onClick={() => onNav('inscriptions')}
          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-1">
            <span className="text-xs font-bold">Chez la famille</span>
            <Mail size={15} />
          </div>
          <div className="text-2xl font-black text-[var(--text)]">{admissions.chezLaFamille}</div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">Liens envoyés aux parents</div>
        </div>

        <div
          onClick={() => onNav('inscriptions')}
          className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-1">
            <span className="text-xs font-bold">En attente</span>
            <Clock size={15} />
          </div>
          <div className="text-2xl font-black text-[var(--text)]">{admissions.enAttenteDirection}</div>
          <div className="text-[11px] text-[var(--text3)] mt-1 leading-tight">À valider par la direction</div>
        </div>
      </div>

      {/* 2 Colonnes: À faire maintenant (2/3) + Raccourcis Rapides (1/3) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
        <div className="md:col-span-8 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-orange-500 dark:text-orange-400" />
              <span className="font-extrabold text-sm text-[var(--text)]">À faire maintenant</span>
            </div>
            <span className="text-[11px] text-[var(--text3)] font-semibold">Priorités de la journée</span>
          </div>

          <div className="space-y-2">
            {admissions.aCompleter > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-orange-500/20 bg-orange-500/5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500 dark:bg-orange-400" />
                  <span className="font-semibold text-[var(--text)]">
                    {admissions.aCompleter} dossier{admissions.aCompleter > 1 ? 's' : ''} renvoyé{admissions.aCompleter > 1 ? 's' : ''} par la direction requièrent des compléments
                  </span>
                </div>
                <button onClick={() => onNav('inscriptions')} className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
                  Examiner &rarr;
                </button>
              </div>
            )}

            {admissions.chezLaFamille > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400" />
                  <span className="text-[var(--text2)]">
                    {admissions.chezLaFamille} dossier{admissions.chezLaFamille > 1 ? 's' : ''} chez les familles en cours de complétion
                  </span>
                </div>
                <button onClick={() => onNav('inscriptions')} className="font-bold text-[var(--primary)] hover:underline">
                  Relancer &rarr;
                </button>
              </div>
            )}

            {admissions.enAttenteDirection > 0 && (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
                  <span className="text-[var(--text2)]">
                    {admissions.enAttenteDirection} dossier{admissions.enAttenteDirection > 1 ? 's' : ''} soumis en attente d&apos;approbation
                  </span>
                </div>
                <button onClick={() => onNav('inscriptions')} className="font-bold text-[var(--primary)] hover:underline">
                  Examiner &rarr;
                </button>
              </div>
            )}

            {admissions.aCompleter === 0 && admissions.chezLaFamille === 0 && admissions.enAttenteDirection === 0 && (
              <div className="p-3 text-center text-xs text-[var(--text3)]">
                Aucun dossier en attente de traitement prioritaire.
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
          <span className="font-extrabold text-sm text-[var(--text)] block pb-2 border-b border-[var(--border)]">
            Raccourcis Secrétariat
          </span>
          <div className="space-y-1.5 text-xs font-semibold">
            <button
              onClick={() => onNav('inscriptions')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><FileText size={14} className="text-blue-500 dark:text-blue-400" /> Nouveau dossier</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
            <button
              onClick={() => onNav('eleves-familles')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><Users size={14} className="text-primary" /> Élèves & familles</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
            <button
              onClick={() => window.open('/api/v2/eleve-onboarding/fiche-vierge-pdf', '_blank')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><Printer size={14} className="text-amber-500 dark:text-amber-400" /> Fiche vierge PDF</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
            <button
              onClick={() => onNav('messagerie')}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-[var(--border)] bg-[var(--bg)]/40 hover:border-[var(--primary)] transition-all"
            >
              <span className="flex items-center gap-2"><MessageCircle size={14} className="text-purple-500 dark:text-purple-400" /> Messagerie</span>
              <ArrowRight size={13} className="text-[var(--text3)]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
