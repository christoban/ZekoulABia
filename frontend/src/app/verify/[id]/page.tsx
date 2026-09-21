'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CheckCircle2, XCircle, Shield, Building2, Calendar, User, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'

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
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'var(--font-nunito), system-ui, -apple-system, sans-serif',
        color: '#f8fafc',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 20,
          padding: '32px 24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Logo / Marque */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              color: '#fff',
              fontSize: 18,
            }}
          >
            Z
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>
            Zekoul<span style={{ color: '#10b981' }}>ABia</span>
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.1)',
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Vérification Officielle
          </span>
        </div>

        {loading && (
          <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Loader2 size={36} className="animate-spin" style={{ color: '#10b981' }} />
            <span style={{ fontSize: 14, color: '#94a3b8' }}>Vérification de l'authenticité en cours...</span>
          </div>
        )}

        {!loading && error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <XCircle size={36} />
            </div>
            <div>
              <h1 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 800, color: '#f87171' }}>
                Document non authentifié
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', maxWidth: 360 }}>
                {error}
              </p>
            </div>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: 12,
                color: '#fca5a5',
                marginTop: 8,
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
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
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
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              <Shield size={14} /> DOCUMENT OFFICIEL AUTHENTIFIÉ
            </div>

            <h1 style={{ margin: '0 0 4px 0', fontSize: 22, fontWeight: 800, color: '#fff' }}>
              {doc.type}
            </h1>
            <span style={{ fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
              Référence : <strong style={{ color: '#f8fafc' }}>{doc.id}</strong>
            </span>

            {/* Fiche d'informations certifiées */}
            <div
              style={{
                width: '100%',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                textAlign: 'left',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Building2 size={16} style={{ color: '#10b981', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Établissement émetteur</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{doc.school}</div>
                </div>
              </div>

              {doc.data?.studentName && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <User size={16} style={{ color: '#3b82f6', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Élève concerné</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{doc.data.studentName}</div>
                    {doc.data.matricule && (
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>Matricule : {doc.data.matricule}</div>
                    )}
                  </div>
                </div>
              )}

              {doc.data?.className && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <FileText size={16} style={{ color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Classe & Année</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>
                      {doc.data.className} {doc.data.yearName ? `• ${doc.data.yearName}` : ''}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Calendar size={16} style={{ color: '#94a3b8', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Délivré le</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>
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

            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>
              Ce sceau numérique atteste que ce document a été généré via le système d'information ZekoulABia et que son intégrité est certifiée conforme par l'établissement.
            </div>
          </div>
        )}

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', width: '100%' }}>
          <Link
            href="/login"
            style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none', transition: 'color 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            ← Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
