'use client'

import React, { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import {
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Clock,
  Save,
  Info,
  Smartphone,
} from 'lucide-react'

interface OnboardingSettingsData {
  schoolId: string
  selfServiceEnabled: boolean
  tokenExpiryDays: number
  capacityBufferPercent: number
  adminGereInscriptions: boolean
}

export default function SectionAdmissions({ schoolInfo }: { schoolInfo: any }) {
  const t = useT('admin')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const [formData, setFormData] = useState<OnboardingSettingsData>({
    schoolId: schoolInfo?.id || '',
    selfServiceEnabled: false,
    tokenExpiryDays: 14,
    capacityBufferPercent: 0,
    adminGereInscriptions: false,
  })

  useEffect(() => {
    let isMounted = true
    async function loadSettings() {
      setLoading(true)
      try {
        const res = await fetchApi('/api/v2/eleve-onboarding/settings', { credentials: 'include' })
        const data = await res.json()
        if (data.success && isMounted) {
          setFormData({
            schoolId: data.data.schoolId || schoolInfo?.id || '',
            selfServiceEnabled: !!data.data.selfServiceEnabled,
            tokenExpiryDays: data.data.tokenExpiryDays ?? 14,
            capacityBufferPercent: data.data.capacityBufferPercent ?? 0,
            adminGereInscriptions: !!data.data.adminGereInscriptions,
          })
        }
      } catch (err) {
        console.error('Erreur chargement paramètres admissions:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadSettings()
    return () => { isMounted = false }
  }, [schoolInfo])

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/eleve-onboarding/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t('settings.admissions.toast_saved') || 'Paramètres enregistrés avec succès', 'ok')
      } else {
        showToast(data.message || t('settings.admissions.toast_error') || 'Erreur lors de la sauvegarde', 'err')
      }
    } catch (err: any) {
      showToast(err.message || t('settings.admissions.toast_error') || 'Erreur réseau', 'err')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text3)' }}>
        <p className="text-xs md:text-sm font-semibold">Chargement des paramètres d'admission...</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 80 }}>
      {toast && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: toast.type === 'ok' ? 'var(--green-light, #eafaf1)' : 'var(--red-light, #fde8e8)',
            color: toast.type === 'ok' ? 'var(--green2, #27ae60)' : 'var(--red, #e74c3c)',
            border: `1px solid ${toast.type === 'ok' ? 'var(--green, #2ecc71)' : 'var(--red, #e74c3c)'}`,
          }}
        >
          {toast.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Titre & Description */}
      <div>
        <h2 className="text-base md:text-lg font-bold" style={{ color: 'var(--text)' }}>
          {t('settings.admissions.title') || 'Admissions & Inscriptions'}
        </h2>
        <p className="text-xs md:text-sm" style={{ color: 'var(--text3)', marginTop: 2 }}>
          {t('settings.admissions.subtitle') || 'Politiques de recrutement, dérogations de capacité et gouvernance des inscriptions'}
        </p>
      </div>

      {/* Section 1 : Politique d'admission & recrutement */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <GraduationCap size={18} style={{ color: 'var(--green)' }} />
          <span className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
            {t('settings.admissions.policy_section') || "Politique d'admission et recrutement"}
          </span>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Lien d'inscription pour les familles (sur invitation) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.self_service_label') || "Lien d'inscription pour les familles (sur invitation)"}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                {t('settings.admissions.self_service_desc') || "Permet de générer des liens sécurisés pour que les familles complètent leur dossier en ligne"}
              </p>
            </div>
            <div
              onClick={() => setFormData(d => ({ ...d, selfServiceEnabled: !d.selfServiceEnabled }))}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: formData.selfServiceEnabled ? 'var(--green)' : 'var(--border2)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: formData.selfServiceEnabled ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                }}
              />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Marge de capacité */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.capacity_buffer_label') || 'Marge de dépassement de capacité tolérée'}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                {t('settings.admissions.capacity_buffer_desc') || 'Pourcentage temporaire toléré au-dessus de la capacité maximale des classes (au-delà, dérogation obligatoire)'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min="0"
                max="50"
                step="1"
                value={formData.capacityBufferPercent}
                onChange={e => setFormData(d => ({ ...d, capacityBufferPercent: Math.max(0, parseInt(e.target.value) || 0) }))}
                style={{
                  width: 70,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1.5px solid var(--border2)',
                  background: 'var(--bg2)',
                  color: 'var(--text)',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              />
              <span className="text-xs md:text-sm font-bold" style={{ color: 'var(--text2)' }}>%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2 : Séparation des pouvoirs & Gouvernance */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Shield size={18} style={{ color: '#e67e22' }} />
          <span className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
            {t('settings.admissions.governance_section') || 'Gouvernance et séparation des pouvoirs'}
          </span>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Règle fixe non désactivable */}
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(230,126,34,0.08)',
              border: '1px solid rgba(230,126,34,0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Shield size={16} style={{ color: '#d35400', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
              <strong>Règle fixe de gouvernance (non désactivable) :</strong> Tout dossier de la <em>voie dossier (hors concours)</em> est obligatoirement validé par l'administrateur. Les admis au concours sont quant à eux inscrits sans validation supplémentaire une fois leurs résultats confirmés.
            </div>
          </div>

          {/* L'administrateur peut aussi inscrire lui-même */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.admin_direct_inscriptions_label') || "L'administrateur peut aussi inscrire directement des élèves"}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                {t('settings.admissions.admin_direct_inscriptions_desc') || "Permet à la direction de créer et valider immédiatement un dossier sans passer par le secrétariat"}
              </p>
            </div>
            <div
              onClick={() => setFormData(d => ({ ...d, adminGereInscriptions: !d.adminGereInscriptions }))}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: formData.adminGereInscriptions ? '#e67e22' : 'var(--border2)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  left: formData.adminGereInscriptions ? 22 : 2,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 : Délais & Règles d'accès numériques */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Clock size={18} style={{ color: 'var(--blue, #3498db)' }} />
          <span className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
            {t('settings.admissions.delays_section') || 'Délais et règles d’accès numériques'}
          </span>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Information CycleResolver */}
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
            }}
          >
            <Smartphone size={16} style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
              <strong>Attribution automatique des profils d'accès :</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                <li><strong>1er cycle :</strong> Le parent gère le profil. L'élève n'a pas de compte distinct.</li>
                <li><strong>2nd cycle avec smartphone :</strong> L'élève gère son propre profil.</li>
                <li><strong>Sans smartphone :</strong> Tout passe par le parent (notifications SMS si tél standard, ou fiches papier).</li>
              </ul>
            </div>
          </div>

          {/* Validité du lien d'inscription */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.token_expiry_label') || 'Validité du lien d’invitation (jours)'}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                Délai accordé aux familles pour compléter leur dossier en ligne avant expiration du lien
              </p>
            </div>
            <input
              type="number"
              min="1"
              max="90"
              value={formData.tokenExpiryDays}
              onChange={e => setFormData(d => ({ ...d, tokenExpiryDays: parseInt(e.target.value) || 14 }))}
              style={{
                width: 70,
                padding: '6px 10px',
                borderRadius: 8,
                border: '1.5px solid var(--border2)',
                background: 'var(--bg2)',
                color: 'var(--text)',
                fontWeight: 700,
                textAlign: 'center',
              }}
            />
          </div>
        </div>
      </div>

      {/* Action Enregistrer avec marge de sécurité */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 22px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            background: 'linear-gradient(135deg, var(--green), var(--green2))',
            color: 'white',
            border: 'none',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.7 : 1,
            boxShadow: '0 2px 6px rgba(46,204,113,0.3)',
          }}
        >
          <Save size={16} />
          <span>{saving ? 'Enregistrement...' : t('settings.admissions.btn_save') || 'Enregistrer les paramètres'}</span>
        </button>
      </div>
    </div>
  )
}
