'use client'
import { useState, useCallback, useEffect } from 'react'
import { Loader2, Save, Send, AlertCircle, CheckCircle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

type Line = {
  code: string
  classId: string
  className?: string
  score: number | null
  isAbsent: boolean
  isIllegible: boolean
  status: 'DRAFT' | 'SUBMITTED'
}

type CorrectionSheetData = {
  lines: Line[]
  submitted: boolean
  sessionName?: string
}

type MySession = {
  sessionId: string
  subjectId: string
  subjectName: string
  classIds: string[]
  classNames: string[]
  anonymatStatus: string
  scheduledDate: string
  submitted: boolean
}

export default function SectionTeacherCorrectionAnonyme({
  onToast,
}: {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}) {
  const [sessionId, setSessionId] = useState('')
  const [mySessions, setMySessions] = useState<MySession[]>([])
  const [lines, setLines] = useState<Line[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [absents, setAbsents] = useState<Record<string, boolean>>({})
  const [illegibles, setIllegibles] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Load assigned sessions on mount
  useEffect(() => {
    fetchApi('/api/v2/assessments/anonymat/my-correction-sessions', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setMySessions(d.data ?? []) })
      .catch(() => {})
  }, [])

  const loadSheet = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetchApi(
        `/api/v2/assessments/sessions/${sessionId}/anonymat/correction-sheet`,
        { credentials: 'include' },
      )
      const data = await res.json()
      if (!data.success) {
        onToast(data.message || data.error || 'Accès refusé', 'error')
        return
      }
      const sheetData: CorrectionSheetData = data.data
      setLines(sheetData.lines)
      setSubmitted(sheetData.submitted)
      const initScores: Record<string, string> = {}
      const initAbsents: Record<string, boolean> = {}
      const initIllegibles: Record<string, boolean> = {}
      for (const l of sheetData.lines) {
        initScores[l.code] = l.score != null ? String(l.score) : ''
        initAbsents[l.code] = l.isAbsent
        initIllegibles[l.code] = l.isIllegible
      }
      setScores(initScores)
      setAbsents(initAbsents)
      setIllegibles(initIllegibles)
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setLoading(false)
    }
  }, [sessionId, onToast])

  const saveDraft = async () => {
    const entries = lines.map((l) => ({
      code: l.code,
      score: scores[l.code] === '' ? null : Number(scores[l.code]),
      isAbsent: absents[l.code] ?? false,
      isIllegible: illegibles[l.code] ?? false,
    }))
    setSaving(true)
    try {
      const res = await fetchApi(`/api/v2/assessments/sessions/${sessionId}/anonymat/notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      })
      const data = await res.json()
      if (data.success) onToast('Brouillon enregistré', 'info')
      else onToast(data.message || data.error || 'Erreur', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setSaving(false)
    }
  }

  const submit = async () => {
    await saveDraft()
    setSubmitting(true)
    try {
      const res = await fetchApi(
        `/api/v2/assessments/sessions/${sessionId}/anonymat/notes/submit`,
        { method: 'POST', credentials: 'include' },
      )
      const data = await res.json()
      if (data.success) {
        onToast('Correction soumise — plus de modification', 'success')
        setSubmitted(true)
        loadSheet()
      } else onToast(data.message || data.error || 'Erreur', 'error')
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'Erreur réseau', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleScoreChange = (code: string, value: string) => {
    if (submitted) return
    setScores((s) => ({ ...s, [code]: value }))
  }

  const handleAbsentChange = (code: string, checked: boolean) => {
    if (submitted) return
    setAbsents((a) => ({ ...a, [code]: checked }))
    if (checked) setIllegibles((i) => ({ ...i, [code]: false }))
  }

  const handleIllegibleChange = (code: string, checked: boolean) => {
    if (submitted) return
    setIllegibles((i) => ({ ...i, [code]: checked }))
    if (checked) setAbsents((a) => ({ ...a, [code]: false }))
  }

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
          Correction anonyme
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text3)' }}>Saisissez les notes par code d'anonymat — aucun nom d'élève n'est affiché</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 3 }}>Session à corriger</label>
            <select
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value)
                setLines([])
              }}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, outline: 'none', fontFamily: 'inherit' }}
            >
              <option value="">— Session à corriger —</option>
              {mySessions.map((s) => (
                <option key={s.sessionId} value={s.sessionId}>
                  {new Date(s.scheduledDate).toLocaleDateString('fr-FR')} · {s.subjectName || s.subjectId.slice(0, 8)}…
                  {s.submitted ? ' (soumis)' : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={loadSheet}
            disabled={loading || !sessionId}
            style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--primary)', color: 'white', fontSize: 12.5, fontWeight: 700, border: 'none', cursor: loading || !sessionId ? 'not-allowed' : 'pointer', opacity: loading || !sessionId ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
          >
            <Loader2 size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Chargement…' : 'Charger la fiche'}
          </button>
        </div>
      </div>

      {lines.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Code</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Classe</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Note /20</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Absent</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Illisible</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.code} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{l.code}</td>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--text3)' }}>{l.className || l.classId}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.25}
                        value={scores[l.code] ?? ''}
                        onChange={(e) => handleScoreChange(l.code, e.target.value)}
                        disabled={submitted || l.status === 'SUBMITTED'}
                        style={{ width: 68, padding: '4px 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, outline: 'none', textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={absents[l.code] ?? false}
                          onChange={(e) => handleAbsentChange(l.code, e.target.checked)}
                          disabled={submitted || l.status === 'SUBMITTED'}
                          style={{ width: 14, height: 14, cursor: 'pointer' }}
                        />
                      </label>
                    </td>
                    <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={illegibles[l.code] ?? false}
                          onChange={(e) => handleIllegibleChange(l.code, e.target.checked)}
                          disabled={submitted || l.status === 'SUBMITTED'}
                          style={{ width: 14, height: 14, cursor: 'pointer' }}
                        />
                      </label>
                    </td>
                    <td style={{ padding: '7px 12px', fontSize: 11.5 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: l.status === 'SUBMITTED' ? 'var(--green-light)' : 'var(--bg2)', color: l.status === 'SUBMITTED' ? 'var(--green)' : 'var(--text3)' }}>
                        {l.status === 'SUBMITTED' ? 'Soumis' : 'Brouillon'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!submitted && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={saveDraft}
                disabled={saving}
                style={{ padding: '6px 13px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
              >
                <Save size={13} />
                {saving ? 'Enregistrement…' : 'Enregistrer brouillon'}
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                style={{ padding: '6px 13px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}
              >
                <Send size={13} />
                {submitting ? 'Soumission…' : 'Soumettre la correction'}
              </button>
            </div>
          )}

          {submitted && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color="var(--green)" />
              <span style={{ color: 'var(--green)', fontSize: 12.5, fontWeight: 700 }}>Correction soumise — aucune modification n'est plus possible</span>
            </div>
          )}
        </div>
      )}

      {sessionId && lines.length === 0 && !loading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--text3)" style={{ margin: '0 auto 8px' }} />
          <p style={{ color: 'var(--text3)', fontSize: 13, fontWeight: 600 }}>Aucune fiche de correction trouvée pour cette session.</p>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Vérifiez l'ID de session et assurez-vous que la correction vous est assignée.</p>
        </div>
      )}
    </div>
  )
}