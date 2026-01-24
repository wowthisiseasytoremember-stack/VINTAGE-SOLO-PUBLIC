# Debug DNS Toggle Script
# Use this to verify if your DNS (AdGuard/NextDNS) is blocking Google Vision API.

function Show-Menu {
    Clear-Host
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "   PWA NETWORK DEBUG TOOL" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "1. ENABLE Google DNS (8.8.8.8)" -ForegroundColor Green
    Write-Host "   (Use this if App is hanging)"
    Write-Host ""
    Write-Host "2. RESTORE Average DNS (DHCP)" -ForegroundColor Yellow
    Write-Host "   (Use this after testing)"
    Write-Host ""
    Write-Host "Q. Quit"
    Write-Host "================================" -ForegroundColor Cyan
}

# Check for Admin Privileges
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "⚠️  Please run this script as ADMINISTRATOR!" -ForegroundColor Red
    Write-Host "Right-click -> Run as Administrator"
    Start-Sleep -Seconds 5
    Exit
}

do {
    Show-Menu
    $choice = Read-Host "Select an option"

    switch ($choice) {
        
        "1" {
            Write-Host "Setting DNS to 8.8.8.8 (Google)..." -ForegroundColor Magenta
            try {
                $adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
                if ($adapter) {
                    Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ServerAddresses ("8.8.8.8", "8.8.4.4")
                    Write-Host "✅ DNS set to Google. Try the app now!" -ForegroundColor Green
                    Write-Host "Wait 5-10 seconds for it to take effect."
                }
                else {
                    Write-Host "❌ No active network adapter found." -ForegroundColor Red
                }
            }
            catch {
                Write-Host "❌ Error setting DNS: $_" -ForegroundColor Red
            }
            Pause
        }

        "2" {
            Write-Host "Restoring default DNS (DHCP)..." -ForegroundColor Magenta
            try {
                $adapter = Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1
                if ($adapter) {
                    Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ResetServerAddresses
                    Write-Host "✅ DNS Restored to Automatic." -ForegroundColor Green
                }
                else {
                    Write-Host "❌ No active network adapter found." -ForegroundColor Red
                }
            }
            catch {
                Write-Host "❌ Error restoring DNS: $_" -ForegroundColor Red
            }
            Pause
        }

        "Q" { Write-Host "Exiting..."; break }
        "q" { Write-Host "Exiting..."; break }
    }
} while ($true)
