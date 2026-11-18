'use client'
import { Loader2, Send, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

interface Props {
  currentPeriodId: string | null
  submissionStatus: string | null
  submitting: boolean
  submitError: string | null
  isOnline: boolean
  onSubmit: () => void
}

export default function AppreciationSubmissionBanner({
  currentPeriodId,
  submissionStatus,
  submitting,
  submitError,
  isOnline,
  onSubmit,
}: Props) {
  return (
    <>
      {currentPeriodId && (
        <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
            {submissionStatus === null ? (
              <>
                <Send size={15} strokeWidth={2} style={{ color: 'var(--amber)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Prêt pour soumission</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Les bulletins de la classe peuvent être soumis au censeur.</div>
                </div>
              </>
            ) : submissionStatus === 'SUBMITTED' ? (
              <>
                <Clock size={15} strokeWidth={2} style={{ color: 'var(--amber)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>En attente de validation</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Le censeur doit valider avant publication.</div>
                </div>
              </>
            ) : submissionStatus === 'VALIDATED' ? (
              <>
                <CheckCircle2 size={15} strokeWidth={2} style={{ color: 'var(--green)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>Validé, en attente de publication</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>L'administrateur doit publier les bulletins.</div>
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} strokeWidth={2} style={{ color: 'var(--blue)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>Bulletins publiés</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>Les parents ont été notifiés.</div>
                </div>
              </>
            )}
          </div>
          {submissionStatus === null && (
            <button
              onClick={onSubmit}
              disabled={submitting || !isOnline}
              style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: submitting || !isOnline ? 'not-allowed' : 'pointer', border: 'none', fontFamily: 'inherit',
                background: submitting ? 'var(--border)' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: !isOnline ? 0.5 : 1 }}>
              {submitting ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Send size={13} strokeWidth={2} />}
              {submitting ? 'Envoi…' : 'Soumettre au censeur'}
            </button>
          )}
        </div>
      )}
      {submitError && (
        <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: 8, color: 'var(--red)', fontSize: 12, fontWeight: 600, marginBottom: 12, whiteSpace: 'pre-line' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} strokeWidth={2} /> </span>
          {submitError}
        </div>
      )}
    </>
  )
}
