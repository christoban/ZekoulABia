'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User,
  Shield,
  Smartphone,
  Calendar,
  Lock,
  Edit3,
  Save,
  CheckCircle2,
  AlertCircle,
  School,
  KeyRound,
  Info,
  RefreshCw,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { isFirstCycleOrPrimary } from '@/lib/academicExamDetector'
import ChangePasswordModal from '@/components/ChangePasswordModal'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface StudentFullProfile {
  id: string
  matricule?: string | null
  firstName: string
  lastName: string
  gender?: string | null
  dateOfBirth?: string | null
  phone?: string | null
  email?: string | null
  photoUrl?: string | null
  classeNom?: string | null
  classeLevel?: string | null
  filiere?: string | null
  serie?: string | null
  schoolName?: string | null
  parentName?: string | null
  parentPhone?: string | null
}

export default function SectionStudentProfile({ onToast }: Props) {
  const t = useT('student')
  const tc = useT('common')

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<StudentFullProfile | null>(null)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)

  // Champs éditables par l'élève du second cycle
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const [userRes, compRes] = await Promise.all([
        fetchApi('/api/v2/users/me', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
        fetchApi('/api/v2/students/me/profile-completeness', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      ])

      const u = userRes?.data
      const s = compRes?.data?.student
      const sp = u?.studentProfile

      if (u) {
        const full: StudentFullProfile = {
          id: u.id,
          matricule: sp?.matricule || s?.matricule || u.matricule || '—',
          firstName: u.firstName || s?.firstName || '',
          lastName: u.lastName || s?.lastName || '',
          gender: sp?.gender || s?.gender || u.gender || null,
          dateOfBirth: sp?.dateOfBirth || s?.dateOfBirth || u.dateOfBirth || null,
          phone: u.phone || s?.phone || '',
          email: u.email || s?.email || '',
          photoUrl: s?.photoUrl || u.avatarUrl || null,
          classeNom: sp?.class?.name || s?.className || '—',
          classeLevel: sp?.class?.level || null,
          filiere: sp?.class?.filiere || sp?.pebsFiliere || null,
          serie: sp?.class?.serie || null,
          schoolName: u.school?.name || null,
          parentName: s?.parents?.[0]?.name || null,
          parentPhone: s?.parents?.[0]?.phone || null,
        }
        setProfile(full)
        setPhone(full.phone || '')
      }
    } catch {
      onToast('Erreur lors du chargement des informations de votre profil', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const isJunior = isFirstCycleOrPrimary(profile?.classeNom, profile?.classeLevel)

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isJunior) return
    setSaving(true)
    setSaveSuccess(false)
    try {
      const res = await fetchApi('/api/v2/students/me/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || tc('errors.generic_error'))
      setSaveSuccess(true)
      onToast('Coordonnées mises à jour avec succès', 'success')
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      onToast(err instanceof Error ? err.message : tc('errors.generic_error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleReportSecretary = () => {
    onToast(
      "Pour corriger une information d'état civil officielle (Nom, Date de naissance, Matricule), présentez-vous au secrétariat avec votre acte de naissance.",
      'info'
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-xs text-[var(--text3)]">
        <RefreshCw size={18} className="animate-spin mr-2" />
        Chargement de votre dossier scolaire…
      </div>
    )
  }

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-4 sm:space-y-6 max-w-4xl mx-auto" style={{ overflowY: 'auto', height: '100%' }}>
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <div style={sTitle}>Mon Dossier & Profil Scolaire</div>
          <div style={sSub}>Consultez vos données d&apos;inscription et vos informations administratives officielles</div>
        </div>
        <button
          type="button"
          onClick={() => setPwdModalOpen(true)}
          className="h-9 px-3.5 rounded-lg border text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors self-start sm:self-auto"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <KeyRound size={14} style={{ color: 'var(--primary)' }} />
          Changer mon mot de passe
        </button>
      </div>

      {/* Bandeau de statut du cycle (1er cycle vs 2nd cycle) */}
      {isJunior ? (
        <div className="p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 bg-[var(--blue-light)] border-[var(--blue)]/30 text-[var(--blue)]">
          <Shield size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-extrabold block mb-0.5">Dossier sous tutelle parentale · Premier Cycle / Primaire</span>
            Les informations de contact et les coordonnées officielles de votre dossier scolaire sont administrées par vos parents/tuteurs légaux ainsi que par la direction de votre établissement. Vous pouvez consulter l&apos;ensemble de vos données en toute transparence.
          </div>
        </div>
      ) : (
        <div className="p-3.5 sm:p-4 rounded-xl border flex items-start gap-3 bg-[var(--green-light)] border-[var(--green)]/30 text-[var(--green)]">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-extrabold block mb-0.5">Dossier élève autonome · Second Cycle</span>
            En tant qu&apos;élève du second cycle, vous êtes habilité à maintenir à jour vos coordonnées personnelles directes. Les données d&apos;état civil certifiées restent quant à elles sécurisées par l&apos;établissement.
          </div>
        </div>
      )}

      {/* ── 1. État civil certifié ── */}
      <div style={sCard}>
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div style={sIconBox}>
              <User size={18} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <div style={sCardTitle}>Données d&apos;état civil certifiées</div>
              <div style={sCardSub}>Informations officielles enregistrées sur votre acte de naissance et dossier scolaire</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-[var(--bg2)] text-[var(--text3)]">
            <Lock size={11} /> Verrouillé
          </span>
        </div>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          <div>
            <span style={sLabel}>Nom de famille</span>
            <div style={sValueBox}>{profile?.lastName || '—'}</div>
          </div>
          <div>
            <span style={sLabel}>Prénom(s)</span>
            <div style={sValueBox}>{profile?.firstName || '—'}</div>
          </div>
          <div>
            <span style={sLabel}>Matricule scolaire officiel</span>
            <div style={{ ...sValueBox, fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>
              {profile?.matricule || '—'}
            </div>
          </div>
          <div>
            <span style={sLabel}>Date de naissance</span>
            <div style={sValueBox}>
              {profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </div>
          </div>
          <div>
            <span style={sLabel}>Genre / Sexe</span>
            <div style={sValueBox}>
              {profile?.gender === 'M' || profile?.gender === 'MALE' ? 'Masculin' : profile?.gender === 'F' || profile?.gender === 'FEMALE' ? 'Féminin' : 'Non précisé'}
            </div>
          </div>
          <div>
            <span style={sLabel}>Identifiant de connexion</span>
            <div style={{ ...sValueBox, fontSize: 11.5, color: 'var(--text2)' }}>
              {profile?.email || '—'}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[11px] text-[var(--text3)] flex items-center gap-1.5">
            <Info size={12} /> Une erreur sur votre nom ou date de naissance ?
          </span>
          <button
            type="button"
            onClick={handleReportSecretary}
            className="text-[11.5px] font-bold text-[var(--primary)] bg-transparent border-none cursor-pointer hover:underline"
          >
            Consignes de rectification
          </button>
        </div>
      </div>

      {/* ── 2. Scolarité & Classe ── */}
      <div style={sCard}>
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
          <div style={sIconBox}>
            <School size={18} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <div style={sCardTitle}>Inscription & Scolarité actuelle</div>
            <div style={sCardSub}>Établissement, classe et parcours pédagogique</div>
          </div>
        </div>

        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          <div>
            <span style={sLabel}>Classe actuelle</span>
            <div style={{ ...sValueBox, fontWeight: 700, color: 'var(--text)' }}>
              {profile?.classeNom || '—'}
            </div>
          </div>
          <div>
            <span style={sLabel}>Établissement fréquenté</span>
            <div style={sValueBox}>{profile?.schoolName || '—'}</div>
          </div>
          <div>
            <span style={sLabel}>Série / Filière</span>
            <div style={sValueBox}>{profile?.serie || profile?.filiere || 'Générale'}</div>
          </div>
          {profile?.parentName && (
            <div>
              <span style={sLabel}>Parent / Tuteur légal</span>
              <div style={sValueBox}>{profile.parentName}</div>
            </div>
          )}
          {profile?.parentPhone && (
            <div>
              <span style={sLabel}>Contact d&apos;urgence parent</span>
              <div style={sValueBox}>{profile.parentPhone}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Coordonnées directes (Édition pour 2nd cycle) ── */}
      <div style={sCard}>
        <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
          <div style={sIconBox}>
            <Smartphone size={18} style={{ color: 'var(--purple)' }} />
          </div>
          <div>
            <div style={sCardTitle}>Coordonnées de contact direct</div>
            <div style={sCardSub}>
              {isJunior
                ? 'Coordonnées gérées par votre tuteur légal'
                : 'Numéro de téléphone personnel pour alertes et communications'}
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveContact} className="pt-4 space-y-3.5">
          <div className="max-w-md">
            <label style={sLabel}>Numéro de téléphone direct</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isJunior}
              placeholder="Ex: 677000000"
              style={{
                ...sInput,
                background: isJunior ? 'var(--bg2)' : 'var(--surface)',
                cursor: isJunior ? 'not-allowed' : 'text',
              }}
            />
            {isJunior && (
              <span className="text-[10.5px] text-[var(--text3)] mt-1 block">
                Modifiable uniquement par votre parent depuis son espace ou par le secrétariat.
              </span>
            )}
          </div>

          {saveSuccess && (
            <div style={sAlertSuccess}>
              <CheckCircle2 size={15} />
              <span>Coordonnées mises à jour avec succès</span>
            </div>
          )}

          {!isJunior && (
            <div className="flex justify-start pt-1">
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-lg text-xs font-bold text-white flex items-center gap-2 cursor-pointer transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
              >
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? 'Enregistrement…' : 'Enregistrer mon numéro'}
              </button>
            </div>
          )}
        </form>
      </div>

      {pwdModalOpen && (
        <ChangePasswordModal
          onClose={() => setPwdModalOpen(false)}
          onToast={(msg, typ) => onToast(msg, typ === 'error' ? 'error' : typ === 'info' ? 'info' : 'success')}
        />
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const sCard: React.CSSProperties = { background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '16px 18px' }
const sCardTitle: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }
const sCardSub: React.CSSProperties = { fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }
const sIconBox: React.CSSProperties = { width: 34, height: 34, borderRadius: 8, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const sLabel: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }
const sValueBox: React.CSSProperties = { minHeight: 38, padding: '8px 12px', borderRadius: 8, fontSize: 12.5, background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--text)', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }
const sInput: React.CSSProperties = { width: '100%', height: 38, padding: '0 11px', borderRadius: 8, fontSize: 12.5, border: '1.5px solid var(--border)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
const sAlertSuccess: React.CSSProperties = { background: 'var(--green-light)', color: 'var(--green)', borderRadius: 8, padding: '7px 12px', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }
