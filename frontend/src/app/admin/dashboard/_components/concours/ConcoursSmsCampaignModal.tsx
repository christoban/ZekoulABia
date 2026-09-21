'use client';

import React, { useState, useEffect } from 'react';
import { Send, PhoneOff, AlertCircle, CheckCircle, Users, X, Info } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  onConfirm: (confirmSms: boolean, campaignId?: string) => Promise<void>;
}

interface EstimationResult {
  totalCandidats: number;
  totalSmsAEnvoyer: number;
  totalSansTelephone: number;
  candidatsSansTelephone: {
    id: string;
    firstName: string;
    lastName: string;
    candidateNumber?: string | null;
    admissionStatus: string;
  }[];
  groupes: {
    admis: { count: number; withPhone: number; withoutPhone: number; previewMessage: string };
    listeAttente: { count: number; withPhone: number; withoutPhone: number; previewMessage: string };
    nonAdmis: { count: number; withPhone: number; withoutPhone: number; previewMessage: string };
  };
  campaignIdSuggere: string;
  subsystem: string;
  examLibelle: string;
  levelLibelle: string;
  schoolName: string;
}

export default function ConcoursSmsCampaignModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [estimation, setEstimation] = useState<EstimationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNoPhoneList, setShowNoPhoneList] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetchApi(`/api/v2/entrance-exams/${sessionId}/publish/estimate-sms`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setEstimation(d.data);
        } else {
          setError(d.message || 'Impossible de calculer l\'estimation SMS');
        }
      })
      .catch(() => setError('Erreur de communication avec le serveur'))
      .finally(() => setLoading(false));
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          color: 'var(--text, #111827)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          border: '1px solid var(--border, #e5e7eb)',
          overflow: 'hidden',
        }}
      >
        {/* En-tête */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(34, 197, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--green, #16a34a)',
              }}
            >
              <Send size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                Publication & Campagne SMS
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text2, #6b7280)' }}>
                Session : <strong>{sessionName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text2, #6b7280)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text2)' }}>
              Calcul de l'estimation de la campagne SMS...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--red, #ef4444)',
                color: 'var(--red, #ef4444)',
                fontSize: 13,
                display: 'flex',
                gap: 8,
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {estimation && (
            <>
              {/* Résumé métriques */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  textAlign: 'center',
                }}
              >
                <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Total Candidats</div>
                  <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{estimation.totalCandidats}</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.08)', borderRadius: 10, border: '1px solid var(--green)' }}>
                  <div style={{ fontSize: 11, color: 'var(--green)' }}>SMS Prévus</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{estimation.totalSmsAEnvoyer}</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(234, 179, 8, 0.08)', borderRadius: 10, border: '1px solid #eab308' }}>
                  <div style={{ fontSize: 11, color: '#854d0e' }}>Sans Téléphone</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#854d0e', marginTop: 4 }}>{estimation.totalSansTelephone}</div>
                </div>
              </div>

              {/* Message d'information sur les sans téléphone */}
              {estimation.totalSansTelephone > 0 && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: 'rgba(234, 179, 8, 0.1)',
                    border: '1px solid #eab308',
                    color: '#854d0e',
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <PhoneOff size={16} /> {estimation.totalSansTelephone} candidat(s) sans contact téléphonique
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNoPhoneList(!showNoPhoneList)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#854d0e',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontSize: 11,
                      }}
                    >
                      {showNoPhoneList ? 'Masquer' : 'Voir la liste (affichage papier)'}
                    </button>
                  </div>
                  {showNoPhoneList && (
                    <div style={{ marginTop: 8, maxHeight: 100, overflowY: 'auto', background: 'var(--surface)', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}>
                      {estimation.candidatsSansTelephone.map((c) => (
                        <div key={c.id} style={{ fontSize: 11, padding: '2px 0' }}>
                          • {c.candidateNumber ? `[${c.candidateNumber}] ` : ''}{c.firstName} {c.lastName} ({c.admissionStatus})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Aperçus des messages par catégorie */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  Aperçu des SMS personnalisés ({estimation.schoolName} — {estimation.levelLibelle})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Admis */}
                  <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                      <span>ADMIS PROVISOIRES ({estimation.groupes.admis.withPhone} SMS)</span>
                      <span>Sous réserve de {estimation.examLibelle}</span>
                    </div>
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text2)', background: 'var(--surface)', padding: 8, borderRadius: 6 }}>
                      "{estimation.groupes.admis.previewMessage}"
                    </div>
                  </div>

                  {/* Liste d'attente */}
                  {estimation.groupes.listeAttente.count > 0 && (
                    <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#854d0e', marginBottom: 4 }}>
                        <span>LISTE COMPLÉMENTAIRE ({estimation.groupes.listeAttente.withPhone} SMS)</span>
                        <span>Promotion si place libérée</span>
                      </div>
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text2)', background: 'var(--surface)', padding: 8, borderRadius: 6 }}>
                        "{estimation.groupes.listeAttente.previewMessage}"
                      </div>
                    </div>
                  )}

                  {/* Non admis */}
                  <div style={{ padding: 10, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                      <span>NON RETENUS ({estimation.groupes.nonAdmis.withPhone} SMS)</span>
                      <span>Message respectueux et bienveillant</span>
                    </div>
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text2)', background: 'var(--surface)', padding: 8, borderRadius: 6 }}>
                      "{estimation.groupes.nonAdmis.previewMessage}"
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                <Info size={14} /> Identifiant campagne anti-doublon : <code>{estimation.campaignIdSuggere}</code>
              </div>
            </>
          )}
        </div>

        {/* Boutons d'action */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            background: 'var(--bg, #f9fafb)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>

          <button
            type="button"
            disabled={submitting || loading || !estimation}
            onClick={async () => {
              try {
                setSubmitting(true);
                await onConfirm(false);
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Publier sans SMS
          </button>

          <button
            type="button"
            disabled={submitting || loading || !estimation}
            onClick={async () => {
              try {
                setSubmitting(true);
                await onConfirm(true, estimation?.campaignIdSuggere);
                onClose();
              } finally {
                setSubmitting(false);
              }
            }}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--green, #16a34a)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Send size={15} />
            {submitting ? 'Envoi en cours...' : `Confirmer et Envoyer (${estimation?.totalSmsAEnvoyer ?? 0} SMS)`}
          </button>
        </div>
      </div>
    </div>
  );
}
