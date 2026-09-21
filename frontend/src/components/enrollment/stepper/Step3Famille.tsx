'use client'

import React from 'react'
import {
  Users,
  Phone,
  Mail,
  Home,
  Briefcase,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react'
import type { StepperFormState, ParentResponsable } from './types'

interface Props {
  form: StepperFormState
  onChange: (updates: Partial<StepperFormState>) => void
  errors: Record<string, string>
}

export default function Step3Famille({ form, onChange, errors }: Props) {
  const responsables = form.responsables.length > 0 ? form.responsables : [
    {
      nom: '',
      prenom: '',
      lien: 'PERE' as const,
      telephone: '',
      email: '',
      profession: '',
      adresse: '',
      estPrincipal: true,
      estFinancier: true,
      contactUrgence: false,
    },
  ]

  const updateResponsable = (index: number, fields: Partial<ParentResponsable>) => {
    const updated = [...responsables]
    updated[index] = { ...updated[index], ...fields }
    onChange({ responsables: updated })
  }

  const ajouterResponsable = () => {
    onChange({
      responsables: [
        ...responsables,
        {
          nom: '',
          prenom: '',
          lien: 'MERE' as const,
          telephone: '',
          email: '',
          profession: '',
          adresse: '',
          estPrincipal: false,
          estFinancier: false,
          contactUrgence: true,
        },
      ],
    })
  }

  const supprimerResponsable = (index: number) => {
    if (responsables.length <= 1) return
    const updated = responsables.filter((_, i) => i !== index)
    onChange({ responsables: updated })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Case à cocher : Aucun téléphone disponible */}
      <div
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: form.aucunTelephoneDisponible ? 'rgba(230,126,34,0.08)' : 'var(--bg2, #f9fafb)',
          border: form.aucunTelephoneDisponible ? '1px solid rgba(230,126,34,0.3)' : '1px solid var(--border, #e5e7eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.aucunTelephoneDisponible}
              onChange={(e) => onChange({ aucunTelephoneDisponible: e.target.checked })}
            />
            Aucun téléphone disponible dans la famille
          </label>
          <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)', marginTop: 2, marginLeft: 24 }}>
            Cochez cette case si les parents ne disposent d'aucun numéro. Le dossier ne sera pas bloqué et le suivi sera noté « à informer sur papier ».
          </div>
        </div>
      </div>

      {errors.responsables && (
        <div style={{ fontSize: 12, color: 'var(--red, #ef4444)', padding: 8, background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
          {errors.responsables}
        </div>
      )}

      {/* Blocs responsables */}
      {responsables.map((resp, index) => (
        <div
          key={index}
          style={{
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border, #e5e7eb)',
            background: 'var(--surface, #fff)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} style={{ color: 'var(--blue, #2563eb)' }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text, #111827)' }}>
                Responsable légal {index + 1}
              </span>
            </div>

            {responsables.length > 1 && (
              <button
                type="button"
                onClick={() => supprimerResponsable(index)}
                style={{ background: 'none', border: 'none', color: 'var(--red, #ef4444)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Trash2 size={13} /> Supprimer
              </button>
            )}
          </div>

          {/* Lien de parenté */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Lien de parenté <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
              </label>
              <select
                value={resp.lien}
                onChange={(e) => updateResponsable(index, { lien: e.target.value as any })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, background: 'var(--surface)' }}
              >
                <option value="PERE">Père</option>
                <option value="MERE">Mère</option>
                <option value="TUTEUR">Tuteur légal</option>
                <option value="AUTRE">Autre responsable</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Nom <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: TCHANA"
                value={resp.nom}
                onChange={(e) => updateResponsable(index, { nom: e.target.value.toUpperCase() })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Prénom <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Robert"
                value={resp.prenom}
                onChange={(e) => updateResponsable(index, { prenom: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
              />
            </div>
          </div>

          {/* Contact : Téléphone & Email */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Téléphone {!form.aucunTelephoneDisponible && <span style={{ color: 'var(--red, #ef4444)' }}>*</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text3)' }} />
                <input
                  type="tel"
                  placeholder={form.aucunTelephoneDisponible ? 'Aucun (optionnel)' : 'Ex: 699 00 00 00'}
                  value={resp.telephone}
                  onChange={(e) => updateResponsable(index, { telephone: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Email (facultatif)
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text3)' }} />
                <input
                  type="email"
                  placeholder="parent@example.com"
                  value={resp.email}
                  onChange={(e) => updateResponsable(index, { email: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
                />
              </div>
            </div>
          </div>

          {/* Profession & Adresse */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Profession (facultatif)
              </label>
              <input
                type="text"
                placeholder="Ex: Enseignant, Commerçant..."
                value={resp.profession}
                onChange={(e) => updateResponsable(index, { profession: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                Adresse / Quartier
              </label>
              <input
                type="text"
                placeholder="Ex: Quartier Administratif, Rue 12"
                value={resp.adresse}
                onChange={(e) => updateResponsable(index, { adresse: e.target.value })}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}
              />
            </div>
          </div>

          {/* Rôles et responsabilités */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resp.estPrincipal}
                onChange={(e) => updateResponsable(index, { estPrincipal: e.target.checked })}
              />
              Contact principal
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resp.estFinancier}
                onChange={(e) => updateResponsable(index, { estFinancier: e.target.checked })}
              />
              Responsable financier (frais de scolarité)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={resp.contactUrgence}
                onChange={(e) => updateResponsable(index, { contactUrgence: e.target.checked })}
              />
              Contact d'urgence
            </label>
          </div>
        </div>
      ))}

      {/* Bouton ajouter un responsable */}
      {responsables.length < 3 && (
        <button
          type="button"
          onClick={ajouterResponsable}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1.5px dashed var(--border, #e5e7eb)',
            background: 'transparent',
            color: 'var(--blue, #2563eb)',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Plus size={16} /> Ajouter un second responsable légal (Père / Mère / Tuteur)
        </button>
      )}
    </div>
  )
}
