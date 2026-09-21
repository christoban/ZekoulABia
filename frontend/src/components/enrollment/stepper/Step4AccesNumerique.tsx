'use client'

import React from 'react'
import {
  Smartphone,
  Phone,
  Shield,
  Bell,
  Sliders,
  CheckCircle2,
} from 'lucide-react'
import {
  type StepperFormState,
  type DispositifType,
  calculerProfilAcces,
} from './types'

interface Props {
  form: StepperFormState
  onChange: (updates: Partial<StepperFormState>) => void
}

const CHOIX_DISPOSITIFS: Array<{ key: DispositifType; label: string; desc: string }> = [
  { key: 'AUCUN', label: 'Aucun téléphone', desc: 'Pas d’appareil disponible' },
  { key: 'SIMPLE', label: 'Téléphone simple', desc: 'Appels et SMS uniquement' },
  { key: 'SMARTPHONE_ANDROID', label: 'Smartphone Android', desc: 'Application ZekoulABia' },
  { key: 'IPHONE', label: 'iPhone (iOS)', desc: 'Application ZekoulABia' },
]

export default function Step4AccesNumerique({ form, onChange }: Props) {
  const profilAcces = calculerProfilAcces(
    form.level,
    form.dispositifEleve,
    form.dispositifParent,
    form.aucunTelephoneDisponible,
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Équipement de l'élève */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)', marginBottom: 8 }}>
          Équipement numérique de l'élève
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {CHOIX_DISPOSITIFS.map((d) => {
            const isSelected = form.dispositifEleve === d.key
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => onChange({ dispositifEleve: d.key })}
                style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: isSelected ? '2px solid var(--blue, #2563eb)' : '1px solid var(--border, #e5e7eb)',
                  background: isSelected ? 'rgba(37,99,235,0.06)' : 'var(--surface, #fff)',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--blue, #2563eb)' : 'var(--text, #111827)' }}>
                  {d.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)', marginTop: 2 }}>
                  {d.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Équipement du parent responsable */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)', marginBottom: 8 }}>
          Équipement numérique du parent responsable
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          {CHOIX_DISPOSITIFS.map((d) => {
            const isSelected = form.dispositifParent === d.key
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => onChange({ dispositifParent: d.key })}
                style={{
                  padding: '12px 10px',
                  borderRadius: 10,
                  border: isSelected ? '2px solid var(--green, #16a34a)' : '1px solid var(--border, #e5e7eb)',
                  background: isSelected ? 'rgba(22,163,74,0.06)' : 'var(--surface, #fff)',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--green, #16a34a)' : 'var(--text, #111827)' }}>
                  {d.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)', marginTop: 2 }}>
                  {d.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Carte résultat calculée par CycleResolver et ProfilAccesResolver */}
      <div
        style={{
          padding: 18,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(37,99,235,0.04), rgba(22,163,74,0.04))',
          border: '1.5px solid var(--border, #e5e7eb)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={18} style={{ color: 'var(--green, #16a34a)' }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text, #111827)' }}>
              Configuration d'accès déduite
            </span>
          </div>

          <button
            type="button"
            onClick={() => onChange({ profilAccesManuel: !form.profilAccesManuel })}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--border, #e5e7eb)',
              background: form.profilAccesManuel ? 'var(--blue, #2563eb)' : 'transparent',
              color: form.profilAccesManuel ? '#fff' : 'var(--text2, #4b5563)',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Sliders size={12} />
            {form.profilAccesManuel ? 'Mode manuel actif' : 'Modifier manuellement'}
          </button>
        </div>

        {/* Phrase claire explicative */}
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text2, #4b5563)', lineHeight: 1.5 }}>
          {profilAcces.phraseClaire}
        </p>

        {/* 3 Pictogrammes : Compte élève, Profil géré par, Canal notifications */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, paddingTop: 4 }}>
          {/* Compte élève */}
          <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
              <Smartphone size={13} />
              <span>Compte élève</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginTop: 4, textTransform: 'capitalize' }}>
              {profilAcces.compteEleve === 'complet' ? 'Accès complet' : profilAcces.compteEleve === 'lecture' ? 'Lecture seule' : 'Aucun compte'}
            </div>
          </div>

          {/* Profil géré par */}
          <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
              <Shield size={13} />
              <span>Profil géré par</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginTop: 4, textTransform: 'capitalize' }}>
              {profilAcces.profilGerePar}
            </div>
          </div>

          {/* Notifications */}
          <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #fff)', border: '1px solid var(--border, #e5e7eb)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
              <Bell size={13} />
              <span>Notifications</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginTop: 4, textTransform: 'capitalize' }}>
              {profilAcces.canalNotification === 'appli' ? 'Application' : profilAcces.canalNotification === 'sms' ? 'SMS directs' : 'Support papier'}
            </div>
          </div>
        </div>

        {/* Panneau de modification manuelle si activé */}
        {form.profilAccesManuel && (
          <div style={{ marginTop: 10, padding: 12, borderRadius: 8, background: 'var(--surface, #fff)', border: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>
              Ajustement personnalisé des accès :
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Compte élève</label>
                <select
                  value={form.compteEleveType}
                  onChange={(e) => onChange({ compteEleveType: e.target.value as any })}
                  style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
                >
                  <option value="AUCUN">Aucun compte</option>
                  <option value="READ_ONLY">Lecture seule</option>
                  <option value="FULL_ACCESS">Accès complet</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Canal de notification</label>
                <select
                  value={form.canalNotification}
                  onChange={(e) => onChange({ canalNotification: e.target.value as any })}
                  style={{ width: '100%', padding: 6, borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}
                >
                  <option value="APPLI_PARENT">Application Parent</option>
                  <option value="APPLI_ELEVE">Application Élève</option>
                  <option value="SMS">SMS uniquement</option>
                  <option value="PAPIER">Support papier</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
