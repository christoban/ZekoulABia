/**
 * Son joué à l'arrivée d'une notification in-app (Socket.io, app ouverte) — synthétisé via
 * Web Audio API plutôt qu'un fichier audio à charger/mettre en cache, pour rester léger et ne
 * dépendre d'aucun asset. Distinct du son des notifications Web Push (voir note dans
 * `frontend/worker/index.js` et ARCHITECTURE.md §8 ADR-10) : ce fichier ne concerne QUE le son
 * joué pendant que l'application est ouverte, jamais le push reçu app fermée/tél. verrouillé.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioCtx = new Ctor()
  }
  return audioCtx
}

/** Joue un court carillon à deux notes (do → mi aigu) avec enveloppe douce — pas de clic audible. */
export function playNotificationSound(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()

    const notes: { freq: number; start: number; duration: number }[] = [
      { freq: 880, start: 0, duration: 0.14 },
      { freq: 1318.5, start: 0.09, duration: 0.22 },
    ]

    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = note.freq
      osc.connect(gain)
      gain.connect(ctx.destination)

      const startAt = ctx.currentTime + note.start
      const endAt = startAt + note.duration
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(0.18, startAt + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.001, endAt)

      osc.start(startAt)
      osc.stop(endAt + 0.02)
    }
  } catch {
    // Le son est un agrément, jamais bloquant — une erreur ici ne doit jamais casser la cloche.
  }
}
