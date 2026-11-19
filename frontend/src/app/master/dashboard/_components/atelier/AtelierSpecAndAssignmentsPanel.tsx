'use client'

import { useState } from 'react'
import { Layers, Plus, Trash2, CheckCircle2, FileCode2 } from 'lucide-react'
import type {
  AtelierAssignmentDto,
  AtelierCatalogSpecDto,
  AtelierSchoolConfigDto,
} from '../../_api/bulletinAtelier'

const COUNCIL_ITEM_OPTIONS = [
  { key: 'honorRoll', label: "Tableau d'honneur" },
  { key: 'encouragements', label: 'Encouragements' },
  { key: 'congratulations', label: 'Félicitations' },
  { key: 'workWarning', label: 'Avertissement travail' },
  { key: 'conductWarning', label: 'Avertissement conduite' },
  { key: 'blame', label: 'Blâme' },
  { key: 'disciplinaryCouncil', label: 'Conseil de discipline' },
  { key: 'exclusion', label: 'Exclusion' },
  { key: 'decision', label: 'Décision annuelle' },
  { key: 'observations', label: 'Observations' },
]

interface Props {
  tab: 'spec' | 'assignments'
  canEdit: boolean
  busy: boolean
  catalogSpecs: AtelierCatalogSpecDto[]
  selectedSpecId: string
  selectedSpecVersion: number
  schoolConfig: AtelierSchoolConfigDto
  draftLanguage: 'fr' | 'en' | 'bilingual'
  draftScheme: string
  draftPeriodMode: string
  draftScale: string
  draftGroupRank: boolean
  draftCouncilItems: string[]
  useMeasured: boolean
  assignments: AtelierAssignmentDto[]
  classes: Array<{ id: string; name: string; level: string | null }>
  knownLevels: string[]
  onSelectSpec: (id: string, version: number) => void
  onChangeUseMeasured: (v: boolean) => void
  onChangeSpecField: (patch: {
    language?: 'fr' | 'en' | 'bilingual'
    scheme?: string
    periodMode?: string
    scale?: string
    groupRank?: boolean
    councilItems?: string[]
  }) => void
  onSaveMeasuredConfig: () => Promise<void>
  onCreateSpecVersion: (publish: boolean, customName: string) => Promise<void>
  onCreateAssignment: (input: {
    classLevel: string | null
    classId: string | null
    periodKind: 'SEQUENCE' | 'TRIMESTER' | 'ANNUAL' | 'MONTHLY'
    groupingScheme: string | null
  }) => Promise<void>
  onDeleteAssignment: (id: string) => Promise<void>
}

export default function AtelierSpecAndAssignmentsPanel(props: Props) {
  const [versionName, setVersionName] = useState('')
  const [periodKind, setPeriodKind] = useState<'SEQUENCE' | 'TRIMESTER' | 'ANNUAL' | 'MONTHLY'>('TRIMESTER')
  const [assignLevel, setAssignLevel] = useState('')
  const [assignClassId, setAssignClassId] = useState('')
  const [assignScheme, setAssignScheme] = useState('')

  const selectedSpec = props.catalogSpecs.find(
    (s) => s.id === props.selectedSpecId && s.version === props.selectedSpecVersion,
  )

  if (props.tab === 'spec') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={cardStyle}>
          <div style={sectionTitle}><FileCode2 size={13} /> Modèle de départ (Familles A–F)</div>
          <select
            value={`${props.selectedSpecId}::${props.selectedSpecVersion}`}
            onChange={(e) => {
              const [id, ver] = e.target.value.split('::')
              if (id) props.onSelectSpec(id, Number(ver || 1))
            }}
            style={inputStyle}
          >
            {props.catalogSpecs.map((s) => (
              <option key={`${s.id}-${s.version}`} value={`${s.id}::${s.version}`}>
                [Famille {s.familyKey}] {s.name} — v{s.version} ({s.status === 'DRAFT' ? 'Brouillon' : 'Publié'})
              </option>
            ))}
          </select>
          {selectedSpec?.validationNotice && (
            <div style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', padding: '5px 8px', borderRadius: 6, fontWeight: 700 }}>
              {selectedSpec.validationNotice}
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={props.useMeasured}
              disabled={!props.canEdit || props.busy}
              onChange={(e) => props.onChangeUseMeasured(e.target.checked)}
            />
            Activer le moteur PDF mesuré officiel (`useMeasuredBulletinRenderer`)
          </label>
          {props.canEdit && (
            <button type="button" onClick={props.onSaveMeasuredConfig} disabled={props.busy} style={secBtnStyle}>
              Enregistrer l&apos;activation sur l&apos;école
            </button>
          )}
        </div>

        <div style={cardStyle}>
          <div style={sectionTitle}>Calibrage & Versionnage (Brouillon / Publié)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <span style={labelStyle}>Langue spec</span>
              <select
                value={props.draftLanguage}
                disabled={!props.canEdit}
                onChange={(e) => props.onChangeSpecField({ language: e.target.value as 'fr' | 'en' | 'bilingual' })}
                style={inputStyle}
              >
                <option value="fr">Français</option>
                <option value="en">Anglais</option>
                <option value="bilingual">Bilingue</option>
              </select>
            </div>
            <div>
              <span style={labelStyle}>Regroupement matières</span>
              <select
                value={props.draftScheme}
                disabled={!props.canEdit}
                onChange={(e) => props.onChangeSpecField({ scheme: e.target.value })}
                style={inputStyle}
              >
                <option value="FLAT">FLAT (à plat)</option>
                <option value="GROUP_1_2_3">GROUP_1_2_3 (1er/2e/3e groupe)</option>
                <option value="SCI_LIT_OTHER">SCI_LIT_OTHER (Scient./Litt./Autres)</option>
                <option value="TECH_GEN_PRO_DIV">TECH_GEN_PRO_DIV (Gén./Pro./Divers)</option>
              </select>
            </div>
            <div>
              <span style={labelStyle}>Mode titre période</span>
              <select
                value={props.draftPeriodMode}
                disabled={!props.canEdit}
                onChange={(e) => props.onChangeSpecField({ periodMode: e.target.value })}
                style={inputStyle}
              >
                <option value="AUTO">AUTO</option>
                <option value="EVALUATION">EVALUATION</option>
                <option value="SEQUENCE">SEQUENCE</option>
                <option value="TRIMESTER">TRIMESTER</option>
                <option value="TERM">TERM</option>
                <option value="MONTHLY">MONTHLY</option>
                <option value="ANNUAL">ANNUAL</option>
              </select>
            </div>
            <div>
              <span style={labelStyle}>Échelle appréciations</span>
              <select
                value={props.draftScale}
                disabled={!props.canEdit}
                onChange={(e) => props.onChangeSpecField({ scale: e.target.value })}
                style={inputStyle}
              >
                <option value="A+/A/ECA/NA">A+ / A / ECA / NA</option>
                <option value="APC_TEXT">APC Texte</option>
                <option value="FREE_TEXT">Texte libre</option>
              </select>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={props.draftGroupRank}
              disabled={!props.canEdit}
              onChange={(e) => props.onChangeSpecField({ groupRank: e.target.checked })}
            />
            Afficher le rang du groupe dans les sous-totaux (Famille B Technique)
          </label>

          <div>
            <span style={labelStyle}>Cases du Conseil de classe</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {COUNCIL_ITEM_OPTIONS.map((item) => {
                const checked = props.draftCouncilItems.includes(item.key)
                return (
                  <label key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--bg)', padding: '3px 7px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!props.canEdit}
                      onChange={() => {
                        const next = checked
                          ? props.draftCouncilItems.filter((k) => k !== item.key)
                          : [...props.draftCouncilItems, item.key]
                        props.onChangeSpecField({ councilItems: next })
                      }}
                    />
                    {item.label}
                  </label>
                )
              })}
            </div>
          </div>

          <input
            type="text"
            placeholder="Nom de la nouvelle version (optionnel)..."
            value={versionName}
            disabled={!props.canEdit}
            onChange={(e) => setVersionName(e.target.value)}
            style={inputStyle}
          />
          {props.canEdit && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onCreateSpecVersion(false, versionName)}
                style={{ ...secBtnStyle, flex: 1 }}
              >
                Enregistrer Brouillon (v+1)
              </button>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onCreateSpecVersion(true, versionName)}
                style={{ ...primBtnStyle, flex: 1 }}
              >
                <CheckCircle2 size={13} /> Publier Version (v+1)
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={cardStyle}>
        <div style={sectionTitle}><Layers size={13} /> Affecter la spec publiée à l&apos;école</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
          Spec sélectionnée : <strong>{props.selectedSpecId} v{props.selectedSpecVersion}</strong>
          {selectedSpec?.status === 'DRAFT' ? ' (publier cette version avant affectation)' : ''}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <span style={labelStyle}>Type de période</span>
            <select value={periodKind} onChange={(e) => setPeriodKind(e.target.value as typeof periodKind)} style={inputStyle}>
              <option value="TRIMESTER">TRIMESTER (Trimestriel)</option>
              <option value="SEQUENCE">SEQUENCE (Séquentiel)</option>
              <option value="ANNUAL">ANNUAL (Annuel)</option>
              <option value="MONTHLY">MONTHLY (Mensuel Primaire)</option>
            </select>
          </div>
          <div>
            <span style={labelStyle}>Niveau (optionnel)</span>
            <select value={assignLevel} onChange={(e) => setAssignLevel(e.target.value)} style={inputStyle}>
              <option value="">Toute l&apos;école (défaut)</option>
              {props.knownLevels.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Classe précise (optionnel)</span>
            <select value={assignClassId} onChange={(e) => setAssignClassId(e.target.value)} style={inputStyle}>
              <option value="">Toutes les classes du niveau</option>
              {props.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={labelStyle}>Schéma matières (optionnel)</span>
            <select value={assignScheme} onChange={(e) => setAssignScheme(e.target.value)} style={inputStyle}>
              <option value="">Défaut du modèle</option>
              <option value="GROUP_1_2_3">GROUP_1_2_3</option>
              <option value="SCI_LIT_OTHER">SCI_LIT_OTHER</option>
              <option value="TECH_GEN_PRO_DIV">TECH_GEN_PRO_DIV</option>
              <option value="FLAT">FLAT</option>
            </select>
          </div>
        </div>
        {props.canEdit && (
          <button
            type="button"
            disabled={props.busy || selectedSpec?.status === 'DRAFT'}
            onClick={() => props.onCreateAssignment({
              classLevel: assignLevel || null,
              classId: assignClassId || null,
              periodKind,
              groupingScheme: assignScheme || null,
            })}
            style={primBtnStyle}
          >
            <Plus size={13} /> Ajouter cette affectation
          </button>
        )}
      </div>

      <div style={cardStyle}>
        <div style={sectionTitle}>Affectations actives ({props.assignments.length})</div>
        {props.assignments.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune affectation enregistrée (repli sur SchoolConfig).</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {props.assignments.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: 11.5 }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {a.periodKind} · {a.templateSpecId} v{a.templateVersion}
                  </div>
                  <div style={{ color: 'var(--text3)', fontSize: 11 }}>
                    Niveau : {a.classLevel ?? 'Tous'} · Classe : {a.classId ?? 'Toutes'} · Regroupement : {a.groupingScheme ?? 'Spec'}
                  </div>
                </div>
                {props.canEdit && (
                  <button
                    type="button"
                    disabled={props.busy}
                    onClick={() => props.onDeleteAssignment(a.id)}
                    style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}
                    title="Supprimer l'affectation"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }
const sectionTitle: React.CSSProperties = { fontSize: 12.5, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 3 }
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 9px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }
const primBtnStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
const secBtnStyle: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
