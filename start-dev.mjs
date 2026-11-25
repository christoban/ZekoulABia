/**
 * ZekoulABia — Lanceur de développement unifié
 *
 * Lance automatiquement :
 *  1. ngrok   → tunnel public sur le port 3000 (frontend)
 *  2. backend → Express avec CLIENT_URL = URL ngrok (pour les emails d'invitation)
 *  3. frontend → Next.js
 *
 * Usage : bun run dev:full   (ou node start-dev.mjs)
 *
 * Le CLIENT_URL est injecté via l'environnement du processus backend.
 * Aucun fichier .env n'est modifié.
 */

import { spawn, execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { setTimeout as sleep } from 'timers/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backendDir  = join(__dirname, 'backend')
const frontendDir = join(__dirname, 'frontend')

const RESET  = '\x1b[0m'
const CYAN   = '\x1b[36m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const MAGENTA= '\x1b[35m'
const RED    = '\x1b[31m'
const BOLD   = '\x1b[1m'

function log(color, emoji, msg) {
  console.log(`${color}${emoji}  ${msg}${RESET}`)
}

// ─── 1. Fermer tout ngrok existant ─────────────────────────────────────────
console.log()
log(CYAN, '🔄', 'Arrêt des tunnels ngrok existants...')
try { execSync('taskkill /F /IM ngrok.exe /T', { stdio: 'ignore' }) } catch { /* pas de ngrok actif */ }
await sleep(600)

// ─── 2. Démarrer ngrok ─────────────────────────────────────────────────────
log(CYAN, '🚀', 'Démarrage de ngrok (port 3000)...')
const ngrokProcess = spawn('ngrok', ['http', '3000'], {
  stdio: 'ignore',
  windowsHide: true,
  detached: false,
})

ngrokProcess.on('error', () => {
  log(RED, '❌', 'ngrok introuvable. Installe-le depuis https://ngrok.com/download')
  process.exit(1)
})

// ─── 3. Attendre que le tunnel soit prêt ───────────────────────────────────
log(YELLOW, '⏳', 'Attente du tunnel ngrok...')
let ngrokUrl = null

for (let i = 0; i < 20; i++) {
  await sleep(1000)
  try {
    const res = await fetch('http://localhost:4040/api/tunnels')
    if (!res.ok) continue
    const { tunnels } = await res.json()
    const tunnel = tunnels.find(t => t.proto === 'https') ?? tunnels[0]
    if (tunnel?.public_url) {
      ngrokUrl = tunnel.public_url.replace(/^http:\/\//, 'https://')
      break
    }
  } catch {
    /* API ngrok pas encore prête */
  }
}

if (!ngrokUrl) {
  log(RED, '❌', 'Impossible d\'obtenir l\'URL ngrok. Vérifie que ngrok est bien authentifié.')
  ngrokProcess.kill()
  process.exit(1)
}

// ─── 4. Afficher l'URL ─────────────────────────────────────────────────────
console.log()
console.log(`${BOLD}${GREEN}  ╔══════════════════════════════════════════╗${RESET}`)
console.log(`${BOLD}${GREEN}  ║       ZEKOULABIA — Tunnel actif !        ║${RESET}`)
console.log(`${BOLD}${GREEN}  ╚══════════════════════════════════════════╝${RESET}`)
console.log()
console.log(`  ${MAGENTA}${BOLD}📱 URL téléphone : ${ngrokUrl}${RESET}`)
console.log(`  ${CYAN}🖥  Dashboard ngrok : http://localhost:4040${RESET}`)
console.log()

// ─── 5. Démarrer le backend avec CLIENT_URL injecté ─────────────────────────
// On passe CLIENT_URL directement dans l'environnement du processus.
// Nodemon hérite de ces variables → pas besoin de modifier backend/.env.
log(GREEN, '🟢', `Backend → CLIENT_URL=${ngrokUrl}`)
const backend = spawn('bun', ['run', 'dev'], {
  cwd: backendDir,
  env: { ...process.env, CLIENT_URL: ngrokUrl },
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: true,
})

backend.on('error', e => log(RED, '❌', `Backend error: ${e.message}`))

// ─── 6. Démarrer le frontend (avec le hostname ngrok pour allowedDevOrigins) ─
const ngrokHostname = new URL(ngrokUrl).hostname
log(GREEN, '🟢', `Frontend → next dev (NGROK_HOSTNAME=${ngrokHostname})`)
const frontend = spawn('bun', ['run', 'dev'], {
  cwd: frontendDir,
  env: { ...process.env, NGROK_HOSTNAME: ngrokHostname },
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: true,
})

frontend.on('error', e => log(RED, '❌', `Frontend error: ${e.message}`))

// ─── 7. Nettoyage à l'arrêt (Ctrl+C) ──────────────────────────────────────
function shutdown() {
  console.log()
  log(YELLOW, '🛑', 'Arrêt de tous les processus...')
  try { ngrokProcess.kill('SIGTERM') } catch {}
  try { backend.kill('SIGTERM') }    catch {}
  try { frontend.kill('SIGTERM') }   catch {}
  // Sur Windows, tuer les processus enfants explicitement
  try { execSync('taskkill /F /IM ngrok.exe /T',    { stdio: 'ignore' }) } catch {}
  try { execSync('taskkill /F /IM bun.exe /T',      { stdio: 'ignore' }) } catch {}
  setTimeout(() => process.exit(0), 1000)
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)
