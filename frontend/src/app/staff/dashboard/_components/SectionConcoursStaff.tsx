'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Building2,
  CheckSquare,
  FileSpreadsheet,
  Award,
  FileCheck,
  UserCheck,
  Eye,
  Calendar,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import ConcoursLifecycleStepper from '@/app/admin/dashboard/_components/concours/ConcoursLifecycleStepper';
import ConcoursRoomsManager from '@/app/admin/dashboard/_components/concours/ConcoursRoomsManager';
import ConcoursGradesSheet from '@/app/admin/dashboard/_components/concours/ConcoursGradesSheet';
import ConcoursCepBatchModal from '@/app/admin/dashboard/_components/concours/ConcoursCepBatchModal';

import ModalVoirConfigurationConcours from './concours/ModalVoirConfigurationConcours';
import ModalAjoutCandidats4Sources from './concours/ModalAjoutCandidats4Sources';
import TabCandidats, { Candidate } from './concours/TabCandidats';
import TabEmargement from './concours/TabEmargement';
import TabResultatsStaff from './concours/TabResultatsStaff';
import TabAdmisAFinaliser from './concours/TabAdmisAFinaliser';

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface Session {
  id: string;
  name: string;
  status: string;
  examDate: string;
  admissionThreshold: number | null;
  availableSeats: number | null;
  registrationFee?: number | null;
  seatReservationDays?: number | null;
}

interface Subject {
  id: string;
  name: string;
  coefficient: number;
  maxScore: number;
  eliminatoryScore?: number | null;
}

interface Room {
  id: string;
  sessionId: string;
  name: string;
  capacity: number;
  assignedCandidatesCount?: number;
}

type TabType = 'CANDIDATS' | 'SALLES' | 'EMARGEMENT' | 'NOTES' | 'RESULTATS' | 'CEP' | 'FINALISATION';

export default function SectionConcoursStaff({ onToast }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('CANDIDATS');

  // Modales
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCepModal, setShowCepModal] = useState(false);

  // Chargement des sessions actives
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchApi('/api/v2/entrance-exams', { credentials: 'include' });
      const data = await res.json();
      const list: Session[] = data.data ?? [];
      setSessions(list);
      if (list.length > 0 && !selectedSessionId) {
        setSelectedSessionId(list[0].id);
      }
    } catch {
      onToast('Erreur lors du chargement des sessions de concours', 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast, selectedSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Chargement des détails de la session sélectionnée
  const loadSessionDetails = useCallback(async (sessionId: string) => {
    try {
      const [resSummary, resDetails] = await Promise.all([
        fetchApi(`/api/v2/entrance-exams/${sessionId}/summary`, { credentials: 'include' }),
        fetchApi(`/api/v2/entrance-exams/${sessionId}/details`, { credentials: 'include' }),
      ]);
      const dataSummary = await resSummary.json();
      const dataDetails = await resDetails.json();

      if (dataSummary.success && dataSummary.data) {
        setCandidates(dataSummary.data.candidates ?? []);
      }
      if (dataDetails.success && dataDetails.data) {
        setSubjects(dataDetails.data.subjects ?? []);
        setRooms(dataDetails.data.rooms ?? []);
      }
    } catch {
      onToast('Erreur lors du chargement des détails du concours', 'error');
    }
  }, [onToast]);

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionDetails(selectedSessionId);
    }
  }, [selectedSessionId, loadSessionDetails]);

  const currentSession = sessions.find((s) => s.id === selectedSessionId) || null;

  // Calcul de la prochaine action contextuelle
  const getProchaineAction = (status: string): { text: string; tab?: TabType } => {
    switch (status) {
      case 'DRAFT':
      case 'REGISTRATION_OPEN':
        return { text: 'Inscrire les candidats et réceptionner les dossiers', tab: 'CANDIDATS' };
      case 'SEATS_ASSIGNED':
        return { text: 'Répartir les candidats dans les salles et imprimer les convocations', tab: 'SALLES' };
      case 'IN_PROGRESS':
        return { text: 'Procéder à l\'émargement des candidats présents', tab: 'EMARGEMENT' };
      case 'GRADING':
        return { text: 'Saisir les notes des épreuves écrites', tab: 'NOTES' };
      case 'DELIBERATION':
        return { text: 'Délibération en cours par la direction (simulation des seuils)' };
      case 'PUBLISHED':
        return { text: 'Saisir les résultats du CEP et finaliser les admissions confirmées', tab: 'CEP' };
      case 'CLOSED':
        return { text: 'Session clôturée' };
      default:
        return { text: 'Consulter les candidats et les résultats' };
    }
  };

  const prochaineAction = currentSession ? getProchaineAction(currentSession.status) : null;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
        <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
        <div>Chargement des concours d&apos;entrée...</div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', maxWidth: 600, margin: '40px auto', background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
        <Calendar size={48} style={{ color: 'var(--accent, #2563eb)', margin: '0 auto 12px' }} />
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          Aucun Concours d&apos;Entrée Actif
        </h3>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text3)' }}>
          Les concours d&apos;entrée sont programmés par la direction dans le calendrier scolaire officiel. Dès qu&apos;une session est ouverte, elle s&apos;affichera automatiquement ici.
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', width: '100%' }}>
      <div style={{ padding: '24px 28px', maxWidth: 1380, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      {/* Sélecteur de concours s'il y a plusieurs sessions */}
      {sessions.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSessionId(s.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 10,
                border: s.id === selectedSessionId ? '2px solid var(--accent, #2563eb)' : '1px solid var(--border)',
                background: s.id === selectedSessionId ? 'rgba(37, 99, 235, 0.08)' : 'var(--surface)',
                color: s.id === selectedSessionId ? 'var(--accent, #2563eb)' : 'var(--text)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Carte d'en-tête Secrétariat */}
      {currentSession && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
                  {currentSession.name}
                </h2>
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                    background: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--accent, #2563eb)',
                  }}
                >
                  {currentSession.status}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
                Composition prévue le{' '}
                <strong>
                  {currentSession.examDate ? new Date(currentSession.examDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Date à déterminer'}
                </strong>{' '}
                &bull; {candidates.length} candidat(s) enregistrés &bull; {currentSession.availableSeats ?? '—'} places disponibles
              </p>
            </div>

            {/* Action voir configuration */}
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Eye size={15} /> Voir la configuration
            </button>
          </div>

          {/* Frise des 8 phases du concours */}
          <ConcoursLifecycleStepper
            currentStatus={currentSession.status}
            onSelectStep={(st) => {
              if (st === 'REGISTRATION_OPEN') setActiveTab('CANDIDATS');
              else if (st === 'SEATS_ASSIGNED') setActiveTab('SALLES');
              else if (st === 'IN_PROGRESS') setActiveTab('EMARGEMENT');
              else if (st === 'GRADING') setActiveTab('NOTES');
              else if (st === 'PUBLISHED') setActiveTab('RESULTATS');
            }}
          />

          {/* Prochaine action contextuelle */}
          {prochaineAction && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.05)',
                border: '1px solid rgba(37, 99, 235, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
              }}
            >
              <div style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} style={{ color: 'var(--accent, #2563eb)' }} />
                <span>
                  <strong>Prochaine action du secrétariat :</strong> {prochaineAction.text}
                </span>
              </div>
              {prochaineAction.tab && (
                <button
                  type="button"
                  onClick={() => setActiveTab(prochaineAction.tab!)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--accent, #2563eb)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Ouvrir l&apos;onglet
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation des 7 onglets */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {[
          { id: 'CANDIDATS', label: `1. Candidats (${candidates.length})`, icon: Users },
          { id: 'SALLES', label: `2. Salles & Convocations (${rooms.length})`, icon: Building2 },
          { id: 'EMARGEMENT', label: '3. Émargement', icon: CheckSquare },
          { id: 'NOTES', label: `4. Notes (${subjects.length})`, icon: FileSpreadsheet },
          { id: 'RESULTATS', label: '5. Résultats & Affiche', icon: Award },
          { id: 'CEP', label: '6. Résultats CEP', icon: FileCheck },
          { id: 'FINALISATION', label: '7. Admis à finaliser', icon: UserCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                padding: '10px 16px',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent, #2563eb)' : '2px solid transparent',
                background: 'transparent',
                color: isActive ? 'var(--accent, #2563eb)' : 'var(--text2)',
                fontWeight: isActive ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu des onglets */}
      {selectedSessionId && currentSession && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 20 }}>
          {activeTab === 'CANDIDATS' && (
            <TabCandidats
              sessionId={selectedSessionId}
              candidates={candidates}
              onOpenAddModal={() => setShowAddModal(true)}
              onRefresh={() => loadSessionDetails(selectedSessionId)}
              onToast={onToast}
            />
          )}

          {activeTab === 'SALLES' && (
            <ConcoursRoomsManager
              sessionId={selectedSessionId}
              rooms={rooms}
              totalCandidates={candidates.length}
              onRefresh={() => loadSessionDetails(selectedSessionId)}
              onToast={onToast}
            />
          )}

          {activeTab === 'EMARGEMENT' && (
            <TabEmargement
              sessionId={selectedSessionId}
              rooms={rooms}
              candidates={candidates}
              onRefresh={() => loadSessionDetails(selectedSessionId)}
              onToast={onToast}
            />
          )}

          {activeTab === 'NOTES' && (
            <ConcoursGradesSheet
              sessionId={selectedSessionId}
              subjects={subjects}
              candidates={candidates}
              onRefresh={() => loadSessionDetails(selectedSessionId)}
              onToast={onToast}
            />
          )}

          {activeTab === 'RESULTATS' && (
            <TabResultatsStaff
              sessionId={selectedSessionId}
              sessionName={currentSession.name}
              candidates={candidates}
              admissionThreshold={currentSession.admissionThreshold}
              availableSeats={currentSession.availableSeats}
              isPublished={currentSession.status === 'PUBLISHED' || currentSession.status === 'CLOSED'}
              onToast={onToast}
            />
          )}

          {activeTab === 'CEP' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                    Saisie des Résultats Officiels du CEP / FSLC
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
                    Rapprochez les résultats du CEP des admis provisoires par import Excel ou liste à cocher, puis soumettez la proposition à la direction.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCepModal(true)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--accent, #2563eb)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Ouvrir l&apos;assistant CEP en lot
                </button>
              </div>

              {/* Statuts actuels du CEP */}
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                {candidates.filter((c) => c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'INSCRIT').length} admis confirmé(s) avec CEP &bull;{' '}
                {candidates.filter((c) => c.admissionStatus === 'ADMIS_PROVISOIRE').length} en attente de validation CEP.
              </div>
            </div>
          )}

          {activeTab === 'FINALISATION' && (
            <TabAdmisAFinaliser
              sessionId={selectedSessionId}
              sessionName={currentSession.name}
              candidates={candidates}
              availableSeats={currentSession.availableSeats}
              onRefresh={() => loadSessionDetails(selectedSessionId)}
              onToast={onToast}
            />
          )}
        </div>
      )}

      {/* Modal Configuration lecture seule */}
      <ModalVoirConfigurationConcours
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        session={currentSession}
        subjects={subjects}
        rooms={rooms}
      />

      {/* Modal Ajout Candidats 4 Sources */}
      {selectedSessionId && currentSession && (
        <ModalAjoutCandidats4Sources
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          sessionId={selectedSessionId}
          sessionName={currentSession.name}
          existingCandidates={candidates}
          onSuccess={() => loadSessionDetails(selectedSessionId)}
          onToast={onToast}
        />
      )}

      {/* Modal Saisie CEP en Lot (Secrétaire : mode isAdmin=false) */}
      {selectedSessionId && currentSession && (
        <ConcoursCepBatchModal
          isOpen={showCepModal}
          onClose={() => setShowCepModal(false)}
          sessionId={selectedSessionId}
          sessionName={currentSession.name}
          isAdmin={false}
          onRefresh={() => loadSessionDetails(selectedSessionId)}
          onToast={onToast}
        />
      )}
      </div>
    </div>
  );
}
