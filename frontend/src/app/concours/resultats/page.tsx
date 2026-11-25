'use client';
import { useState } from 'react';
import { Award, Search, Calendar, Hash, CheckCircle2, Clock, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import LanguageSwitch from '@/components/LanguageSwitch';

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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)';
    e.target.style.boxShadow = '0 0 0 3px rgba(227, 176, 75, 0.2)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--border)';
    e.target.style.boxShadow = 'none';
  };

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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--green-light)', color: 'var(--success)', fontWeight: 700, fontSize: 13 }}>
            <CheckCircle2 size={16} /> Admis(e)
          </span>
        );
      case 'ADMIS_PROVISOIRE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--amber-light)', color: 'var(--amber)', fontWeight: 700, fontSize: 13 }}>
            <Clock size={16} /> Admis(e) sous réserve de CEP
          </span>
        );
      case 'LISTE_ATTENTE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--orange-light)', color: 'var(--orange)', fontWeight: 700, fontSize: 13 }}>
            <AlertCircle size={16} /> Liste d'attente
          </span>
        );
      case 'REFUSE':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--red-light)', color: 'var(--red)', fontWeight: 700, fontSize: 13 }}>
            <XCircle size={16} /> Non retenu(e)
          </span>
        );
      case 'INSCRIT':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--blue-light)', color: 'var(--blue)', fontWeight: 700, fontSize: 13 }}>
            <CheckCircle2 size={16} /> Inscription confirmée
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'var(--bg2)', color: 'var(--text2)', fontWeight: 600, fontSize: 13 }}>
            {status}
          </span>
        );
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', position: 'relative', fontFamily: 'var(--font-nunito), Nunito, sans-serif' }}>
      <div className="login-bg" />
      <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '16px 24px', position: 'relative', zIndex: 10 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--text)', fontWeight: 700, fontSize: 18 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg,var(--primary),var(--accent))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(180,83,42,0.22)', overflow: 'hidden'
            }}>
              <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif' }}>ZekoulABia — Concours d'entrée</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>
              <ArrowLeft size={16} /> Espace établissement
            </Link>
            <LanguageSwitch compact />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: 680, width: '100%', margin: '40px auto', padding: '0 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
            Consultation des résultats officiels
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', margin: 0 }}>
            Saisissez le code anonymisé présent sur la convocation ainsi que la date de naissance du candidat.
          </p>
        </div>

        {/* Formulaire de recherche */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)', border: '1px solid var(--border)', marginBottom: 28 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Code candidat (présent sur la carte de convocation)
              </label>
              <div style={{ position: 'relative' }}>
                <Hash size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--text3)' }} />
                <input
                  type="text"
                  placeholder="Ex : EK-C042, LYC-C001..."
                  value={candidateNumber}
                  onChange={e => setCandidateNumber(e.target.value.toUpperCase())}
                  onFocus={handleFocus} onBlur={handleBlur}
                  required
                  style={{
                    width: '100%',
                    minHeight: 48,
                    padding: '12px 16px 12px 42px',
                    borderRadius: 10,
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: 1,
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text2)', marginBottom: 8, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Date de naissance du candidat
              </label>
              <div style={{ position: 'relative' }}>
                <Calendar size={18} style={{ position: 'absolute', left: 14, top: 15, color: 'var(--text3)' }} />
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  onFocus={handleFocus} onBlur={handleBlur}
                  required
                  style={{
                    width: '100%',
                    minHeight: 48,
                    padding: '12px 16px 12px 42px',
                    borderRadius: 10,
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 16,
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                minHeight: 48,
                padding: '12px 24px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--primary)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 15,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = 'var(--primary-hover)')}
              onMouseLeave={e => !loading && (e.currentTarget.style.background = 'var(--primary)')}
            >
              <Search size={18} /> {loading ? 'Recherche en cours...' : 'Consulter mon résultat'}
            </button>
          </form>

          {error && (
            <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: 'var(--red-light)', border: '1px solid rgba(217,72,31,0.2)', color: 'var(--red)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Affichage du résultat */}
        {resultat && (
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  CANDIDAT : {resultat.candidateNumber}
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', margin: '4px 0 0 0', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
                  {resultat.candidateFullName}
                </h2>
              </div>
              <div>{getStatusBadge(resultat.admissionStatus)}</div>
            </div>

            {/* Message personnalisé */}
            <div style={{ padding: 16, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border2)', fontSize: 14, lineHeight: 1.5, color: 'var(--text)', marginBottom: 24 }}>
              {resultat.message}
            </div>

            {/* Statistiques générales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'var(--bg2)', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Moyenne générale</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', marginTop: 4 }}>
                  {resultat.totalAverage !== null ? `${resultat.totalAverage.toFixed(2)} / 20` : '-'}
                </div>
              </div>
              <div style={{ background: 'var(--bg2)', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Rang officiel</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>
                  {resultat.rank ? `${resultat.rank}e` : '-'}
                </div>
              </div>
              {resultat.reservationExpiresAt && (
                <div style={{ background: 'var(--amber-light)', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <span style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>Délai d'inscription</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)', marginTop: 6 }}>
                    Avant le {new Date(resultat.reservationExpiresAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              )}
            </div>

            {/* Relevé des notes par épreuve */}
            {resultat.grades.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
                  Détail des notes par épreuve
                </h3>
                <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text2)' }}>Épreuve</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text2)' }}>Note obtenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultat.grades.map((g, i) => (
                        <tr key={i} style={{ borderBottom: i < resultat.grades.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{g.subjectName}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
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
