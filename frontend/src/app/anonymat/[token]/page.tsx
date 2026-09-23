'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle, Printer } from 'lucide-react'
import LanguageSwitch from '@/components/LanguageSwitch'

type Row = {
  code: string
  studentLastName: string
  studentFirstName: string
  className: string
  orderInClass: number
}

function AnonymatListContent() {
  const params = useParams()
  const token = String(params.token ?? '')
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('Lien invalide')
      return
    }
    fetch(`/api/v2/anonymat/lists/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setRows(data.data.rows ?? [])
          setStatus('ready')
        } else {
          setStatus('error')
          setError(data.message || data.error || 'Lien invalide ou expiré')
        }
      })
      .catch(() => {
        setStatus('error')
        setError('Erreur réseau')
      })
  }, [token])

  const markDone = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v2/anonymat/lists/${encodeURIComponent(token)}/done`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) setStatus('done')
      else setError(data.message || data.error || 'Échec')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={36} style={{ color: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24, position: 'relative' }}>
        <div className="login-bg" />
        <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)', position: 'relative', zIndex: 1 }}>
          <XCircle size={48} style={{ color: 'var(--red)', margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Liste inaccessible</h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>{error}</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24, position: 'relative' }}>
        <div className="login-bg" />
        <div className="deco-band" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 5 }} />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 40, maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)', position: 'relative', zIndex: 1 }}>
          <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
          <h2 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>Merci</h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, margin: 0 }}>Votre lot est marqué terminé. Cette liste n'est plus accessible.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '80px 24px 40px', position: 'relative', fontFamily: 'var(--font-nunito), Nunito, sans-serif' }}>
      <div className="login-bg" />
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
          <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            ZekoulABia
          </span>
        </div>
        <LanguageSwitch compact />
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 28px', boxShadow: '0 10px 40px rgba(58, 36, 25, 0.10)', position: 'relative', zIndex: 1 }}>
        <h1 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Liste d'anonymisation
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 16 }}>
          Apposez le même code sur l'en-tête et le corps de chaque copie, puis séparez-les.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Classe</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nom</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prénom</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Code</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.className}-${r.code}`} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', fontSize: 14, color: 'var(--text2)' }}>{r.orderInClass}</td>
                <td style={{ padding: '12px 8px', fontSize: 14, color: 'var(--text)' }}>{r.className}</td>
                <td style={{ padding: '12px 8px', fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{r.studentLastName}</td>
                <td style={{ padding: '12px 8px', fontSize: 14, color: 'var(--text)' }}>{r.studentFirstName}</td>
                <td style={{ padding: '12px 8px', fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: 'var(--primary)' }}>{r.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Printer size={16} />
            Imprimer
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={markDone}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 14, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.2s' }}
            onMouseEnter={e => !submitting && (e.currentTarget.style.background = 'var(--primary-hover)')}
            onMouseLeave={e => !submitting && (e.currentTarget.style.background = 'var(--primary)')}
          >
            <CheckCircle size={16} />
            {submitting ? 'Validation…' : "J'ai terminé mon lot"}
          </button>
        </div>
      </div>
      <style>{`
        @media print {
          button { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  )
}

export default function AnonymatTokenPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />}>
      <AnonymatListContent />
    </Suspense>
  )
}