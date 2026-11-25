# Script to create 2 pilot schools in MASTER DB

$ErrorActionPreference = "Stop"

Write-Host "🚀 Creating Pilot Schools..." -ForegroundColor Cyan

$adminEmail = "admin@edunexus.fr"
$adminPassword = "SecurePassword123!"

Write-Host "Authenticating as master admin..." -ForegroundColor Yellow
try {
        $loginBody = @{ email = $adminEmail; password = $adminPassword } | ConvertTo-Json
        $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
        $loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/master/auth/login" `
            -Method POST `
            -Headers @{"Content-Type" = "application/json"} `
            -Body $loginBody `
            -WebSession $session `
          -UseBasicParsing `
            -ErrorAction Stop
        Write-Host "✅ Master admin authenticated" -ForegroundColor Green
} catch {
        Write-Host "❌ Error authenticating master admin: $($_.Exception.Message)" -ForegroundColor Red
        throw
}

# School 1
$school1 = @{
    schoolName = "École Primaire Pilot 1"
    schoolMotto = "Apprendre, grandir, réussir"
    dbName = "edunexus_school_1"
    dbConnectionString = "mongodb://localhost:27017/edunexus_school_1"
    systemType = "francophone"
    structure = "simple"
    foundedYear = 2020
    location = "Paris, France"
    isPilot = $true
} | ConvertTo-Json

Write-Host "Creating School 1..." -ForegroundColor Yellow
try {
    $response1 = Invoke-RestMethod -Uri "http://localhost:5000/api/master/schools" `
      -Method POST `
      -Headers @{"Content-Type" = "application/json"} `
      -WebSession $session `
      -Body $school1 `
      -ErrorAction Stop
    
    Write-Host "✅ School 1 Created:" -ForegroundColor Green
    Write-Host ($response1 | ConvertTo-Json -Depth 3)
    $schoolId1 = $response1._id
    Write-Host "School 1 ID: $schoolId1" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error creating School 1: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# School 2
$school2 = @{
    schoolName = "École Secondaire Pilot 2"
    schoolMotto = "Excellence et discipline"
    dbName = "edunexus_school_2"
    dbConnectionString = "mongodb://localhost:27017/edunexus_school_2"
    systemType = "francophone"
    structure = "complex"
    foundedYear = 2018
    location = "Lyon, France"
    isPilot = $true
} | ConvertTo-Json

Write-Host "Creating School 2..." -ForegroundColor Yellow
try {
    $response2 = Invoke-RestMethod -Uri "http://localhost:5000/api/master/schools" `
      -Method POST `
      -Headers @{"Content-Type" = "application/json"} `
      -WebSession $session `
      -Body $school2 `
      -ErrorAction Stop
    
    Write-Host "✅ School 2 Created:" -ForegroundColor Green
    Write-Host ($response2 | ConvertTo-Json -Depth 3)
    $schoolId2 = $response2._id
    Write-Host "School 2 ID: $schoolId2" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error creating School 2: $($_.Exception.Message)" -ForegroundColor Red
}

# List all schools
Write-Host ""
Write-Host "Listing all schools..." -ForegroundColor Yellow
try {
    $schools = Invoke-RestMethod -Uri "http://localhost:5000/api/master/schools" `
      -Method GET `
      -Headers @{"Content-Type" = "application/json"}
  -WebSession $session
    
    Write-Host "✅ Total schools: $($schools.Count)" -ForegroundColor Green
    Write-Host ($schools | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "❌ Error listing schools: $($_.Exception.Message)" -ForegroundColor Red
}
