'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle, XCircle, Printer } from 'lucide-react'

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ed' }}>
        <Loader2 size={36} style={{ color: 'var(--green)' }} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ed', padding: 24 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 40, maxWidth: 480, textAlign: 'center' }}>
          <XCircle size={48} style={{ color: 'var(--red)' }} />
          <h2 style={{ marginTop: 16, fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, color: 'var(--text)' }}>Liste inaccessible</h2>
          <p style={{ marginTop: 8, color: 'var(--text3)' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f3ed', padding: 24 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 40, maxWidth: 480, textAlign: 'center' }}>
          <CheckCircle size={48} style={{ color: 'var(--green)' }} />
          <h2 style={{ marginTop: 16, fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, color: 'var(--text)' }}>Merci</h2>
          <p style={{ marginTop: 8, color: 'var(--text3)' }}>Votre lot est marqué terminé. Cette liste n'est plus accessible.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f3ed', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Liste d'anonymisation
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: 14, marginBottom: 16 }}>
          Apposez le même code sur l'en-tête et le corps de chaque copie, puis séparez-les.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Classe</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nom</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prénom</th>
              <th style={{ textAlign: 'left', padding: '12px 8px', fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Code</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.className}-${r.code}`} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '12px 8px', fontSize: 14, color: 'var(--text2)' }}>{r.orderInClass}</td>
                <td style={{ padding: '12px 8px', fontSize: 14, color: 'var(--text)' }}>{r.className}</td>
                <td style={{ padding: '12px 8px', fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{r.studentLastName}</td>
                <td style={{ padding: '12px 8px', fontSize: 14, color: 'var(--text)' }}>{r.studentFirstName}</td>
                <td style={{ padding: '12px 8px', fontSize: 18, fontWeight: 900, fontFamily: 'monospace', color: 'var(--text)' }}>{r.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] text-sm font-medium hover:bg-[var(--border)] flex items-center gap-2"
          >
            <Printer size={16} />
            Imprimer
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={markDone}
            className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            <CheckCircle size={16} />
            {submitting ? 'Validation…' : "J'ai terminé mon lot"}
          </button>
        </div>
      </div>
      <style jsx>{`
        @media print {
          button { display: none !important; }
          body { background: white; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

export default function AnonymatTokenPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#f7f3ed' }} />}>
      <AnonymatListContent />
    </Suspense>
  )
}