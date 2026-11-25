# ============================================================
# ZEKOULABIA — Démarrage ngrok pour tests mobile
# ============================================================
# Ce script :
#  1. Lance ngrok sur le port 3000 (frontend Next.js)
#  2. Récupère l'URL publique depuis l'API locale de ngrok
#  3. Met à jour CLIENT_URL dans backend/.env
#     (pour que les emails d'invitation contiennent le bon lien)
#  4. Affiche l'URL à ouvrir sur le téléphone
#
# Usage : .\start-ngrok.ps1
# ============================================================

$BackendEnvPath = "$PSScriptRoot\backend\.env"
$FrontendPort   = 3000

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ZEKOULABIA — Tunnel ngrok (port $FrontendPort)" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que ngrok est disponible
if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "❌  ngrok introuvable dans le PATH." -ForegroundColor Red
    exit 1
}

# Tuer tout processus ngrok existant
$existing = Get-Process ngrok -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "⚠️  Arrêt du tunnel ngrok existant..." -ForegroundColor Yellow
    $existing | Stop-Process -Force
    Start-Sleep -Seconds 1
}

# Démarrer ngrok en arrière-plan
Write-Host "🚀  Démarrage de ngrok sur le port $FrontendPort..." -ForegroundColor Green
Start-Process -FilePath "ngrok" -ArgumentList "http $FrontendPort" -WindowStyle Minimized

# Attendre que le tunnel soit prêt
Write-Host "⏳  Attente du tunnel..." -ForegroundColor Yellow
$ngrokUrl = $null
$attempts  = 0
$maxAttempts = 15

while (-not $ngrokUrl -and $attempts -lt $maxAttempts) {
    Start-Sleep -Seconds 2
    $attempts++
    try {
        $response  = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
        $tunnel    = $response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
        if (-not $tunnel) {
            $tunnel = $response.tunnels | Select-Object -First 1
        }
        if ($tunnel) {
            $ngrokUrl = $tunnel.public_url
            # Forcer HTTPS
            $ngrokUrl = $ngrokUrl -replace "^http:", "https:"
        }
    } catch {
        # API pas encore prête, on réessaie
    }
}

if (-not $ngrokUrl) {
    Write-Host "❌  Impossible d'obtenir l'URL ngrok après $maxAttempts tentatives." -ForegroundColor Red
    Write-Host "    Vérifiez que ngrok est bien configuré avec : ngrok config check" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅  Tunnel actif !" -ForegroundColor Green
Write-Host ""
Write-Host "  URL publique : $ngrokUrl" -ForegroundColor Magenta
Write-Host ""

# Mettre à jour CLIENT_URL dans backend/.env
if (Test-Path $BackendEnvPath) {
    $envContent = Get-Content $BackendEnvPath -Raw

    if ($envContent -match "CLIENT_URL=") {
        $envContent = $envContent -replace "CLIENT_URL=.*", "CLIENT_URL=$ngrokUrl"
    } else {
        $envContent += "`nCLIENT_URL=$ngrokUrl"
    }

    $envContent | Set-Content $BackendEnvPath -NoNewline
    Write-Host "✅  backend/.env mis à jour : CLIENT_URL=$ngrokUrl" -ForegroundColor Green
} else {
    Write-Host "⚠️  Fichier backend/.env introuvable : $BackendEnvPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  PROCHAINES ÉTAPES" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Redémarre le backend Express" -ForegroundColor White
Write-Host "     (pour qu'il prenne le nouveau CLIENT_URL)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Redémarre Next.js si besoin" -ForegroundColor White
Write-Host "     (les rewrites sont déjà en place)" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Ouvre sur ton téléphone :" -ForegroundColor White
Write-Host "     $ngrokUrl" -ForegroundColor Magenta
Write-Host ""
Write-Host "  4. Si ngrok affiche une page d'avertissement," -ForegroundColor White
Write-Host "     clique sur 'Visit Site' pour continuer." -ForegroundColor Gray
Write-Host ""
Write-Host "  Dashboard ngrok : http://localhost:4040" -ForegroundColor DarkGray
Write-Host ""
