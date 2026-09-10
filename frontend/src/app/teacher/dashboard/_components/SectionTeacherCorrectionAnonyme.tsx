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
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="text-[22px] font-bold text-[var(--text)] mb-2" style={{ fontFamily: 'var(--font-spectral),Spectral,serif' }}>
          Correction anonyme
        </h1>
        <p className="text-[var(--text3)] text-sm">Saisissez les notes par code d'anonymat — aucun nom d'élève n'est affiché</p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label className="block text-sm font-medium text-[var(--text2)] mb-1">Session à corriger</label>
            <select
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value)
                setLines([])
              }}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
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
            className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            <Loader2 size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Chargement…' : 'Charger la fiche'}
          </button>
        </div>
      </div>

      {lines.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Code</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Classe</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Note /20</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Absent</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Illisible</th>
                  <th className="text-left p-3 text-sm font-semibold text-[var(--text3)] uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.code} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="p-3 font-mono text-lg font-bold text-[var(--text)]" style={{ fontFamily: 'monospace' }}>{l.code}</td>
                    <td className="p-3 text-sm text-[var(--text3)]">{l.className || l.classId}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.25}
                        value={scores[l.code] ?? ''}
                        onChange={(e) => handleScoreChange(l.code, e.target.value)}
                        disabled={submitted || l.status === 'SUBMITTED'}
                        className="w-24 px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-50"
                      />
                    </td>
                    <td className="p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={absents[l.code] ?? false}
                          onChange={(e) => handleAbsentChange(l.code, e.target.checked)}
                          disabled={submitted || l.status === 'SUBMITTED'}
                          className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg)] text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                      </label>
                    </td>
                    <td className="p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={illegibles[l.code] ?? false}
                          onChange={(e) => handleIllegibleChange(l.code, e.target.checked)}
                          disabled={submitted || l.status === 'SUBMITTED'}
                          className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg)] text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                      </label>
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${l.status === 'SUBMITTED' ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                        {l.status === 'SUBMITTED' ? 'Soumis' : 'Brouillon'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!submitted && (
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg2)] text-[var(--text)] text-sm font-medium hover:bg-[var(--border)] flex items-center gap-2"
              >
                <Save size={16} />
                {saving ? 'Enregistrement…' : 'Enregistrer brouillon'}
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={16} />
                {submitting ? 'Soumission…' : 'Soumettre la correction'}
              </button>
            </div>
          )}

          {submitted && (
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle size={20} className="text-green-400" />
              <span className="text-green-400 font-medium">Correction soumise — aucune modification n'est plus possible</span>
            </div>
          )}
        </div>
      )}

      {sessionId && lines.length === 0 && !loading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <AlertCircle size={48} className="text-[var(--text3)] mx-auto mb-4" />
          <p className="text-[var(--text3)]">Aucune fiche de correction trouvée pour cette session.</p>
          <p className="text-sm text-[var(--text3)] mt-1">Vérifiez l'ID de session et assurez-vous que la correction vous est assignée.</p>
        </div>
      )}
    </div>
  )
}