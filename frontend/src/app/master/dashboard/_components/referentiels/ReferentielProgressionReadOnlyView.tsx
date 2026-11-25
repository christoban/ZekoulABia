'use client'

import { BookOpen, ExternalLink, Info, Layers } from 'lucide-react'
import type { OfficialProgressionChapterDto } from '../../_api'

interface Props {
  item: Record<string, unknown>
}

export function isImportedProgressionItem(item: Record<string, unknown> | null): boolean {
  if (!item) return false
  const source = typeof item.source === 'string' ? item.source.trim() : ''
  if (source.length > 0 && source !== 'manuel') return true
  if (typeof item.importChecksum === 'string' && item.importChecksum.length > 0) return true
  const chapitres = Array.isArray(item.chapitres)
    ? (item.chapitres as OfficialProgressionChapterDto[])
    : []
  return chapitres.some(
    (c) =>
      c.moduleOrdre !== undefined ||
      c.moduleTitre !== undefined ||
      c.leconNumero !== undefined ||
      c.numeroAffiche !== undefined ||
      c.sourceUrl !== undefined,
  )
}

interface ModuleGroup {
  key: string
  moduleOrdre: number | null
  moduleTitre: string
  lecons: OfficialProgressionChapterDto[]
}

function groupChaptersByModule(chapitres: OfficialProgressionChapterDto[]): ModuleGroup[] {
  const groups: ModuleGroup[] = []
  const byKey = new Map<string, ModuleGroup>()

  for (const ch of chapitres) {
    const modOrdre = ch.moduleOrdre !== null && ch.moduleOrdre !== undefined ? ch.moduleOrdre : null
    const modTitre = (ch.moduleTitre ?? '').trim()
    const key = `${modOrdre !== null ? modOrdre : '__FLAT__'}::${modTitre}`
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        moduleOrdre: modOrdre,
        moduleTitre:
          modTitre ||
          (modOrdre !== null ? `Module ${modOrdre}` : 'Leçons / Chapitres sans module'),
        lecons: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.lecons.push(ch)
  }

  return groups
}

/**
 * Vue en lecture seule des progressions importées (groupées par module),
 * afin d'éviter toute ambiguïté ou perte de métadonnées avec l'éditeur de chapitres plats.
 */
export default function ReferentielProgressionReadOnlyView({ item }: Props) {
  const templateCode = String(item.templateCode ?? '__ALL__')
  const level = String(item.level ?? '')
  const filiere = String(item.filiere ?? '')
  const subjectName = String(item.subjectName ?? '')
  const titre = String(item.titre ?? '')
  const source = typeof item.source === 'string' && item.source ? item.source : 'Import national'
  const manuallyEdited = item.manuallyEdited === true
  const chapitres = Array.isArray(item.chapitres)
    ? (item.chapitres as OfficialProgressionChapterDto[])
    : []

  const groups = groupChaptersByModule(chapitres)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
          fontSize: 12.5,
          color: 'var(--text2)',
        }}
      >
        <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <strong>Vue en lecture seule (programme structuré par modules).</strong>{' '}
          L&apos;éditeur de chapitres plats n&apos;est pas utilisé ici pour préserver la structure
          importée (modules, positions, liens sources). Pour mettre à jour ce programme, utilisez{' '}
          <strong>« Importer un fichier »</strong>.
        </div>
      </div>

      {/* Métadonnées */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Template</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>
            {templateCode}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Niveau / Filière</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {level} {filiere ? `· ${filiere}` : '· (toutes)'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Matière</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{subjectName}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>Source</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>
            {source} {manuallyEdited ? '(modifié)' : ''}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{titre}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
          {groups.length} module(s) · {chapitres.length} leçon(s)
        </div>
      </div>

      {/* Liste groupée par module */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.map((grp) => (
          <div
            key={grp.key}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'var(--surface)',
            }}
          >
            <div
              style={{
                padding: '9px 12px',
                background: 'var(--bg2)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 12.5, color: 'var(--text)' }}>
                <Layers size={14} color="var(--primary)" />
                <span>
                  {grp.moduleOrdre !== null ? `Module ${grp.moduleOrdre} — ` : ''}
                  {grp.moduleTitre}
                </span>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700 }}>
                {grp.lecons.length} leçon(s)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {grp.lecons.map((lecon, idx) => {
                const badgeNumero =
                  lecon.numeroAffiche ||
                  (lecon.leconNumero !== null && lecon.leconNumero !== undefined
                    ? `Leçon ${lecon.leconNumero}`
                    : 'Sans n°')
                return (
                  <div
                    key={`${grp.key}-${lecon.ordre}-${idx}`}
                    style={{
                      padding: '8px 12px',
                      borderBottom: idx < grp.lecons.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--text3)',
                          minWidth: 24,
                        }}
                      >
                        #{lecon.ordre}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 6,
                          background: 'var(--bg2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text2)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {badgeNumero}
                      </span>
                      <span style={{ color: 'var(--text)', fontWeight: 600, overflowWrap: 'anywhere' }}>
                        {lecon.titre}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {lecon.volumeHeuresPrevu !== null && lecon.volumeHeuresPrevu !== undefined && (
                        <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 700 }}>
                          {lecon.volumeHeuresPrevu}h
                        </span>
                      )}
                      {lecon.sourceUrl && (
                        <a
                          href={lecon.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ouvrir la leçon source"
                          style={{
                            color: 'var(--primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 11.5,
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          <BookOpen size={13} />
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

