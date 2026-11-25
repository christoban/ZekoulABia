'use client';
import { useState } from 'react';
import { Building2, Users, Download, Shuffle, Plus, FileText, CheckCircle } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import ConcoursEmargementModal from './ConcoursEmargementModal';

interface Room {
  id: string;
  sessionId: string;
  name: string;
  capacity: number;
  assignedCandidatesCount?: number;
}

interface Props {
  sessionId: string;
  rooms: Room[];
  totalCandidates: number;
  onRefresh: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ConcoursRoomsManager({
  sessionId,
  rooms,
  totalCandidates,
  onRefresh,
  onToast,
}: Props) {
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [activeEmargementRoom, setActiveEmargementRoom] = useState<Room | null>(null);

  const totalCapacity = rooms.reduce((acc, r) => acc + r.capacity, 0);
  const totalAssigned = rooms.reduce((acc, r) => acc + (r.assignedCandidatesCount || 0), 0);

  const handleCreateRoom = async () => {
    if (!newRoomName || !newRoomCapacity) {
      onToast('Nom et capacité de salle requis', 'error');
      return;
    }
    try {
      setCreating(true);
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newRoomName, capacity: Number(newRoomCapacity) }),
      });
      const data = await res.json();
      if (data.success) {
        onToast('Salle créée avec succès', 'success');
        setNewRoomName('');
        setNewRoomCapacity('');
        onRefresh();
      } else {
        onToast(data.message || 'Erreur lors de la création', 'error');
      }
    } catch {
      onToast('Erreur de connexion', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleAutoAssign = async (mode: 'ALPHABETIQUE' | 'ALEATOIRE') => {
    try {
      setAssigning(true);
      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/rooms/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.success) {
        onToast(`Répartition effectuée : ${data.data.totalCandidats} candidats assignés`, 'success');
        onRefresh();
      } else {
        onToast(data.message || 'Erreur de répartition', 'error');
      }
    } catch {
      onToast('Erreur de connexion', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleDownloadEmargement = (roomId: string) => {
    const url = `/api/v2/entrance-exams/${sessionId}/rooms/${roomId}/emargement-pdf`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Building2 size={20} color="var(--accent, #2563eb)" /> Salles d'examen & Répartition
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 0 0' }}>
            {rooms.length} salle(s) configurée(s) — Capacité totale : {totalCapacity} places | Candidats : {totalCandidates} (Assignés : {totalAssigned})
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleAutoAssign('ALPHABETIQUE')}
            disabled={assigning || rooms.length === 0}
            style={{
              padding: '8px 14px',
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
            <Users size={16} /> Répartition alphabétique
          </button>
          <button
            onClick={() => handleAutoAssign('ALEATOIRE')}
            disabled={assigning || rooms.length === 0}
            style={{
              padding: '8px 14px',
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
            <Shuffle size={16} /> Répartition aléatoire
          </button>
        </div>
      </div>

      {/* Formulaire ajout salle */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Nom de la salle (ex: Salle 12, Bâtiment B)"
          value={newRoomName}
          onChange={e => setNewRoomName(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, flex: 2, minWidth: 200 }}
        />
        <input
          type="number"
          placeholder="Capacité (places)"
          value={newRoomCapacity}
          onChange={e => setNewRoomCapacity(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, width: 140 }}
        />
        <button
          onClick={handleCreateRoom}
          disabled={creating}
          style={{
            padding: '7px 16px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--accent, #2563eb)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus size={16} /> {creating ? 'Création...' : 'Ajouter la salle'}
        </button>
      </div>

      {/* Grille des salles */}
      {rooms.length === 0 ? (
        <p style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic', margin: 0 }}>
          Aucune salle enregistrée. Ajoutez des salles pour répartir les candidats et éditer les listes d'émargement.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {rooms.map(r => {
            const assigned = r.assignedCandidatesCount || 0;
            const pct = Math.min(100, Math.round((assigned / r.capacity) * 100));

            return (
              <div
                key={r.id}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{r.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
                      {assigned} / {r.capacity} places
                    </span>
                  </div>

                  {/* Barre de remplissage */}
                  <div style={{ height: 6, width: '100%', background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: pct > 100 ? 'var(--red, #ef4444)' : 'var(--green, #16a34a)',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setActiveEmargementRoom(r)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'var(--green, #16a34a)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <CheckCircle size={14} /> Émarger (Jour J)
                  </button>

                  <button
                    onClick={() => handleDownloadEmargement(r.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Download size={14} /> Liste PDF
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeEmargementRoom && (
        <ConcoursEmargementModal
          sessionId={sessionId}
          room={activeEmargementRoom}
          isOpen={true}
          onClose={() => {
            setActiveEmargementRoom(null);
            onRefresh();
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}
