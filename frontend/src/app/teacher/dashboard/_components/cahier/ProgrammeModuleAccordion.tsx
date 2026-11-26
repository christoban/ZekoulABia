'use client'

import { ChevronDown, ChevronRight, BookOpenCheck, Pencil } from 'lucide-react'
import type { ProgressionChapitreItem, ProgressionModuleItem, TranslateFn } from './types'

interface Props {
  module: ProgressionModuleItem
  lecons: ProgressionChapitreItem[]
  expanded: boolean
  canEdit: boolean
  busyChapitreId: string | null
  busyModuleOrdre: number | null
  onToggleExpand: () => void
  onToggleModuleActif: (moduleOrdre: number, actif: boolean) => void
  onToggleLecon: (chapitreId: string, fait: boolean) => void
  onLogLesson?: (chapitreId: string) => void
  t: TranslateFn
}

export default function ProgrammeModuleAccordion({
  module,
  lecons,
  expanded,
  canEdit,
  busyChapitreId,
  busyModuleOrdre,
  onToggleExpand,
  onToggleModuleActif,
  onToggleLecon,
  onLogLesson,
  t,
}: Props) {
  const isBusyModule = busyModuleOrdre === module.moduleOrdre
  const pct = module.progressionPct ?? 0

  return (
    <div
      style={{
        borderRadius: 11,
        border: `1px solid ${module.actif ? 'var(--border)' : 'var(--border2)'}`,
        background: module.actif ? 'var(--surface)' : 'var(--bg2)',
        opacity: module.actif ? 1 : 0.68,
        overflow: 'hidden',
        transition: 'opacity 0.15s',
      }}
    >
      {/* En-tête du module */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggleExpand}
          style={{
            flex: 1,
            minWidth: 200,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ color: 'var(--text3)', display: 'flex', flexShrink: 0 }}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: module.actif ? 'var(--bg2)' : 'var(--border)',
                  color: 'var(--text2)',
                }}
              >
                M{module.moduleOrdre}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                {module.moduleTitre}
              </span>
              {!module.actif && (
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '1px 7px',
                    borderRadius: 999,
                    background: 'var(--amber-light)',
                    color: 'var(--amber)',
                  }}
                >
                  {t('cahier_de_texte.prog_module_inactive')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
              <div
                style={{
                  flex: 1,
                  maxWidth: 180,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--bg2)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: module.actif ? 'var(--green)' : 'var(--text3)',
                    transition: 'width 0.25s',
                  }}
                />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>
                {module.leconsRealisees}/{module.leconsTotal} ({pct}%)
              </span>
            </div>
          </div>
        </button>

        {/* Bascule actif / inactif */}
        {canEdit && (
          <button
            type="button"
            disabled={isBusyModule}
            onClick={() => onToggleModuleActif(module.moduleOrdre, !module.actif)}
            aria-pressed={module.actif}
            style={{
              padding: '5px 10px',
              borderRadius: 7,
              fontSize: 11,
              fontWeight: 800,
              fontFamily: 'inherit',
              cursor: isBusyModule ? 'wait' : 'pointer',
              border: `1px solid ${module.actif ? 'var(--border)' : 'var(--sidebar)'}`,
              background: module.actif ? 'var(--bg)' : 'var(--sidebar)',
              color: module.actif ? 'var(--text2)' : 'white',
              flexShrink: 0,
            }}
          >
            {module.actif
              ? t('cahier_de_texte.prog_module_deactivate')
              : t('cahier_de_texte.prog_module_reactivate')}
          </button>
        )}
      </div>

      {/* Leçons du module */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            padding: '8px 12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {lecons.map((lecon) => {
            const isBusy = busyChapitreId === lecon.id
            const fromCahier =
              lecon.sourceRealisation === 'CAHIER' || lecon.sourceRealisation === 'LES_DEUX'

            return (
              <div
                key={lecon.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: lecon.realise ? 'var(--green-light)' : 'var(--bg)',
                  border: `1px solid ${lecon.realise ? 'var(--green-light)' : 'var(--border)'}`,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    flex: 1,
                    minWidth: 0,
                    cursor: canEdit && !isBusy ? 'pointer' : 'default',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={lecon.cocheDirecte || lecon.realise}
                    disabled={!canEdit || isBusy}
                    onChange={() => onToggleLecon(lecon.id, !lecon.cocheDirecte)}
                    aria-label={lecon.titre}
                    style={{
                      width: 17,
                      height: 17,
                      accentColor: 'var(--green)',
                      cursor: canEdit && !isBusy ? 'pointer' : 'not-allowed',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: lecon.realise ? 'var(--green)' : 'var(--text)',
                      textDecoration: lecon.realise ? 'none' : 'none',
                      wordBreak: 'break-word',
                    }}
                  >
                    {lecon.numeroAffiche ? (
                      <strong style={{ marginRight: 5 }}>{lecon.numeroAffiche}</strong>
                    ) : null}
                    {lecon.titre}
                  </span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                  {fromCahier && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: 'var(--blue-light)',
                        color: 'var(--blue)',
                      }}
                    >
                      <BookOpenCheck size={11} />
                      {t('cahier_de_texte.prog_validated_via_cahier')}
                    </span>
                  )}
                  {lecon.volumeHeuresPrevu !== null && lecon.volumeHeuresPrevu !== undefined && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)' }}>
                      {lecon.volumeHeuresPrevu}h
                    </span>
                  )}
                  {onLogLesson && module.actif && (
                    <button
                      type="button"
                      onClick={() => onLogLesson(lecon.id)}
                      title={t('cahier_de_texte.prog_log_session_title')}
                      style={{
                        padding: '3px 7px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text2)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10.5,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                      }}
                    >
                      <Pencil size={11} />
                      {t('cahier_de_texte.prog_log_session_btn')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
