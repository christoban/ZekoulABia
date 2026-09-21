'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Keyboard,
  FileSpreadsheet,
  FileText,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Plus,
  ArrowRight,
  Upload,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchApi } from '@/lib/fetchApi';

export interface CandidatAEnregistrer {
  tempId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  originSchool?: string;
  parentPhone?: string;
  gender?: string;
  fraisPayes?: boolean;
  piecesFournies?: boolean;
  isDuplicate?: boolean;
  errorMessage?: string;
}

interface ExistingCandidate {
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  existingCandidates: ExistingCandidate[];
  onSuccess: (count: number) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type SourceType = 'SAISIE' | 'EXCEL' | 'DOCUMENT' | 'PHOTO';

export default function ModalAjoutCandidats4Sources({
  isOpen,
  onClose,
  sessionId,
  sessionName,
  existingCandidates,
  onSuccess,
  onToast,
}: Props) {
  const [step, setStep] = useState<'SOURCE' | 'VERIF'>('SOURCE');
  const [source, setSource] = useState<SourceType>('SAISIE');
  const [candidatesList, setCandidatesList] = useState<CandidatAEnregistrer[]>([]);
  const [saving, setSaving] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);

  // Champs de saisie unitaire manuelle
  const [saisieNom, setSaisieNom] = useState('');
  const [saisiePrenom, setSaisiePrenom] = useState('');
  const [saisieDateNaiss, setSaisieDateNaiss] = useState('');
  const [saisieEcole, setSaisieEcole] = useState('');
  const [saisiePhone, setSaisiePhone] = useState('');
  const [saisieFrais, setSaisieFrais] = useState(false);
  const [saisiePieces, setSaisiePieces] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const verifierDoublons = (list: CandidatAEnregistrer[]): CandidatAEnregistrer[] => {
    return list.map((cand, idx) => {
      const nomNorm = cand.lastName.trim().toLowerCase();
      const prenomNorm = cand.firstName.trim().toLowerCase();

      // Vérif contre les candidats déjà enregistrés en base
      const existeEnBase = existingCandidates.some(
        (ec) =>
          ec.lastName.trim().toLowerCase() === nomNorm &&
          ec.firstName.trim().toLowerCase() === prenomNorm &&
          (!cand.dateOfBirth || !ec.dateOfBirth || ec.dateOfBirth.slice(0, 10) === cand.dateOfBirth.slice(0, 10))
      );

      // Vérif contre les doublons internes au lot
      const doublonInterne = list.some(
        (other, otherIdx) =>
          otherIdx !== idx &&
          other.lastName.trim().toLowerCase() === nomNorm &&
          other.firstName.trim().toLowerCase() === prenomNorm
      );

      const isDup = existeEnBase || doublonInterne;
      return {
        ...cand,
        isDuplicate: isDup,
        errorMessage: !cand.lastName.trim() || !cand.firstName.trim()
          ? 'Nom et prénom obligatoires'
          : isDup
          ? existeEnBase
            ? 'Candidat déjà inscrit à ce concours'
            : 'Doublon détecté dans ce lot'
          : undefined,
      };
    });
  };

  const handleAjouterManuel = () => {
    if (!saisieNom.trim() || !saisiePrenom.trim()) {
      onToast('Nom et prénom obligatoires', 'error');
      return;
    }

    const nouveau: CandidatAEnregistrer = {
      tempId: `man_${Date.now()}_${Math.random()}`,
      lastName: saisieNom.trim().toUpperCase(),
      firstName: saisiePrenom.trim(),
      dateOfBirth: saisieDateNaiss.trim() || undefined,
      originSchool: saisieEcole.trim() || undefined,
      parentPhone: saisiePhone.trim() || undefined,
      fraisPayes: saisieFrais,
      piecesFournies: saisiePieces,
    };

    const updated = verifierDoublons([...candidatesList, nouveau]);
    setCandidatesList(updated);
    setSaisieNom('');
    setSaisiePrenom('');
    setSaisieDateNaiss('');
    setSaisieEcole('');
    setSaisiePhone('');
    setSaisieFrais(false);
    setSaisiePieces(false);
    onToast('Candidat ajouté à la liste de vérification', 'info');
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const imported: CandidatAEnregistrer[] = rows.map((r, i) => {
          // Auto-détection des clés
          const keys = Object.keys(r);
          const getVal = (patterns: string[]): string => {
            const foundKey = keys.find((k) => patterns.some((p) => k.toLowerCase().includes(p)));
            return foundKey ? String(r[foundKey] ?? '').trim() : '';
          };

          const nom = getVal(['nom', 'last', 'surname']);
          const prenom = getVal(['prenom', 'first', 'given']);
          const dateNaiss = getVal(['date', 'naissance', 'birth', 'dob']);
          const ecole = getVal(['ecole', 'school', 'etablissement', 'origine']);
          const phone = getVal(['tel', 'phone', 'contact', 'parent']);

          return {
            tempId: `xls_${Date.now()}_${i}`,
            lastName: nom.toUpperCase(),
            firstName: prenom,
            dateOfBirth: dateNaiss || undefined,
            originSchool: ecole || undefined,
            parentPhone: phone || undefined,
            fraisPayes: false,
            piecesFournies: false,
          };
        }).filter((c) => c.lastName || c.firstName);

        if (imported.length === 0) {
          onToast('Aucun candidat valide détecté dans le fichier', 'error');
        } else {
          const verified = verifierDoublons([...candidatesList, ...imported]);
          setCandidatesList(verified);
          setStep('VERIF');
          onToast(`${imported.length} candidats importés. Veuillez vérifier la liste.`, 'success');
        }
      } catch {
        onToast('Erreur lors de la lecture du fichier Excel/CSV', 'error');
      } finally {
        setProcessingFile(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePhotoScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingFile(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const base64 = (evt.target?.result as string)?.split(',')[1];
        if (!base64) throw new Error('Impossible de lire l\'image');

        const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });

        const data = await res.json();
        if (data.success && Array.isArray(data.data?.candidats)) {
          const scanned: CandidatAEnregistrer[] = data.data.candidats.map((c: any, i: number) => ({
            tempId: `scan_${Date.now()}_${i}`,
            lastName: String(c.nom || c.lastName || '').toUpperCase(),
            firstName: String(c.prenom || c.firstName || ''),
            dateOfBirth: c.dateNaissance || c.dateOfBirth,
            originSchool: c.ecoleOrigine || c.originSchool,
            parentPhone: c.telephoneParent || c.parentPhone,
            fraisPayes: false,
            piecesFournies: false,
          }));

          const verified = verifierDoublons([...candidatesList, ...scanned]);
          setCandidatesList(verified);
          setStep('VERIF');
          onToast(`${scanned.length} candidats reconnus par OCR/Vision. Vérifiez la liste.`, 'success');
        } else {
          onToast(data.message || 'Aucun texte clair détecté sur le document', 'error');
        }
      } catch {
        onToast('Erreur lors de l\'analyse du scan', 'error');
      } finally {
        setProcessingFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEnregistrerTout = async () => {
    const valides = candidatesList.filter((c) => !c.errorMessage && !c.isDuplicate);
    if (valides.length === 0) {
      onToast('Aucun candidat valide à enregistrer', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        candidats: valides.map((c) => ({
          firstName: c.firstName,
          lastName: c.lastName,
          dateOfBirth: c.dateOfBirth,
          originSchool: c.originSchool,
          parentPhone: c.parentPhone,
        })),
      };

      const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        onToast(`${valides.length} candidats enregistrés avec succès !`, 'success');
        onSuccess(valides.length);
        onClose();
      } else {
        onToast(data.message || 'Erreur lors de l\'enregistrement des candidats', 'error');
      }
    } catch {
      onToast('Erreur de communication avec le serveur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const modifierLigne = (tempId: string, champ: keyof CandidatAEnregistrer, val: any) => {
    const updated = candidatesList.map((c) => (c.tempId === tempId ? { ...c, [champ]: val } : c));
    setCandidatesList(verifierDoublons(updated));
  };

  const supprimerLigne = (tempId: string) => {
    const updated = candidatesList.filter((c) => c.tempId !== tempId);
    setCandidatesList(verifierDoublons(updated));
  };

  const countErreurs = candidatesList.filter((c) => c.errorMessage || c.isDuplicate).length;
  const countValides = candidatesList.length - countErreurs;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
          maxWidth: step === 'VERIF' ? 960 : 720,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 45px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          transition: 'max-width 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg2)',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
              Ajout de Candidats au Concours
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: 13, color: 'var(--text3)' }}>
              Session : <strong>{sessionName}</strong> &bull; 4 modes d&apos;entrée vers un écran unique de vérification
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps modal */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {step === 'SOURCE' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Choix des 4 sources */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { id: 'SAISIE', label: 'Saisie Guichet', icon: Keyboard, desc: 'Un par un' },
                  { id: 'EXCEL', label: 'Excel / CSV', icon: FileSpreadsheet, desc: 'Fichier tableur' },
                  { id: 'DOCUMENT', label: 'PDF / Texte', icon: FileText, desc: 'Liste numérique' },
                  { id: 'PHOTO', label: 'Photo / Scan', icon: Camera, desc: 'Reconnaissance OCR' },
                ].map((s) => {
                  const Icon = s.icon;
                  const isSelected = source === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSource(s.id as SourceType)}
                      style={{
                        padding: '12px 10px',
                        borderRadius: 10,
                        border: isSelected ? '2px solid var(--accent, #2563eb)' : '1px solid var(--border)',
                        background: isSelected ? 'rgba(37, 99, 235, 0.06)' : 'var(--bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        textAlign: 'center',
                      }}
                    >
                      <Icon size={20} color={isSelected ? 'var(--accent, #2563eb)' : 'var(--text2)'} />
                      <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--accent, #2563eb)' : 'var(--text)' }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.desc}</div>
                    </button>
                  );
                })}
              </div>

              {/* Source 1 : Saisie Guichet */}
              {source === 'SAISIE' && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18, background: 'var(--bg)' }}>
                  <h4 style={{ margin: '0 0 14px 0', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    Saisie d&apos;un candidat au guichet
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                        Nom de famille *
                      </label>
                      <input
                        type="text"
                        value={saisieNom}
                        onChange={(e) => setSaisieNom(e.target.value)}
                        placeholder="Ex: NGONO"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                        Prénom(s) *
                      </label>
                      <input
                        type="text"
                        value={saisiePrenom}
                        onChange={(e) => setSaisiePrenom(e.target.value)}
                        placeholder="Ex: Marie Chantal"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                        Date de naissance
                      </label>
                      <input
                        type="date"
                        value={saisieDateNaiss}
                        onChange={(e) => setSaisieDateNaiss(e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                        École d&apos;origine
                      </label>
                      <input
                        type="text"
                        value={saisieEcole}
                        onChange={(e) => setSaisieEcole(e.target.value)}
                        placeholder="Ex: École Publique de Bastos"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 4 }}>
                        Téléphone du parent
                      </label>
                      <input
                        type="tel"
                        value={saisiePhone}
                        onChange={(e) => setSaisiePhone(e.target.value)}
                        placeholder="Ex: +237 690 00 00 00"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={saisieFrais}
                          onChange={(e) => setSaisieFrais(e.target.checked)}
                        />
                        Frais réglés
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={saisiePieces}
                          onChange={(e) => setSaisiePieces(e.target.checked)}
                        />
                        Pièces fournies
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleAjouterManuel}
                      style={{
                        padding: '8px 18px',
                        borderRadius: 8,
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
                      <Plus size={16} /> Ajouter à la liste
                    </button>
                  </div>
                </div>
              )}

              {/* Source 2 : Excel / CSV */}
              {source === 'EXCEL' && (
                <div
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 12,
                    padding: 36,
                    textAlign: 'center',
                    background: 'var(--bg)',
                  }}
                >
                  <FileSpreadsheet size={40} style={{ color: 'var(--accent, #2563eb)', margin: '0 auto 12px' }} />
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    Importer un fichier Excel (.xlsx, .xls) ou CSV
                  </h4>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--text3)' }}>
                    Colonnes détectées automatiquement : Nom, Prénom, Date de naissance, École d&apos;origine, Téléphone
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls, .csv"
                    style={{ display: 'none' }}
                    onChange={handleExcelUpload}
                  />
                  <button
                    type="button"
                    disabled={processingFile}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--accent, #2563eb)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {processingFile ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Choisir le fichier
                  </button>
                </div>
              )}

              {/* Source 3 : PDF / Document numérique */}
              {source === 'DOCUMENT' && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 20, background: 'var(--bg)' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    Coller une liste texte ou document numérique
                  </h4>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text3)' }}>
                    Collez le texte brut copié d&apos;un document Word ou PDF (une ligne par candidat : Nom Prénom [Téléphone])
                  </p>
                  <textarea
                    rows={6}
                    placeholder="Ex:&#10;NGONO Marie 690000001&#10;ESSOMBA Jean 690000002"
                    style={{
                      width: '100%',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text)',
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                    onBlur={(e) => {
                      const text = e.target.value.trim();
                      if (!text) return;
                      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
                      const parsed: CandidatAEnregistrer[] = lines.map((line, idx) => {
                        const parts = line.split(/\s+/);
                        const phone = parts.find((p) => /^[0-9+]{8,15}$/.test(p));
                        const nameParts = parts.filter((p) => p !== phone);
                        return {
                          tempId: `txt_${Date.now()}_${idx}`,
                          lastName: (nameParts[0] || '').toUpperCase(),
                          firstName: nameParts.slice(1).join(' ') || 'Prénom',
                          parentPhone: phone,
                          fraisPayes: false,
                          piecesFournies: false,
                        };
                      });
                      setCandidatesList(verifierDoublons([...candidatesList, ...parsed]));
                      onToast(`${parsed.length} candidats ajoutés depuis le texte`, 'info');
                    }}
                  />
                </div>
              )}

              {/* Source 4 : Photo / Scan */}
              {source === 'PHOTO' && (
                <div
                  style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 12,
                    padding: 36,
                    textAlign: 'center',
                    background: 'var(--bg)',
                  }}
                >
                  <Camera size={40} style={{ color: 'var(--accent, #2563eb)', margin: '0 auto 12px' }} />
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    Scanner ou photographier une liste imprimée
                  </h4>
                  <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--text3)' }}>
                    Prenez une photo nette de la liste manuscrite ou tapuscrite des candidats. L&apos;IA extraira les noms.
                  </p>
                  <input
                    type="file"
                    ref={photoInputRef}
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={handlePhotoScanUpload}
                  />
                  <button
                    type="button"
                    disabled={processingFile}
                    onClick={() => photoInputRef.current?.click()}
                    style={{
                      padding: '10px 22px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--accent, #2563eb)',
                      color: '#fff',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {processingFile ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                    Prendre la photo / Sélectionner
                  </button>
                </div>
              )}

              {/* Barre de transition vers la vérification si des candidats sont prêts */}
              {candidatesList.length > 0 && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                    {candidatesList.length} candidat(s) en attente de vérification
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('VERIF')}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'var(--green, #10b981)',
                      color: '#fff',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    Vérifier la liste <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Écran unique de vérification */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Compteurs d'état */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--green, #10b981)', fontWeight: 700, fontSize: 13 }}>
                    ✓ {countValides} valides
                  </div>
                  {countErreurs > 0 && (
                    <div style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red, #ef4444)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={14} /> {countErreurs} à corriger / doublons
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setStep('SOURCE')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: 'var(--bg)',
                    color: 'var(--text)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  + Ajouter d&apos;autres candidats
                </button>
              </div>

              {/* Tableau modifiable */}
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '8px 10px', width: 40 }}>#</th>
                      <th style={{ padding: '8px 10px' }}>Nom *</th>
                      <th style={{ padding: '8px 10px' }}>Prénom(s) *</th>
                      <th style={{ padding: '8px 10px' }}>Date Naiss.</th>
                      <th style={{ padding: '8px 10px' }}>École d&apos;origine</th>
                      <th style={{ padding: '8px 10px' }}>Tél. Parent</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 60 }}>Frais</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatesList.map((cand, idx) => {
                      const hasError = cand.isDuplicate || cand.errorMessage;
                      return (
                        <tr
                          key={cand.tempId}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            background: hasError ? 'rgba(239, 68, 68, 0.05)' : idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                          }}
                        >
                          <td style={{ padding: '8px 10px', color: 'var(--text3)', fontSize: 12 }}>{idx + 1}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="text"
                              value={cand.lastName}
                              onChange={(e) => modifierLigne(cand.tempId, 'lastName', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: hasError && !cand.lastName ? '1px solid var(--red)' : '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                fontSize: 13,
                              }}
                            />
                            {cand.errorMessage && (
                              <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 2 }}>
                                {cand.errorMessage}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="text"
                              value={cand.firstName}
                              onChange={(e) => modifierLigne(cand.tempId, 'firstName', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: hasError && !cand.firstName ? '1px solid var(--red)' : '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                fontSize: 13,
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="date"
                              value={cand.dateOfBirth || ''}
                              onChange={(e) => modifierLigne(cand.tempId, 'dateOfBirth', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 6px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                fontSize: 12,
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="text"
                              value={cand.originSchool || ''}
                              onChange={(e) => modifierLigne(cand.tempId, 'originSchool', e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                fontSize: 13,
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="tel"
                              value={cand.parentPhone || ''}
                              onChange={(e) => modifierLigne(cand.tempId, 'parentPhone', e.target.value)}
                              placeholder="+237..."
                              style={{
                                width: '100%',
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text)',
                                fontSize: 13,
                              }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={cand.fraisPayes || false}
                              onChange={(e) => modifierLigne(cand.tempId, 'fraisPayes', e.target.checked)}
                            />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => supprimerLigne(cand.tempId)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text3)' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg2)',
          }}
        >
          {step === 'VERIF' ? (
            <button
              type="button"
              onClick={() => setStep('SOURCE')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              &larr; Retour aux modes d&apos;entrée
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Les doublons et erreurs seront signalés sur l&apos;écran de vérification.
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>

            {step === 'VERIF' && (
              <button
                type="button"
                disabled={saving || countValides === 0}
                onClick={handleEnregistrerTout}
                style={{
                  padding: '8px 22px',
                  borderRadius: 8,
                  border: 'none',
                  background: countValides > 0 ? 'var(--green, #10b981)' : 'var(--border)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: countValides > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                Enregistrer les {countValides} candidat(s)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
