'use client'

import { Sparkles, Eye, SlidersHorizontal } from 'lucide-react'
import { PHOTO_SECRETARY_TIP, type PhotoStudioMode } from './imageBackgroundProcessor'

interface Props {
  studioMode: PhotoStudioMode
  sensitivity: number
  showOriginal: boolean
  showSensitivity: boolean
  onSelectMode: (mode: PhotoStudioMode) => void
  onToggleShowOriginal: (show: boolean) => void
  onToggleSensitivity: () => void
  onChangeSensitivity: (val: number) => void
}

export default function StudioRetouchToolbar({
  studioMode,
  sensitivity,
  showOriginal,
  showSensitivity,
  onSelectMode,
  onToggleShowOriginal,
  onToggleSensitivity,
  onChangeSensitivity,
}: Props) {
  return (
    <div className="w-full max-w-sm mt-3 flex flex-col gap-2">
      {/* Sélecteur de mode */}
      <div className="flex items-center justify-between gap-1 p-1 rounded-xl border bg-slate-50 dark:bg-slate-900" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() => onSelectMode('WHITE_STUDIO')}
          className="flex-1 py-1 px-2 rounded-lg text-[11px] font-black border-0 cursor-pointer transition-all flex items-center justify-center gap-1"
          style={{
            background: studioMode === 'WHITE_STUDIO' && !showOriginal ? 'var(--surface)' : 'transparent',
            color: studioMode === 'WHITE_STUDIO' && !showOriginal ? 'var(--primary, #059669)' : 'var(--text3)',
            boxShadow: studioMode === 'WHITE_STUDIO' && !showOriginal ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Sparkles size={11} />
          <span>Fond Blanc</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectMode('OVAL_MEDALLION')}
          className="flex-1 py-1 px-2 rounded-lg text-[11px] font-black border-0 cursor-pointer transition-all flex items-center justify-center gap-1"
          style={{
            background: studioMode === 'OVAL_MEDALLION' && !showOriginal ? 'var(--surface)' : 'transparent',
            color: studioMode === 'OVAL_MEDALLION' && !showOriginal ? 'var(--primary, #059669)' : 'var(--text3)',
            boxShadow: studioMode === 'OVAL_MEDALLION' && !showOriginal ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <span>Médaillon</span>
        </button>
        <button
          type="button"
          onClick={() => onSelectMode('ORIGINAL')}
          className="flex-1 py-1 px-2 rounded-lg text-[11px] font-black border-0 cursor-pointer transition-all flex items-center justify-center gap-1"
          style={{
            background: studioMode === 'ORIGINAL' || showOriginal ? 'var(--surface)' : 'transparent',
            color: studioMode === 'ORIGINAL' || showOriginal ? 'var(--text)' : 'var(--text3)',
            boxShadow: studioMode === 'ORIGINAL' || showOriginal ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <span>Original</span>
        </button>
      </div>

      {/* Bouton Voir Original + Réglage tolérance */}
      <div className="flex items-center justify-between text-[11px] px-1 text-[var(--text3)]">
        <button
          type="button"
          onMouseDown={() => onToggleShowOriginal(true)}
          onMouseUp={() => onToggleShowOriginal(false)}
          onTouchStart={() => onToggleShowOriginal(true)}
          onTouchEnd={() => onToggleShowOriginal(false)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-black bg-transparent border-0 cursor-pointer select-none"
        >
          <Eye size={12} />
          <span>Maintenir pour voir l'original</span>
        </button>

        {studioMode === 'WHITE_STUDIO' && (
          <button
            type="button"
            onClick={onToggleSensitivity}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-transparent border-0 cursor-pointer"
          >
            <SlidersHorizontal size={11} />
            <span>Sensibilité</span>
          </button>
        )}
      </div>

      {/* Curseur de sensibilité (si activé) */}
      {showSensitivity && studioMode === 'WHITE_STUDIO' && (
        <div className="p-2 rounded-lg border bg-slate-50 dark:bg-slate-900 flex items-center gap-2 text-xs" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[10.5px] font-bold text-[var(--text3)]">Tolérance :</span>
          <input
            type="range"
            min="20"
            max="80"
            value={sensitivity}
            onChange={(e) => onChangeSensitivity(Number(e.target.value))}
            className="flex-1 cursor-pointer accent-emerald-600"
          />
          <span className="text-[10px] font-mono font-bold w-6 text-right">{sensitivity}</span>
        </div>
      )}

      {/* Consigne & Astuce Terrain Secrétaire */}
      <div className="p-2.5 rounded-xl border flex items-start gap-2 text-[11px] leading-relaxed" style={{ background: '#fefce8', borderColor: '#fef08a', color: '#854d0e' }}>
        <Sparkles size={14} className="shrink-0 text-amber-600 mt-0.5" />
        <span>
          <strong>Astuce tenue blanche :</strong> {PHOTO_SECRETARY_TIP}
        </span>
      </div>
    </div>
  )
}

