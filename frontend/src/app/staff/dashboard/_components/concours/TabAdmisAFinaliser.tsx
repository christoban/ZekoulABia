'use client';

import React, { useState } from 'react';
import {
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';

interface Candidate {
  id: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  examScore?: number | null;
  rank?: number | null;
  admissionStatus: string;
  cepResult?: string | null;
  parentPhone?: string | null;
}

interface Props {
  sessionId: string;
  sessionName: string;
  candidates: Candidate[];
  availableSeats: number | null;
  onRefresh: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function TabAdmisAFinaliser({
  sessionId,
  sessionName,
  candidates,
  availableSeats,
  onRefresh,
  onToast,
}: Props) {
  const [finalizing, setFinalizing] = useState(false);

  // Les candidats éligibles à la finalisation directe sont ceux avec statut ADMIS, CONFIRME ou REPECHE
  const confirmes = candidates.filter(
    (c) => c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'ADMIS' || c.admissionStatus === 'REPECHE'
  );
  const dejaInscrits = candidates.filter((c) => c.admissionStatus === 'INSCRIT');
  const enAttenteCep = candidates.filter((c) => c.admissionStatus === 'ADMIS_PROVISOIRE');

  const handleFinaliserTout = async () => {
    if (confirmes.length === 0) {
      onToast('Aucun candidat confirmé prêt pour l\'inscription finale', 'info');
      return;
    }

    try {
      setFinalizing(true);
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/finalize-admissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ traiterForfaitsEtRepechage: true }),
      });

      const data = await res.json();
      if (data.success) {
        onToast(
          `Finalisation réussie ! ${data.data.dossiersCrees} dossier(s) d'élèves inscrits directement.`,
          'success'
        );
        onRefresh();
      } else {
        onToast(data.message || 'Erreur lors de la finalisation des admissions', 'error');
      }
    } catch {
      onToast('Erreur de connexion au serveur', 'error');
    } finally {
      setFinalizing(false);
    }
  };

  const totalCapacite = availableSeats || 50;
  const totalActuel = dejaInscrits.length + confirmes.length;
  const pctRemplissage = Math.min(100, Math.round((totalActuel / totalCapacite) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Bannière d'autonomie Secrétariat (Règle d'or : Inscription directe sans re-validation direction) */}
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: 'rgba(16, 185, 129, 0.07)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <ShieldCheck size={22} style={{ color: 'var(--green, #10b981)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
            Voie Concours : Inscription Directe Autorisée
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
            Conformément aux règles d&apos;admission de l&apos;établissement, les lauréats confirmés du concours sont inscrits <strong>sans exiger de seconde validation de la direction</strong>. La finalisation crée directement les comptes élèves et dossiers scolaires définitifs.
          </div>
        </div>

        {confirmes.length > 0 && (
          <button
            type="button"
            disabled={finalizing}
            onClick={handleFinaliserTout}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--green, #10b981)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: finalizing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
              flexShrink: 0,
            }}
          >
            {finalizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Finaliser les {confirmes.length} admis
          </button>
        )}
      </div>

      {/* Jauge de remplissage de la classe cible */}
      <div style={{ padding: 18, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} style={{ color: 'var(--accent, #2563eb)' }} /> Capacité d&apos;accueil concours
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {dejaInscrits.length} inscrits + {confirmes.length} à finaliser / {totalCapacite} places ({pctRemplissage}%)
          </div>
        </div>
        <div style={{ width: '100%', height: 10, background: 'var(--bg2)', borderRadius: 5, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pctRemplissage}%`,
              height: '100%',
              background: pctRemplissage >= 100 ? 'var(--amber, #f59e0b)' : 'var(--green, #10b981)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Liste des candidats à finaliser */}
      <div>
        <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          Candidats confirmés prêts pour l&apos;inscription ({confirmes.length})
        </h4>

        {confirmes.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
            <CheckCircle2 size={28} style={{ color: 'var(--green, #10b981)', margin: '0 auto 6px' }} />
            <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
              Tous les admis confirmés ont déjà été finalisés et inscrits !
            </div>
            {enAttenteCep.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {enAttenteCep.length} candidat(s) sont encore en statut &quot;Admis provisoire&quot; en attente des résultats du CEP dans l&apos;onglet précédent.
              </div>
            )}
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '10px 14px', width: 50 }}>Rang</th>
                  <th style={{ padding: '10px 14px' }}>Code</th>
                  <th style={{ padding: '10px 14px' }}>Nom & Prénom(s)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Note</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Confirmation CEP</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {confirmes.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: idx === confirmes.length - 1 ? 'none' : '1px solid var(--border)',
                      background: idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text2)' }}>{c.rank ?? idx + 1}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent, #2563eb)' }}>
                      {c.candidateNumber || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>
                      {c.lastName} {c.firstName}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>
                      {c.examScore != null ? `${Number(c.examScore).toFixed(2)}/20` : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--green, #10b981)', fontWeight: 600 }}>
                      ✓ Reçu
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: 'var(--green, #10b981)',
                        }}
                      >
                        {c.admissionStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Liste des déjà inscrits */}
      {dejaInscrits.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
            Inscriptions déjà finalisées ({dejaInscrits.length})
          </h4>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Ces élèves sont enregistrés en base et apparaissent dans la colonne &quot;Inscrits&quot; de votre Kanban des Inscriptions.
          </div>
        </div>
      )}
    </div>
  );
}
