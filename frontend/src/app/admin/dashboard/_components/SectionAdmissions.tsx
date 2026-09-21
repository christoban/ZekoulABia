'use client'

import React, { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import {
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Shield,
  Clock,
  Save,
  RotateCcw,
} from 'lucide-react'

interface OnboardingSettingsData {
  schoolId: string
  selfServiceEnabled: boolean
  defaultRecipient: 'ELEVE' | 'PARENT' | 'LES_DEUX'
  ageThresholdForParent: number
  tokenExpiryDays: number
  directAdmissionWithoutExam: boolean
  capacityBufferPercent: number
  adminGereInscriptions: boolean
  adminGereFinances: boolean
}

export default function SectionAdmissions({ schoolInfo }: { schoolInfo: any }) {
  const t = useT('admin')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const [formData, setFormData] = useState<OnboardingSettingsData>({
    schoolId: schoolInfo?.id || '',
    selfServiceEnabled: false,
    defaultRecipient: 'ELEVE',
    ageThresholdForParent: 15,
    tokenExpiryDays: 14,
    directAdmissionWithoutExam: false,
    capacityBufferPercent: 0,
    adminGereInscriptions: false,
    adminGereFinances: true,
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
            defaultRecipient: data.data.defaultRecipient || 'ELEVE',
            ageThresholdForParent: data.data.ageThresholdForParent ?? 15,
            tokenExpiryDays: data.data.tokenExpiryDays ?? 14,
            directAdmissionWithoutExam: !!data.data.directAdmissionWithoutExam,
            capacityBufferPercent: data.data.capacityBufferPercent ?? 0,
            adminGereInscriptions: !!data.data.adminGereInscriptions,
            adminGereFinances: data.data.adminGereFinances ?? true,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
          {/* Direct admission switch */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.direct_admission_label') || 'Admission directe sans concours'}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                {t('settings.admissions.direct_admission_desc') || "Permet l'inscription directe sans passage préalable par un concours d'entrée"}
              </p>
            </div>
            <div
              onClick={() => setFormData(d => ({ ...d, directAdmissionWithoutExam: !d.directAdmissionWithoutExam }))}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: formData.directAdmissionWithoutExam ? 'var(--green)' : 'var(--border2)',
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
                  left: formData.directAdmissionWithoutExam ? 22 : 2,
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

          {/* Self service switch */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.self_service_label') || 'Portail public d’auto-inscription'}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                {t('settings.admissions.self_service_desc') || 'Permet aux familles et candidats de soumettre leur dossier en ligne en autonomie'}
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

          {/* Capacity Buffer */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.capacity_buffer_label') || 'Marge de dépassement de capacité tolérée'}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                {t('settings.admissions.capacity_buffer_desc') || 'Pourcentage temporaire toléré au-dessus de la capacité maximale des classes'}
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
          {/* Validation obligatoire par l'admin */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.admin_inscriptions_label') || 'Validation obligatoire par l’Administrateur (Proviseur)'}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                {t('settings.admissions.admin_inscriptions_desc') || 'Les dossiers finalisés par le secrétariat restent en attente de l’approbation de la direction'}
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

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Gestion directe des finances par l'admin */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.admin_finances_label') || 'Gestion directe des finances par l’Administrateur'}
              </p>
              <p className="text-[11px] md:text-xs" style={{ color: 'var(--text3)' }}>
                {t('settings.admissions.admin_finances_desc') || 'Permet à la direction d’autoriser et percevoir directement les frais de scolarité'}
              </p>
            </div>
            <div
              onClick={() => setFormData(d => ({ ...d, adminGereFinances: !d.adminGereFinances }))}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: formData.adminGereFinances ? '#e67e22' : 'var(--border2)',
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
                  left: formData.adminGereFinances ? 22 : 2,
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

      {/* Section 3 : Délais & Destinataires */}
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
            {t('settings.admissions.delays_section') || 'Délais et destinataires des accès'}
          </span>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Destinataire par défaut */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.default_recipient_label') || 'Destinataire par défaut des accès'}
              </p>
            </div>
            <select
              value={formData.defaultRecipient}
              onChange={e => setFormData(d => ({ ...d, defaultRecipient: e.target.value as any }))}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1.5px solid var(--border2)',
                background: 'var(--bg2)',
                color: 'var(--text)',
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <option value="ELEVE">Élève uniquement</option>
              <option value="PARENT">Parent uniquement</option>
              <option value="LES_DEUX">Élève et Parent</option>
            </select>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Seuil d'âge pour accès Parent */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.age_threshold_label') || 'Seuil d’âge pour accès Parent obligatoire (années)'}
              </p>
            </div>
            <input
              type="number"
              min="5"
              max="25"
              value={formData.ageThresholdForParent}
              onChange={e => setFormData(d => ({ ...d, ageThresholdForParent: parseInt(e.target.value) || 15 }))}
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

          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* Validité du lien d'inscription */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="text-xs md:text-sm font-bold" style={{ color: 'var(--text)' }}>
                {t('settings.admissions.token_expiry_label') || 'Validité du lien d’inscription (jours)'}
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

      {/* Action Enregistrer */}
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
