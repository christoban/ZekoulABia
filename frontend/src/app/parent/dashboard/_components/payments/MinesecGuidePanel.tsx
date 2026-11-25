'use client'

import {
  Book,
  Smartphone,
  CreditCard,
  Search,
  CheckCircle2,
  FileText,
  ExternalLink,
  Copy,
  Phone,
  Info,
} from 'lucide-react'
import type { Toast } from '../../_types'
import { isExamClass, getExamLabel } from '@/lib/academicExamDetector'
import type { Child } from './types'

interface Props {
  isPrivate: boolean
  childrenList: Child[]
  examChildren: Child[]
  guideOpen: boolean
  onToggleGuide: () => void
  onToast: (msg: string, type?: Toast['type']) => void
}

export default function MinesecGuidePanel({
  isPrivate,
  childrenList,
  examChildren,
  guideOpen,
  onToggleGuide,
  onToast,
}: Props) {
  const handleCopy = (text: string, label: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    onToast(`${label} copié dans le presse-papier`, 'info')
  }

  return (
    <div style={{ background: 'var(--blue-light)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 12, padding: '14px 16px' }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-start sm:items-center gap-2.5">
          <Book size={20} style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--blue)' }}>
              {isPrivate
                ? "Guide Officiel MINESEC : Frais d'Examens d'État (cartescolaire.cm)"
                : "Paiements Réglementaires MINESEC (Inscriptions & Examens d'État)"}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--blue)', marginTop: 2 }}>
              {isPrivate ? (
                <>
                  Établissement privé : Paiement obligatoire pour les examens d&apos;État (
                  {examChildren.map((c) => `${c.prenom} - ${getExamLabel(c.classeNom)}`).join(', ')})
                </>
              ) : (
                "Conformément aux directives ministérielles, les frais d'inscription et d'examens publics s'effectuent via le guichet unique national."
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onToggleGuide}
          className="h-8 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer self-start sm:self-auto shrink-0"
          style={{ background: 'var(--surface)', color: 'var(--blue)', borderColor: 'var(--blue)' }}
        >
          {guideOpen ? 'Masquer la procédure' : 'Voir la procédure détaillée'}
        </button>
      </div>

      {guideOpen && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(37,99,235,0.2)', fontSize: 12, color: 'var(--text)', lineHeight: 1.6 }} className="space-y-4">
          {/* 1. Identification des enfants concernés et matricules */}
          <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text3)] mb-2 flex items-center gap-1.5">
              <FileText size={12} /> Enfants & Matricules Nationaux nécessaires pour le guichet MINESEC
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {(isPrivate ? examChildren : childrenList).map((c) => (
                <div key={c.studentId} className="flex items-center justify-between p-2 rounded-md bg-[var(--bg2)] border border-[var(--border)]">
                  <div>
                    <span className="font-bold text-[var(--text)]">{c.prenom} {c.nom}</span>
                    <span className="text-[11px] text-[var(--text3)] block">{c.classeNom || 'Classe standard'} {isExamClass(c.classeNom) ? `· ${getExamLabel(c.classeNom)}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[var(--primary)] text-[11.5px] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)]">
                      {c.matricule || 'Matricule école'}
                    </span>
                    {c.matricule && (
                      <button
                        type="button"
                        onClick={() => handleCopy(c.matricule!, 'Matricule')}
                        title="Copier le matricule"
                        className="p-1 rounded hover:bg-[var(--surface)] text-[var(--text3)] hover:text-[var(--text)] cursor-pointer border-0 bg-transparent"
                      >
                        <Copy size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Procédures pas-à-pas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Méthode A : En ligne sur cartescolaire.cm */}
            <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
              <div>
                <div className="font-bold text-xs text-[var(--blue)] mb-2 flex items-center gap-1.5">
                  <CreditCard size={14} /> Méthode 1 : En ligne sur le portail officiel
                </div>
                <ol className="m-0 pl-4 space-y-1.5 text-xs text-[var(--text2)]">
                  <li>Accédez au portail national officiel <strong>cartescolaire.cm/pay-fees</strong>.</li>
                  <li>Sélectionnez le type d&apos;opération : {isPrivate ? "« Frais d'examen officiel » (BEPC, Probatoire, Baccalauréat)" : "« Frais de scolarité publique » ou « Frais d'examen »"}.</li>
                  <li>Saisissez le <strong>matricule national</strong> de l&apos;élève (affiché ci-dessus).</li>
                  <li>Choisissez votre opérateur de paiement (MTN MoMo, Orange Money, Express Union).</li>
                  <li>Validez la notification reçue sur votre téléphone en entrant votre code secret.</li>
                </ol>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center gap-2">
                <a
                  href="https://cartescolaire.cm/pay-fees"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-bold text-white no-underline transition-opacity hover:opacity-90"
                  style={{ background: 'var(--blue)' }}
                >
                  <ExternalLink size={12} /> Accéder à cartescolaire.cm
                </a>
              </div>
            </div>

            {/* Méthode B : USSD Mobile direct sans connexion */}
            <div className="p-3.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex flex-col justify-between">
              <div>
                <div className="font-bold text-xs text-[var(--blue)] mb-2 flex items-center gap-1.5">
                  <Smartphone size={14} /> Méthode 2 : Directement par téléphone (USSD)
                </div>
                <div className="space-y-2 text-xs text-[var(--text2)]">
                  <div className="p-2 rounded bg-[var(--bg2)] border border-[var(--border)]">
                    <span className="font-bold text-[var(--text)] block mb-0.5">MTN Mobile Money :</span>
                    <span>Composez <strong className="font-mono text-[var(--primary)]">*126*007#</strong> &gt; Choisir <strong>MINESEC</strong> &gt; Saisir le matricule de l&apos;élève &gt; Confirmer avec le code PIN MoMo.</span>
                  </div>
                  <div className="p-2 rounded bg-[var(--bg2)] border border-[var(--border)]">
                    <span className="font-bold text-[var(--text)] block mb-0.5">Orange Money :</span>
                    <span>Composez <strong className="font-mono text-[var(--primary)]">#150*42#</strong> &gt; Choisir <strong>Paiement MINESEC</strong> &gt; Saisir le matricule de l&apos;élève &gt; Confirmer avec votre code secret OM.</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-[var(--border)] text-[11px] text-[var(--text3)] flex items-center gap-1">
                <Info size={12} /> Les SMS de confirmation contiennent votre ID de transaction officiel.
              </div>
            </div>
          </div>

          {/* 3. Validation impérative & Quittance officielle */}
          <div className="p-3 rounded-lg bg-[var(--bg2)] border border-[var(--border)] flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-[var(--green)] shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--text2)] leading-relaxed">
              <strong className="text-[var(--text)] block mb-0.5">Quittance numérique officielle obligatoire (Délai 24h à 48h) :</strong>
              Après votre paiement, attendez entre 24h et 48h pour la synchronisation ministérielle. Rendez-vous ensuite sur <a href="https://cartescolaire.cm/verify-payment" target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--blue)] underline">cartescolaire.cm/verify-payment</a> pour télécharger la quittance officielle munie d&apos;un QR Code certifié. Déposez-en une copie au secrétariat de l&apos;école pour finaliser l&apos;inscription.
            </div>
          </div>

          {/* 4. Assistance & Hotline officielle MINESEC */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[var(--text3)] pt-1">
            <div className="flex items-center gap-1.5">
              <Phone size={13} />
              <span>Assistance téléphonique MINESEC : <strong>+237 678 873 377</strong> / <strong>contact@cartescolaire.cm</strong></span>
            </div>
            <a
              href="https://cartescolaire.cm/verify-payment"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[var(--blue)] hover:underline inline-flex items-center gap-1"
            >
              <Search size={12} /> Vérifier une quittance
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
