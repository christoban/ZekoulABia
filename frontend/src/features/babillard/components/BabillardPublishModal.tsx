'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Trash2,
  AlertCircle,
  Eye,
  Clock,
  Pin,
} from 'lucide-react';
import { fetchApi } from '@/lib/fetchApi';
import type { PieceJointe, PublicationCategorie, PublicationPriorite, PublicationItem } from '../types';
import { CATEGORIE_CONFIG, ROLE_LABELS_FR } from '../types';
import LightweightRichEditor from './LightweightRichEditor';
import PublicationCard from './PublicationCard';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onSaved?: () => void;
  initialData?: PublicationItem | null;
  userRole?: string;
}

const ALL_ROLES = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'];

export default function BabillardPublishModal({
  isOpen,
  onClose,
  onSuccess,
  onSaved,
  initialData,
  userRole,
}: Props) {
  const [titre, setTitre] = useState(initialData?.titre ?? '');
  const [categorie, setCategorie] = useState<PublicationCategorie>(initialData?.categorie ?? 'COMMUNIQUE');
  const [priorite, setPriorite] = useState<PublicationPriorite>(initialData?.priorite ?? 'NORMALE');
  const [corps, setCorps] = useState(initialData?.corps ?? '');
  const [roles, setRoles] = useState<string[]>(initialData?.audienceRoles ?? ALL_ROLES);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(initialData?.audienceClasses ?? []);
  const [targetAllClasses, setTargetAllClasses] = useState(
    !initialData?.audienceClasses || initialData.audienceClasses.length === 0
  );
  const [epinglee, setEpinglee] = useState(initialData?.epinglee ?? false);
  const [duree, setDuree] = useState(initialData?.dureeVisibilite ?? 'PERMANENT');
  const [programmeeLe, setProgrammeeLe] = useState(initialData?.programmeeLe ?? '');
  const [piecesJointes, setPiecesJointes] = useState<PieceJointe[]>(initialData?.piecesJointes ?? []);

  // UI & Validation States
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titreError, setTitreError] = useState<string | null>(null);
  const [corpsError, setCorpsError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [selectedLightboxImage, setSelectedLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // References for scrolling to invalid input (B4) and cleanup of Blob URLs
  const titreInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const blobUrlsRef = useRef<string[]>([]);

  // Nettoyage de sécurité des Blob URLs au démontage
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, []);

  // Fermeture lightbox via Échap
  useEffect(() => {
    if (!selectedLightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedLightboxImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLightboxImage]);

  // Load school classes
  useEffect(() => {
    fetchApi('/api/v2/classes')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) {
          setAvailableClasses(d.data.map((c: any) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const toggleRole = (r: string) => {
    setRolesError(null);
    if (roles.includes(r)) {
      if (roles.length > 1) {
        setRoles(roles.filter((x) => x !== r));
      }
    } else {
      setRoles([...roles, r]);
    }
  };

  const selectAllRoles = () => {
    setRolesError(null);
    setRoles(ALL_ROLES);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setServerError('Le fichier ne doit pas dépasser 10 Mo.');
      return;
    }

    if (piecesJointes.length >= 5) {
      setServerError('Maximum 5 pièces jointes par publication.');
      return;
    }

    setUploading(true);
    setServerError(null);

    // Prévisualisation locale instantanée (0 ms) pour les images
    let localPreviewUrl: string | undefined = undefined;
    if (file.type.startsWith('image/')) {
      localPreviewUrl = URL.createObjectURL(file);
      blobUrlsRef.current.push(localPreviewUrl);
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ordre', String(piecesJointes.length));

      const res = await fetchApi('/api/v2/babillard/pieces-jointes', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data) {
        const nouvellePj: PieceJointe = {
          ...data.data,
          previewUrl: localPreviewUrl,
        };
        setPiecesJointes([...piecesJointes, nouvellePj]);
      } else {
        if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        setServerError(data.message || "Erreur lors de l'envoi du document.");
      }
    } catch {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      setServerError('Impossible de téléverser le fichier.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePieceJointe = (id: string) => {
    const pj = piecesJointes.find((p) => p.id === id);
    if (pj?.previewUrl) {
      try {
        URL.revokeObjectURL(pj.previewUrl);
      } catch {}
    }
    setPiecesJointes(piecesJointes.filter((p) => p.id !== id));
  };

  // Form submit with inline validation (B4)
  const handleFormSubmit = (asDraft = false) => {
    setServerError(null);
    let hasError = false;

    if (!titre.trim()) {
      setTitreError('Le titre est obligatoire.');
      titreInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      titreInputRef.current?.focus();
      hasError = true;
    } else {
      setTitreError(null);
    }

    if (!corps.trim() || corps === '<p></p>' || corps === '<br>') {
      setCorpsError('Le contenu du message est obligatoire.');
      if (!hasError) {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      hasError = true;
    } else {
      setCorpsError(null);
    }

    if (roles.length === 0) {
      setRolesError('Veuillez sélectionner au moins un rôle destinataire.');
      hasError = true;
    } else {
      setRolesError(null);
    }

    if (hasError) return;

    if (asDraft) {
      executeSave(true);
    } else {
      setShowConfirmation(true);
    }
  };

  const executeSave = async (isDraft: boolean) => {
    setSubmitting(true);
    setServerError(null);

    const payload = {
      titre: titre.trim(),
      corps: corps.trim(),
      categorie,
      priorite,
      audience: {
        roles,
        classeIds: targetAllClasses ? [] : selectedClasses,
      },
      epinglee,
      statut: isDraft ? 'BROUILLON' : undefined,
      dureeVisibilite: duree,
      programmeeLe: programmeeLe ? new Date(programmeeLe).toISOString() : null,
      piecesJointes,
    };

    try {
      const isEditing = !!initialData?.id;
      const url = isEditing ? `/api/v2/babillard/${initialData.id}` : '/api/v2/babillard';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetchApi(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const d = await res.json();
      if (d.success) {
        const msg = isDraft
          ? 'Brouillon enregistré.'
          : isEditing
          ? 'Communiqué mis à jour avec succès.'
          : 'Communiqué officiel diffusé avec succès.';
        if (onSuccess) onSuccess(msg);
        if (onSaved) onSaved();
        onClose();
      } else {
        setServerError(d.message || "Une erreur est survenue lors de l'enregistrement.");
        setShowConfirmation(false);
      }
    } catch {
      setServerError('Erreur réseau ou serveur inaccessible.');
      setShowConfirmation(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Preview item for unified PublicationCard (A4, B6)
  const previewItem: PublicationItem = {
    id: initialData?.id || 'preview-mock-id',
    type: 'ANNONCE',
    titre: titre.trim() || 'Titre de votre communiqué officiel',
    corps: corps.trim() || '<p>Le contenu du message apparaîtra ici avec son formatage complet...</p>',
    corpsFormat: 'HTML_SAFE',
    categorie,
    priorite,
    audience: {
      roles,
      classeIds: targetAllClasses ? [] : selectedClasses,
    },
    epinglee,
    isPinned: epinglee,
    statut: 'PUBLIEE',
    publieeLe: new Date().toISOString(),
    dureeVisibilite: duree,
    auteurId: 'me',
    auteurTitre: initialData?.auteurTitre || 'Le Proviseur',
    auteur: initialData?.auteur || {
      id: 'me',
      prenom: 'Jean',
      nom: 'Ngono',
      role: 'ADMIN',
      titreOfficiel: 'Le Proviseur',
    },
    piecesJointes,
    isRead: true, // L'auteur visualisant son aperçu n'a pas de badge "Nouveau"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-[1240px] bg-[var(--surface)] text-[var(--text)] rounded-xl shadow-2xl border border-[var(--border)] flex flex-col max-h-[94vh] overflow-hidden">
        {/* En-tête du modal */}
        <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-spectral font-bold text-lg sm:text-xl text-[var(--text)]">
              {initialData?.id ? 'Modifier le communiqué' : 'Publier un communiqué officiel'}
            </h2>
            {/* Bascule mobile formulaire / aperçu */}
            <div className="flex sm:hidden rounded bg-[var(--bg)] p-0.5 text-xs font-semibold border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setMobileTab('form')}
                className={`px-2.5 py-1 rounded transition-colors ${mobileTab === 'form' ? 'bg-[var(--surface)] shadow-xs text-[var(--text)] font-bold' : 'text-[var(--text2)]'}`}
              >
                Saisie
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('preview')}
                className={`px-2.5 py-1 rounded transition-colors ${mobileTab === 'preview' ? 'bg-[var(--surface)] shadow-xs text-[var(--text)] font-bold' : 'text-[var(--text2)]'}`}
              >
                Aperçu direct
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--bg)] text-[var(--text3)] hover:text-[var(--text)] transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {serverError && (
          <div className="mx-5 mt-3 p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{serverError}</span>
          </div>
        )}

        {/* Corps du modal en deux colonnes sur grand écran */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Colonne gauche : Formulaire */}
          <div className={`space-y-4 lg:col-span-7 ${mobileTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
            {/* 1. Titre avec validation inline (B4, B5) */}
            <div>
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--text)] mb-1">
                <label htmlFor="pub-titre">Titre du communiqué *</label>
                <span className={`text-[11px] ${titre.length > 120 ? 'text-red-500 font-bold' : 'text-[var(--text3)]'}`}>
                  {titre.length} / 120
                </span>
              </div>
              <input
                ref={titreInputRef}
                id="pub-titre"
                type="text"
                value={titre}
                maxLength={120}
                aria-invalid={!!titreError}
                aria-describedby={titreError ? 'pub-titre-error' : undefined}
                onChange={(e) => {
                  setTitre(e.target.value);
                  if (titreError && e.target.value.trim()) setTitreError(null);
                }}
                placeholder="Ex : Rentrée scolaire 2026/2027"
                className={`w-full px-3 py-2 rounded-lg border bg-[var(--bg)] text-sm text-[var(--text)] placeholder-[var(--text3)] focus:outline-none transition-colors ${
                  titreError ? 'border-red-500 ring-1 ring-red-500' : 'border-[var(--border)] focus:border-primary'
                }`}
              />
              {titreError && (
                <p id="pub-titre-error" className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {titreError}
                </p>
              )}
            </div>

            {/* 2 & 3. Catégorie et Priorité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-[var(--text)] mb-1">Catégorie</label>
                <select
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value as PublicationCategorie)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs text-[var(--text)] focus:outline-none focus:border-primary"
                >
                  {Object.entries(CATEGORIE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k} className="bg-[var(--surface)] text-[var(--text)]">
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-[var(--text)] mb-1">Priorité</label>
                <div className="grid grid-cols-3 gap-1 bg-[var(--bg)] border border-[var(--border)] p-1 rounded-lg text-xs font-semibold text-center">
                  {(['NORMALE', 'IMPORTANTE', 'URGENTE'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriorite(p)}
                      className={`py-1 rounded transition-all ${
                        priorite === p
                          ? p === 'URGENTE'
                            ? 'bg-red-600 text-white font-bold shadow-xs'
                            : p === 'IMPORTANTE'
                            ? 'bg-orange-500 text-white font-bold shadow-xs'
                            : 'bg-primary text-white font-bold shadow-xs'
                          : 'text-[var(--text2)] hover:text-[var(--text)]'
                      }`}
                    >
                      {p === 'NORMALE' ? 'Normale' : p === 'IMPORTANTE' ? 'Importante' : 'Urgente'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Contenu du message avec validation inline (A1, B4) */}
            <div ref={editorRef}>
              <label className="block text-xs sm:text-sm font-bold text-[var(--text)] mb-1">Message officiel *</label>
              <LightweightRichEditor
                value={corps}
                onChange={(val) => {
                  setCorps(val);
                  if (corpsError && val.trim() && val !== '<p></p>' && val !== '<br>') setCorpsError(null);
                }}
              />
              {corpsError && (
                <p className="mt-1 text-xs text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {corpsError}
                </p>
              )}
            </div>

            {/* 5. Documents joints */}
            <div>
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--text)] mb-1">
                <span>Documents joints (PDF ou Images, max 10 Mo)</span>
                <span className="text-[11px] text-[var(--text3)]">{piecesJointes.length}/5 documents</span>
              </div>

              <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-3.5 bg-[var(--bg2)] text-center">
                <input
                  type="file"
                  id="pub-file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileUpload}
                  disabled={uploading || piecesJointes.length >= 5}
                />
                <label
                  htmlFor="pub-file"
                  className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
                >
                  <UploadCloud size={15} />
                  {uploading ? 'Téléversement en cours...' : 'Ajouter un document'}
                </label>
                <div className="text-[11px] text-[var(--text3)] mt-1.5">
                  Glissez un fichier ou cliquez ci-dessus. Formats : PDF, JPG, PNG, WebP.
                </div>
              </div>

              {/* Liste des pièces jointes */}
              {piecesJointes.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {piecesJointes.map((pj) => {
                    const isImg = pj.mime.startsWith('image/');
                    const displayUrl =
                      pj.previewUrl ||
                      (initialData?.id
                        ? `/api/v2/babillard/${initialData.id}/pieces-jointes/${pj.id}`
                        : undefined);

                    return (
                      <div
                        key={pj.id}
                        className="flex items-center justify-between px-3 py-2 rounded bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text)] group hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isImg && displayUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedLightboxImage({ url: displayUrl, title: pj.nomOriginal })}
                              className="relative w-9 h-9 rounded overflow-hidden border border-[var(--border)] shrink-0 group/thumb cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                              title="Cliquer pour agrandir l'image"
                            >
                              <img
                                src={displayUrl}
                                alt={pj.nomOriginal}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                                <Eye size={12} />
                              </div>
                            </button>
                          ) : (
                            <div className="w-9 h-9 rounded bg-[var(--bg2)] flex items-center justify-center shrink-0 border border-[var(--border)]">
                              <FileText size={16} className="text-[var(--text3)]" />
                            </div>
                          )}
                          <div className="min-w-0">
                            {isImg && displayUrl ? (
                              <button
                                type="button"
                                onClick={() => setSelectedLightboxImage({ url: displayUrl, title: pj.nomOriginal })}
                                className="text-left font-medium text-[var(--text)] hover:text-primary transition-colors truncate block max-w-[200px] sm:max-w-[240px] cursor-pointer"
                                title="Cliquer pour inspecter l'image"
                              >
                                {pj.nomOriginal}
                              </button>
                            ) : (
                              <span className="truncate font-medium block max-w-[200px] sm:max-w-[240px]">{pj.nomOriginal}</span>
                            )}
                            <span className="text-[11px] text-[var(--text3)]">
                              {(pj.taille / 1024).toFixed(0)} Ko {isImg && '· Image'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isImg && displayUrl && (
                            <button
                              type="button"
                              onClick={() => setSelectedLightboxImage({ url: displayUrl, title: pj.nomOriginal })}
                              className="text-[var(--text2)] hover:text-primary p-1.5 rounded hover:bg-[var(--bg2)] transition-colors"
                              title="Aperçu grand format"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removePieceJointe(pj.id)}
                            className="text-red-500 hover:text-red-600 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                            title="Retirer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Public cible */}
            <div className="p-3.5 rounded-lg bg-[var(--bg2)] border border-[var(--border)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-[var(--text)]">Public cible *</span>
                <button
                  type="button"
                  onClick={selectAllRoles}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Tous les rôles
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ALL_ROLES.map((r) => {
                  const isSel = roles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        isSel
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-[var(--surface)] text-[var(--text)] border-[var(--border)] hover:bg-[var(--bg)]'
                      }`}
                    >
                      {ROLE_LABELS_FR[r]}
                    </button>
                  );
                })}
              </div>
              {rolesError && (
                <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {rolesError}
                </p>
              )}

              {/* Si Élèves ou Parents ciblés : option ciblage par classes */}
              {(roles.includes('STUDENT') || roles.includes('PARENT')) && (
                <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--text)]">
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="targetClasses"
                        checked={targetAllClasses}
                        onChange={() => { setTargetAllClasses(true); setSelectedClasses([]); }}
                      />
                      Toutes les classes de l'école
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="targetClasses"
                        checked={!targetAllClasses}
                        onChange={() => setTargetAllClasses(false)}
                      />
                      Classes spécifiques
                    </label>
                  </div>

                  {!targetAllClasses && (
                    <div className="max-h-28 overflow-y-auto p-2 bg-[var(--surface)] rounded border border-[var(--border)] grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {availableClasses.map((cls) => {
                        const isChecked = selectedClasses.includes(cls.id);
                        return (
                          <label key={cls.id} className="flex items-center gap-1.5 text-[11.5px] cursor-pointer text-[var(--text)]">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedClasses(
                                  isChecked
                                    ? selectedClasses.filter((id) => id !== cls.id)
                                    : [...selectedClasses, cls.id]
                                );
                              }}
                            />
                            <span className="truncate">{cls.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 7. Options de visibilité & Programmation future */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-[var(--bg2)] border border-[var(--border)] text-xs text-[var(--text)]">
              <div>
                <label className="block font-bold text-[var(--text)] mb-1">Durée d'affichage</label>
                <select
                  value={duree}
                  onChange={(e) => setDuree(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
                >
                  <option value="PERMANENT">Permanent (Pas d'expiration)</option>
                  <option value="J3">3 jours</option>
                  <option value="J7">7 jours (1 semaine)</option>
                  <option value="J15">15 jours (2 semaines)</option>
                  <option value="J30">30 jours (1 mois)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[var(--text)] mb-1 flex items-center gap-1">
                  <Clock size={12} />
                  Publication programmée
                </label>
                <input
                  type="datetime-local"
                  value={programmeeLe}
                  onChange={(e) => setProgrammeeLe(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
                />
                <span className="text-[10.5px] text-[var(--text3)]">Laisser vide pour diffusion immédiate.</span>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pub-pin"
                  checked={epinglee}
                  onChange={(e) => setEpinglee(e.target.checked)}
                  className="cursor-pointer"
                />
                <label htmlFor="pub-pin" className="cursor-pointer font-semibold text-[var(--text)] flex items-center gap-1">
                  <Pin size={13} className="text-orange-500" />
                  Épingler « À la une » en tête du babillard (max 3)
                </label>
              </div>
            </div>
          </div>

          {/* Colonne droite : Aperçu en temps réel STICKY sur grand écran (B7) */}
          <div className={`lg:col-span-5 ${mobileTab === 'form' ? 'hidden lg:block' : 'block'}`}>
            <div className="lg:sticky lg:top-4">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[var(--text)] mb-2">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} />
                  Aperçu tel qu'il apparaîtra sur le babillard
                </span>
                <span className="text-[11px] text-[var(--text3)] font-semibold">Rendu réel</span>
              </div>

              <div
                className="p-4 sm:p-5 rounded-xl border border-[var(--border)] flex items-center justify-center min-h-[420px]"
                style={{
                  background: 'var(--board-bg, #ece5d8)',
                  backgroundImage: 'var(--board-texture)',
                }}
              >
                {/* A4: Exact même composant PublicationCard que le panneau */}
                <div className="w-full max-w-[360px]">
                  <PublicationCard
                    publication={previewItem}
                    userRole={userRole}
                    canManage={false}
                    onClick={() => {
                      const imgPj = previewItem.piecesJointes?.find((p) => p.mime.startsWith('image/'));
                      const imgUrl =
                        imgPj?.previewUrl ||
                        (initialData?.id && imgPj?.id
                          ? `/api/v2/babillard/${initialData.id}/pieces-jointes/${imgPj.id}`
                          : undefined);
                      if (imgUrl) {
                        setSelectedLightboxImage({
                          url: imgUrl,
                          title: imgPj?.nomOriginal || previewItem.titre,
                        });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            B5: PIED D'ACTIONS DU MODAL
            - Desktop : Annuler gauche, Brouillon + Diffuser droite
            - Mobile : Diffuser pleine largeur en haut, Brouillon dessous (Annuler masqué)
           ======================================================== */}
        <div className="px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface)]">
          {/* Mobile layout (sm:hidden) */}
          <div className="flex sm:hidden flex-col gap-2 w-full">
            <button
              type="button"
              disabled={submitting || uploading}
              onClick={() => handleFormSubmit(false)}
              className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm text-center"
            >
              {submitting ? 'Diffusion...' : 'Diffuser le communiqué'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleFormSubmit(true)}
              className="w-full py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg2)] disabled:opacity-50 transition-colors text-center"
            >
              Enregistrer comme brouillon
            </button>
          </div>

          {/* Desktop layout (hidden on mobile) */}
          <div className="hidden sm:flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text2)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
            >
              Annuler
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFormSubmit(true)}
                className="px-3.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--bg)] disabled:opacity-50 transition-colors"
              >
                Enregistrer comme brouillon
              </button>
              <button
                type="button"
                disabled={submitting || uploading}
                onClick={() => handleFormSubmit(false)}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
              >
                {submitting ? 'Diffusion...' : 'Diffuser le communiqué'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Boîte modale de confirmation de diffusion avec estimation de l'audience */}
      {showConfirmation && (
        <div className="fixed inset-0 z-60 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-[420px] bg-[var(--surface)] text-[var(--text)] rounded-xl shadow-2xl border border-[var(--border)] p-5">
            <h3 className="font-spectral font-bold text-lg mb-2 text-[var(--text)]">Confirmer la diffusion</h3>
            <p className="text-xs text-[var(--text2)] leading-relaxed mb-4">
              Vous allez diffuser ce communiqué officiel à destination de :{' '}
              <strong className="text-[var(--text)]">
                {roles.length >= 5 ? 'Tous les rôles' : roles.map((r) => ROLE_LABELS_FR[r] ?? r).join(', ')}
              </strong>
              {!targetAllClasses && selectedClasses.length > 0 && (
                <span> ({selectedClasses.length} classe{selectedClasses.length > 1 ? 's' : ''})</span>
              )}.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text2)] hover:bg-[var(--bg)] hover:text-[var(--text)] transition-colors"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => executeSave(false)}
                className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-sm transition-colors"
              >
                {submitting ? 'Validation...' : 'Confirmer et diffuser'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox d'inspection haute résolution pour prévisualiser l'image avant publication */}
      {selectedLightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-70 bg-black/90 flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedLightboxImage(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3 text-white z-10">
            <span className="text-xs font-medium max-w-[300px] truncate opacity-80">
              {selectedLightboxImage.title}
            </span>
            <button
              type="button"
              onClick={() => setSelectedLightboxImage(null)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
              title="Fermer (Échap)"
            >
              <X size={18} />
            </button>
          </div>
          <div
            className="max-w-[92vw] max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedLightboxImage.url}
              alt={selectedLightboxImage.title}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
            />
          </div>
          <div className="mt-3 text-white/70 text-xs">
            Aperçu haute résolution avant diffusion
          </div>
        </div>
      )}
    </div>
  );
}
