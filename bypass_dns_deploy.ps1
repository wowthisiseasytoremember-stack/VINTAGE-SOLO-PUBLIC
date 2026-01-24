$ErrorActionPreference = "Stop"
$projectPath = "c:\Users\wowth\OneDrive\Desktop\test-from-PRD-main\test-from-PRD-main"

try {
    Write-Host "📂 Navigating to project directory..." -ForegroundColor Cyan
    Set-Location -Path $projectPath
    
    # Validation
    if (!(Test-Path "firebase.json")) {
        throw "CRITICAL: Could not find firebase.json in $projectPath"
    }

    Write-Host "🔍 Finding REAL internet adapter..." -ForegroundColor Cyan
    # Get the adapter that has the default gateway (0.0.0.0/0)
    $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (!$route) { throw "No internet connection found." }
    
    $adapter = Get-NetAdapter -InterfaceIndex $route.InterfaceIndex
    Write-Host "   ✅ Identified Internet Adapter: $($adapter.Name) ($($adapter.InterfaceDescription))" -ForegroundColor Green
    
    Write-Host "💾 Snapshotting current DNS..." -ForegroundColor Cyan
    $currentDNS = (Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex).ServerAddresses
    Write-Host "   Current Settings: $(if ($currentDNS) { $currentDNS -join ', ' } else { 'Automatic (DHCP)' })" -ForegroundColor Gray
    
    Write-Host "🌍 Switching to Google DNS (8.8.8.8)..." -ForegroundColor Yellow
    Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ServerAddresses ("8.8.8.8", "8.8.4.4")
    
    Write-Host "🚿 Flushing DNS cache..." -ForegroundColor Cyan
    ipconfig /flushdns
    
    Write-Host "⏳ Waiting 8 seconds for DNS propagation..." -ForegroundColor Cyan
    Start-Sleep -Seconds 8
    
    Write-Host "🚀 STARTING DEPLOYMENT..." -ForegroundColor Green
    # Double-ensure path is correct for the cmd execution
    cmd /c "cd /d ""$projectPath"" && firebase deploy --only functions --project pwa-id-app --non-interactive --force"
    
}
catch {
    Write-Error "❌ Error occurred: $_"
}
finally {
    if ($adapter) {
        Write-Host "`n🔄 Reverting DNS settings for $($adapter.Name)..." -ForegroundColor Cyan
        if ($currentDNS) {
            Set-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ServerAddresses $currentDNS
            Write-Host "✅ Restored to: $($currentDNS -join ', ')" -ForegroundColor Green
        }
        else {
            Reset-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -ResetServerAddresses
            Write-Host "✅ Restored to Automatic (DHCP)." -ForegroundColor Green
        }
        ipconfig /flushdns
    }
    
    Write-Host "✨ Done. Press any key to close..." -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
