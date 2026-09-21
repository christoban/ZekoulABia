'use client';
import { useState, useEffect } from 'react';
import { Sliders, CheckCircle, AlertTriangle, Send, UserCheck, BarChart3 } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';

interface SimulationOutcome {
  admisIds: string[];
  listeAttenteIds: string[];
  refusesIds: string[];
  effectiveThreshold: number | null;
  cutOffTieDetected: boolean;
  tieCandidateIdsAtCutOff: string[];
  totalCandidates: number;
  admisCount: number;
  listeAttenteCount: number;
  refusesCount: number;
  eliminatedCount: number;
  gradeDistribution: { range: string; count: number }[];
}

interface Props {
  sessionId: string;
  initialThreshold: number | null;
  initialSeats: number | null;
  status: string;
  onRefresh: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ConcoursDeliberationSimulator({
  sessionId,
  initialThreshold,
  initialSeats,
  status,
  onRefresh,
  onToast,
}: Props) {
  const [threshold, setThreshold] = useState<number>(initialThreshold ?? 10.0);
  const [seats, setSeats] = useState<number>(initialSeats ?? 50);
  const [waitingSeats, setWaitingSeats] = useState<number>(15);
  const [simulating, setSimulating] = useState(false);
  const [outcome, setOutcome] = useState<SimulationOutcome | null>(null);
  const [applying, setApplying] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const runSimulation = async (apply = false) => {
    try {
      if (apply) setApplying(true);
      else setSimulating(true);

      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/deliberation/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          admissionThreshold: threshold,
          availableSeats: seats,
          waitingListSeats: waitingSeats,
          appliquer: apply,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOutcome(data.data.outcome);
        if (apply) {
          onToast('Délibération appliquée avec succès ! Les statuts et délais sont enregistrés.', 'success');
          onRefresh();
        }
      } else {
        onToast(data.message || 'Erreur lors de la simulation', 'error');
      }
    } catch {
      onToast('Erreur de connexion', 'error');
    } finally {
      setSimulating(false);
      setApplying(false);
    }
  };

  useEffect(() => {
    runSimulation(false);
  }, [threshold, seats, waitingSeats, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePublish = async () => {
    if (!confirm('Êtes-vous sûr de vouloir publier officiellement les résultats du concours ? Ils deviendront consultables par les familles.')) {
      return;
    }
    try {
      setPublishing(true);
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        onToast('Résultats publiés officiellement !', 'success');
        onRefresh();
      } else {
        onToast(data.message || 'Erreur lors de la publication', 'error');
      }
    } catch {
      onToast('Erreur de connexion', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleFinalize = async () => {
    if (!confirm('Générer automatiquement les dossiers d\'inscription (onboarding) pour tous les candidats admis ?')) {
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
        onToast(`Admissions finalisées : ${data.data.dossiersCrees} dossiers créés, ${data.data.repechesCount} repêchés.`, 'success');
        onRefresh();
      } else {
        onToast(data.message || 'Erreur lors de la finalisation', 'error');
      }
    } catch {
      onToast('Erreur de connexion', 'error');
    } finally {
      setFinalizing(false);
    }
  };

  const maxDistributionCount = Math.max(...(outcome?.gradeDistribution.map(d => d.count) || [1]), 1);

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Sliders size={20} color="var(--purple, #9333ea)" /> Simulateur interactif de délibération
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 0 0' }}>
            Ajustez les quotas et seuils pour visualiser en direct l'impact sur les admissions et listes d'attente
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => runSimulation(true)}
            disabled={applying}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--purple, #9333ea)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <CheckCircle size={16} /> {applying ? 'Application...' : 'Appliquer la délibération'}
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing || status === 'PUBLISHED' || status === 'CLOSED'}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: status === 'PUBLISHED' ? 'var(--green-light)' : 'var(--surface)',
              color: status === 'PUBLISHED' ? 'var(--green)' : 'var(--text)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Send size={16} /> {status === 'PUBLISHED' ? 'Résultats publiés' : 'Publier les résultats'}
          </button>

          <button
            onClick={handleFinalize}
            disabled={finalizing}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <UserCheck size={16} /> {finalizing ? 'Traitement...' : 'Bascule vers Inscription'}
          </button>
        </div>
      </div>

      {/* Curseur de contrôle */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 24, background: 'var(--bg)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Places disponibles</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent, #2563eb)' }}>{seats} places</span>
          </div>
          <input
            type="range"
            min="1"
            max="300"
            value={seats}
            onChange={e => setSeats(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Seuil minimal d'admission</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green, #16a34a)' }}>{threshold.toFixed(2)} / 20</span>
          </div>
          <input
            type="range"
            min="5"
            max="18"
            step="0.25"
            value={threshold}
            onChange={e => setThreshold(parseFloat(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Places liste d'attente</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>{waitingSeats} places</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={waitingSeats}
            onChange={e => setWaitingSeats(Number(e.target.value))}
            style={{ width: '100%', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Cartes résultats et indicateurs */}
      {outcome && (
        <>
          {outcome.cutOffTieDetected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, background: 'rgba(234, 179, 8, 0.12)', border: '1px solid #eab308', color: '#854d0e', fontSize: 13, marginBottom: 16 }}>
              <AlertTriangle size={18} />
              <span>
                <strong>Attention ex æquo :</strong> Plusieurs candidats partagent exactement la même moyenne ({outcome.effectiveThreshold?.toFixed(2)}/20) au niveau de la coupure. Le départage a priorisé les notes dans les matières à plus fort coefficient puis l'âge.
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Candidats totaux</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{outcome.totalCandidates}</div>
            </div>
            <div style={{ background: 'var(--green-light)', padding: 12, borderRadius: 8, border: '1px solid var(--green)', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--green)' }}>Admis</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{outcome.admisCount}</div>
            </div>
            <div style={{ background: 'rgba(234, 179, 8, 0.12)', padding: 12, borderRadius: 8, border: '1px solid #eab308', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: '#854d0e' }}>Liste d'attente</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#854d0e', marginTop: 4 }}>{outcome.listeAttenteCount}</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Refusés / Éliminés</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text2)', marginTop: 4 }}>{outcome.refusesCount} ({outcome.eliminatedCount} éliminés)</div>
            </div>
            <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Seuil effectif</span>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--purple, #9333ea)', marginTop: 4 }}>
                {outcome.effectiveThreshold !== null ? `${outcome.effectiveThreshold.toFixed(2)}/20` : '-'}
              </div>
            </div>
          </div>

          {/* Histogramme visuel des moyennes */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <BarChart3 size={16} /> Distribution des moyennes par tranche de 2 points
            </h4>
            <div style={{ display: 'flex', alignItems: 'flex-end', height: 100, gap: 8, background: 'var(--bg)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
              {outcome.gradeDistribution.map(d => {
                const heightPct = Math.round((d.count / maxDistributionCount) * 100);
                const isPassing = parseFloat(d.range.split('-')[0]) >= threshold;

                return (
                  <div key={d.range} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text2)', marginBottom: 2 }}>
                      {d.count > 0 ? d.count : ''}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: `${Math.max(4, heightPct)}%`,
                        background: isPassing ? 'var(--green, #16a34a)' : 'var(--text3)',
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.2s ease',
                      }}
                      title={`Tranche [${d.range}[ : ${d.count} candidats`}
                    />
                    <span style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4, whiteSpace: 'nowrap' }}>
                      {d.range}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
