'use client';

import React, { useState, useRef } from 'react';
import { Loader2, X } from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import AjoutCandidatsSourcesPanel from './AjoutCandidatsSourcesPanel';
import AjoutCandidatsVerifTable from './AjoutCandidatsVerifTable';
import {
  type CandidatAEnregistrer,
  type ExistingCandidate,
  type ScannedCandidateRaw,
  type SourceType,
  mapScannedCandidates,
  parseExcelCandidates,
  parseTextCandidates,
  verifierDoublons,
} from './ajoutCandidatsUtils';

export type { CandidatAEnregistrer };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  sessionName: string;
  existingCandidates: ExistingCandidate[];
  onSuccess: (count: number) => void;
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

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

    setCandidatesList(verifierDoublons([...candidatesList, nouveau], existingCandidates));
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
        const imported = parseExcelCandidates(evt.target?.result);
        if (imported.length === 0) {
          onToast('Aucun candidat valide détecté dans le fichier', 'error');
        } else {
          setCandidatesList(verifierDoublons([...candidatesList, ...imported], existingCandidates));
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

  const handleTextBlur = (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    const parsed = parseTextCandidates(text);
    setCandidatesList(verifierDoublons([...candidatesList, ...parsed], existingCandidates));
    onToast(`${parsed.length} candidats ajoutés depuis le texte`, 'info');
  };

  const handlePhotoScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessingFile(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const base64 = (evt.target?.result as string)?.split(',')[1];
        if (!base64) throw new Error("Impossible de lire l'image");

        const res = await fetchApi(`/api/v2/entrance-exams/${sessionId}/candidates/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });

        const data = await res.json();
        if (data.success && Array.isArray(data.data?.candidats)) {
          const scanned = mapScannedCandidates(data.data.candidats as ScannedCandidateRaw[]);
          setCandidatesList(verifierDoublons([...candidatesList, ...scanned], existingCandidates));
          setStep('VERIF');
          onToast(`${scanned.length} candidats reconnus par OCR/Vision. Vérifiez la liste.`, 'success');
        } else {
          onToast(data.message || 'Aucun texte clair détecté sur le document', 'error');
        }
      } catch {
        onToast("Erreur lors de l'analyse du scan", 'error');
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
        onToast(data.message || "Erreur lors de l'enregistrement des candidats", 'error');
      }
    } catch {
      onToast('Erreur de communication avec le serveur', 'error');
    } finally {
      setSaving(false);
    }
  };

  const modifierLigne = <K extends keyof CandidatAEnregistrer>(
    tempId: string,
    champ: K,
    val: CandidatAEnregistrer[K]
  ) => {
    const updated = candidatesList.map((c) => (c.tempId === tempId ? { ...c, [champ]: val } : c));
    setCandidatesList(verifierDoublons(updated, existingCandidates));
  };

  const supprimerLigne = (tempId: string) => {
    const updated = candidatesList.filter((c) => c.tempId !== tempId);
    setCandidatesList(verifierDoublons(updated, existingCandidates));
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

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {step === 'SOURCE' ? (
            <AjoutCandidatsSourcesPanel
              source={source}
              setSource={setSource}
              candidatesCount={candidatesList.length}
              processingFile={processingFile}
              fileInputRef={fileInputRef}
              photoInputRef={photoInputRef}
              saisieNom={saisieNom}
              setSaisieNom={setSaisieNom}
              saisiePrenom={saisiePrenom}
              setSaisiePrenom={setSaisiePrenom}
              saisieDateNaiss={saisieDateNaiss}
              setSaisieDateNaiss={setSaisieDateNaiss}
              saisieEcole={saisieEcole}
              setSaisieEcole={setSaisieEcole}
              saisiePhone={saisiePhone}
              setSaisiePhone={setSaisiePhone}
              saisieFrais={saisieFrais}
              setSaisieFrais={setSaisieFrais}
              saisiePieces={saisiePieces}
              setSaisiePieces={setSaisiePieces}
              onAjouterManuel={handleAjouterManuel}
              onExcelUpload={handleExcelUpload}
              onTextBlur={handleTextBlur}
              onPhotoScanUpload={handlePhotoScanUpload}
              onGoToVerif={() => setStep('VERIF')}
            />
          ) : (
            <AjoutCandidatsVerifTable
              candidatesList={candidatesList}
              countValides={countValides}
              countErreurs={countErreurs}
              onAddMore={() => setStep('SOURCE')}
              onModifyRow={modifierLigne}
              onDeleteRow={supprimerLigne}
            />
          )}
        </div>

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
                  background: countValides > 0 ? 'var(--green, var(--green))' : 'var(--border)',
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
