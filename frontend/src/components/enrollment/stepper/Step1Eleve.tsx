'use client'

import React, { useState, useEffect } from 'react'
import {
  User,
  Users,
  Calendar,
  AlertCircle,
  Camera,
  CheckCircle2,
  Search,
} from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import type {
  StepperFormState,
  OrigineDossier,
  CandidatConcoursSuggestion,
} from './types'

interface Props {
  form: StepperFormState
  onChange: (updates: Partial<StepperFormState>) => void
  errors: Record<string, string>
  onDoublonDetecte: (doublons: Array<{ id: string; nomComplet: string; dateNaissance?: string }>) => void
}

const ORIGINES: Array<{ key: OrigineDossier; label: string; desc: string }> = [
  { key: 'HORS_CONCOURS', label: 'Hors concours', desc: 'Inscription ponctuelle directe' },
  { key: 'CONCOURS', label: 'Admis au concours', desc: 'Candidat confirmé d’une session' },
  { key: 'TRANSFERT', label: 'Transfert', desc: 'Élève venant d’un autre établissement' },
  { key: 'AUTRE', label: 'Autre', desc: 'Cas particulier ou dérogation' },
]

export default function Step1Eleve({
  form,
  onChange,
  errors,
  onDoublonDetecte,
}: Props) {
  const [candidatsRecherche, setCandidatsRecherche] = useState('')
  const [candidatsTrouves, setCandidatsTrouves] = useState<CandidatConcoursSuggestion[]>([])
  const [searchingCandidat, setSearchingCandidat] = useState(false)

  // Détection de doublons en direct
  useEffect(() => {
    if (!form.nom.trim() || !form.dateNaissance) return
    const timer = setTimeout(async () => {
      try {
        const res = await fetchApi(
          `/api/v2/users?role=STUDENT&search=${encodeURIComponent(form.nom.trim())}&limit=5`,
          { credentials: 'include' },
        )
        const data = await res.json()
        const users = Array.isArray(data.data) ? data.data : (Array.isArray(data.users) ? data.users : [])
        const match = users.map((u: any) => ({
          id: u.id,
          nomComplet: `${u.lastName || ''} ${u.firstName || ''}`.trim() || u.nomProvisoire || 'Élève',
          dateNaissance: u.dateNaissance,
        }))
        onDoublonDetecte(match)
      } catch {
        // silencieux
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form.nom, form.dateNaissance, onDoublonDetecte])

  // Recherche des admis au concours
  useEffect(() => {
    if (form.origine !== 'CONCOURS' || candidatsRecherche.trim().length < 2) {
      setCandidatsTrouves([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingCandidat(true)
      try {
        const res = await fetchApi(
          `/api/v2/entrance-exams/candidates?search=${encodeURIComponent(candidatsRecherche.trim())}&status=CONFIRMED&limit=5`,
          { credentials: 'include' },
        )
        const data = await res.json()
        if (data.success && Array.isArray(data.data)) {
          setCandidatsTrouves(data.data)
        }
      } catch {
        // silencieux
      } finally {
        setSearchingCandidat(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [form.origine, candidatsRecherche])

  const selectCandidat = (c: CandidatConcoursSuggestion) => {
    onChange({
      candidatConcoursId: c.id,
      nom: c.nom,
      prenom: c.prenom,
      sexe: c.gender || '',
      dateNaissance: c.dateNaissance || '',
      level: c.level || form.level,
      classId: c.classeId || form.classId,
    })
    setCandidatsTrouves([])
    setCandidatsRecherche(`${c.nom} ${c.prenom} (${c.codeCandidat})`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Origine du dossier (choix segmenté sans aucun code AUTOSERVICE) */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text, #111827)', marginBottom: 8 }}>
          Origine du dossier <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {ORIGINES.map((o) => {
            const isSelected = form.origine === o.key
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => onChange({ origine: o.key })}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: isSelected ? '2px solid var(--green, #16a34a)' : '1px solid var(--border, #e5e7eb)',
                  background: isSelected ? 'rgba(22,163,74,0.06)' : 'var(--surface, #fff)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? 'var(--green, #16a34a)' : 'var(--text, #111827)' }}>
                  {o.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)', marginTop: 2 }}>
                  {o.desc}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sélecteur de candidat admis si Origine = CONCOURS */}
      {form.origine === 'CONCOURS' && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: 'rgba(22,163,74,0.05)',
            border: '1px solid rgba(22,163,74,0.2)',
          }}
        >
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--green, #16a34a)', marginBottom: 6 }}>
            Rechercher le candidat admis (Nom ou Code candidat) :
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text3)' }} />
            <input
              type="text"
              placeholder="Ex: Mbarga, 2026-6E-042..."
              value={candidatsRecherche}
              onChange={(e) => setCandidatsRecherche(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13,
              }}
            />
          </div>

          {candidatsTrouves.length > 0 && (
            <div style={{ marginTop: 8, background: 'var(--surface, #fff)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {candidatsTrouves.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectCandidat(c)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{c.nom} {c.prenom}</span>
                  <span style={{ color: 'var(--blue)' }}>{c.codeCandidat}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Nom et Prénoms */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Nom de famille <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: TCHANA"
            value={form.nom}
            onChange={(e) => onChange({ nom: e.target.value.toUpperCase() })}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: errors.nom ? '1.5px solid var(--red, #ef4444)' : '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
            }}
          />
          {errors.nom && <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 3 }}>{errors.nom}</div>}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Prénom(s) <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
          </label>
          <input
            type="text"
            placeholder="Ex: Jean-Baptiste"
            value={form.prenom}
            onChange={(e) => onChange({ prenom: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: errors.prenom ? '1.5px solid var(--red, #ef4444)' : '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
            }}
          />
          {errors.prenom && <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 3 }}>{errors.prenom}</div>}
        </div>
      </div>

      {/* 3. Sexe & Date de naissance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Sexe <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => onChange({ sexe: 'M' })}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: form.sexe === 'M' ? '2px solid var(--blue, #2563eb)' : '1px solid var(--border)',
                background: form.sexe === 'M' ? 'rgba(37,99,235,0.08)' : 'var(--surface)',
                color: form.sexe === 'M' ? 'var(--blue)' : 'var(--text)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Masculin (M)
            </button>
            <button
              type="button"
              onClick={() => onChange({ sexe: 'F' })}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                border: form.sexe === 'F' ? '2px solid #db2777' : '1px solid var(--border)',
                background: form.sexe === 'F' ? 'rgba(219,39,119,0.08)' : 'var(--surface)',
                color: form.sexe === 'F' ? '#db2777' : 'var(--text)',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Féminin (F)
            </button>
          </div>
          {errors.sexe && <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 3 }}>{errors.sexe}</div>}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Date de naissance <span style={{ color: 'var(--red, #ef4444)' }}>*</span>
          </label>
          <input
            type="date"
            value={form.dateNaissance}
            onChange={(e) => onChange({ dateNaissance: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: errors.dateNaissance ? '1.5px solid var(--red, #ef4444)' : '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
            }}
          />
          {errors.dateNaissance && <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 3 }}>{errors.dateNaissance}</div>}
        </div>
      </div>

      {/* 4. Lieu de naissance & Nationalité */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Lieu de naissance
          </label>
          <input
            type="text"
            placeholder="Ex: Yaoundé"
            value={form.lieuNaissance}
            onChange={(e) => onChange({ lieuNaissance: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Nationalité
          </label>
          <input
            type="text"
            placeholder="Camerounaise"
            value={form.nationalite}
            onChange={(e) => onChange({ nationalite: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
            }}
          />
        </div>
      </div>

      {/* 5. Sous-système & Matricule national */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Sous-système
          </label>
          <select
            value={form.sousSysteme}
            onChange={(e) => onChange({ sousSysteme: e.target.value as any })}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
              background: 'var(--surface)',
            }}
          >
            <option value="FRANCOPHONE">Francophone (MINESEC)</option>
            <option value="ANGLOPHONE">Anglophone (General Education)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            Matricule national (facultatif)
          </label>
          <input
            type="text"
            placeholder="Ex: 2026-MINESEC-XXXX"
            value={form.matriculeNational || ''}
            onChange={(e) => onChange({ matriculeNational: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #e5e7eb)',
              fontSize: 13,
            }}
          />
        </div>
      </div>
    </div>
  )
}
