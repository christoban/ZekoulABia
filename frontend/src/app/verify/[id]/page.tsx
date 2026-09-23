'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, XCircle, Shield, Building2, Calendar, User, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import LanguageSwitch from '@/components/LanguageSwitch'

interface VerifiedDocument {
  id: string
  type: string
  school: string
  generatedAt: string
  authentic: boolean
  data?: {
    studentName?: string
    matricule?: string | null
    className?: string
    yearName?: string
    motif?: string
    [key: string]: any
  }
}

export default function VerifyDocumentPage() {
  const params = useParams()
  const documentId = (params?.id as string) || ''

  const [loading, setLoading] = useState(true)
  const [doc, setDoc] = useState<VerifiedDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      setLoading(false)
      setError('Identifiant de document manquant')
      return
    }

    fetch(`/api/v2/verify/${encodeURIComponent(documentId)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.success) {
          setError(json.message || 'Document introuvable ou signature invalide')
        } else {
          setDoc(json.document)
        }
      })
      .catch(() => {
        setError('Impossible de joindre le serveur de vérification')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [documentId])

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      position: 'relative',
      overflowX: 'hidden',
      paddingTop: 80,
      paddingBottom: 40,
      fontFamily: 'var(--font-nunito), Nunito, sans-serif'
    }}>
      {/* Motif géométrique discret */}
      <div className="login-bg" />

      {/* Bande multicolore camerounaise */}
      <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />

      {/* En-tête commun */}
      <header style={{
        position: 'absolute', top: 5, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,var(--primary),var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(180,83,42,0.22)', overflow: 'hidden'
          }}>
            <img src="/logo.svg" alt="ZekoulABia" style={{ width: '65%', height: '65%', objectFit: 'contain' }} />
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              ZekoulABia
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              Vérification Officielle
            </span>
          </div>
        </div>
        <LanguageSwitch compact />
      </header>

      {/* Carte principale */}
      <main style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 520,
        width: 'calc(100% - 32px)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        {loading && (
          <div style={{ padding: '36px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>Vérification de l'authenticité en cours...</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--red-light)',
                color: 'var(--red)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XCircle size={36} />
            </div>
            <div>
              <h1 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 800, color: 'var(--red)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
                Document non authentifié
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>
                {error}
              </p>
            </div>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: 'var(--red-light)',
                border: '1px solid rgba(217,72,31,0.2)',
                fontSize: 12,
                color: 'var(--red)',
                marginTop: 4,
                width: '100%'
              }}
            >
              Ce document n'existe pas dans le registre sécurisé ou a été révoqué.
            </div>
          </div>
        )}

        {!loading && doc && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--green-light)',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 20,
                background: 'var(--green-light)',
                border: '1px solid rgba(47, 143, 91, 0.25)',
                color: 'var(--success)',
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 14,
              }}
            >
              <Shield size={14} /> DOCUMENT OFFICIEL AUTHENTIFIÉ
            </div>

            <h1 style={{ margin: '0 0 4px 0', fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
              {doc.type}
            </h1>
            <span style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
              Référence : <strong style={{ color: 'var(--text)' }}>{doc.id}</strong>
            </span>

            {/* Fiche d'informations certifiées */}
            <div
              style={{
                width: '100%',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                textAlign: 'left',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Building2 size={16} style={{ color: 'var(--primary)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Établissement émetteur</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{doc.school}</div>
                </div>
              </div>

              {doc.data?.studentName && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <User size={16} style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Élève concerné</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{doc.data.studentName}</div>
                    {doc.data.matricule && (
                      <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>Matricule : {doc.data.matricule}</div>
                    )}
                  </div>
                </div>
              )}

              {doc.data?.className && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <FileText size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Classe & Année</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {doc.data.className} {doc.data.yearName ? `• ${doc.data.yearName}` : ''}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Calendar size={16} style={{ color: 'var(--text3)', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Délivré le</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                    {new Date(doc.generatedAt).toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
              Ce sceau numérique atteste que ce document a été généré via le système d'information ZekoulABia et que son intégrité est certifiée conforme par l'établissement.
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', width: '100%' }}>
          <Link
            href="/login"
            style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 700, transition: 'color 0.15s' }}
          >
            ← Retour à l'accueil
          </Link>
        </div>
      </main>
    </div>
  )
}
