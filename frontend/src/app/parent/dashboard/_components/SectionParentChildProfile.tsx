'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  User,
  School,
  Lock,
  Smartphone,
  Save,
  Shield,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Info,
  Calendar,
  Award,
  Users,
  HeartPulse,
  TrendingUp,
  FileText,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useT } from '@/lib/i18n'
import { isFirstCycleOrPrimary, isExamClass, getExamLabel } from '@/lib/academicExamDetector'
import type { ChildWithStats, ParentSection } from '../_types'

interface Props {
  userId?: string
  initialStudentId?: string
  onNav?: (section: ParentSection) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

function detectSousSysteme(classeNom?: string | null): 'ANGLOPHONE' | 'FRANCOPHONE' {
  const c = (classeNom || '').trim().toLowerCase()
  if (
    c.includes('form') ||
    c.includes('sixth') ||
    c.includes('class ') ||
    c.includes('class1') ||
    c.includes('class2') ||
    c.includes('class3') ||
    c.includes('class4') ||
    c.includes('class5') ||
    c.includes('class6') ||
    c.includes('nursery')
  ) {
    return 'ANGLOPHONE'
  }
  return 'FRANCOPHONE'
}

function detectCycleLabel(classeNom?: string | null): { cycle: string; ministere: string } {
  const c = (classeNom || '').trim().toLowerCase()
  const isPri =
    c.includes('sil') ||
    c.includes('cp') ||
    c.includes('ce1') ||
    c.includes('ce2') ||
    c.includes('cm1') ||
    c.includes('cm2') ||
    c.includes('class') ||
    c.includes('nursery') ||
    c.includes('maternelle')

  if (isPri) {
    return { cycle: 'Enseignement Primaire / Maternelle', ministere: 'MINEDUB' }
  }

  const isJunior = isFirstCycleOrPrimary(classeNom)
  if (isJunior) {
    return { cycle: 'Premier Cycle du Secondaire', ministere: 'MINESEC' }
  }

  return { cycle: 'Second Cycle du Secondaire (Lycée / High School)', ministere: 'MINESEC' }
}

export default function SectionParentChildProfile({ userId, initialStudentId, onNav, onToast }: Props) {
  const tc = useT('common')
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '')

  const childrenCacheKey = userId ? `parent:children:${userId}` : ''
  const fetchChildren = useCallback(async () => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    return (res.data ?? []) as ChildWithStats[]
  }, [userId])

  const { data: childrenRaw, loading, refetch } = useCachedFetch<ChildWithStats[]>(childrenCacheKey, fetchChildren)
  const childrenList = childrenRaw ?? []

  useEffect(() => {
    if (!selectedStudentId && childrenList.length > 0) {
      setSelectedStudentId(childrenList[0].studentId)
    }
  }, [selectedStudentId, childrenList])

  const currentChild = childrenList.find(c => c.studentId === selectedStudentId) || childrenList[0]

  // Formulaire d'édition pour les enfants du 1er cycle / primaire
  const [phone, setPhone] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Synchronisation des champs quand l'enfant change
  useEffect(() => {
    if (currentChild) {
      setPhone(currentChild.phone || '')
      setDateOfBirth(currentChild.dateOfBirth ? currentChild.dateOfBirth.slice(0, 10) : '')
      setGender(currentChild.gender || '')
      setSaveError(null)
      setSaveSuccess(false)
    }
  }, [currentChild])

  const isJunior = isFirstCycleOrPrimary(currentChild?.classeNom)
  const sousSysteme = detectSousSysteme(currentChild?.classeNom)
  const cycleInfo = detectCycleLabel(currentChild?.classeNom)
  const hasOfficialExam = isExamClass(currentChild?.classeNom)
  const officialExamName = hasOfficialExam ? getExamLabel(currentChild?.classeNom) : null

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isJunior || !currentChild) return
    setSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    try {
      const payload: { phone?: string; dateOfBirth?: string; gender?: string } = {
        phone: phone.trim(),
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
      }

      const res = await fetchApi(`/api/v2/parent/children/${currentChild.studentId}/profile`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok || !d.success) throw new Error(d.message || tc('errors.generic_error'))

      setSaveSuccess(true)
      onToast('Dossier scolaire mis à jour avec succès', 'success')
      refetch()
      setTimeout(() => setSaveSuccess(false), 3500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : tc('errors.generic_error')
      setSaveError(msg)
      onToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleReportSecretary = () => {
    onToast(
      "Pour corriger l'orthographe officielle du Nom, Prénom ou Matricule, présentez une copie conforme de l'acte de naissance au secrétariat de l'école.",
      'info'
    )
  }

  if (loading && !childrenList.length) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-xs font-semibold text-[var(--text3)]">
        <RefreshCw size={18} className="animate-spin mr-2" />
        Chargement des dossiers scolaires…
      </div>
    )
  }

  if (!childrenList.length) {
    return (
      <div className="p-6 text-center text-xs text-[var(--text3)]">
        Aucun enfant rattaché à votre compte.
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4 sm:space-y-6 max-w-4xl mx-auto" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <div style={sTitle}>Dossier & Profil Scolaire de l&apos;Élève</div>
          <div style={sSub}>Consultez l&apos;intégralité des données officielles certifiées et gérez les coordonnées sous tutelle</div>
        </div>
      </div>

      {/* Sélecteur d'enfant (si le parent en a plusieurs) */}
      {childrenList.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {childrenList.map((child) => {
            const isSel = child.studentId === currentChild?.studentId
            return (
              <button
                key={child.studentId}
                onClick={() => setSelectedStudentId(child.studentId)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                  isSel ? 'shadow-sm text-white' : 'hover:bg-[var(--bg2)] text-[var(--text2)]'
                }`}
                style={{
                  background: isSel ? 'linear-gradient(135deg,var(--primary),var(--accent))' : 'var(--surface)',
                  borderColor: isSel ? 'transparent' : 'var(--border)',
                }}
              >
                <Users size={13} />
                <span>{child.prenom} {child.nom}</span>
                <span className="text-[10px] opacity-80">({child.classeNom || '—'})</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Bandeau de cycle et tutelle parentale */}
      {isJunior ? (
        <div className="p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 bg-[var(--blue-light)] border-[var(--blue)]/30 text-[var(--blue)]">
          <Shield size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-extrabold block mb-0.5">Tutelle parentale directe · Premier Cycle / Primaire</span>
            En tant que parent ou tuteur légal, vous êtes l&apos;administrateur officiel du dossier scolaire de <strong className="text-[var(--text)]">{currentChild?.prenom} {currentChild?.nom}</strong>. Vous pouvez consulter l&apos;ensemble de ses données officielles et rectifier ses coordonnées déclaratives (date de naissance, genre, contact d&apos;urgence).
          </div>
        </div>
      ) : (
        <div className="p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 bg-[var(--green-light)] border-[var(--green)]/30 text-[var(--green)]">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-extrabold block mb-0.5">Dossier élève autonome · Second Cycle</span>
            Votre enfant est scolarisé au second cycle. En conformité avec son autonomie scolaire, ses coordonnées directes sont maintenues à jour par l&apos;élève lui-même depuis son espace ou par le secrétariat. Vous consultez l&apos;intégralité de son dossier certifié en toute transparence.
          </div>
        </div>
      )}

      {/* ── 1. État civil certifié & Modification sous tutelle ── */}
      <div style={sCard}>
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div style={sIconBox}>
              <User size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={sCardTitle}>Données d&apos;état civil officielles certifiées</div>
              <div style={sCardSub}>Informations légales et registre scolaire de l&apos;élève</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-[var(--bg2)] text-[var(--text3)]">
            <Lock size={11} /> Certifié
          </span>
        </div>

        {/* Affichage des données certifiées en lecture seule */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          <div>
            <span style={sLabel}>Nom officiel de famille</span>
            <div style={sValueBox}>{currentChild?.nom || '—'}</div>
          </div>
          <div>
            <span style={sLabel}>Prénom(s) officiel(s)</span>
            <div style={sValueBox}>{currentChild?.prenom || '—'}</div>
          </div>
          <div>
            <span style={sLabel}>Matricule national scolaire</span>
            <div style={{ ...sValueBox, fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
              {currentChild?.matricule || 'En cours d\'attribution'}
            </div>
          </div>
        </div>

        {/* Formulaire d'édition sous tutelle pour le 1er cycle / primaire */}
        {isJunior ? (
          <form onSubmit={handleSaveProfile} className="mt-4 pt-4 border-t border-[var(--border)] space-y-3.5">
            <div className="text-xs font-black uppercase tracking-wider text-[var(--text3)] flex items-center gap-1.5">
              <Shield size={13} className="text-[var(--primary)]" />
              Données déclaratives administrables par le parent
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--text2)] block mb-1">
                  Date de naissance (officielle)
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border text-xs outline-none bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text2)] block mb-1">
                  Genre / Sexe
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border text-xs outline-none bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
                >
                  <option value="">Non renseigné</option>
                  <option value="M">Masculin (Garçon)</option>
                  <option value="F">Féminin (Fille)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--text2)] block mb-1">
                  Téléphone / Contact d&apos;urgence
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: 677000000"
                  className="w-full h-9 px-3 rounded-lg border text-xs outline-none bg-[var(--surface)] text-[var(--text)] border-[var(--border)]"
                />
              </div>
            </div>

            {saveError && (
              <div className="p-2.5 rounded-lg bg-[var(--red-light)] text-[var(--red)] text-xs flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-2.5 rounded-lg bg-[var(--green-light)] text-[var(--green)] text-xs flex items-center gap-2">
                <CheckCircle2 size={14} />
                <span>Dossier enregistré et synchronisé avec succès</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[var(--text3)] flex items-center gap-1.5">
                <Info size={12} /> Modifications directes prises en compte par la direction
              </span>
              <button
                type="submit"
                disabled={saving}
                className="h-8 px-4 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
              >
                {saving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        ) : (
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div>
              <span style={sLabel}>Date de naissance</span>
              <div style={sValueBox}>
                {currentChild?.dateOfBirth ? new Date(currentChild.dateOfBirth).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Non renseignée'}
              </div>
            </div>
            <div>
              <span style={sLabel}>Genre / Sexe</span>
              <div style={sValueBox}>
                {currentChild?.gender === 'M' || currentChild?.gender === 'MALE' ? 'Masculin' : currentChild?.gender === 'F' || currentChild?.gender === 'FEMALE' ? 'Féminin' : 'Non précisé'}
              </div>
            </div>
            <div>
              <span style={sLabel}>Contact de l&apos;élève</span>
              <div style={sValueBox}>{currentChild?.phone || 'Non renseigné'}</div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--text3)] flex items-center gap-1.5">
            <Info size={12} /> Une erreur sur l&apos;orthographe du nom ou prénom ?
          </span>
          <button
            type="button"
            onClick={handleReportSecretary}
            className="text-[11.5px] font-bold text-[var(--primary)] bg-transparent border-none cursor-pointer hover:underline"
          >
            Consignes de rectification au secrétariat
          </button>
        </div>
      </div>

      {/* ── 2. Scolarité, Cycle & Sous-système Camerounais ── */}
      <div style={sCard}>
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
          <div style={sIconBox}>
            <School size={18} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <div style={sCardTitle}>Inscription & Cursus Pédagogique</div>
            <div style={sCardSub}>Structure du cycle, sous-système linguistique et examens nationaux</div>
          </div>
        </div>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          <div>
            <span style={sLabel}>Classe inscrite</span>
            <div style={{ ...sValueBox, fontWeight: 700, color: 'var(--text)' }}>
              {currentChild?.classeNom || '—'}
            </div>
          </div>

          <div>
            <span style={sLabel}>Cycle d&apos;enseignement</span>
            <div style={sValueBox}>{cycleInfo.cycle}</div>
            <div className="text-[10px] text-[var(--text3)] mt-0.5 font-bold uppercase">{cycleInfo.ministere}</div>
          </div>

          <div>
            <span style={sLabel}>Sous-système linguistique</span>
            <div style={sValueBox}>
              {sousSysteme === 'ANGLOPHONE' ? 'Anglophone (General Education)' : 'Francophone (Enseignement Général)'}
            </div>
          </div>

          {hasOfficialExam && officialExamName && (
            <div className="p-3 rounded-xl border bg-[var(--amber-light)] border-[var(--amber)]/30 col-span-1 sm:col-span-2 lg:col-span-3">
              <div className="text-xs font-extrabold text-[var(--amber)] flex items-center gap-2">
                <Award size={16} />
                <span>Classe d&apos;examen d&apos;État officiel : {officialExamName}</span>
              </div>
              <div className="text-[11.5px] text-[var(--text2)] mt-0.5">
                Cet élève est inscrit dans une classe terminale de cycle préparant une certification nationale officielle du Cameroun ({officialExamName}).
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Raccourcis pédagogiques & algorithmiques ── */}
      <div style={sCard}>
        <div className="text-xs font-black uppercase tracking-wider text-[var(--text3)] mb-3 flex items-center gap-1.5">
          <Sparkles size={14} className="text-[var(--primary)]" />
          Évaluation & Suivi de cet enfant en 1 clic
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => onNav?.('health-tracking')}
            className="h-10 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-[var(--bg2)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }}
          >
            <HeartPulse size={14} className="text-[var(--green)]" />
            <span>Santé scolaire sur 100 & IA</span>
          </button>
          <button
            type="button"
            onClick={() => onNav?.('academic-profile')}
            className="h-10 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-[var(--bg2)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }}
          >
            <TrendingUp size={14} className="text-[var(--primary)]" />
            <span>Évolution & Moyennes</span>
          </button>
          <button
            type="button"
            onClick={() => onNav?.('grades')}
            className="h-10 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-[var(--bg2)]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border2)', color: 'var(--text)' }}
          >
            <FileText size={14} className="text-[var(--amber)]" />
            <span>Bulletins & Notes</span>
          </button>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const sCard: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }
const sCardTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 15, fontWeight: 700, color: 'var(--text)' }
const sCardSub: React.CSSProperties = { fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }
const sIconBox: React.CSSProperties = { width: 34, height: 34, borderRadius: 9, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const sLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }
const sValueBox: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: 'var(--text)', background: 'var(--bg2)', padding: '7px 11px', borderRadius: 8, minHeight: 34, display: 'flex', alignItems: 'center' }
