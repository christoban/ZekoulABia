'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Award, Plus, Hash, CheckCircle2, Loader2, Search } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface OnToast {
  (msg: string, type?: 'success' | 'error' | 'info'): void
}

interface StudentOption {
  userId: string
  profileId: string
  fullName: string
  className: string
  matricule: string | null
}

interface ExamRegistrationItem {
  id: string
  anneeScolaire: string
  typeExamen: string
  status: string
  session: number
  matriculeNational: string
  numeroCandidatExamen: string | null
  resultatStatus: string | null
  resultatMention: string | null
  resultatScore: number | null
}

interface RawUser {
  id: string
  firstName: string
  lastName: string
  studentProfile?: {
    id?: string
    matricule?: string | null
    class?: { name: string } | null
  } | null
}

const EXAM_TYPES = ['BEPC', 'PROBATOIRE', 'BAC', 'GCE_OL', 'GCE_AL'] as const
const RESULT_STATUSES = ['ADMIS', 'AJOURNE', 'RATTRAPAGE', 'ABSENT'] as const

export default function ExamensOfficielsPanel({ onToast }: { onToast: OnToast }) {
  const [students, setStudents] = useState<StudentOption[]>([])
  const [search, setSearch] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [anneeScolaire, setAnneeScolaire] = useState(`${new Date().getFullYear() - 1}-${new Date().getFullYear()}`)
  const [typeExamen, setTypeExamen] = useState<(typeof EXAM_TYPES)[number]>('BEPC')
  const [registrations, setRegistrations] = useState<ExamRegistrationItem[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingRegs, setLoadingRegs] = useState(false)
  const [registering, setRegistering] = useState(false)
  const [candInputs, setCandInputs] = useState<Record<string, string>>({})
  const [resultDrafts, setResultDrafts] = useState<Record<string, { status: string; mention: string; score: string }>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const onToastRef = useRef(onToast)
  useEffect(() => {
    onToastRef.current = onToast
  })

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/users?role=STUDENT&limit=200', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      fetchApi('/api/v2/academic-years?isCurrent=true', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
    ])
      .then(([uData, yData]) => {
        const rawList: RawUser[] = Array.isArray(uData?.data) ? uData.data : []
        const mapped: StudentOption[] = rawList
          .filter((u) => Boolean(u.studentProfile?.id))
          .map((u) => ({
            userId: u.id,
            profileId: u.studentProfile!.id!,
            fullName: `${u.lastName} ${u.firstName}`.trim(),
            className: u.studentProfile?.class?.name ?? '—',
            matricule: u.studentProfile?.matricule ?? null,
          }))
        setStudents(mapped)
        if (mapped.length > 0) setSelectedProfileId(mapped[0].profileId)

        const years = Array.isArray(yData?.data) ? yData.data : Array.isArray(yData) ? yData : []
        if (years[0]?.name) setAnneeScolaire(years[0].name)
      })
      .finally(() => setLoadingStudents(false))
  }, [])

  const loadRegistrations = useCallback(async (profileId: string) => {
    if (!profileId) {
      setRegistrations([])
      return
    }
    setLoadingRegs(true)
    try {
      const r = await fetchApi(`/api/v2/examens/${profileId}`, { credentials: 'include' })
      const d = await r.json()
      if (!r.ok || !d.success) throw new Error(d.message ?? 'Erreur chargement inscriptions')
      const list: ExamRegistrationItem[] = Array.isArray(d.data) ? d.data : []
      setRegistrations(list)
      const cands: Record<string, string> = {}
      const resDrafts: Record<string, { status: string; mention: string; score: string }> = {}
      for (const item of list) {
        cands[item.id] = item.numeroCandidatExamen ?? ''
        resDrafts[item.id] = {
          status: item.resultatStatus ?? 'ADMIS',
          mention: item.resultatMention ?? '',
          score: item.resultatScore != null ? String(item.resultatScore) : '',
        }
      }
      setCandInputs(cands)
      setResultDrafts(resDrafts)
    } catch (err) {
      onToastRef.current(err instanceof Error ? err.message : 'Erreur examens élève', 'error')
      setRegistrations([])
    } finally {
      setLoadingRegs(false)
    }
  }, [])

  useEffect(() => {
    if (selectedProfileId) void loadRegistrations(selectedProfileId)
  }, [selectedProfileId, loadRegistrations])

  const selectedStudent = students.find((s) => s.profileId === selectedProfileId) ?? null
  const filteredStudents = students.filter((s) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return s.fullName.toLowerCase().includes(q) || s.className.toLowerCase().includes(q) || (s.matricule ?? '').toLowerCase().includes(q)
  })

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStudent) return
    setRegistering(true)
    try {
      const r = await fetchApi('/api/v2/examens/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentUserId: selectedStudent.userId,
          typeExamen,
          anneeScolaire: anneeScolaire.trim(),
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) throw new Error(d.message ?? 'Erreur inscription examen')
      onToastRef.current(d.data?.message ?? 'Inscription examen enregistrée', 'success')
      await loadRegistrations(selectedStudent.profileId)
    } catch (err) {
      onToastRef.current(err instanceof Error ? err.message : 'Erreur inscription', 'error')
    } finally {
      setRegistering(false)
    }
  }

  const handleSaveCandidateNumber = async (examId: string) => {
    const num = (candInputs[examId] ?? '').trim()
    if (!num) {
      onToastRef.current('Saisissez le numéro de candidat', 'info')
      return
    }
    setBusyId(examId)
    try {
      const r = await fetchApi(`/api/v2/examens/${examId}/set-candidate-number`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroCandidatExamen: num }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) throw new Error(d.message ?? 'Erreur mise à jour numéro')
      onToastRef.current('Numéro candidat enregistré', 'success')
      if (selectedProfileId) await loadRegistrations(selectedProfileId)
    } catch (err) {
      onToastRef.current(err instanceof Error ? err.message : 'Erreur numéro candidat', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const handleSaveResult = async (examId: string) => {
    const draft = resultDrafts[examId] ?? { status: 'ADMIS', mention: '', score: '' }
    setBusyId(examId)
    try {
      const parsedScore = draft.score.trim() === '' ? undefined : Number(draft.score)
      if (parsedScore !== undefined && Number.isNaN(parsedScore)) throw new Error('Note / moyenne invalide')
      const r = await fetchApi(`/api/v2/examens/${examId}/result`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultatStatus: draft.status,
          ...(draft.mention.trim() ? { resultatMention: draft.mention.trim() } : {}),
          ...(parsedScore !== undefined ? { resultatScore: parsedScore } : {}),
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) throw new Error(d.message ?? 'Erreur enregistrement résultat')
      onToastRef.current('Résultat officiel enregistré', 'success')
      if (selectedProfileId) await loadRegistrations(selectedProfileId)
    } catch (err) {
      onToastRef.current(err instanceof Error ? err.message : 'Erreur résultat', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <form onSubmit={handleRegister} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 10, alignItems: 'end' }}>
        <div>
          <label style={lbl}>Filtrer élève</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 9, top: 10, color: 'var(--text3)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, classe, matricule…" style={{ ...inp, paddingLeft: 28 }} />
          </div>
        </div>
        <div>
          <label style={lbl}>Élève ({filteredStudents.length})</label>
          <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} disabled={loadingStudents} style={inp}>
            {filteredStudents.map((s) => (
              <option key={s.profileId} value={s.profileId}>{s.fullName} ({s.className}){s.matricule ? ` · ${s.matricule}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={lbl}>Examen officiel</label>
          <select value={typeExamen} onChange={(e) => setTypeExamen(e.target.value as (typeof EXAM_TYPES)[number])} style={inp}>
            {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Année scolaire</label>
          <input value={anneeScolaire} onChange={(e) => setAnneeScolaire(e.target.value)} style={inp} required />
        </div>
        <button type="submit" disabled={registering || !selectedStudent}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: registering || !selectedStudent ? 0.6 : 1 }}>
          {registering ? <Loader2 size={14} style={{ animation: 'edu-spin 0.8s linear infinite' }} /> : <Plus size={14} />}
          Inscrire dossier
        </button>
      </form>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>
          <Award size={16} style={{ color: 'var(--primary)' }} />
          Dossiers d&apos;examens {selectedStudent ? `— ${selectedStudent.fullName}` : ''}
        </div>
        {loadingRegs ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Chargement…</div>
        ) : registrations.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>Aucune inscription enregistrée pour cet élève.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {registrations.map((reg) => {
              const draft = resultDrafts[reg.id] ?? { status: 'ADMIS', mention: '', score: '' }
              return (
                <div key={reg.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--text)' }}>
                      {reg.typeExamen} · {reg.anneeScolaire} (Session {reg.session})
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800, background: 'var(--bg2)', color: 'var(--text2)' }}>
                      {reg.status} · Mat. {reg.matriculeNational}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, alignItems: 'end' }}>
                    <div>
                      <label style={lbl}>N° Candidat</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input value={candInputs[reg.id] ?? ''} onChange={(e) => setCandInputs((p) => ({ ...p, [reg.id]: e.target.value }))} placeholder="N° officiel" style={inp} />
                        <button type="button" onClick={() => handleSaveCandidateNumber(reg.id)} disabled={busyId === reg.id}
                          style={{ padding: '0 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Hash size={12} /> OK
                        </button>
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Résultat</label>
                      <select value={draft.status} onChange={(e) => setResultDrafts((p) => ({ ...p, [reg.id]: { ...draft, status: e.target.value } }))} style={inp}>
                        {RESULT_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Mention</label>
                      <input value={draft.mention} onChange={(e) => setResultDrafts((p) => ({ ...p, [reg.id]: { ...draft, mention: e.target.value } }))} placeholder="Bien, AB…" style={inp} />
                    </div>
                    <div>
                      <label style={lbl}>Moyenne</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input type="number" step="0.01" value={draft.score} onChange={(e) => setResultDrafts((p) => ({ ...p, [reg.id]: { ...draft, score: e.target.value } }))} placeholder="12.50" style={inp} />
                        <button type="button" onClick={() => handleSaveResult(reg.id)} disabled={busyId === reg.id}
                          style={{ padding: '0 12px', borderRadius: 8, border: 'none', background: 'var(--green)', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} /> Valider
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', boxSizing: 'border-box' }
