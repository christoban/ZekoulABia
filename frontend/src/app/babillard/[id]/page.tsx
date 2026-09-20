'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchApi } from '@/lib/fetchApi';
import { Publication } from '@/features/babillard/types';
import AnnonceDetailRenderer from '@/features/babillard/renderers/AnnonceDetailRenderer';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function BabillardPublicationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadPublication = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchApi(`/api/v2/babillard/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Publication introuvable ou vous n\'avez pas accès à ce communiqué.');
          }
          throw new Error('Erreur lors du chargement de la publication.');
        }
        const data = await res.json();
        setPublication(data.data || data);

        // Auto mark as read
        fetchApi(`/api/v2/babillard/${id}/lu`, { method: 'POST' }).catch(() => {});
      } catch (err: any) {
        setError(err?.message || 'Impossible d\'afficher le communiqué');
      } finally {
        setLoading(false);
      }
    };

    loadPublication();
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
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-neutral-800/80 backdrop-blur shadow-sm text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au babillard
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center p-12 bg-white/90 dark:bg-neutral-800/90 rounded-2xl shadow-xl backdrop-blur max-w-md w-full">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-3" />
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
            Chargement du document officiel...
          </p>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center p-8 bg-white/90 dark:bg-neutral-800/90 rounded-2xl shadow-xl backdrop-blur max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white mb-1">
            Communiqué inaccessible
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
            {error}
          </p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg text-sm font-semibold hover:opacity-90 transition"
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
