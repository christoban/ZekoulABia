'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, PartyPopper, XCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import ConversationalOnboarding, { type OnboardingState } from './ConversationalOnboarding'
import { validateGrilleHoraire } from './timetableGridConfig'
import AnimatedBackground from '@/components/AnimatedBackground'
import LanguageSwitch from '@/components/LanguageSwitch'

// ── Types ──────────────────────────────────────────────────────────────────

interface SchoolData {
  id: string
  name: string
  subdomain: string
  subsystem: string
  educationType: string
  ownership: string
  email: string | null
  logoUrl: string | null
  status: string
  onboardingConfig?: Record<string, unknown> | null
}

// ── Styles ─────────────────────────────────────────────────────────────────

const PAGE: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  fontFamily: 'var(--font-nunito),Nunito,sans-serif',
  padding: '40px 16px 80px',
}

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1.5px solid var(--border)',
  borderRadius: 18,
  padding: '36px 40px',
  width: '100%',
  maxWidth: 480,
  boxShadow: '0 4px 24px rgba(26,46,30,0.07)',
}

const BTN_PRIMARY: React.CSSProperties = {
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
  color: 'white', border: 'none', borderRadius: 10,
  padding: '13px 28px', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
}

// ── Component ──────────────────────────────────────────────────────────────

type ActivationPhase = 'config' | 'activating' | 'success'

interface ActivationStats {
  classCount: number
  subjectCount: number
  academicYear: string
}

const PROGRESS_STEPS = [
  'Création de l\'année scolaire',
  'Création des classes',
  'Configuration des matières',
  'Configuration des règles MINESEC',
]

export default function ConfigurationPage() {
  const router = useRouter()
  const t = useT('onboarding')

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [school, setSchool] = useState<SchoolData | null>(null)
  const [activationPhase, setActivationPhase] = useState<ActivationPhase>('config')
  const [completedSteps, setCompletedSteps] = useState(0)
  const [activationStats, setActivationStats] = useState<ActivationStats | null>(null)
  const [activateError, setActivateError] = useState('')
  const [redirectCountdown, setRedirectCountdown] = useState(3)

  // ── Load school info ──────────────────────────────────────────────────
  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.replace('/login'); return }
        const s: SchoolData = d.data
        if (s.status === 'ACTIVE') { router.replace('/admin/dashboard'); return }
        if (s.status !== 'APPROVED') { router.replace('/login'); return }
        setSchool(s)
        setLoadState('ready')
      })
      .catch(() => router.replace('/login'))
  }, [router])

  // ── Exécution (onboarding conversationnel → build déterministe) ─────────
  async function handleExecute(state: OnboardingState) {
    if (!school) return
    setActivateError('')
    setActivationPhase('activating')
    setCompletedSteps(0)

    // Animation séquentielle des étapes (même si backend répond instantanément)
    const STEP_DELAY = 600
    const stepTimers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i <= PROGRESS_STEPS.length; i++) {
      stepTimers.push(setTimeout(() => setCompletedSteps(i), i * STEP_DELAY))
    }
    const minDisplayTime = PROGRESS_STEPS.length * STEP_DELAY + 400

    const startTime = Date.now()
    try {
      const gridError = validateGrilleHoraire(state.gridConfig)
      if (gridError) throw new Error(t(`phase2.timetableGrid.validation.${gridError}`))

      const gridResponse = await fetchApi('/api/v2/timetable-grid-config', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.gridConfig),
      })
      const gridData = await gridResponse.json()
      if (!gridResponse.ok || !gridData.success) throw new Error(gridData.message || t('phase2.timetableGrid.saveError'))

      const res = await fetchApi(`/api/v2/onboarding/execute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Erreur lors de la configuration')

      const stats: ActivationStats = {
        classCount:   data.data?.classCount   ?? 0,
        subjectCount: data.data?.subjectCount ?? 0,
        academicYear: data.data?.academicYear ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      }

      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, minDisplayTime - elapsed)
      setTimeout(() => {
        stepTimers.forEach(clearTimeout)
        setCompletedSteps(PROGRESS_STEPS.length)
        setActivationStats(stats)
        setActivationPhase('success')
      }, remaining)
    } catch (e: unknown) {
      stepTimers.forEach(clearTimeout)
      setActivateError(e instanceof Error ? e.message : 'Erreur réseau. Réessayez.')
      setActivationPhase('config')
    }
  }

  // ── Compte à rebours auto-redirect (phase success) ────────────────────
  useEffect(() => {
    if (activationPhase !== 'success') return
    setRedirectCountdown(3)
    const interval = setInterval(() => {
      setRedirectCountdown(n => {
        if (n <= 1) { clearInterval(interval); return 0 }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [activationPhase])

  useEffect(() => {
    if (redirectCountdown === 0) router.replace('/admin/dashboard?activated=1')
  }, [redirectCountdown, router])

  // ── Loading / error screens ───────────────────────────────────────────

  if (loadState === 'loading') {
    return (
      <div style={{ ...PAGE, justifyContent: 'center' }}>
        <div style={{ width: 48, height: 48, border: '4px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite' }} />
        <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (loadState === 'error' || !school) return null

  // ── Phase : écran de progression ─────────────────────────────────────
  if (activationPhase === 'activating') {
    return (
      <div style={{ ...PAGE, justifyContent: 'center' }}>
        <style>{`
          @keyframes edu-spin { to { transform: rotate(360deg); } }
          @keyframes edu-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
          @keyframes edu-checkIn { 0% { transform:scale(0.4); opacity:0; } 70% { transform:scale(1.15); } 100% { transform:scale(1); opacity:1; } }
        `}</style>
        <div style={{ ...CARD, maxWidth: 480, animation: 'edu-fadeUp 0.35s ease both' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 52, height: 52, border: '4px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              Configuration de votre établissement…
            </div>
            <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>Quelques secondes</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PROGRESS_STEPS.map((label, i) => {
              const done = completedSteps > i
              const active = completedSteps === i
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: done ? 'var(--green-light)' : active ? 'var(--bg)' : 'var(--bg)', borderRadius: 10, border: `1.5px solid ${done ? 'rgba(142,42,58,0.2)' : 'var(--border)'}`, transition: 'all 0.3s' }}>
                  <div style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {done ? (
                      <span style={{ display: 'flex', color: 'var(--green)', animation: 'edu-checkIn 0.3s ease both' }}><CheckCircle2 size={20} /></span>
                    ) : active ? (
                      <div style={{ width: 20, height: 20, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite' }} />
                    ) : (
                      <span style={{ display: 'flex', opacity: 0.35 }}><Loader2 size={18} /></span>
                    )}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: done ? 700 : 500, color: done ? 'var(--green)' : active ? 'var(--text)' : 'var(--text3)' }}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Phase : écran de succès ──────────────────────────────────────────
  if (activationPhase === 'success' && activationStats) {
    return (
      <div style={{ ...PAGE, justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes edu-popIn { 0% { transform:scale(0.7); opacity:0; } 70% { transform:scale(1.05); } 100% { transform:scale(1); opacity:1; } }
          @keyframes edu-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
        `}</style>
        {/* Célébration — particules dorées/vertes, teinte fixe */}
        <AnimatedBackground variant="celebration" style={{ zIndex: 0 }} />
        <div style={{ ...CARD, maxWidth: 480, textAlign: 'center', animation: 'edu-fadeUp 0.4s ease both', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, animation: 'edu-popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}><PartyPopper size={64} /></div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            Votre établissement est configuré et prêt !
          </div>
          <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            <strong>{school.name}</strong> est maintenant actif sur la plateforme.
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
            {activationStats.classCount > 0 && (
              <div style={{ background: 'var(--green-light)', border: '1.5px solid rgba(142,42,58,0.2)', borderRadius: 12, padding: '12px 20px', minWidth: 110 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{activationStats.classCount}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>classes</div>
              </div>
            )}
            {activationStats.subjectCount > 0 && (
              <div style={{ background: 'var(--blue-light)', border: '1.5px solid rgba(29,78,216,0.15)', borderRadius: 12, padding: '12px 20px', minWidth: 110 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{activationStats.subjectCount}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>matières</div>
              </div>
            )}
            <div style={{ background: 'var(--amber-light)', border: '1.5px solid rgba(234,179,8,0.25)', borderRadius: 12, padding: '12px 20px', minWidth: 110 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--amber)' }}>{activationStats.academicYear}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>année scolaire</div>
            </div>
          </div>

          <div style={{ background: 'var(--border)', borderRadius: 8, overflow: 'hidden', height: 5, marginBottom: 10 }}>
            <div style={{ height: '100%', background: 'var(--green)', width: `${((3 - redirectCountdown) / 3) * 100}%`, transition: 'width 0.9s linear', borderRadius: 8 }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginBottom: 20 }}>
            Redirection dans {redirectCountdown} seconde{redirectCountdown > 1 ? 's' : ''}…
          </div>

          <button
            onClick={() => router.replace('/admin/dashboard?activated=1')}
            style={{ ...BTN_PRIMARY, width: '100%', justifyContent: 'center', fontSize: 16, padding: '15px 28px' }}>
            Accéder à mon tableau de bord →
          </button>
        </div>
      </div>
    )
  }

  // ── Phase config : questionnaire conversationnel ──────────────────────
  return (
    <div style={PAGE}>
      <style>{`
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        @keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* Brand header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,var(--sidebar),var(--accent))", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "65%", height: "65%", objectFit: "contain" }} /></div>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>ZekoulABia</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Configuration de votre espace</div>
        </div>
        {/* Langue de l'onboarding : FR par défaut, un anglophone bascule en EN ici (mémorisé) */}
        <LanguageSwitch style={{ marginLeft: 'auto' }} />
      </div>

      {activateError && (
        <div style={{ maxWidth: 560, width: '100%', background: 'var(--red-light)', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <XCircle size={16} style={{ flexShrink: 0 }} /> {activateError}
        </div>
      )}

      <ConversationalOnboarding
        schoolId={school.id}
        schoolName={school.name}
        subSystem={school.subsystem as OnboardingState['subSystem']}
        ownership={school.ownership}
        educationType={school.educationType}
        phase1Config={school.onboardingConfig ?? undefined}
        onComplete={handleExecute}
      />

      <div style={{ marginTop: 28, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
        ZekoulABia · Plateforme de gestion scolaire · Cameroun
      </div>
    </div>
  )
}
