'use client'

import React from 'react'
import {
  FileCheck,
  User,
  BookOpen,
  Users,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Printer,
  Send,
  Save,
  Loader2,
} from 'lucide-react'
import {
  type StepperFormState,
  type ClasseSuggestion,
  calculerProfilAcces,
} from './types'

interface Props {
  form: StepperFormState
  suggestions: ClasseSuggestion[]
  doublonsDetectes: Array<{ id: string; nomComplet: string; dateNaissance?: string }>
  scoreCompletude: number
  piecesManquantesCount: number
  onGoToStep: (stepNumber: number) => void
  onSaveDraft: () => void
  onSubmitToDirection: () => void
  onFinalizeDirect: () => void
  onPrintPreFilledPdf?: () => void
  loading: boolean
}

export default function Step6Recapitulatif({
  form,
  suggestions,
  doublonsDetectes,
  scoreCompletude,
  piecesManquantesCount,
  onGoToStep,
  onSaveDraft,
  onSubmitToDirection,
  onFinalizeDirect,
  onPrintPreFilledPdf,
  loading,
}: Props) {
  const classeSelectionnee = suggestions.find((s) => s.id === form.classId)
  const profilAcces = calculerProfilAcces(
    form.level,
    form.dispositifEleve,
    form.dispositifParent,
    form.aucunTelephoneDisponible,
  )

  const nomComplet = `${form.nom.trim()} ${form.prenom.trim()}`.trim() || 'Élève non renseigné'
  const isConcours = form.origine === 'CONCOURS'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Bannière de récapitulatif */}
      <div
        style={{
          padding: '14px 18px',
          borderRadius: 12,
          background: 'var(--bg2, #f9fafb)',
          border: '1px solid var(--border, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text, #111827)' }}>
            {nomComplet}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2, #4b5563)', marginTop: 2 }}>
            Voie : <strong>{form.origine === 'CONCOURS' ? 'Concours d’entrée' : form.origine === 'TRANSFERT' ? 'Transfert' : 'Hors concours'}</strong>
            {classeSelectionnee ? ` • Classe : ${classeSelectionnee.name}` : ''}
          </div>
        </div>

        {onPrintPreFilledPdf && (
          <button
            type="button"
            onClick={onPrintPreFilledPdf}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              background: 'var(--surface, #fff)',
              color: 'var(--text, #111827)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Printer size={14} /> Imprimer la fiche pré-remplie
          </button>
        )}
      </div>

      {/* Alertes éventuelles */}
      {(doublonsDetectes.length > 0 || classeSelectionnee?.estPleine || piecesManquantesCount > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {doublonsDetectes.length > 0 && (
            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(234,179,8,0.15)', color: '#b45309', fontSize: 12, display: 'flex', gap: 8 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Doublon potentiel : un élève nommé {doublonsDetectes[0].nomComplet} existe déjà dans l'école.</span>
            </div>
          )}
          {classeSelectionnee?.estPleine && (
            <div style={{ padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: 'var(--red, #ef4444)', fontSize: 12, display: 'flex', gap: 8 }}>
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Capacité maximale atteinte pour {classeSelectionnee.name}. Dérogation signalée à la direction.</span>
            </div>
          )}
        </div>
      )}

      {/* Cartes de synthèse par section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Section 1 : Identité élève */}
        <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} style={{ color: 'var(--blue)' }} /> Identité de l'élève
            </span>
            <button type="button" onClick={() => onGoToStep(1)} style={btnModifier}>
              <Edit2 size={11} /> Modifier
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            <div><strong>Nom & Prénom :</strong> {form.nom} {form.prenom} ({form.sexe === 'M' ? 'Masculin' : 'Féminin'})</div>
            <div><strong>Né(e) le :</strong> {form.dateNaissance || 'Non renseigné'} {form.lieuNaissance ? `à ${form.lieuNaissance}` : ''} • {form.nationalite || 'Camerounaise'}</div>
            {form.matriculeNational && <div><strong>Matricule national :</strong> {form.matriculeNational}</div>}
          </div>
        </div>

        {/* Section 2 : Scolarité */}
        <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookOpen size={14} style={{ color: 'var(--green)' }} /> Scolarité & Classe
            </span>
            <button type="button" onClick={() => onGoToStep(2)} style={btnModifier}>
              <Edit2 size={11} /> Modifier
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            <div><strong>Niveau & Classe :</strong> {form.level || 'Non sélectionné'} — {classeSelectionnee?.name || 'Non affectée'}</div>
            {form.motifHorsConcours && <div><strong>Motif Hors Concours :</strong> {form.motifHorsConcours}</div>}
            {form.etablissementOrigine && <div><strong>Établissement précédent :</strong> {form.etablissementOrigine}</div>}
          </div>
        </div>

        {/* Section 3 : Famille */}
        <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} style={{ color: '#d97706' }} /> Responsables légaux
            </span>
            <button type="button" onClick={() => onGoToStep(3)} style={btnModifier}>
              <Edit2 size={11} /> Modifier
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
            {form.aucunTelephoneDisponible ? (
              <div style={{ color: '#b45309' }}>Aucun numéro de téléphone disponible dans la famille (suivi sur papier).</div>
            ) : form.responsables.length > 0 ? (
              form.responsables.map((r, i) => (
                <div key={i}>
                  <strong>{r.lien} :</strong> {r.nom} {r.prenom} {r.telephone ? `• Tél : ${r.telephone}` : ''}
                </div>
              ))
            ) : (
              <div>Responsable non renseigné.</div>
            )}
          </div>
        </div>

        {/* Section 4 : Accès numérique */}
        <div style={{ padding: 14, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Smartphone size={14} style={{ color: 'var(--blue)' }} /> Profil d'accès numérique
            </span>
            <button type="button" onClick={() => onGoToStep(4)} style={btnModifier}>
              <Edit2 size={11} /> Modifier
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {profilAcces.phraseClaire}
          </div>
        </div>
      </div>

      {/* Actions finales du bas */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 10,
          borderTop: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={loading}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface, #fff)',
            color: 'var(--text, #111827)',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Save size={15} /> Enregistrer le brouillon
        </button>

        {isConcours ? (
          <button
            type="button"
            onClick={onFinalizeDirect}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(180,83,42,0.3)',
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Finaliser l'inscription (Admis au concours)
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmitToDirection}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, var(--blue, #2563eb), #1d4ed8)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Soumettre à la direction
          </button>
        )}
      </div>
    </div>
  )
}

const btnModifier: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--blue, #2563eb)',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
}
