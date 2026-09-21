'use client';

import React from 'react';
import { X, BookOpen, Building2, Award, Calendar, DollarSign, Clock, Users } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
  coefficient: number;
  maxScore: number;
  eliminatoryScore?: number | null;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  assignedCandidatesCount?: number;
}

interface SessionDetails {
  id: string;
  name: string;
  status: string;
  examDate: string;
  admissionThreshold: number | null;
  availableSeats: number | null;
  registrationFee?: number | null;
  seatReservationDays?: number | null;
  academicEvent?: {
    title: string;
    description?: string;
  } | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  session: SessionDetails | null;
  subjects: Subject[];
  rooms: Room[];
}

export default function ModalVoirConfigurationConcours({
  isOpen,
  onClose,
  session,
  subjects,
  rooms,
}: Props) {
  if (!isOpen || !session) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg2)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              Configuration du Concours (Lecture seule)
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: 13, color: 'var(--text3)' }}>
              Paramètres définis par la direction dans le calendrier officiel
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text3)',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Cartes métriques */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 4 }}>
                <Calendar size={14} /> Date de composition
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                {session.examDate ? new Date(session.examDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Non définie'}
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 4 }}>
                <Users size={14} /> Places offertes
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent, #2563eb)' }}>
                {session.availableSeats ?? 'Non défini'}
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 4 }}>
                <Award size={14} /> Seuil d&apos;admission
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--green, #10b981)' }}>
                {session.admissionThreshold != null ? `${session.admissionThreshold} / 20` : 'À déterminer'}
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12, marginBottom: 4 }}>
                <DollarSign size={14} /> Frais de dossier
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                {session.registrationFee ? `${session.registrationFee.toLocaleString()} FCFA` : 'Gratuit'}
              </div>
            </div>
          </div>

          {/* Épreuves */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <BookOpen size={16} style={{ color: 'var(--accent, #2563eb)' }} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Épreuves & Barèmes ({subjects.length})
              </h4>
            </div>
            {subjects.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                Aucune matière enregistrée pour cette session.
              </p>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)' }}>Matière</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Coefficient</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Note max</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Note éliminatoire</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((s, idx) => (
                      <tr
                        key={s.id}
                        style={{
                          borderBottom: idx === subjects.length - 1 ? 'none' : '1px solid var(--border)',
                          background: idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>{s.name}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text)' }}>{s.coefficient}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text)' }}>/{s.maxScore}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', color: s.eliminatoryScore ? 'var(--red, #ef4444)' : 'var(--text3)' }}>
                          {s.eliminatoryScore != null ? `< ${s.eliminatoryScore}` : 'Aucune'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Salles */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Building2 size={16} style={{ color: 'var(--accent, #2563eb)' }} />
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Salles prévues ({rooms.length})
              </h4>
            </div>
            {rooms.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                Aucune salle configurée. La répartition sera effectuée dans l&apos;onglet Salles.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {rooms.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      Capacité : {r.capacity} places
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note de gouvernance */}
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'rgba(37, 99, 235, 0.05)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              fontSize: 13,
              color: 'var(--text2)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Clock size={16} style={{ color: 'var(--accent, #2563eb)', flexShrink: 0, marginTop: 2 }} />
            <div>
              Pour modifier les seuils, coefficients ou dates d&apos;épreuves, contactez la direction. Toute modification du calendrier est tracée dans le journal d&apos;audit.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--bg2)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
