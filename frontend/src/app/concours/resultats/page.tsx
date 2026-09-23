'use client';
import { useState } from 'react';
import { Award, Search, Calendar, Hash, CheckCircle2, Clock, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface GradeItem {
  subjectName: string;
  score: number | null;
  maxScore: number;
}

interface Resultat {
  candidateNumber: string;
  candidateFullName: string;
  admissionStatus: string;
  totalAverage: number | null;
  rank: number | null;
  grades: GradeItem[];
  reservationExpiresAt: string | null;
  message: string;
}

export default function ResultatsConcoursPublicPage() {
  const [sessionId, setSessionId] = useState('');
  const [candidateNumber, setCandidateNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateNumber || !dateOfBirth) {
      setError('Veuillez renseigner le code candidat et la date de naissance.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResultat(null);

      const res = await fetch('/api/v2/entrance-exams/public/resultats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          candidateNumber: candidateNumber.trim(),
          dateOfBirth,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResultat(data.data);
      } else {
        setError(data.message || 'Aucun résultat trouvé pour ces identifiants.');
      }
    } catch {
      setError('Erreur de communication avec le serveur. Veuillez réessayer ultérieurement.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ADMIS':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--green-light)', color: '#15803d', fontWeight: 700, fontSize: 14 }}>
            <CheckCircle2 size={18} /> Admis(e)
          </span>
        );
      case 'ADMIS_PROVISOIRE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#fef9c3', color: '#854d0e', fontWeight: 700, fontSize: 14 }}>
            <Clock size={18} /> Admis(e) sous réserve de CEP
          </span>
        );
      case 'LISTE_ATTENTE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#fed7aa', color: '#9a3412', fontWeight: 700, fontSize: 14 }}>
            <AlertCircle size={18} /> Liste d'attente
          </span>
        );
      case 'REFUSE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: 14 }}>
            <XCircle size={18} /> Non retenu(e)
          </span>
        );
      case 'INSCRIT':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: '#e0e7ff', color: '#3730a3', fontWeight: 700, fontSize: 14 }}>
            <CheckCircle2 size={18} /> Inscription confirmée
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600, fontSize: 14 }}>
            {status}
          </span>
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)', color: 'var(--text, #0f172a)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border, #e2e8f0)', background: 'var(--surface, #ffffff)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'var(--text, #0f172a)', fontWeight: 700, fontSize: 18 }}>
            <Award color="#2563eb" size={24} />
            <span>ZekoulABia — Concours d'entrée</span>
          </Link>
          <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13, color: 'var(--text2, #64748b)', fontWeight: 600 }}>
            <ArrowLeft size={16} /> Espace établissement
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: 680, width: '100%', margin: '40px auto', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text, #0f172a)', margin: '0 0 8px 0' }}>
            Consultation des résultats officiels
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text2, #64748b)', margin: 0 }}>
            Saisissez le code anonymisé présent sur la convocation ainsi que la date de naissance du candidat.
          </p>
        </div>

        {/* Formulaire de recherche */}
        <div style={{ background: 'var(--surface, #ffffff)', borderRadius: 16, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border, #e2e8f0)', marginBottom: 28 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 8 }}>
                Code candidat (présent sur la carte de convocation)
              </label>
              <div style={{ position: 'relative' }}>
                <Hash size={18} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text3, #94a3b8)' }} />
                <input
                  type="text"
                  placeholder="Ex : EK-C042, LYC-C001..."
                  value={candidateNumber}
                  onChange={e => setCandidateNumber(e.target.value.toUpperCase())}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    borderRadius: 10,
                    border: '1.5px solid var(--border, #cbd5e1)',
                    background: 'var(--bg, #f8fafc)',
                    fontSize: 15,
                    fontWeight: 600,
                    letterSpacing: 1,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 8 }}>
                Date de naissance du candidat
              </label>
              <div style={{ position: 'relative' }}>
                <Calendar size={18} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text3, #94a3b8)' }} />
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    borderRadius: 10,
                    border: '1.5px solid var(--border, #cbd5e1)',
                    background: 'var(--bg, #f8fafc)',
                    fontSize: 15,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '14px 24px',
                borderRadius: 10,
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.2s ease',
              }}
            >
              <Search size={18} /> {loading ? 'Recherche en cours...' : 'Consulter mon résultat'}
            </button>
          </form>

          {error && (
            <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Affichage du résultat */}
        {resultat && (
          <div style={{ background: 'var(--surface, #ffffff)', borderRadius: 16, padding: 28, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid var(--border, #e2e8f0)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20, borderBottom: '1px solid var(--border, #e2e8f0)', paddingBottom: 16 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3, #94a3b8)', letterSpacing: 0.5 }}>
                  CANDIDAT : {resultat.candidateNumber}
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text, #0f172a)', margin: '4px 0 0 0' }}>
                  {resultat.candidateFullName}
                </h2>
              </div>
              <div>{getStatusBadge(resultat.admissionStatus)}</div>
            </div>

            {/* Message personnalisé */}
            <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', fontSize: 14, lineHeight: 1.5, color: 'var(--text, #0f172a)', marginBottom: 24 }}>
              {resultat.message}
            </div>

            {/* Statistiques générales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--bg, #f8fafc)', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid var(--border, #e2e8f0)' }}>
                <span style={{ fontSize: 12, color: 'var(--text3, #64748b)' }}>Moyenne générale</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
                  {resultat.totalAverage !== null ? `${resultat.totalAverage.toFixed(2)} / 20` : '-'}
                </div>
              </div>
              <div style={{ background: 'var(--bg, #f8fafc)', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid var(--border, #e2e8f0)' }}>
                <span style={{ fontSize: 12, color: 'var(--text3, #64748b)' }}>Rang officiel</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text, #0f172a)', marginTop: 4 }}>
                  {resultat.rank ? `${resultat.rank}e` : '-'}
                </div>
              </div>
              {resultat.reservationExpiresAt && (
                <div style={{ background: '#fef9c3', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid #facc15' }}>
                  <span style={{ fontSize: 12, color: '#854d0e' }}>Délai d'inscription</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#854d0e', marginTop: 6 }}>
                    Avant le {new Date(resultat.reservationExpiresAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              )}
            </div>

            {/* Relevé des notes par épreuve */}
            {resultat.grades.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: 12 }}>
                  Détail des notes par épreuve
                </h3>
                <div style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Épreuve</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Note obtenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultat.grades.map((g, i) => (
                        <tr key={i} style={{ borderBottom: i < resultat.grades.length - 1 ? '1px solid var(--border, #e2e8f0)' : 'none' }}>
                          <td style={{ padding: '10px 14px', color: 'var(--text, #0f172a)' }}>{g.subjectName}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                            {g.score !== null ? `${g.score} / ${g.maxScore}` : 'Absent'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
