'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/fetchApi';
import { Publication } from '@/features/babillard/types';
import AnnonceDetailRenderer from '@/features/babillard/renderers/AnnonceDetailRenderer';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

import { getCachedData, putCachedData } from '@/lib/offline/db';

export default function BabillardPublicationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;

    const loadPublication = async () => {
      // 1. Essai immédiat depuis le cache Dexie chiffré (0 ms)
      try {
        const cached = await getCachedData<Publication>(`babillard:publication:${id}`);
        if (cached?.data && isMounted) {
          setPublication(cached.data);
          setLoading(false);
        }
      } catch {
        // Poursuite vers le réseau
      }

      // 2. Si hors-ligne strict et déjà affiché depuis le cache, arrêt
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await fetchApi(`/api/v2/babillard/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Publication introuvable ou vous n\'avez pas accès à ce communiqué.');
          }
          throw new Error('Erreur lors du chargement de la publication.');
        }
        const data = await res.json();
        const pubData: Publication = data.data || data;
        if (isMounted) {
          setPublication(pubData);
          setError(null);
        }

        // Sauvegarde dans Dexie pour consultation ultérieure hors-ligne
        await putCachedData(`babillard:publication:${id}`, pubData).catch(() => {});

        // Auto mark as read (si en ligne)
        fetchApi(`/api/v2/babillard/${id}/lu`, { method: 'POST' }).catch(() => {});
      } catch (err: unknown) {
        if (isMounted) {
          // Si on n'avait rien en cache, afficher l'erreur
          setPublication((current) => {
            if (!current) {
              const msg = err instanceof Error ? err.message : 'Impossible d\'afficher le communiqué';
              setError(msg);
            }
            return current;
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPublication();

    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <div
      className="min-h-screen p-4 sm:p-6 md:p-8 flex flex-col items-center justify-start"
      style={{
        backgroundColor: 'var(--board-bg)',
        backgroundImage: 'var(--board-texture)',
      }}
    >
      {/* Top Bar */}
      <div className="w-full max-w-3xl mb-4 flex items-center justify-between print:hidden">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] shadow-sm text-sm font-medium hover:bg-[var(--bg2)] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au babillard
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-2xl shadow-xl backdrop-blur max-w-md w-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-[var(--text2)]">
            Chargement du document officiel...
          </p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center p-8 bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-2xl shadow-xl backdrop-blur max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--text)] mb-1">
            Communiqué inaccessible
          </h2>
          <p className="text-sm text-[var(--text2)] mb-4">
            {error}
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition"
          >
            Revenir en arrière
          </button>
        </div>
      )}

      {!loading && !error && publication && (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <AnnonceDetailRenderer
            publication={publication}
            onClose={() => router.back()}
          />
        </div>
      )}
    </div>
  );
}
