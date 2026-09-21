'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardList, Users, Building2, Award, Sliders, ArrowLeft, Plus, FileCheck } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import { useT } from '@/lib/i18n';
import ConcoursLifecycleStepper from './concours/ConcoursLifecycleStepper';
import ConcoursRoomsManager from './concours/ConcoursRoomsManager';
import ConcoursGradesSheet from './concours/ConcoursGradesSheet';
import ConcoursDeliberationSimulator from './concours/ConcoursDeliberationSimulator';
import ConcoursCepBatchModal from './concours/ConcoursCepBatchModal';

interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

interface Session {
  id: string; name: string; status: string; examDate: string;
  admissionThreshold: number | null; availableSeats: number | null;
}

interface Subject {
  id: string; name: string; coefficient: number; maxScore: number; eliminatoryScore?: number | null;
}

interface Room {
  id: string; sessionId: string; name: string; capacity: number; assignedCandidatesCount?: number;
}

interface Candidate {
  id: string; candidateNumber?: string | null; firstName: string; lastName: string; examScore: number | null;
  totalAverage?: number | null; rank?: number | null; roomName?: string | null; deskNumber?: number | null;
  admissionStatus: string; cepResult: string | null; cepResultDate: string | null;
  studentProfileId: string | null; grades?: { subjectId: string; score: number | null; isAbsent: boolean }[];
}

interface Summary {
  session: Session; total: number; pending: number; admisProvisoire: number;
  confirms: number; annules: number; cepPending: number; candidates: Candidate[];
}

const btnPri = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' as const };
const btnSec = { padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 14, cursor: 'pointer' as const };
const inputStyle = { padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14 };

type TabMode = 'CANDIDATS' | 'SALLES' | 'NOTES' | 'DELIBERATION' | 'CEP';

export default function SectionAdminEntranceExams({ onToast }: Props) {
  const t = useT('admin');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<TabMode>('CANDIDATS');
  const [showCepModal, setShowCepModal] = useState(false);

  // Formulaire de création session
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formThreshold, setFormThreshold] = useState('');
  const [formSeats, setFormSeats] = useState('');
  const [years, setYears] = useState<{ id: string; label: string; isCurrent: boolean }[]>([]);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/api/v2/entrance-exams', { credentials: 'include' });
      const data = await res.json();
      setSessions(data.data ?? []);
    } catch { /* empty */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).then(d => {
      const list = d.data ?? [];
      setYears(list);
      const cur = list.find((y: { isCurrent: boolean }) => y.isCurrent);
      if (cur) setFormYear(cur.id);
    }).catch(() => {});
  }, []);

  const openSessionDetails = async (sessionId: string) => {
    try {
      setSelectedSessionId(sessionId);
      const [resSummary, resDetails] = await Promise.all([
        fetchApi(`/api/v2/entrance-exams/${sessionId}/summary`, { credentials: 'include' }),
        fetchApi(`/api/v2/entrance-exams/${sessionId}/details`, { credentials: 'include' }),
      ]);
      const dataSummary = await resSummary.json();
      const dataDetails = await resDetails.json();

      setSummary(dataSummary.data ?? null);
      if (dataDetails.success && dataDetails.data) {
        setSubjects(dataDetails.data.subjects ?? []);
        setRooms(dataDetails.data.rooms ?? []);
      }
    } catch {
      onToast('Erreur lors du chargement des détails du concours', 'error');
    }
  };

  const handleCreate = async () => {
    if (!formName || !formDate || !formYear) { onToast(t('lv2_choice.fill_all'), 'error'); return; }
    try {
      setCreating(true);
      const res = await fetchApi('/api/v2/entrance-exams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          name: formName, examDate: formDate, academicYearId: formYear,
          admissionThreshold: formThreshold ? Number(formThreshold) : undefined,
          availableSeats: formSeats ? Number(formSeats) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onToast(t('entrance_exams.session_created'), 'success');
        setFormName(''); setFormDate(''); setFormThreshold(''); setFormSeats('');
        loadSessions();
      } else onToast(data.message || t('common.error'), 'error');
    } catch { onToast(t('common.error'), 'error'); } finally { setCreating(false); }
  };

  const handleImport = async () => {
    if (!selectedSessionId) return;
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetchApi(`/api/v2/entrance-exams/${selectedSessionId}/candidates/import`, {
        method: 'POST', credentials: 'include', body: fd,
      });
      const data = await res.json();
      if (data.success) {
        onToast(`Import réussi : ${data.data?.candidats?.length ?? 0} candidats ajoutés`, 'success');
        openSessionDetails(selectedSessionId);
      } else onToast(data.message || 'Erreur d\'import', 'error');
    } catch { onToast('Erreur de connexion', 'error'); }
  };

  return (
    <div className="px-4 py-5 md:px-8 md:py-6" style={{ height: '100%', overflowY: 'auto' }}>
      {/* En-tête principal */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="text-[15px] md:text-[17px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardList size={22} color="var(--accent, #2563eb)" /> {t('entrance_exams.title')} — Gestion complète v2
        </h2>
        {selectedSessionId && (
          <button
            onClick={() => { setSelectedSessionId(null); setSummary(null); }}
            style={{ ...btnSec, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={16} /> Retour aux sessions
          </button>
        )}
      </div>

      {/* Vue 1 : Liste & Création des sessions */}
      {!selectedSessionId && (
        <>
          <div className="rounded-[16px] md:rounded-[12px] p-[16px] md:p-[20px] mb-[20px] md:mb-[24px] border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
            <h3 className="text-[14.5px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
              {t('entrance_exams.create_session')}
            </h3>
            <div className="grid grid-cols-2 sm:flex" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div className="col-span-2 sm:flex-[2] sm:min-w-[200px]">
                <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.session_name')}</label>
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Concours d'entrée en 6e - Session Juin 2026" style={{ ...inputStyle, width: '100%' }} />
              </div>
              <div>
                <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('entrance_exams.exam_date')}</label>
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full sm:w-auto" style={inputStyle} />
              </div>
              <div>
                <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>{t('lv2_choice.academic_year')}</label>
                <select value={formYear} onChange={e => setFormYear(e.target.value)} className="w-full sm:w-auto" style={{ ...inputStyle, minWidth: 140 }}>
                  <option value="">—</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Seuil min (/20)</label>
                <input type="number" value={formThreshold} onChange={e => setFormThreshold(e.target.value)} placeholder="10.0" className="w-full sm:w-[80px]" style={inputStyle} />
              </div>
              <div>
                <label className="text-[12px] md:text-[13px]" style={{ fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>Places disp.</label>
                <input type="number" value={formSeats} onChange={e => setFormSeats(e.target.value)} placeholder="120" className="w-full sm:w-[80px]" style={inputStyle} />
              </div>
              <button onClick={handleCreate} disabled={creating} className="col-span-2 sm:col-span-1" style={{ ...btnPri, borderRadius: 8 }}>
                {creating ? '...' : t('lv2_choice.create')}
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ color: 'var(--text2)' }}>{t('common.loading')}</p>
          ) : sessions.length === 0 ? (
            <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>{t('entrance_exams.no_sessions')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sessions.map(s => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 20px', borderRadius: 10, background: 'var(--surface)',
                    border: '1px solid var(--border)', flexWrap: 'wrap', gap: 10,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{s.name}</span>
                    <span style={{ marginLeft: 12, color: 'var(--text2)', fontSize: 13 }}>
                      Date : {new Date(s.examDate).toLocaleDateString()}
                    </span>
                    <span style={{
                      marginLeft: 12, padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700,
                      background: s.status === 'PUBLISHED' ? 'var(--green-light)' : 'rgba(37,99,235,0.1)',
                      color: s.status === 'PUBLISHED' ? 'var(--green)' : 'var(--accent, #2563eb)',
                    }}>
                      {s.status}
                    </span>
                  </div>
                  <button onClick={() => openSessionDetails(s.id)} style={btnSec}>
                    Gérer le cycle complet →
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Vue 2 : Session sélectionnée — Cycle complet */}
      {selectedSessionId && summary && (
        <div>
          {/* Frise d'avancement du cycle de vie */}
          <ConcoursLifecycleStepper currentStatus={summary.session.status} />

          {/* Onglets navigation interne */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            {[
              { id: 'CANDIDATS' as const, label: 'Inscriptions & Guichet', icon: Users },
              { id: 'SALLES' as const, label: 'Salles & Convocations', icon: Building2 },
              { id: 'NOTES' as const, label: 'Notation & Épreuves', icon: Award },
              { id: 'DELIBERATION' as const, label: 'Délibération & Publication', icon: Sliders },
              { id: 'CEP' as const, label: 'Résultats CEP (Admissions)', icon: FileCheck },
            ].map(tab => {
              const active = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--accent, #2563eb)' : '2px solid transparent',
                    background: 'transparent',
                    color: active ? 'var(--accent, #2563eb)' : 'var(--text2)',
                    fontWeight: active ? 700 : 500,
                    fontSize: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Icon size={16} /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* Contenu de l'onglet actif */}
          {activeTab === 'CANDIDATS' && (
            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                    Candidats inscrits ({summary.total})
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 0 0' }}>
                    Admis : {summary.confirms + summary.admisProvisoire} | En attente : {summary.pending}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="file" ref={fileRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
                  <button onClick={() => fileRef.current?.click()} style={btnSec}>
                    Import Excel
                  </button>
                </div>
              </div>

              {summary.candidates.length === 0 ? (
                <p style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Aucun candidat inscrit.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Code</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nom & Prénom</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Statut</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Moyenne</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Rang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.candidates.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--accent, #2563eb)' }}>
                            {c.candidateNumber || c.id.slice(0, 6)}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.firstName} {c.lastName}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>{c.admissionStatus}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>
                            {c.totalAverage !== null && c.totalAverage !== undefined ? c.totalAverage.toFixed(2) : '-'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>{c.rank ? `${c.rank}e` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'SALLES' && (
            <ConcoursRoomsManager
              sessionId={selectedSessionId}
              rooms={rooms}
              totalCandidates={summary.total}
              onRefresh={() => openSessionDetails(selectedSessionId)}
              onToast={onToast}
            />
          )}

          {activeTab === 'NOTES' && (
            <ConcoursGradesSheet
              sessionId={selectedSessionId}
              subjects={subjects}
              candidates={summary.candidates}
              onRefresh={() => openSessionDetails(selectedSessionId)}
              onToast={onToast}
            />
          )}

          {activeTab === 'DELIBERATION' && (
            <ConcoursDeliberationSimulator
              sessionId={selectedSessionId}
              initialThreshold={summary.session.admissionThreshold}
              initialSeats={summary.session.availableSeats}
              status={summary.session.status}
              onRefresh={() => openSessionDetails(selectedSessionId)}
              onToast={onToast}
            />
          )}

          {activeTab === 'CEP' && (
            <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileCheck size={18} style={{ color: 'var(--blue, #2563eb)' }} /> Résultats du CEP & Confirmation des Admissions
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text2)', margin: '4px 0 0 0' }}>
                    Saisie en lot (à cocher ou import) avec promotion de liste d'attente à la libération de places.
                  </p>
                </div>
                <button
                  onClick={() => setShowCepModal(true)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--blue, #2563eb)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <FileCheck size={16} /> Saisie / Import en lot du CEP
                </button>
              </div>

              {/* Indicateurs de progression CEP */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Admis Provisoires en attente</div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{summary.admisProvisoire}</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(34, 197, 94, 0.08)', borderRadius: 8, border: '1px solid var(--green)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--green)' }}>Confirmés définitifs</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{summary.confirms}</div>
                </div>
                <div style={{ padding: 12, background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, border: '1px solid var(--red)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--red)' }}>Échoués (Places libérées)</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)', marginTop: 4 }}>{summary.annules}</div>
                </div>
              </div>

              {/* Tableau des candidats concernés */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Code</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nom & Prénom</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Statut Admission</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Résultat CEP</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Dossier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.candidates
                      .filter(c => ['ADMIS_PROVISOIRE', 'CONFIRME', 'ANNULE', 'LISTE_ATTENTE'].includes(c.admissionStatus))
                      .map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--accent, #2563eb)' }}>
                            {c.candidateNumber || c.id.slice(0, 6)}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{c.firstName} {c.lastName}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: c.admissionStatus === 'CONFIRME' ? 'var(--green-light)' : c.admissionStatus === 'ADMIS_PROVISOIRE' ? 'rgba(37,99,235,0.1)' : 'var(--bg)',
                              color: c.admissionStatus === 'CONFIRME' ? 'var(--green)' : c.admissionStatus === 'ADMIS_PROVISOIRE' ? 'var(--accent)' : 'var(--text2)',
                            }}>
                              {c.admissionStatus}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {c.cepResult === 'REUSSI' ? '✓ Réussi' : c.cepResult === 'ECHOUE' ? '✕ Échoué' : 'En attente'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {c.studentProfileId ? 'Créé' : c.admissionStatus === 'CONFIRME' ? 'Brouillon prêt' : '-'}
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

      {selectedSessionId && summary && (
        <ConcoursCepBatchModal
          isOpen={showCepModal}
          onClose={() => setShowCepModal(false)}
          sessionId={selectedSessionId}
          sessionName={summary.session.name}
          isAdmin={true}
          onRefresh={() => openSessionDetails(selectedSessionId)}
          onToast={onToast}
        />
      )}
    </div>
  );
}
