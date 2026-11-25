'use client';
import { useState } from 'react';
import { Award, Save, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';

interface Subject {
  id: string;
  name: string;
  coefficient: number;
  maxScore: number;
  eliminatoryScore?: number | null;
}

interface GradeEntry {
  subjectId: string;
  score: number | null;
  isAbsent: boolean;
}

interface CandidateRow {
  id: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  totalAverage?: number | null;
  rank?: number | null;
  roomName?: string | null;
  deskNumber?: number | null;
  grades?: { subjectId: string; score: number | null; isAbsent: boolean }[];
}

interface Props {
  sessionId: string;
  subjects: Subject[];
  candidates: CandidateRow[];
  onRefresh: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ConcoursGradesSheet({
  sessionId,
  subjects,
  candidates,
  onRefresh,
  onToast,
}: Props) {
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [draftGrades, setDraftGrades] = useState<Record<string, number | null>>({});
  const [saving, setSaving] = useState(false);
  const [filterRoom, setFilterRoom] = useState<string>('ALL');

  const startEditing = (c: CandidateRow) => {
    setEditingCandidateId(c.id);
    const initialMap: Record<string, number | null> = {};
    subjects.forEach(s => {
      const g = c.grades?.find(entry => entry.subjectId === s.id);
      initialMap[s.id] = g?.score ?? null;
    });
    setDraftGrades(initialMap);
  };

  const handleSaveGrades = async (candidateId: string) => {
    try {
      setSaving(true);
      const notes = Object.entries(draftGrades).map(([subjectId, score]) => ({
        subjectId,
        score: score !== null && !isNaN(score) ? score : null,
        isAbsent: score === null,
      }));

      const res = await fetchApi(`/api/v2/entrance-exams/candidates/${candidateId}/grades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, notes }),
      });

      const data = await res.json();
      if (data.success) {
        onToast('Notes enregistrées avec succès', 'success');
        setEditingCandidateId(null);
        onRefresh();
      } else {
        onToast(data.message || 'Erreur lors de l\'enregistrement', 'error');
      }
    } catch {
      onToast('Erreur de connexion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadConvocation = (candidateId: string, candidateNumber?: string | null) => {
    const url = `/api/v2/entrance-exams/candidates/${candidateId}/convocation-pdf`;
    window.open(url, '_blank');
  };

  const uniqueRooms = Array.from(new Set(candidates.map(c => c.roomName).filter(Boolean)));
  const filteredCandidates = candidates.filter(c => filterRoom === 'ALL' || c.roomName === filterRoom);

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Award size={20} color="var(--green, #16a34a)" /> Feuille de notation & Anonymat des copies
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 0 0' }}>
            {candidates.length} candidat(s) | {subjects.length} épreuve(s) configurée(s)
          </p>
        </div>

        {uniqueRooms.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Filtrer par salle :</span>
            <select
              value={filterRoom}
              onChange={e => setFilterRoom(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}
            >
              <option value="ALL">Toutes les salles</option>
              {uniqueRooms.map(r => <option key={r} value={r!}>{r}</option>)}
            </select>
          </div>
        )}
      </div>

      {subjects.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
          Aucune épreuve configurée pour cette session. Veuillez configurer les matières et coefficients.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>N° Table</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>Code Candidat</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>Nom & Prénom</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>Salle</th>
                {subjects.map(s => (
                  <th key={s.id} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>
                    {s.name} <br />
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                      (Coef {s.coefficient})
                    </span>
                  </th>
                ))}
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>Moyenne /20</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>Rang</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCandidates.map((c, idx) => {
                const isEditing = editingCandidateId === c.id;

                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: idx % 2 === 1 ? 'var(--bg)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{c.deskNumber || '-'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--accent, #2563eb)' }}>
                      {c.candidateNumber || c.id.slice(0, 6)}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                      {c.firstName} {c.lastName}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{c.roomName || '-'}</td>

                    {/* Colonnes matières */}
                    {subjects.map(s => {
                      const existing = c.grades?.find(g => g.subjectId === s.id)?.score;
                      const isElim = s.eliminatoryScore && existing !== null && existing !== undefined && existing < s.eliminatoryScore;

                      if (isEditing) {
                        return (
                          <td key={s.id} style={{ padding: '6px 8px', textAlign: 'center' }}>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max={s.maxScore}
                              value={draftGrades[s.id] ?? ''}
                              onChange={e => {
                                const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                setDraftGrades(prev => ({ ...prev, [s.id]: val }));
                              }}
                              style={{
                                width: 64,
                                padding: '4px 6px',
                                borderRadius: 4,
                                border: '1px solid var(--border)',
                                textAlign: 'center',
                                fontSize: 13,
                              }}
                            />
                          </td>
                        );
                      }

                      return (
                        <td key={s.id} style={{ padding: '10px 12px', textAlign: 'center', color: isElim ? 'var(--red, #ef4444)' : 'var(--text)' }}>
                          {existing !== null && existing !== undefined ? (
                            <span style={{ fontWeight: isElim ? 700 : 500, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                              {existing} {isElim && <AlertTriangle size={12} />}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text3)' }}>-</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Moyenne */}
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>
                      {c.totalAverage !== null && c.totalAverage !== undefined ? c.totalAverage.toFixed(2) : '-'}
                    </td>

                    {/* Rang */}
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text2)' }}>
                      {c.rank ? `${c.rank}e` : '-'}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        {isEditing ? (
                          <button
                            onClick={() => handleSaveGrades(c.id)}
                            disabled={saving}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: 'none',
                              background: 'var(--green, #16a34a)',
                              color: '#fff',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Save size={14} /> Sauver
                          </button>
                        ) : (
                          <button
                            onClick={() => startEditing(c)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Noter
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadConvocation(c.id, c.candidateNumber)}
                          title="Télécharger la convocation PDF avec QR code"
                          style={{
                            padding: '5px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text2)',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
