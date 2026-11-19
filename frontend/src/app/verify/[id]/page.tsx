'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Shield,
  Building2,
  Calendar,
  User,
  FileText,
  Loader2,
  Copy,
  Award,
} from 'lucide-react'
import Link from 'next/link'
import LanguageSwitch from '@/components/LanguageSwitch'

type VerifyStatus = 'AUTHENTIC' | 'REVOKED' | 'TAMPERED' | 'NOT_FOUND'
type LookupMode = 'LONG_TOKEN' | 'SHORT_CODE'

interface VerifiedDocument {
  id: string
  shortVerifyCode?: string
  lookupMode?: LookupMode
  status?: VerifyStatus
  type: string
  school?: string
  yearName?: string
  periodName?: string
  className?: string
  classLevel?: string | null
  studentMaskedName?: string
  generalAverage?: number | null
  generalAverageDisplay?: string
  rank?: number | null
  totalStudents?: number | null
  rankDisplay?: string
  issuedAt?: string
  generatedAt?: string
  revokedAt?: string
  reprintCount?: number
  isDuplicate?: boolean
  computationVersion?: number
  legacyFormat?: boolean
  formatNotice?: string | null
  authentic: boolean
  message?: string
  data?: {
    studentName?: string
    className?: string
    yearName?: string
    periodName?: string
    [key: string]: unknown
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
      setError('Identifiant de vérification manquant')
      return
    }

    const search = typeof window !== 'undefined' ? window.location.search : ''
    const queryToken = new URLSearchParams(search).get('token')
    const url = queryToken
      ? `/api/v2/verify/${encodeURIComponent(documentId)}?token=${encodeURIComponent(queryToken)}`
      : `/api/v2/verify/${encodeURIComponent(documentId)}`

    fetch(url)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json.document) {
          setError(json.message || 'Document introuvable ou code de vérification invalide.')
        } else {
          setDoc(json.document as VerifiedDocument)
        }
      })
      .catch(() => {
        setError('Impossible de joindre le serveur de vérification')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [documentId])

  const effectiveStatus: VerifyStatus =
    doc?.status ?? (doc ? (doc.authentic ? 'AUTHENTIC' : 'REVOKED') : 'NOT_FOUND')
  const isAuthentic = !loading && Boolean(doc) && effectiveStatus === 'AUTHENTIC' && doc?.authentic === true
  const isRevoked = !loading && Boolean(doc) && (effectiveStatus === 'REVOKED' || effectiveStatus === 'TAMPERED')
  const isNotFound = !loading && (!doc || effectiveStatus === 'NOT_FOUND' || Boolean(error))
  const isShortLookup = doc?.lookupMode === 'SHORT_CODE'

  const studentDisplay = doc?.studentMaskedName ?? doc?.data?.studentName
  const classDisplay = doc?.className ?? doc?.data?.className
  const yearDisplay = doc?.yearName ?? doc?.data?.yearName
  const periodDisplay = doc?.periodName ?? doc?.data?.periodName
  const issuedDisplay = doc?.issuedAt ?? doc?.generatedAt

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
      <div className="login-bg" />
      <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />

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
            <span style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>Vérification de l&apos;authenticité en cours...</span>
          </div>
        )}

        {isNotFound && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--red-light)', color: 'var(--red)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <XCircle size={36} />
            </div>
            <div>
              <span style={{
                display: 'inline-block', padding: '4px 12px', borderRadius: 20,
                background: 'var(--red-light)', color: 'var(--red)',
                fontSize: 11, fontWeight: 800, marginBottom: 8,
              }}>
                INTROUVABLE
              </span>
              <h1 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 800, color: 'var(--red)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
                Document non authentifié
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)' }}>
                {error || 'Document introuvable ou code de vérification invalide.'}
              </p>
            </div>
          </div>
        )}

        {isRevoked && doc && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--amber-light, #fef3c7)', color: 'var(--amber, #b45309)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={34} />
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 20,
              background: 'var(--amber-light, #fef3c7)', color: 'var(--amber, #b45309)',
              fontSize: 12, fontWeight: 800,
            }}>
              {effectiveStatus === 'TAMPERED' ? 'INTÉGRITÉ COMPROMISE' : 'RÉVOQUÉ OU REMPLACÉ'}
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
              {doc.type}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
              {doc.message || 'Ce document a été révoqué ou remplacé par une nouvelle version officielle.'}
            </p>
            {!isShortLookup && doc.school && (
              <div style={{
                width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 14, textAlign: 'left', fontSize: 12, color: 'var(--text2)',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div><strong>Établissement :</strong> {doc.school}</div>
                {studentDisplay && <div><strong>Élève :</strong> {studentDisplay}</div>}
                {doc.revokedAt && (
                  <div><strong>Révoqué le :</strong> {new Date(doc.revokedAt).toLocaleDateString('fr-FR')}</div>
                )}
              </div>
            )}
          </div>
        )}

        {isAuthentic && doc && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--green-light)', color: 'var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
            }}>
              <CheckCircle2 size={36} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 14 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: 'var(--green-light)', border: '1px solid rgba(47, 143, 91, 0.25)',
                color: 'var(--success)', fontSize: 12, fontWeight: 800,
              }}>
                <Shield size={14} /> AUTHENTIQUE
              </span>
              {!isShortLookup && doc.isDuplicate && (doc.reprintCount ?? 0) > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 20,
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 12, fontWeight: 700,
                }}>
                  <Copy size={13} /> Duplicata n° {doc.reprintCount}
                </span>
              )}
              {doc.legacyFormat && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '6px 12px', borderRadius: 20,
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  color: 'var(--text2)', fontSize: 11, fontWeight: 700,
                }}>
                  {doc.formatNotice || 'Ancien format (v1)'}
                </span>
              )}
            </div>

            <h1 style={{ margin: '0 0 4px 0', fontSize: 22, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
              {doc.type}
            </h1>
            <span style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
              Code : <strong style={{ color: 'var(--text)' }}>{doc.shortVerifyCode ?? doc.id}</strong>
            </span>

            {isShortLookup ? (
              <div style={{
                width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 12, padding: 16, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 14,
              }}>
                {doc.message || 'Référence reconnue authentique dans le registre officiel. Scannez le QR code pour comparer les résultats.'}
              </div>
            ) : (
              <>
                <div style={{
                  width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column',
                  gap: 12, textAlign: 'left', marginBottom: 18,
                }}>
                  {doc.school && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Building2 size={16} style={{ color: 'var(--primary)', marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Établissement émetteur</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{doc.school}</div>
                      </div>
                    </div>
                  )}

                  {studentDisplay && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <User size={16} style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Élève</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{studentDisplay}</div>
                      </div>
                    </div>
                  )}

                  {(classDisplay || yearDisplay || periodDisplay) && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <FileText size={16} style={{ color: 'var(--amber)', marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Classe &amp; Période</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {[classDisplay, periodDisplay, yearDisplay].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                    </div>
                  )}

                  {(doc.generalAverageDisplay || doc.rankDisplay) && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Award size={16} style={{ color: 'var(--success)', marginTop: 2, flexShrink: 0 }} />
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        {doc.generalAverageDisplay && (
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Moyenne générale</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{doc.generalAverageDisplay}</div>
                          </div>
                        )}
                        {doc.rankDisplay && (
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Rang</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{doc.rankDisplay}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {issuedDisplay && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <Calendar size={16} style={{ color: 'var(--text3)', marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>Date d&apos;émission</div>
                        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>
                          {new Date(issuedDisplay).toLocaleString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
                  Comparez la moyenne générale, le rang et le nom masqué avec votre document papier. Les notes détaillées et la conduite restent privées.
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid var(--border)', width: '100%' }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 700 }}>
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </main>
    </div>
  )
}
