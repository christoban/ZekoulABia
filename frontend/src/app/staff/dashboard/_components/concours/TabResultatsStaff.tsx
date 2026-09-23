'use client';

import React, { useState } from 'react';
import {
  Award,
  Users,
  Search,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

interface Candidate {
  id: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  examScore?: number | null;
  totalAverage?: number | null;
  rank?: number | null;
  admissionStatus: string;
  parentPhone?: string | null;
}

interface Props {
  sessionId: string;
  sessionName: string;
  candidates: Candidate[];
  admissionThreshold: number | null;
  availableSeats: number | null;
  isPublished: boolean;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function TabResultatsStaff({
  sessionId,
  sessionName,
  candidates,
  admissionThreshold,
  availableSeats,
  isPublished,
  onToast,
}: Props) {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ADMIS' | 'ATTENTE' | 'REFUSE'>('ALL');
  const [search, setSearch] = useState('');

  const admis = candidates.filter(
    (c) => c.admissionStatus === 'ADMIS' || c.admissionStatus === 'ADMIS_PROVISOIRE' || c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'INSCRIT'
  );
  const listeAttente = candidates.filter((c) => c.admissionStatus === 'LISTE_ATTENTE');
  const refuses = candidates.filter((c) => c.admissionStatus === 'REFUSE' || c.admissionStatus === 'NON_ADMIS');

  const filtered = candidates.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      c.lastName.toLowerCase().includes(q) ||
      c.firstName.toLowerCase().includes(q) ||
      (c.candidateNumber && c.candidateNumber.toLowerCase().includes(q));

    let matchStatus = true;
    if (filterStatus === 'ADMIS') {
      matchStatus = admis.some((a) => a.id === c.id);
    } else if (filterStatus === 'ATTENTE') {
      matchStatus = listeAttente.some((a) => a.id === c.id);
    } else if (filterStatus === 'REFUSE') {
      matchStatus = refuses.some((a) => a.id === c.id);
    }

    return matchSearch && matchStatus;
  });

  const handlePrintAffiche = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* État de publication */}
      {!isPublished ? (
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <Clock size={24} style={{ color: 'var(--amber, #f59e0b)', flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
              Délibération en cours &bull; Résultats non publiés
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
              La commission d&apos;admission de la direction procède actuellement aux simulations de seuils et quotas. Les listes officielles et les SMS de notification seront diffusés dès la publication finale par la direction.
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={22} style={{ color: 'var(--green, var(--green))' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                Résultats Officiels Publiés
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Les listes sont consultables et l&apos;affiche officielle est prête pour diffusion.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePrintAffiche}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Printer size={15} /> Imprimer l&apos;Affiche Officielle
          </button>
        </div>
      )}

      {/* Cartes de synthèse */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 4 }}>
            <Users size={14} /> Total Candidats
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{candidates.length}</div>
        </div>

        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green, var(--green))', fontSize: 12, marginBottom: 4 }}>
            <Award size={14} /> Admis (ou Provisoires)
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green, var(--green))' }}>
            {admis.length} {availableSeats ? `/ ${availableSeats} places` : ''}
          </div>
        </div>

        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber, #f59e0b)', fontSize: 12, marginBottom: 4 }}>
            <Clock size={14} /> Liste d&apos;attente
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--amber, #f59e0b)' }}>{listeAttente.length}</div>
        </div>

        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red, #ef4444)', fontSize: 12, marginBottom: 4 }}>
            <XCircle size={14} /> Refusés / Non admis
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--red, #ef4444)' }}>{refuses.length}</div>
        </div>
      </div>

      {/* Barre de filtres */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(['ALL', 'ADMIS', 'ATTENTE', 'REFUSE'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: filterStatus === st ? '1px solid var(--accent, #2563eb)' : '1px solid var(--border)',
                background: filterStatus === st ? 'rgba(37, 99, 235, 0.08)' : 'var(--surface)',
                color: filterStatus === st ? 'var(--accent, #2563eb)' : 'var(--text)',
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {st === 'ALL'
                ? `Tous (${candidates.length})`
                : st === 'ADMIS'
                ? `Admis (${admis.length})`
                : st === 'ATTENTE'
                ? `Liste d'attente (${listeAttente.length})`
                : `Refusés (${refuses.length})`}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: 260 }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer un candidat..."
            style={{
              width: '100%',
              padding: '6px 10px 6px 30px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* Tableau des résultats */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '10px 14px', width: 60, textAlign: 'center' }}>Rang</th>
              <th style={{ padding: '10px 14px' }}>Code</th>
              <th style={{ padding: '10px 14px' }}>Nom & Prénom(s)</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Moyenne Concours</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Décision Jury</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Confirmation CEP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, idx) => (
              <tr
                key={c.id}
                style={{
                  borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--border)',
                  background: idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                }}
              >
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: c.rank && c.rank <= 3 ? 'var(--amber, #f59e0b)' : 'var(--text2)' }}>
                  {c.rank ?? '—'}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent, #2563eb)' }}>
                  {c.candidateNumber || '—'}
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>
                  {c.lastName} {c.firstName}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>
                  {c.examScore != null ? `${Number(c.examScore).toFixed(2)} / 20` : 'En attente'}
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background:
                        c.admissionStatus === 'ADMIS' || c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'INSCRIT'
                          ? 'rgba(47,143,91,0.12)'
                          : c.admissionStatus === 'ADMIS_PROVISOIRE'
                          ? 'rgba(59, 130, 246, 0.12)'
                          : c.admissionStatus === 'LISTE_ATTENTE'
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                      color:
                        c.admissionStatus === 'ADMIS' || c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'INSCRIT'
                          ? 'var(--green, var(--green))'
                          : c.admissionStatus === 'ADMIS_PROVISOIRE'
                          ? 'var(--accent, #2563eb)'
                          : c.admissionStatus === 'LISTE_ATTENTE'
                          ? 'var(--amber, #f59e0b)'
                          : 'var(--red, #ef4444)',
                    }}
                  >
                    {c.admissionStatus}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text2)' }}>
                  {c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'INSCRIT' ? (
                    <span style={{ color: 'var(--green, var(--green))', fontWeight: 600 }}>✓ CEP Confirmé</span>
                  ) : (
                    <span style={{ color: 'var(--text3)' }}>Non renseigné</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
