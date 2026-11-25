'use client';

import React from 'react';
import {
  ArrowRight,
  Camera,
  FileSpreadsheet,
  FileText,
  Keyboard,
  Loader2,
  Upload,
} from 'lucide-react';
import AjoutCandidatsSaisieForm from './AjoutCandidatsSaisieForm';
import type { SourceType } from './ajoutCandidatsUtils';

interface Props {
  source: SourceType;
  setSource: (source: SourceType) => void;
  candidatesCount: number;
  processingFile: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  saisieNom: string;
  setSaisieNom: (val: string) => void;
  saisiePrenom: string;
  setSaisiePrenom: (val: string) => void;
  saisieDateNaiss: string;
  setSaisieDateNaiss: (val: string) => void;
  saisieEcole: string;
  setSaisieEcole: (val: string) => void;
  saisiePhone: string;
  setSaisiePhone: (val: string) => void;
  saisieFrais: boolean;
  setSaisieFrais: (val: boolean) => void;
  saisiePieces: boolean;
  setSaisiePieces: (val: boolean) => void;
  onAjouterManuel: () => void;
  onExcelUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTextBlur: (text: string) => void;
  onPhotoScanUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGoToVerif: () => void;
}

const SOURCES: Array<{ id: SourceType; label: string; icon: typeof Keyboard; desc: string }> = [
  { id: 'SAISIE', label: 'Saisie Guichet', icon: Keyboard, desc: 'Un par un' },
  { id: 'EXCEL', label: 'Excel / CSV', icon: FileSpreadsheet, desc: 'Fichier tableur' },
  { id: 'DOCUMENT', label: 'PDF / Texte', icon: FileText, desc: 'Liste numérique' },
  { id: 'PHOTO', label: 'Photo / Scan', icon: Camera, desc: 'Reconnaissance OCR' },
];

export default function AjoutCandidatsSourcesPanel({
  source,
  setSource,
  candidatesCount,
  processingFile,
  fileInputRef,
  photoInputRef,
  saisieNom,
  setSaisieNom,
  saisiePrenom,
  setSaisiePrenom,
  saisieDateNaiss,
  setSaisieDateNaiss,
  saisieEcole,
  setSaisieEcole,
  saisiePhone,
  setSaisiePhone,
  saisieFrais,
  setSaisieFrais,
  saisiePieces,
  setSaisiePieces,
  onAjouterManuel,
  onExcelUpload,
  onTextBlur,
  onPhotoScanUpload,
  onGoToVerif,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {SOURCES.map((s) => {
          const Icon = s.icon;
          const isSelected = source === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSource(s.id)}
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

      {source === 'SAISIE' && (
        <AjoutCandidatsSaisieForm
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
          onAjouterManuel={onAjouterManuel}
        />
      )}

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
            onChange={onExcelUpload}
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
            onBlur={(e) => onTextBlur(e.target.value)}
          />
        </div>
      )}

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
            onChange={onPhotoScanUpload}
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

      {candidatesCount > 0 && (
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
            {candidatesCount} candidat(s) en attente de vérification
          </div>
          <button
            type="button"
            onClick={onGoToVerif}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--green, var(--green))',
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
  );
}
