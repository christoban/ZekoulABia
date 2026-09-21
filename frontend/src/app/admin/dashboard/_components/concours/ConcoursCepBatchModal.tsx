'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileCheck,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  UserCheck,
  UserX,
  Users,
  Send,
  X,
  FileSpreadsheet,
  Info,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import * as XLSX from 'xlsx';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  isAdmin?: boolean;
  onRefresh?: () => void;
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface Candidate {
  id: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  admissionStatus: string;
  cepResult?: string | null;
  parentPhone?: string | null;
  examScore?: number | null;
  rank?: number | null;
}

interface CandidatRapproche {
  candidateId: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  currentStatus: string;
  proposedStatus: 'CONFIRME' | 'ANNULE';
  cepResult: 'REUSSI' | 'ECHOUE';
  parentPhone: string | null;
}

interface CandidatNonRapproche {
  item: { firstName?: string; lastName?: string; candidateNumber?: string };
  motif: string;
}

interface CandidatPromotion {
  candidateId: string;
  firstName: string;
  lastName: string;
  rank: number | null;
  examScore: number | null;
  parentPhone: string | null;
}

interface PropositionResult {
  rapproches: CandidatRapproche[];
  nonRapproches: CandidatNonRapproche[];
  places: {
    totalProvisoires: number;
    reussis: number;
    echoues: number;
    placesLiberees: number;
  };
  promotionsProposees: CandidatPromotion[];
}

export default function ConcoursCepBatchModal({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  isAdmin = true,
  onRefresh,
  onToast,
}: Props) {
  const [activeTab, setActiveTab] = useState<'MANUEL' | 'IMPORT'>('MANUEL');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [provisoires, setProvisoires] = useState<Candidate[]>([]);
  const [manualDecisions, setManualDecisions] = useState<Record<string, 'REUSSI' | 'ECHOUE' | 'NONE'>>({});
  const [proposal, setProposal] = useState<PropositionResult | null>(null);
  const [selectedPromotions, setSelectedPromotions] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les candidats admis provisoires de la session
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setProposal(null);
    setManualDecisions({});
    fetchApi(`/api/v2/entrance-exams/${sessionId}/details`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          const list: Candidate[] = d.data.candidates ?? [];
          const provs = list.filter((c) => c.admissionStatus === 'ADMIS_PROVISOIRE');
          setProvisoires(provs);
          const initial: Record<string, 'REUSSI' | 'ECHOUE' | 'NONE'> = {};
          provs.forEach((c) => {
            initial[c.id] = c.cepResult === 'REUSSI' ? 'REUSSI' : c.cepResult === 'ECHOUE' ? 'ECHOUE' : 'NONE';
          });
          setManualDecisions(initial);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  // Soumission de la vérification (étape 1 : Secrétaire ou Admin)
  const handleProposer = async (items: { candidateId?: string; firstName?: string; lastName?: string; dateOfBirth?: string; cepResult: 'REUSSI' | 'ECHOUE' }[]) => {
    if (items.length === 0) {
      onToast?.('Aucun résultat renseigné à vérifier', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/cep-batch/propose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setProposal(data.data);
        // Cocher toutes les promotions proposées par défaut
        const promoMap: Record<string, boolean> = {};
        (data.data.promotionsProposees ?? []).forEach((p: CandidatPromotion) => {
          promoMap[p.candidateId] = true;
        });
        setSelectedPromotions(promoMap);
        onToast?.('Vérification effectuée : prévisualisation prête', 'info');
      } else {
        onToast?.(data.message || 'Erreur lors de la vérification', 'error');
      }
    } catch {
      onToast?.('Erreur de communication serveur', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProposeManual = () => {
    const items = Object.entries(manualDecisions)
      .filter(([_, val]) => val === 'REUSSI' || val === 'ECHOUE')
      .map(([candidateId, val]) => ({
        candidateId,
        cepResult: val as 'REUSSI' | 'ECHOUE',
      }));
    handleProposer(items);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

        const items: { firstName?: string; lastName?: string; candidateNumber?: string; cepResult: 'REUSSI' | 'ECHOUE' }[] = [];

        for (const row of rawRows) {
          const keys = Object.keys(row);
          const findKey = (candidates: string[]) =>
            keys.find((k) => candidates.some((c) => k.toLowerCase().includes(c)));

          const nomKey = findKey(['nom', 'name', 'last']);
          const prenomKey = findKey(['prenom', 'first']);
          const numKey = findKey(['matricule', 'num', 'candidat']);
          const resKey = findKey(['result', 'decision', 'cep', 'mention']);

          const resVal = String(row[resKey || ''] || '').toLowerCase();
          const isReussi = resVal.includes('reussi') || resVal.includes('admis') || resVal.includes('pass') || resVal.includes('oui') || resVal === '1';
          const isEchoue = resVal.includes('echou') || resVal.includes('refus') || resVal.includes('fail') || resVal.includes('non') || resVal === '0';

          if (isReussi || isEchoue) {
            items.push({
              lastName: nomKey ? String(row[nomKey]) : undefined,
              firstName: prenomKey ? String(row[prenomKey]) : undefined,
              candidateNumber: numKey ? String(row[numKey]) : undefined,
              cepResult: isReussi ? 'REUSSI' : 'ECHOUE',
            });
          }
        }

        if (items.length === 0) {
          onToast?.('Aucune ligne exploitable trouvée dans le fichier', 'error');
          return;
        }

        handleProposer(items);
      } catch {
        onToast?.('Erreur de lecture du fichier Excel/CSV', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Application définitive (Étape 2 : Administrateur)
  const handleApply = async () => {
    if (!proposal) return;
    if (!isAdmin) {
      onToast?.('Seul un administrateur peut valider et appliquer les résultats définitivement', 'error');
      return;
    }

    try {
      setApplying(true);
      const decisions = proposal.rapproches.map((r) => ({
        candidateId: r.candidateId,
        cepResult: r.cepResult,
      }));
      const promotionsIds = Object.entries(selectedPromotions)
        .filter(([_, checked]) => checked)
        .map(([id]) => id);

      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/cep-batch/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ decisions, promotionsIds }),
      });
      const data = await res.json();
      if (data.success) {
        onToast?.(
          `Résultats CEP appliqués : ${data.data.confirmes} confirmés (${data.data.dossiersCrees} dossiers brouillons), ${data.data.annules} annulés, ${data.data.promus} promus.`,
          'success'
        );
        onRefresh?.();
        onClose();
      } else {
        onToast?.(data.message || 'Erreur lors de l\'application', 'error');
      }
    } catch {
      onToast?.('Erreur de communication avec le serveur', 'error');
    } finally {
      setApplying(false);
    }
  };

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
          maxWidth: 780,
          maxHeight: '92vh',
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
            padding: '16px 24px',
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
                background: 'rgba(37, 99, 235, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--blue, #2563eb)',
              }}
            >
              <FileCheck size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                Saisie & Validation des résultats du CEP
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text2, #6b7280)' }}>
                Session : <strong>{sessionName}</strong> • {provisoires.length} admis provisoire(s) à traiter
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Bandeau d'information sur la règle de notification */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(37, 99, 235, 0.08)',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              color: 'var(--text2)',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Info size={16} style={{ color: 'var(--blue, #2563eb)', flexShrink: 0 }} />
            <span>
              <strong>Règle de notification :</strong> Aucun SMS n'est envoyé aux admis ou recalés du CEP (familles déjà informées). Les dossiers d'inscription sont créés en brouillon. En cas d'échec, la place est libérée et le candidat promu en liste d'attente reçoit un SMS.
            </span>
          </div>

          {!proposal ? (
            <>
              {/* Onglets de mode */}
              <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('MANUEL')}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: activeTab === 'MANUEL' ? '2px solid var(--green, #16a34a)' : 'none',
                    color: activeTab === 'MANUEL' ? 'var(--green, #16a34a)' : 'var(--text2)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Saisie à cocher ({provisoires.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('IMPORT')}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    background: 'transparent',
                    borderBottom: activeTab === 'IMPORT' ? '2px solid var(--green, #16a34a)' : 'none',
                    color: activeTab === 'IMPORT' ? 'var(--green, #16a34a)' : 'var(--text2)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Import de liste (Excel / CSV)
                </button>
              </div>

              {activeTab === 'MANUEL' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      Cochez le résultat du CEP pour chaque candidat admis provisoire :
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const allReussi: Record<string, 'REUSSI'> = {};
                          provisoires.forEach((p) => { allReussi[p.id] = 'REUSSI'; });
                          setManualDecisions(allReussi);
                        }}
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                      >
                        Tous Réussis
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualDecisions({})}
                        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
                      >
                        Réinitialiser
                      </button>
                    </div>
                  </div>

                  <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px' }}>Candidat</th>
                          <th style={{ padding: '8px 12px' }}>Moyenne Concours</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Décision CEP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provisoires.map((c) => {
                          const cur = manualDecisions[c.id] || 'NONE';
                          return (
                            <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{c.candidateNumber || 'Sans matricule'}</div>
                              </td>
                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                                {c.examScore !== null && c.examScore !== undefined ? `${c.examScore.toFixed(2)}/20` : '-'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: 6, background: 'var(--bg)', padding: 4, borderRadius: 6, border: '1px solid var(--border)' }}>
                                  <button
                                    type="button"
                                    onClick={() => setManualDecisions((prev) => ({ ...prev, [c.id]: 'REUSSI' }))}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 4,
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      fontSize: 11,
                                      background: cur === 'REUSSI' ? 'var(--green, #16a34a)' : 'transparent',
                                      color: cur === 'REUSSI' ? '#fff' : 'var(--text2)',
                                    }}
                                  >
                                    ✓ Réussi
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setManualDecisions((prev) => ({ ...prev, [c.id]: 'ECHOUE' }))}
                                    style={{
                                      padding: '4px 10px',
                                      borderRadius: 4,
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      fontSize: 11,
                                      background: cur === 'ECHOUE' ? 'var(--red, #ef4444)' : 'transparent',
                                      color: cur === 'ECHOUE' ? '#fff' : 'var(--text2)',
                                    }}
                                  >
                                    ✕ Échoué
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 16px', border: '2px dashed var(--border)', borderRadius: 12 }}>
                  <FileSpreadsheet size={36} style={{ color: 'var(--green)', marginBottom: 8 }} />
                  <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700 }}>
                    Importer un fichier de résultats officiels
                  </h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: 12, color: 'var(--text2)' }}>
                    Colonnes reconnues : <strong>Nom, Prénom, Date de naissance, Résultat</strong> (Réussi / Échoué)
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '8px 20px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--green, #16a34a)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Upload size={16} /> Choisir le fichier Excel ou CSV
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Étape de synthèse et proposition */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center' }}>
                <div style={{ padding: 10, background: 'rgba(34, 197, 94, 0.08)', borderRadius: 8, border: '1px solid var(--green)' }}>
                  <div style={{ fontSize: 11, color: 'var(--green)' }}>Confirmés</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{proposal.places.reussis}</div>
                </div>
                <div style={{ padding: 10, background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, border: '1px solid var(--red)' }}>
                  <div style={{ fontSize: 11, color: 'var(--red)' }}>Échoués (Annulés)</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>{proposal.places.echoues}</div>
                </div>
                <div style={{ padding: 10, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 8, border: '1px solid var(--blue)' }}>
                  <div style={{ fontSize: 11, color: 'var(--blue)' }}>Places Libérées</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>{proposal.places.placesLiberees}</div>
                </div>
                <div style={{ padding: 10, background: 'rgba(234, 179, 8, 0.08)', borderRadius: 8, border: '1px solid #eab308' }}>
                  <div style={{ fontSize: 11, color: '#854d0e' }}>Promotions Proposées</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#854d0e' }}>{proposal.promotionsProposees.length}</div>
                </div>
              </div>

              {/* Promotions de la liste d'attente */}
              {proposal.promotionsProposees.length > 0 && (
                <div style={{ padding: 14, background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={16} /> Promotion automatique des candidats en liste d'attente
                  </h4>
                  <p style={{ margin: '0 0 10px 0', fontSize: 12, color: 'var(--text2)' }}>
                    Les places libérées sont proposées en priorité aux premiers de la liste complémentaire. Cochez les candidats à promouvoir :
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {proposal.promotionsProposees.map((p) => (
                      <label
                        key={p.candidateId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 6,
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedPromotions[p.candidateId])}
                            onChange={(e) =>
                              setSelectedPromotions((prev) => ({ ...prev, [p.candidateId]: e.target.checked }))
                            }
                          />
                          <span style={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</span>
                          <span style={{ color: 'var(--text3)' }}>• Rang {p.rank ?? '-'} • {p.examScore?.toFixed(2)}/20</span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Send size={12} /> SMS de notification envoyé
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Non rapprochés s'il y en a */}
              {proposal.nonRapproches.length > 0 && (
                <div style={{ padding: 12, borderRadius: 8, background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', color: '#854d0e', fontSize: 12 }}>
                  <strong>{proposal.nonRapproches.length} ligne(s) non rapprochée(s) :</strong>
                  <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                    {proposal.nonRapproches.map((nr, idx) => (
                      <li key={idx}>
                        {nr.item.firstName} {nr.item.lastName} : {nr.motif}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied de page avec actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #e5e7eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg, #f9fafb)',
          }}
        >
          {proposal ? (
            <button
              type="button"
              onClick={() => setProposal(null)}
              disabled={applying}
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
              ← Modifier la saisie
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Étape 1 : Saisie / Importation
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
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

            {!proposal ? (
              <button
                type="button"
                onClick={handleProposeManual}
                disabled={loading || provisoires.length === 0}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--blue, #2563eb)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                Vérifier le lot <ArrowRight size={15} />
              </button>
            ) : isAdmin ? (
              <button
                type="button"
                onClick={handleApply}
                disabled={applying}
                style={{
                  padding: '8px 22px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--green, #16a34a)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <CheckCircle size={16} />
                {applying ? 'Application en cours...' : 'Confirmer et Appliquer définitivement'}
              </button>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', alignSelf: 'center' }}>
                En attente de validation par un administrateur
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
