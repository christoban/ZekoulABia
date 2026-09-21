'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Printer,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export interface Candidate {
  id: string;
  candidateNumber?: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  originSchool?: string | null;
  parentPhone?: string | null;
  examScore?: number | null;
  admissionStatus: string;
  cepResult?: string | null;
  roomName?: string | null;
  deskNumber?: number | null;
  registrationFeePaid?: boolean;
  documentsComplete?: boolean;
}

interface Props {
  sessionId: string;
  candidates: Candidate[];
  onOpenAddModal: () => void;
  onRefresh: () => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function TabCandidats({
  sessionId,
  candidates,
  onOpenAddModal,
  onToast,
}: Props) {
  const [search, setSearch] = useState('');
  const [filterPieces, setFilterPieces] = useState(false);
  const [filterFrais, setFilterFrais] = useState(false);

  // Filtrage
  const filtered = candidates.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      c.lastName.toLowerCase().includes(q) ||
      c.firstName.toLowerCase().includes(q) ||
      (c.candidateNumber && c.candidateNumber.toLowerCase().includes(q)) ||
      (c.originSchool && c.originSchool.toLowerCase().includes(q));

    const matchPieces = !filterPieces || !c.documentsComplete;
    const matchFrais = !filterFrais || !c.registrationFeePaid;

    return matchSearch && matchPieces && matchFrais;
  });

  const handleExportExcel = () => {
    try {
      const dataToExport = candidates.map((c, idx) => ({
        'N°': idx + 1,
        'Code Candidat': c.candidateNumber || 'En attente',
        Nom: c.lastName,
        'Prénom(s)': c.firstName,
        'Date de naissance': c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString('fr-FR') : '',
        "École d'origine": c.originSchool || '',
        'Téléphone parent': c.parentPhone || '',
        Salle: c.roomName || 'Non assignée',
        Place: c.deskNumber || '',
        Statut: c.admissionStatus,
        'Frais réglés': c.registrationFeePaid ? 'Oui' : 'Non',
        'Pièces complètes': c.documentsComplete ? 'Oui' : 'Non',
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Candidats');
      XLSX.writeFile(wb, `candidats-concours-${sessionId.slice(0, 8)}.xlsx`);
      onToast('Export Excel généré avec succès', 'success');
    } catch {
      onToast("Erreur lors de l'export Excel", 'error');
    }
  };

  const handlePrintConvocation = (candId: string) => {
    window.open(`/api/v2/entrance-exams/candidates/${candId}/convocation-pdf`, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        {/* Recherche et filtres */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (nom, code, école...)"
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

          <button
            type="button"
            onClick={() => setFilterPieces((v) => !v)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: filterPieces ? '1px solid var(--accent, #2563eb)' : '1px solid var(--border)',
              background: filterPieces ? 'rgba(37, 99, 235, 0.08)' : 'var(--surface)',
              color: filterPieces ? 'var(--accent, #2563eb)' : 'var(--text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileText size={14} /> Pièces manquantes
          </button>

          <button
            type="button"
            onClick={() => setFilterFrais((v) => !v)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: filterFrais ? '1px solid var(--accent, #2563eb)' : '1px solid var(--border)',
              background: filterFrais ? 'rgba(37, 99, 235, 0.08)' : 'var(--surface)',
              color: filterFrais ? 'var(--accent, #2563eb)' : 'var(--text)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <DollarSign size={14} /> Frais non réglés
          </button>
        </div>

        {/* Boutons actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={handleExportExcel}
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
            <FileSpreadsheet size={15} /> Exporter
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent, #2563eb)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
            }}
          >
            <Plus size={16} /> Ajouter des candidats
          </button>
        </div>
      </div>

      {/* Tableau des candidats */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 12,
            background: 'var(--bg)',
          }}
        >
          <AlertCircle size={32} style={{ color: 'var(--text3)', margin: '0 auto 8px' }} />
          <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>
            {candidates.length === 0 ? 'Aucun candidat inscrit pour le moment.' : 'Aucun candidat ne correspond aux filtres.'}
          </div>
          {candidates.length === 0 && (
            <button
              type="button"
              onClick={onOpenAddModal}
              style={{
                marginTop: 12,
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent, #2563eb)',
                color: '#fff',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Ajouter les premiers candidats
            </button>
          )}
        </div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text2)' }}>Code</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text2)' }}>Nom & Prénom(s)</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text2)' }}>École d&apos;origine</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text2)' }}>Tél. Parent</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text2)' }}>Salle</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Pièces</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Frais</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
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
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent, #2563eb)' }}>
                    {c.candidateNumber || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                    {c.lastName} {c.firstName}
                    {c.dateOfBirth && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>
                        Né(e) le {new Date(c.dateOfBirth).toLocaleDateString('fr-FR')}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>
                    {c.originSchool || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>
                    {c.parentPhone || <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>Aucun</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text)' }}>
                    {c.roomName ? (
                      <span>
                        {c.roomName} {c.deskNumber && <span style={{ color: 'var(--text3)' }}>(P.{c.deskNumber})</span>}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text3)', fontSize: 12 }}>Non assigné</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {c.documentsComplete ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--green, #10b981)', margin: '0 auto' }} />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--amber, #f59e0b)', fontWeight: 600 }}>Incomplet</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {c.registrationFeePaid ? (
                      <CheckCircle2 size={16} style={{ color: 'var(--green, #10b981)', margin: '0 auto' }} />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--amber, #f59e0b)', fontWeight: 600 }}>À régler</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          c.admissionStatus === 'ADMIS' || c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'INSCRIT'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : c.admissionStatus === 'ADMIS_PROVISOIRE'
                            ? 'rgba(59, 130, 246, 0.12)'
                            : c.admissionStatus === 'LISTE_ATTENTE'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(156, 163, 175, 0.12)',
                        color:
                          c.admissionStatus === 'ADMIS' || c.admissionStatus === 'CONFIRME' || c.admissionStatus === 'INSCRIT'
                            ? 'var(--green, #10b981)'
                            : c.admissionStatus === 'ADMIS_PROVISOIRE'
                            ? 'var(--accent, #2563eb)'
                            : c.admissionStatus === 'LISTE_ATTENTE'
                            ? 'var(--amber, #f59e0b)'
                            : 'var(--text3)',
                      }}
                    >
                      {c.admissionStatus}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <button
                      type="button"
                      title="Imprimer la convocation"
                      onClick={() => handlePrintConvocation(c.id)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text)',
                        fontSize: 12,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Printer size={13} /> Convocation
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
