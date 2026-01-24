# Test Suite for Frontend & Firebase Integration (Non-Interactive)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VINTAGE SOLO SYSTEM CHECK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$frontendUrl = "http://localhost:3000"

Write-Host "1. Checking Frontend Availability..." -NoNewline
try {
    $req = Invoke-WebRequest -Uri $frontendUrl -TimeoutSec 3 -UseBasicParsing
    if ($req.StatusCode -eq 200) {
        Write-Host " ✅ UP" -ForegroundColor Green
    }
    else {
        Write-Host " ⚠️ STATUS $($req.StatusCode)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host " ❌ DOWN (Is npm start running?)" -ForegroundColor Red
}

Write-Host "2. Checking Network Environment (DNS)..." -NoNewline
try {
    $dns = Resolve-DnsName -Name "firebase.googleapis.com" -ErrorAction Stop
    if ($dns.IPAddress -contains "0.0.0.0" -or $dns.IPAddress -contains "127.0.0.1") {
        Write-Host " ⚠️ BLOCKED" -ForegroundColor Yellow
    }
    else {
        Write-Host " ✅ CLEAN" -ForegroundColor Green
    }
}
catch {
    Write-Host " ❓ UNKNOWN" -ForegroundColor Gray
}

Write-Host "3. Verifying Firebase Configuration..." -NoNewline
if (Test-Path "firebase.json") {
    Write-Host " ✅ FOUND" -ForegroundColor Green
}
else {
    Write-Host " ❌ MISSING" -ForegroundColor Red
}

Write-Host ""
Write-Host "NOTE: Legacy Python Backend is DISABLED and archived."
Write-Host "System Check Complete."
Exit 0
