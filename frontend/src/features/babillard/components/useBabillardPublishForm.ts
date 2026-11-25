'use client';

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { fetchApi } from '@/lib/fetchApi';
import type { PieceJointe, PublicationCategorie, PublicationPriorite, PublicationItem } from '../types';

export const PUBLISH_ALL_ROLES = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'] as const;

interface UseBabillardPublishFormOptions {
  initialData?: PublicationItem | null;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onSaved?: () => void;
}

export function useBabillardPublishForm({
  initialData,
  onClose,
  onSuccess,
  onSaved,
}: UseBabillardPublishFormOptions) {
  const [titre, setTitre] = useState(initialData?.titre ?? '');
  const [categorie, setCategorie] = useState<PublicationCategorie>(initialData?.categorie ?? 'COMMUNIQUE');
  const [priorite, setPriorite] = useState<PublicationPriorite>(initialData?.priorite ?? 'NORMALE');
  const [corps, setCorps] = useState(initialData?.corps ?? '');
  const [roles, setRoles] = useState<string[]>(initialData?.audienceRoles ?? [...PUBLISH_ALL_ROLES]);
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
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((url) => {
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
          setAvailableClasses((d.data as Array<{ id: string; name: string }>).map((c) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
  }, []);

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
    setRoles([...PUBLISH_ALL_ROLES]);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
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

  return {
    titre,
    setTitre,
    categorie,
    setCategorie,
    priorite,
    setPriorite,
    corps,
    setCorps,
    roles,
    selectedClasses,
    setSelectedClasses,
    targetAllClasses,
    setTargetAllClasses,
    epinglee,
    setEpinglee,
    duree,
    setDuree,
    programmeeLe,
    setProgrammeeLe,
    piecesJointes,
    availableClasses,
    uploading,
    submitting,
    titreError,
    setTitreError,
    corpsError,
    setCorpsError,
    rolesError,
    serverError,
    showConfirmation,
    setShowConfirmation,
    mobileTab,
    setMobileTab,
    selectedLightboxImage,
    setSelectedLightboxImage,
    titreInputRef,
    editorRef,
    previewItem,
    toggleRole,
    selectAllRoles,
    handleFileUpload,
    removePieceJointe,
    handleFormSubmit,
    executeSave,
  };
}

