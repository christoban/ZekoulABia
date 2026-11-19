'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, Upload, RefreshCw, Save, Download, Image as ImageIcon, FileText } from 'lucide-react'
import type { SchoolRow, Toast } from '../_types'
import {
  createAtelierSpecVersion,
  deleteAtelierAssignment,
  fetchAtelierPreviewPdfBlob,
  fetchAtelierState,
  saveAtelierAssignment,
  saveAtelierIdentityKit,
  uploadAtelierAsset,
  type AtelierIdentityKitDto,
  type AtelierStateDto,
} from '../_api/bulletinAtelier'
import AtelierSpecAndAssignmentsPanel from './atelier/AtelierSpecAndAssignmentsPanel'

interface Props {
  schools: SchoolRow[]
  initialSchoolId?: string | null
  onToast: (msg: string, type?: Toast['type']) => void
}

const ASSET_SLOTS: Array<{ key: 'logo' | 'coatOfArms' | 'stamp' | 'principalSignature' | 'censorSignature'; label: string; field: keyof AtelierIdentityKitDto }> = [
  { key: 'logo', label: 'Logo établissement', field: 'logoAssetKey' },
  { key: 'coatOfArms', label: 'Armoiries (optionnel)', field: 'coatOfArmsAssetKey' },
  { key: 'stamp', label: 'Cachet officiel PNG', field: 'stampAssetKey' },
  { key: 'principalSignature', label: 'Signature Proviseur PNG', field: 'principalSignatureAssetKey' },
  { key: 'censorSignature', label: 'Signature Censeur PNG', field: 'censorSignatureAssetKey' },
]

export default function SectionBulletinAtelier({ schools, initialSchoolId, onToast }: Props) {
  const [schoolId, setSchoolId] = useState(initialSchoolId || schools[0]?.id || '')
  const [state, setState] = useState<AtelierStateDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'identity' | 'spec' | 'assignments'>('identity')

  const [kitForm, setKitForm] = useState<Partial<AtelierIdentityKitDto>>({})
  const [useMeasured, setUseMeasured] = useState(false)
  const [selectedSpecId, setSelectedSpecId] = useState('GENERAL_GROUPED_V1')
  const [selectedSpecVersion, setSelectedSpecVersion] = useState(1)
  const [draftLanguage, setDraftLanguage] = useState<'fr' | 'en' | 'bilingual'>('bilingual')
  const [draftScheme, setDraftScheme] = useState('SCI_LIT_OTHER')
  const [draftPeriodMode, setDraftPeriodMode] = useState('AUTO')
  const [draftScale, setDraftScale] = useState('A+/A/ECA/NA')
  const [draftGroupRank, setDraftGroupRank] = useState(false)
  const [draftCouncilItems, setDraftCouncilItems] = useState<string[]>([])

  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [photoZoom, setPhotoZoom] = useState(100)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const pdfUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (initialSchoolId) setSchoolId(initialSchoolId)
  }, [initialSchoolId])

  useEffect(() => {
    if (!schoolId && schools[0]?.id) setSchoolId(schools[0].id)
  }, [schools, schoolId])

  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
    }
  }, [])

  const applySelectedSpecDefaults = useCallback((spec: AtelierStateDto['catalogSpecs'][number]) => {
    setSelectedSpecId(spec.id)
    setSelectedSpecVersion(spec.version)
    setDraftLanguage(spec.language)
    setDraftScheme(spec.defaultGroupingScheme ?? 'FLAT')
    setDraftGroupRank(Boolean(spec.showGroupRankInSubtotal))
    const hdr = spec.blocks.find((b) => b.type === 'officialHeader')
    const tbl = spec.blocks.find((b) => b.type === 'subjectTable')
    const ccl = spec.blocks.find((b) => b.type === 'councilDecision')
    setDraftPeriodMode(typeof hdr?.periodLabelMode === 'string' ? hdr.periodLabelMode : 'AUTO')
    setDraftScale(typeof tbl?.appreciationScale === 'string' ? tbl.appreciationScale : 'A+/A/ECA/NA')
    setDraftCouncilItems(Array.isArray(ccl?.items) ? (ccl.items as string[]) : [])
  }, [])

  const refreshPreview = useCallback(async (
    sid: string,
    specId: string,
    specVer: number,
    overrides?: Record<string, unknown>,
    kitOverrides?: Record<string, unknown>,
  ) => {
    if (!sid) return
    setPreviewLoading(true)
    try {
      const blob = await fetchAtelierPreviewPdfBlob(sid, {
        templateSpecId: specId,
        templateVersion: specVer,
        draftOverrides: overrides,
        kitOverrides,
      })
      const nextUrl = URL.createObjectURL(blob)
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current)
      pdfUrlRef.current = nextUrl
      setPdfUrl(nextUrl)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur aperçu PDF', 'error')
    } finally {
      setPreviewLoading(false)
    }
  }, [onToast])

  const loadSchoolState = useCallback(async (sid: string) => {
    if (!sid) return
    setLoading(true)
    try {
      const data = await fetchAtelierState(sid)
      setState(data)
      setUseMeasured(Boolean(data.schoolConfig.useMeasuredBulletinRenderer))
      setKitForm(data.identityKit ?? { useCoatOfArms: false })
      const activeAssign = data.assignments.find((a) => a.isActive)
      const initialSpec =
        (activeAssign ? data.catalogSpecs.find((s) => s.id === activeAssign.templateSpecId && s.version === activeAssign.templateVersion) : undefined) ??
        data.catalogSpecs[0]
      if (initialSpec) {
        applySelectedSpecDefaults(initialSpec)
        void refreshPreview(sid, initialSpec.id, initialSpec.version)
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Impossible de charger l’atelier', 'error')
    } finally {
      setLoading(false)
    }
  }, [applySelectedSpecDefaults, onToast, refreshPreview])

  useEffect(() => {
    if (schoolId) void loadSchoolState(schoolId)
  }, [schoolId, loadSchoolState])

  const currentOverrides = {
    language: draftLanguage,
    defaultGroupingScheme: draftScheme,
    periodLabelMode: draftPeriodMode,
    appreciationScale: draftScale,
    showGroupRankInSubtotal: draftGroupRank,
    councilItems: draftCouncilItems,
  }

  const handleSaveIdentity = async () => {
    if (!schoolId) return
    setBusy(true)
    try {
      const res = await saveAtelierIdentityKit(schoolId, {
        ...kitForm,
        useMeasuredBulletinRenderer: useMeasured,
      })
      setState((prev) => (prev ? { ...prev, identityKit: res.identityKit, schoolConfig: res.schoolConfig } : prev))
      onToast('Kit d’identité enregistré', 'success')
      void refreshPreview(schoolId, selectedSpecId, selectedSpecVersion, currentOverrides, kitForm as Record<string, unknown>)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur enregistrement kit', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleAssetFile = async (kind: 'logo' | 'coatOfArms' | 'stamp' | 'principalSignature' | 'censorSignature', file: File) => {
    if (!schoolId) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUri = typeof reader.result === 'string' ? reader.result : ''
      if (!dataUri) return
      setBusy(true)
      try {
        const res = await uploadAtelierAsset(schoolId, kind, dataUri)
        setState((prev) => (prev ? { ...prev, identityKit: res.identityKit } : prev))
        setKitForm(res.identityKit)
        onToast('Média validé et enregistré', 'success')
        void refreshPreview(schoolId, selectedSpecId, selectedSpecVersion, currentOverrides, res.identityKit as unknown as Record<string, unknown>)
      } catch (err) {
        onToast(err instanceof Error ? err.message : 'Média refusé', 'error')
      } finally {
        setBusy(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleCreateVersion = async (publish: boolean, name: string) => {
    if (!schoolId) return
    setBusy(true)
    try {
      const res = await createAtelierSpecVersion(schoolId, {
        baseSpecId: selectedSpecId,
        baseVersion: selectedSpecVersion,
        name: name || undefined,
        ...currentOverrides,
        publish,
      })
      setState((prev) => (prev ? { ...prev, catalogSpecs: res.catalogSpecs } : prev))
      applySelectedSpecDefaults(res.spec)
      onToast(publish ? `Version v${res.spec.version} publiée` : `Brouillon v${res.spec.version} enregistré`, 'success')
      void refreshPreview(schoolId, res.spec.id, res.spec.version)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur versionnage spec', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} /> Atelier Bulletins Officiels (Master)
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            Calibrage côté ZekoulABia par établissement — aperçu PDF généré exclusivement avec un élève fictif.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={selectTopStyle}>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!schoolId || previewLoading}
            onClick={() => refreshPreview(schoolId, selectedSpecId, selectedSpecVersion, currentOverrides, kitForm as Record<string, unknown>)}
            style={primTopBtn}
          >
            <RefreshCw size={13} /> {previewLoading ? 'Génération…' : 'Actualiser PDF'}
          </button>
        </div>
      </div>

      {loading && <div style={{ fontSize: 13, color: 'var(--text3)', padding: 20 }}>Chargement de l’atelier…</div>}

      {!loading && state && (
        <div className="grid grid-cols-1 lg:grid-cols-12" style={{ gap: 14, flex: 1, minHeight: 0 }}>
          {/* Colonne gauche : Photo témoin + Réglages */}
          <div className="lg:col-span-6" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={cardBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ImageIcon size={14} /> Photo témoin du bulletin papier (locale)
                </span>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Upload size={12} /> Charger image locale
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setPhotoPreviewUrl(URL.createObjectURL(f))
                    }}
                  />
                </label>
              </div>
              {photoPreviewUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text3)' }}>
                    <span>Zoom : {photoZoom}%</span>
                    <input type="range" min={50} max={200} value={photoZoom} onChange={(e) => setPhotoZoom(Number(e.target.value))} />
                  </div>
                  <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', padding: 6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreviewUrl} alt="Photo témoin" style={{ width: `${photoZoom}%`, maxWidth: 'none', borderRadius: 4 }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { id: 'identity', label: 'Identité & Médias' },
                { id: 'spec', label: 'Modèle & Versions' },
                { id: 'assignments', label: 'Affectations' },
              ] as const).map((tItem) => (
                <button
                  key={tItem.id}
                  type="button"
                  onClick={() => setTab(tItem.id)}
                  style={{
                    flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    border: '1px solid var(--border2)',
                    background: tab === tItem.id ? 'var(--primary)' : 'var(--surface)',
                    color: tab === tItem.id ? '#fff' : 'var(--text2)',
                  }}
                >
                  {tItem.label}
                </button>
              ))}
            </div>

            {tab === 'identity' ? (
              <div style={cardBox}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {([
                    ['Délégation Régionale FR', 'regionalDelegationFr'],
                    ['Regional Delegation EN', 'regionalDelegationEn'],
                    ['Délégation Dép. FR', 'departmentalDelegationFr'],
                    ['Departmental Del. EN', 'departmentalDelegationEn'],
                    ['Devise FR', 'mottoFr'],
                    ['Motto EN', 'mottoEn'],
                    ['Ville', 'city'],
                    ['Boîte postale (BP)', 'poBox'],
                    ['Téléphone', 'phone'],
                    ['N° Autorisation', 'authorizationNumber'],
                    ['Couleur accent (#hex)', 'accentColor'],
                  ] as const).map(([lbl, field]) => (
                    <div key={field}>
                      <span style={lblSm}>{lbl}</span>
                      <input
                        type="text"
                        disabled={!state.canEdit}
                        value={String(kitForm[field] ?? '')}
                        onChange={(e) => setKitForm((prev) => ({ ...prev, [field]: e.target.value }))}
                        style={inpSm}
                      />
                    </div>
                  ))}
                  <div>
                    <span style={lblSm}>Année création</span>
                    <input
                      type="number"
                      disabled={!state.canEdit}
                      value={kitForm.foundingYear ?? ''}
                      onChange={(e) => setKitForm((prev) => ({ ...prev, foundingYear: e.target.value ? Number(e.target.value) : null }))}
                      style={inpSm}
                    />
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={!state.canEdit}
                    checked={Boolean(kitForm.useCoatOfArms)}
                    onChange={(e) => setKitForm((prev) => ({ ...prev, useCoatOfArms: e.target.checked }))}
                  />
                  Afficher les armoiries officielles sur l&apos;en-tête
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {ASSET_SLOTS.map((slot) => {
                    const hasAsset = Boolean(state.identityKit?.[slot.field])
                    return (
                      <label key={slot.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 11, cursor: state.canEdit ? 'pointer' : 'not-allowed' }}>
                        <span>{slot.label} {hasAsset ? '✓' : ''}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg"
                          disabled={!state.canEdit || busy}
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) void handleAssetFile(slot.key, f)
                          }}
                        />
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Importer</span>
                      </label>
                    )
                  })}
                </div>

                {state.canEdit && (
                  <button type="button" disabled={busy} onClick={handleSaveIdentity} style={primTopBtn}>
                    <Save size={13} /> Enregistrer le Kit d&apos;identité
                  </button>
                )}
              </div>
            ) : (
              <AtelierSpecAndAssignmentsPanel
                tab={tab}
                canEdit={state.canEdit}
                busy={busy}
                catalogSpecs={state.catalogSpecs}
                selectedSpecId={selectedSpecId}
                selectedSpecVersion={selectedSpecVersion}
                schoolConfig={state.schoolConfig}
                draftLanguage={draftLanguage}
                draftScheme={draftScheme}
                draftPeriodMode={draftPeriodMode}
                draftScale={draftScale}
                draftGroupRank={draftGroupRank}
                draftCouncilItems={draftCouncilItems}
                useMeasured={useMeasured}
                assignments={state.assignments}
                classes={state.classes}
                knownLevels={state.knownClassLevels}
                onSelectSpec={(id, ver) => {
                  const found = state.catalogSpecs.find((s) => s.id === id && s.version === ver)
                  if (found) {
                    applySelectedSpecDefaults(found)
                    void refreshPreview(schoolId, found.id, found.version, undefined, kitForm as Record<string, unknown>)
                  }
                }}
                onChangeUseMeasured={setUseMeasured}
                onChangeSpecField={(patch) => {
                  if (patch.language !== undefined) setDraftLanguage(patch.language)
                  if (patch.scheme !== undefined) setDraftScheme(patch.scheme)
                  if (patch.periodMode !== undefined) setDraftPeriodMode(patch.periodMode)
                  if (patch.scale !== undefined) setDraftScale(patch.scale)
                  if (patch.groupRank !== undefined) setDraftGroupRank(patch.groupRank)
                  if (patch.councilItems !== undefined) setDraftCouncilItems(patch.councilItems)
                }}
                onSaveMeasuredConfig={handleSaveIdentity}
                onCreateSpecVersion={handleCreateVersion}
                onCreateAssignment={async (input) => {
                  setBusy(true)
                  try {
                    const res = await saveAtelierAssignment(schoolId, {
                      ...input,
                      templateSpecId: selectedSpecId,
                      templateVersion: selectedSpecVersion,
                    })
                    setState((prev) => (prev ? { ...prev, assignments: [res.assignment, ...prev.assignments] } : prev))
                    onToast('Affectation enregistrée', 'success')
                  } catch (err) {
                    onToast(err instanceof Error ? err.message : 'Erreur affectation', 'error')
                  } finally {
                    setBusy(false)
                  }
                }}
                onDeleteAssignment={async (id) => {
                  setBusy(true)
                  try {
                    await deleteAtelierAssignment(schoolId, id)
                    setState((prev) => (prev ? { ...prev, assignments: prev.assignments.filter((a) => a.id !== id) } : prev))
                    onToast('Affectation supprimée', 'info')
                  } catch (err) {
                    onToast(err instanceof Error ? err.message : 'Erreur suppression', 'error')
                  } finally {
                    setBusy(false)
                  }
                }}
              />
            )}
          </div>

          {/* Colonne droite : Aperçu PDF en direct sur élève fictif */}
          <div className="lg:col-span-6" style={{ ...cardBox, minHeight: 580, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Eye size={14} /> Aperçu PDF en direct — {selectedSpecId} v{selectedSpecVersion}
              </span>
              {pdfUrl && (
                <a href={pdfUrl} download={`apercu-${selectedSpecId}-v${selectedSpecVersion}.pdf`} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                  <Download size={12} /> Télécharger PDF
                </a>
              )}
            </div>
            {pdfUrl ? (
              <iframe src={pdfUrl} title="Aperçu PDF Atelier" style={{ width: '100%', flex: 1, minHeight: 540, border: '1px solid var(--border)', borderRadius: 8 }} />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12.5 }}>
                Cliquez sur « Actualiser PDF » pour générer l&apos;aperçu.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const cardBox: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }
const lblSm: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 2 }
const inpSm: React.CSSProperties = { width: '100%', padding: '5.5px 8px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box' }
const selectTopStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit' }
const primTopBtn: React.CSSProperties = { padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
