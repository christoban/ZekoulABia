'use client'

import { useState, useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { X, Rocket } from 'lucide-react'

// ─── Helper label + error ─────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>
        {label}
      </label>
      {children}
      {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface DemoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
  lang: 'fr' | 'en'
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DemoModal({ isOpen, onClose, onSuccess, onError, lang }: DemoModalProps) {
  const [nom, setNom] = useState('')
  const [nomEtablissement, setNomEtablissement] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [ville, setVille] = useState('')
  const [nbEleves, setNbEleves] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Lock scroll + Escape to close
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isFr = lang === 'fr'

  const validate = () => {
    const e: Record<string, string> = {}
    if (!nom.trim()) e.nom = isFr ? 'Champ requis' : 'Required'
    if (!nomEtablissement.trim()) e.nomEtablissement = isFr ? 'Champ requis' : 'Required'
    if (!email.trim()) e.email = isFr ? 'Champ requis' : 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = isFr ? 'Email invalide' : 'Invalid email'
    return e
  }

  const reset = () => {
    setNom(''); setNomEtablissement(''); setEmail(''); setTelephone('')
    setVille(''); setNbEleves(''); setMessage(''); setErrors({})
  }

  const submit = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setLoading(true); setErrors({})
    try {
      const res = await fetch('/api/v2/public/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: nom.trim(), nomEtablissement: nomEtablissement.trim(),
          email: email.trim(), telephone, ville, nbEleves, message,
        }),
      })
      const data = await res.json() as { success?: boolean; message?: string }
      if (!res.ok || !data.success) throw new Error(data.message ?? (isFr ? 'Erreur inconnue' : 'Unknown error'))
      reset()
      onSuccess()
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : (isFr ? "Erreur lors de l'envoi" : 'Send error'))
    } finally {
      setLoading(false)
    }
  }

  // inputs — taille confortable, moderne
  const inputBase: CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    fontSize: 12,
    fontFamily: 'inherit',
    color: 'var(--text)',
    background: 'var(--bg2)',
    outline: 'none',
    transition: 'border-color 100ms',
    boxSizing: 'border-box',
  }

  const focusGreen = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    el.style.borderColor = 'var(--green)'
  }
  const blurDefault = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, hasError: boolean) => {
    el.style.borderColor = hasError ? 'var(--red)' : 'var(--border)'
  }

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(26,18,9,0.55)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.18s ease',
        }}
      />

      {/* ── Conteneur de centrage (pas d'animation ici) ── */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 201, width: '96%', maxWidth: 620,
        maxHeight: '85vh', overflowY: 'auto',
        borderRadius: 10,
      }}>
        {/* ── Contenu animé ─────────────────────────────── */}
        <div style={{
          background: 'var(--surface)', borderRadius: 8,
          padding: '24px 20px',
          animation: 'popIn 0.18s ease',
          boxShadow: '0 16px 48px rgba(0,0,0,0.16)',
        }}>

          {/* ── Header ──────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0, background: "linear-gradient(135deg,var(--green),var(--green2))", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "65%", height: "65%", objectFit: "contain" }} /></div>
              <div>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                  {isFr ? 'Demander une démo gratuite' : 'Request a free demo'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
                  {isFr ? 'Notre équipe vous contacte dans les 24h ouvrables.' : 'Our team contacts you within 24 business hours.'}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--bg2)', border: 'none', cursor: 'pointer',
                color: 'var(--text2)', fontSize: 16, padding: '6px 9px',
                borderRadius: 8, lineHeight: 1, marginLeft: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--border)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg2)' }}
              title={isFr ? 'Fermer' : 'Close'}
            ><X size={16} strokeWidth={2} /></button>
          </div>

          {/* Séparateur */}
          <div style={{ height: 1, background: 'var(--border)', marginBottom: 16 }} />

          {/* ── Formulaire ──────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Ligne 1 : Nom + Établissement */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <Field label={`${isFr ? 'Nom complet' : 'Full name'} *`} error={errors.nom}>
                <input
                  value={nom} onChange={e => setNom(e.target.value)}
                  placeholder={isFr ? 'Jean Nguema' : 'John Doe'}
                  style={{ ...inputBase, borderColor: errors.nom ? 'var(--red)' : 'var(--border)' }}
                  onFocus={e => focusGreen(e.currentTarget)}
                  onBlur={e => blurDefault(e.currentTarget, !!errors.nom)}
                />
              </Field>
              <Field label={`${isFr ? "Nom de l'établissement" : 'School name'} *`} error={errors.nomEtablissement}>
                <input
                  value={nomEtablissement} onChange={e => setNomEtablissement(e.target.value)}
                  placeholder="Lycée de la Réussite"
                  style={{ ...inputBase, borderColor: errors.nomEtablissement ? 'var(--red)' : 'var(--border)' }}
                  onFocus={e => focusGreen(e.currentTarget)}
                  onBlur={e => blurDefault(e.currentTarget, !!errors.nomEtablissement)}
                />
              </Field>
            </div>

            {/* Ligne 2 : Email + Téléphone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <Field label="Email *" error={errors.email}>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="contact@lycee.cm"
                  style={{ ...inputBase, borderColor: errors.email ? 'var(--red)' : 'var(--border)' }}
                  onFocus={e => focusGreen(e.currentTarget)}
                  onBlur={e => blurDefault(e.currentTarget, !!errors.email)}
                />
              </Field>
              <Field label={isFr ? 'Téléphone (WhatsApp de préférence)' : 'Phone (WhatsApp preferred)'}>
                <input
                  type="tel" value={telephone} onChange={e => setTelephone(e.target.value)}
                  placeholder="+237 6XX XXX XXX"
                  style={inputBase}
                  onFocus={e => focusGreen(e.currentTarget)}
                  onBlur={e => blurDefault(e.currentTarget, false)}
                />
              </Field>
            </div>

            {/* Ligne 3 : Ville + Nb élèves */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <Field label={isFr ? 'Ville' : 'City'}>
                <input
                  value={ville} onChange={e => setVille(e.target.value)}
                  placeholder="Yaoundé"
                  style={inputBase}
                  onFocus={e => focusGreen(e.currentTarget)}
                  onBlur={e => blurDefault(e.currentTarget, false)}
                />
              </Field>
              <Field label={isFr ? "Nombre d'élèves (approx.)" : 'Students approx.'}>
                <select
                  value={nbEleves} onChange={e => setNbEleves(e.target.value)}
                  style={{ ...inputBase, cursor: 'pointer', appearance: 'auto' }}
                  onFocus={e => focusGreen(e.currentTarget)}
                  onBlur={e => blurDefault(e.currentTarget, false)}
                >
                  <option value="">{isFr ? 'Choisir...' : 'Choose...'}</option>
                  <option value="lt100">{isFr ? '< 100 élèves' : '< 100 students'}</option>
                  <option value="100-300">100 – 300</option>
                  <option value="300-500">300 – 500</option>
                  <option value="500plus">500+</option>
                </select>
              </Field>
            </div>

            {/* Message */}
            <Field label={isFr ? 'Message (optionnel)' : 'Message (optional)'}>
              <textarea
                value={message} onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder={isFr
                  ? 'Dites-nous en plus sur votre établissement ou vos besoins spécifiques...'
                  : 'Tell us more about your school or specific needs...'}
                style={{ ...inputBase, resize: 'vertical', minHeight: 100 }}
                onFocus={e => focusGreen(e.currentTarget)}
                onBlur={e => blurDefault(e.currentTarget, false)}
              />
            </Field>

            {/* Bouton Envoyer */}
            <button
              onClick={submit}
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#6b9e8e' : 'linear-gradient(135deg,var(--green),var(--green2))',
                color: 'var(--surface)', fontWeight: 800, fontSize: 13,
                padding: '11px 20px', borderRadius: 6, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 3px 10px rgba(5,150,105,0.2)',
                fontFamily: 'inherit', transition: 'all 100ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(5,150,105,0.36)' }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(5,150,105,0.24)' }}
            >
              {loading ? (
                <>
                  <span style={{
                    display: 'inline-block', width: 18, height: 18, flexShrink: 0,
                    border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'var(--surface)',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }} />
                  {isFr ? 'Envoi en cours...' : 'Sending...'}
                </>
              ) : (
                <><Rocket size={18} strokeWidth={2} />{isFr ? 'Envoyer la demande' : 'Send request'}</>
              )}
            </button>

          </div>
        </div>
      </div>
    </>
  )
}
