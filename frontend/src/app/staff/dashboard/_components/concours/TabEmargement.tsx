'use client';

import React, { useState } from 'react';
import {
  Check,
  X,
  Search,
  Printer,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';

interface Room {
  id: string;
  name: string;
  capacity: number;
}

interface Candidate {
  id: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  roomName?: string | null;
  deskNumber?: number | null;
  isAbsent?: boolean;
}

interface Props {
  sessionId: string;
  rooms: Room[];
  candidates: Candidate[];
  onRefresh: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function TabEmargement({
  sessionId,
  rooms,
  candidates,
  onRefresh,
  onToast,
}: Props) {
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filtered = candidates.filter((c) => {
    const matchRoom = selectedRoom === 'ALL' || c.roomName === selectedRoom;
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      c.lastName.toLowerCase().includes(q) ||
      c.firstName.toLowerCase().includes(q) ||
      (c.candidateNumber && c.candidateNumber.toLowerCase().includes(q));

    return matchRoom && matchSearch;
  });

  const total = filtered.length;
  const absents = filtered.filter((c) => c.isAbsent === true).length;
  const presents = total - absents;
  const tauxPresence = total > 0 ? Math.round((presents / total) * 100) : 0;

  const handleTogglePresence = async (candId: string, currentAbsent: boolean) => {
    try {
      setUpdatingId(candId);
      const isPresent = currentAbsent; // On inverse l'état
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/emargement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ candidateId: candId, isPresent }),
      });

      const data = await res.json();
      if (data.success) {
        onToast(isPresent ? 'Présence enregistrée' : 'Absence enregistrée', 'info');
        onRefresh();
      } else {
        onToast(data.message || 'Erreur lors de l\'émargement', 'error');
      }
    } catch {
      onToast('Erreur de communication avec le serveur', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePrintSheet = () => {
    if (selectedRoom === 'ALL') {
      onToast('Veuillez sélectionner une salle spécifique pour imprimer sa liste d\'émargement', 'info');
      return;
    }
    const foundRoom = rooms.find((r) => r.name === selectedRoom);
    if (!foundRoom) return;
    window.open(`/api/v2/entrance-exams/${sessionId}/rooms/${foundRoom.id}/emargement-pdf`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cartes de métriques d'émargement */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 4 }}>
            <Users size={14} /> Total convoqués
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{total}</div>
        </div>

        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green, var(--green))', fontSize: 12, marginBottom: 4 }}>
            <CheckCircle2 size={14} /> Présents
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--green, var(--green))' }}>{presents}</div>
        </div>

        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--red, #ef4444)', fontSize: 12, marginBottom: 4 }}>
            <XCircle size={14} /> Absents
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--red, #ef4444)' }}>{absents}</div>
        </div>

        <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 4 }}>
            <Clock size={14} /> Taux de présence
          </div>
          <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent, #2563eb)' }}>{tauxPresence}%</div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
          {/* Sélection de la salle */}
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <option value="ALL">Toutes les salles ({rooms.length})</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name} ({r.capacity} places)
              </option>
            ))}
          </select>

          {/* Recherche */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Scanner ou chercher code, nom..."
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>
        </div>

        {/* Action impression feuille émargement */}
        <button
          type="button"
          onClick={handlePrintSheet}
          style={{
            padding: '7px 14px',
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
          <Printer size={15} /> Imprimer feuille d&apos;émargement (PDF)
        </button>
      </div>

      {/* Tableau d'émargement */}
      {filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 12, background: 'var(--bg)' }}>
          <div style={{ color: 'var(--text3)', fontSize: 14 }}>Aucun candidat dans cette salle ou ne correspond à la recherche.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)' }}>Code</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)' }}>Nom & Prénom(s)</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)' }}>Salle</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Place</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Émargement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const isAbsent = Boolean(c.isAbsent);
                const isUpdating = updatingId === c.id;

                return (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--border)',
                      background: isAbsent ? 'rgba(239, 68, 68, 0.04)' : idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent, #2563eb)' }}>
                      {c.candidateNumber || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>
                      {c.lastName} {c.firstName}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>
                      {c.roomName || 'Non assignée'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text)' }}>
                      {c.deskNumber || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 700,
                          background: isAbsent ? 'rgba(239, 68, 68, 0.12)' : 'rgba(47,143,91,0.12)',
                          color: isAbsent ? 'var(--red, #ef4444)' : 'var(--green, var(--green))',
                        }}
                      >
                        {isAbsent ? 'ABSENT' : 'PRÉSENT'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleTogglePresence(c.id, isAbsent)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: 'none',
                          background: isAbsent ? 'var(--green, var(--green))' : 'var(--red, #ef4444)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: isUpdating ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {isUpdating ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : isAbsent ? (
                          <>
                            <Check size={13} /> Marquer Présent
                          </>
                        ) : (
                          <>
                            <X size={13} /> Marquer Absent
                          </>
                        )}
                      </button>
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
