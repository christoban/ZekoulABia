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

  // References for scrolling to invalid input (B4)
  const titreInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

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
        setPiecesJointes([...piecesJointes, data.data]);
      } else {
        setServerError(data.message || "Erreur lors de l'envoi du document.");
      }
    } catch {
      setServerError('Impossible de téléverser le fichier.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePieceJointe = (id: string) => {
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
      <div className="relative w-full max-w-[1240px] bg-[#fcfbf9] text-[#1a1209] rounded-xl shadow-2xl border border-[#e2dacb] flex flex-col max-h-[94vh] overflow-hidden">
        {/* En-tête du modal */}
        <div className="px-5 py-3.5 border-b border-[#e2dacb] bg-[var(--bg)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-spectral font-bold text-lg sm:text-xl text-[#1a1209]">
              {initialData?.id ? 'Modifier le communiqué' : 'Publier un communiqué officiel'}
            </h2>
            {/* Bascule mobile formulaire / aperçu */}
            <div className="flex sm:hidden rounded bg-[#ede6da] p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMobileTab('form')}
                className={`px-2.5 py-1 rounded ${mobileTab === 'form' ? 'bg-white shadow-xs text-black' : 'text-[#6b5d4b]'}`}
              >
                Saisie
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('preview')}
                className={`px-2.5 py-1 rounded ${mobileTab === 'preview' ? 'bg-white shadow-xs text-black' : 'text-[#6b5d4b]'}`}
              >
                Aperçu direct
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#e8e0d4] text-[#786c5a] hover:text-[#1a1209] transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {serverError && (
          <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
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
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#5a4d3d] mb-1">
                <label htmlFor="pub-titre">Titre du communiqué *</label>
                <span className={`text-[11px] ${titre.length > 120 ? 'text-red-600 font-bold' : 'text-[#8a7c6a]'}`}>
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
                className={`w-full px-3 py-2 rounded-lg border bg-white text-sm text-[#1a1209] focus:outline-none transition-colors ${
                  titreError ? 'border-red-500 ring-1 ring-red-500' : 'border-[#d8cfbe] focus:border-primary'
                }`}
              />
              {titreError && (
                <p id="pub-titre-error" className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {titreError}
                </p>
              )}
            </div>

            {/* 2 & 3. Catégorie et Priorité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#5a4d3d] mb-1">Catégorie</label>
                <select
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value as PublicationCategorie)}
                  className="w-full px-3 py-2 rounded-lg border border-[#d8cfbe] bg-white text-xs text-[#1a1209] focus:outline-none focus:border-primary"
                >
                  {Object.entries(CATEGORIE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-[#5a4d3d] mb-1">Priorité</label>
                <div className="grid grid-cols-3 gap-1 bg-[#ede6da] p-1 rounded-lg text-xs font-semibold text-center">
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
                          : 'text-[#6b5d4b] hover:text-[#1a1209]'
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
              <label className="block text-xs sm:text-sm font-bold text-[#5a4d3d] mb-1">Message officiel *</label>
              <LightweightRichEditor
                value={corps}
                onChange={(val) => {
                  setCorps(val);
                  if (corpsError && val.trim() && val !== '<p></p>' && val !== '<br>') setCorpsError(null);
                }}
              />
              {corpsError && (
                <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {corpsError}
                </p>
              )}
            </div>

            {/* 5. Documents joints */}
            <div>
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#5a4d3d] mb-1">
                <span>Documents joints (PDF ou Images, max 10 Mo)</span>
                <span className="text-[11px] text-[#8a7c6a]">{piecesJointes.length}/5 documents</span>
              </div>

              <div className="border-2 border-dashed border-[#d8cfbe] rounded-lg p-3.5 bg-[var(--bg)] text-center">
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
                  className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#d8cfbe] text-xs font-semibold text-[#1a1209] hover:bg-[#ede6da] transition-colors"
                >
                  <UploadCloud size={15} />
                  {uploading ? 'Téléversement en cours...' : 'Ajouter un document'}
                </label>
                <div className="text-[11px] text-[#8a7c6a] mt-1.5">
                  Glissez un fichier ou cliquez ci-dessus. Formats : PDF, JPG, PNG, WebP.
                </div>
              </div>

              {/* Liste des pièces jointes */}
              {piecesJointes.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {piecesJointes.map((pj) => (
                    <div
                      key={pj.id}
                      className="flex items-center justify-between px-3 py-2 rounded bg-white border border-[#e2dacb] text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={15} className="text-[#8a7c6a] shrink-0" />
                        <span className="truncate font-medium">{pj.nomOriginal}</span>
                        <span className="text-[11px] text-[#8a7c6a]">
                          ({(pj.taille / 1024).toFixed(0)} Ko)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePieceJointe(pj.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Retirer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Public cible */}
            <div className="p-3.5 rounded-lg bg-[#f5f0e6] border border-[#e6dfd3] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-[#5a4d3d]">Public cible *</span>
                <button
                  type="button"
                  onClick={selectAllRoles}
                  className="text-xs font-semibold text-success hover:underline"
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
                          ? 'bg-success text-white border-success shadow-xs'
                          : 'bg-white text-[#5a4d3d] border-[#d8cfbe] hover:bg-[#ede6da]'
                      }`}
                    >
                      {ROLE_LABELS_FR[r]}
                    </button>
                  );
                })}
              </div>
              {rolesError && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                  <AlertCircle size={12} /> {rolesError}
                </p>
              )}

              {/* Si Élèves ou Parents ciblés : option ciblage par classes */}
              {(roles.includes('STUDENT') || roles.includes('PARENT')) && (
                <div className="pt-2 border-t border-[#e2dacb] text-xs">
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
                    <div className="max-h-28 overflow-y-auto p-2 bg-white rounded border border-[#d8cfbe] grid grid-cols-2 sm:grid-cols-3 gap-1">
                      {availableClasses.map((cls) => {
                        const isChecked = selectedClasses.includes(cls.id);
                        return (
                          <label key={cls.id} className="flex items-center gap-1.5 text-[11.5px] cursor-pointer">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-[var(--bg)] border border-[#e6dfd3] text-xs">
              <div>
                <label className="block font-bold text-[#5a4d3d] mb-1">Durée d'affichage</label>
                <select
                  value={duree}
                  onChange={(e) => setDuree(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-[#d8cfbe] bg-white text-xs text-[#1a1209]"
                >
                  <option value="PERMANENT">Permanent (Pas d'expiration)</option>
                  <option value="J3">3 jours</option>
                  <option value="J7">7 jours (1 semaine)</option>
                  <option value="J15">15 jours (2 semaines)</option>
                  <option value="J30">30 jours (1 mois)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#5a4d3d] mb-1 flex items-center gap-1">
                  <Clock size={12} />
                  Publication programmée
                </label>
                <input
                  type="datetime-local"
                  value={programmeeLe}
                  onChange={(e) => setProgrammeeLe(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded border border-[#d8cfbe] bg-white text-xs text-[#1a1209]"
                />
                <span className="text-[10.5px] text-[#8a7c6a]">Laisser vide pour diffusion immédiate.</span>
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pub-pin"
                  checked={epinglee}
                  onChange={(e) => setEpinglee(e.target.checked)}
                  className="cursor-pointer"
                />
                <label htmlFor="pub-pin" className="cursor-pointer font-semibold text-[#3b3226] flex items-center gap-1">
                  <Pin size={13} className="text-orange-600" />
                  Épingler « À la une » en tête du babillard (max 3)
                </label>
              </div>
            </div>
          </div>

          {/* Colonne droite : Aperçu en temps réel STICKY sur grand écran (B7) */}
          <div className={`lg:col-span-5 ${mobileTab === 'form' ? 'hidden lg:block' : 'block'}`}>
            <div className="lg:sticky lg:top-4">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#5a4d3d] mb-2">
                <span className="flex items-center gap-1.5">
                  <Eye size={14} />
                  Aperçu tel qu'il apparaîtra sur le babillard
                </span>
                <span className="text-[11px] text-[#8a7c6a] font-semibold">Rendu réel</span>
              </div>

              <div
                className="p-4 sm:p-5 rounded-xl border border-[#d8cfbe] flex items-center justify-center min-h-[420px]"
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
                    onClick={() => {}}
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
        <div className="px-5 py-3.5 border-t border-[#e2dacb] bg-[var(--bg)]">
          {/* Mobile layout (sm:hidden) */}
          <div className="flex sm:hidden flex-col gap-2 w-full">
            <button
              type="button"
              disabled={submitting || uploading}
              onClick={() => handleFormSubmit(false)}
              className="w-full py-2.5 rounded-lg bg-success text-white text-sm font-bold hover:bg-success disabled:opacity-50 transition-colors shadow-sm text-center"
            >
              {submitting ? 'Diffusion...' : 'Diffuser le communiqué'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleFormSubmit(true)}
              className="w-full py-2 rounded-lg border border-[#d8cfbe] bg-white text-xs font-semibold text-[#3b3226] hover:bg-[#ede6da] disabled:opacity-50 transition-colors text-center"
            >
              Enregistrer comme brouillon
            </button>
          </div>

          {/* Desktop layout (hidden on mobile) */}
          <div className="hidden sm:flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-[#d8cfbe] bg-white text-xs font-semibold text-[#5a4d3d] hover:bg-[#ede6da] transition-colors"
            >
              Annuler
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleFormSubmit(true)}
                className="px-3.5 py-1.5 rounded-lg border border-[#d8cfbe] bg-white text-xs font-semibold text-[#3b3226] hover:bg-[#ede6da] disabled:opacity-50 transition-colors"
              >
                Enregistrer comme brouillon
              </button>
              <button
                type="button"
                disabled={submitting || uploading}
                onClick={() => handleFormSubmit(false)}
                className="px-4 py-1.5 rounded-lg bg-success text-white text-xs font-bold hover:bg-success disabled:opacity-50 transition-colors shadow-sm"
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
          <div className="w-full max-w-[420px] bg-white rounded-xl shadow-2xl border border-neutral-300 p-5 text-neutral-900">
            <h3 className="font-spectral font-bold text-lg mb-2">Confirmer la diffusion</h3>
            <p className="text-xs text-neutral-600 leading-relaxed mb-4">
              Vous allez diffuser ce communiqué officiel à destination de :{' '}
              <strong>
                {roles.length >= 5 ? 'Tous les rôles' : roles.map((r) => ROLE_LABELS_FR[r] ?? r).join(', ')}
              </strong>
              {!targetAllClasses && selectedClasses.length > 0 && (
                <span> ({selectedClasses.length} classe{selectedClasses.length > 1 ? 's' : ''})</span>
              )}.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => executeSave(false)}
                className="px-4 py-1.5 rounded-lg bg-success text-white text-xs font-bold hover:bg-success shadow-sm"
              >
                {submitting ? 'Validation...' : 'Confirmer et diffuser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
