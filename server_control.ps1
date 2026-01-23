function Get-PortProcess {
    param([int]$Port)
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connection) {
            return $connection.OwningProcess
        }
    }
    catch {
        return $null
    }
    return $null
}

function Show-Header {
    Clear-Host
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "   Vintage Ephemera - Control Panel" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Get-LocalIP {
    try {
        # Prioritize Wi-Fi and Ethernet interfaces
        $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
                ($_.InterfaceAlias -match "Wi-Fi|Ethernet|WLAN" -and $_.InterfaceAlias -notmatch "vEthernet|Virtual") -and 
                $_.IPAddress -notlike "169.254.*" 
            } | Select-Object -First 1).IPAddress

        # Fallback if no specific interface found
        if (-not $ip) {
            $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
                    $_.InterfaceAlias -notlike "*Loopback*" -and 
                    $_.IPAddress -notlike "169.254.*" 
                } | Select-Object -First 1).IPAddress
        }
        return $ip
    }
    catch {
        return "Unknown"
    }
}

function Open-Browser {
    Write-Host "Opening dashboard in default browser..." -ForegroundColor Cyan
    Start-Process "explorer.exe" "http://localhost:3000"
}

function Show-Status {
    $backendPid = Get-PortProcess -Port 8000
    $frontendPid = Get-PortProcess -Port 3000
    $localIP = Get-LocalIP
    
    # Read Status File
    $statusMsg = "Stopped"
    $statusColor = "Red"
    if (Test-Path ".server_status") {
        $statusMsg = Get-Content ".server_status" -Raw
        $statusMsg = $statusMsg.Trim()
    }

    # Intelligent Override: If file says stopped (or missing) but processes exist
    if ($statusMsg -eq "Stopped") {
        if ($backendPid -and $frontendPid) {
            $statusMsg = "Ready" 
            $statusColor = "Green"
        }
        elseif ($backendPid -or $frontendPid) {
            $statusMsg = "Partial"
            $statusColor = "Yellow"
        }
    }
    else {
        # Normal status file handling
        if ($statusMsg -eq "Ready") {
            $statusColor = "Green"
        }
        elseif ($statusMsg -match "Building|Starting|Initializing") {
            $statusColor = "Yellow"
        }
    }

    Write-Host "Overall Status: " -NoNewline
    Write-Host "$statusMsg" -ForegroundColor $statusColor
    Write-Host "--------------------" -ForegroundColor Gray
    
    if ($backendPid) {
        Write-Host "  [BACKEND]  Running (PID: $backendPid)" -ForegroundColor Green -NoNewline
        Write-Host " -> http://localhost:8000" -ForegroundColor Gray
    }
    else {
        Write-Host "  [BACKEND]  Stopped" -ForegroundColor Red
    }

    if ($frontendPid) {
        Write-Host "  [FRONTEND] Running (PID: $frontendPid)" -ForegroundColor Green -NoNewline
        Write-Host " -> http://localhost:3000" -ForegroundColor Gray
        
        Write-Host ""
        Write-Host "Access Links:" -ForegroundColor Yellow
        Write-Host "  PC Link:      " -NoNewline
        Write-Host "http://localhost:3000" -ForegroundColor Cyan
        Write-Host "  Android Link: " -NoNewline
        Write-Host "http://$($localIP):3000" -ForegroundColor Cyan
        Write-Host "  (Type the Android link into your phone's browser)" -ForegroundColor DarkGray
    }
    else {
        Write-Host "  [FRONTEND] Stopped" -ForegroundColor Red
    }
    
    if ($statusMsg -match "Building") {
        Write-Host ""
        Write-Host "NOTE: The app is currently compiling. Please wait for status to become 'Ready' before accessing via phone." -ForegroundColor Yellow
    }
    Write-Host ""
}

function Stop-Servers {
    Write-Host "Stopping servers..." -ForegroundColor Yellow
    
    $backendPid = Get-PortProcess -Port 8000
    if ($backendPid) {
        Stop-Process -Id $backendPid -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped Backend (PID: $backendPid)" -ForegroundColor Gray
    }

    $frontendPid = Get-PortProcess -Port 3000
    if ($frontendPid) {
        Stop-Process -Id $frontendPid -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped Frontend (PID: $frontendPid)" -ForegroundColor Gray
    }
    
    if (Test-Path ".server_status") {
        Remove-Item ".server_status"
    }

    Start-Sleep -Seconds 1
    Write-Host "Servers stopped." -ForegroundColor Green
    Start-Sleep -Seconds 1
}

function Start-Servers {
    Write-Host "Starting servers..." -ForegroundColor Yellow
    # Launch start-local.ps1 in a new window
    Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy Bypass", "-File .\start-local.ps1"
    Write-Host "Launch command sent." -ForegroundColor Green
    Start-Sleep -Seconds 2
}



function Show-QR {
    $localIP = Get-LocalIP
    if ($localIP -eq "Unknown") {
        Write-Host "Could not determine Local IP." -ForegroundColor Red
        return
    }
    $url = "http://$($localIP):3000"
    $encodedUrl = [uri]::EscapeDataString($url)
    $qrApi = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=$encodedUrl"
    
    Write-Host "Generating QR Code for: $url" -ForegroundColor Yellow
    Write-Host "Opening in browser..." -ForegroundColor Cyan
    Start-Process $qrApi
}

while ($true) {
    Show-Header
    Show-Status

    Write-Host "Options:" -ForegroundColor Cyan
    Write-Host "  [1] Start Servers"
    Write-Host "  [2] Stop Servers"
    Write-Host "  [3] Restart Servers"
    Write-Host "  [4] Open Dashboard in Browser"
    Write-Host "  [5] Show Mobile Connect QR Code"
    Write-Host "  [R] Refresh Status"
    Write-Host "  [Q] Exit"
    Write-Host ""
    
    $choice = Read-Host "Select an option"
    
    switch ($choice) {
        "1" { Start-Servers }
        "2" { Stop-Servers }
        "3" { Stop-Servers; Start-Servers }
        "4" { Open-Browser }
        "5" { Show-QR }
        "R" { continue }
        "r" { continue }
        "Q" { exit }
        "q" { exit }
        Default { Write-Host "Invalid option." -ForegroundColor Red; Start-Sleep -Seconds 1 }
    }
}
