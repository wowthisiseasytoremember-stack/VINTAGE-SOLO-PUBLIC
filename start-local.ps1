# PowerShell script for Windows local network deployment

$StatusFile = ".server_status"
Set-Content -Path $StatusFile -Value "Initializing..."

try {
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Vintage Ephemera - Local Network Setup" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan

    # Get local IP
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1).IPAddress

    Write-Host ""
    Set-Content -Path $StatusFile -Value "Starting Backend..."
    Write-Host "Starting backend server..." -ForegroundColor Yellow
    Set-Location backend
    Start-Process python -ArgumentList "start_server.py" -WindowStyle Normal
    Write-Host "Backend URL: http://$localIP:8000" -ForegroundColor Green

    Write-Host ""
    Set-Content -Path "..\$StatusFile" -Value "Checking Frontend..."
    Write-Host "Starting frontend server..." -ForegroundColor Yellow
    Set-Location ..\frontend

    # Build if needed
    if (-not (Test-Path "build")) {
        Set-Content -Path "..\$StatusFile" -Value "Building Frontend (This may take a few minutes)..."
        Write-Host "Building frontend..." -ForegroundColor Yellow
        npm install
        npm run build
    }

    Set-Location build
    Set-Content -Path "..\..\$StatusFile" -Value "Starting Frontend Server..."
    Start-Process python -ArgumentList "-m", "http.server", "3000" -WindowStyle Normal
    Write-Host "Frontend URL: http://$localIP:3000" -ForegroundColor Green

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Server is running!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "Access from your phone: http://$localIP:3000" -ForegroundColor White
    Write-Host ""
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host "==========================================" -ForegroundColor Cyan
    
    # Indicate Ready
    Set-Content -Path "..\..\$StatusFile" -Value "Ready"

    # Keep script running
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Set-Location "$PSScriptRoot"
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    Set-Content -Path $StatusFile -Value "Stopping..."
    # Clean up status file on exit
    if (Test-Path $StatusFile) {
        Remove-Item $StatusFile
    }
}
