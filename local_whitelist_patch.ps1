$ErrorActionPreference = "Stop"
$hostsPath = "$env:SystemRoot\system32\drivers\etc\hosts"
$domains = @(
    "firestore.googleapis.com",
    "firebase.googleapis.com",
    "firebasestorage.googleapis.com",
    "cloudfunctions.googleapis.com",
    "identitytoolkit.googleapis.com",
    "securetoken.googleapis.com"
)

function Get-CleanIP {
    param ($domain)
    try {
        # Use Google DNS-over-HTTPS to bypass local DNS filters
        $url = "https://dns.google/resolve?name=$domain&type=A"
        $response = Invoke-RestMethod -Uri $url -TimeoutSec 5
        if ($response.Answer) {
            return $response.Answer[0].data
        }
    }
    catch {
        Write-Warning "Could not resolve $domain via DoH."
    }
    return $null
}

Write-Host "🛡️ STARTING LOCAL WHITELIST PATCH..." -ForegroundColor Cyan
Write-Host "   Target: Windows Hosts File" -ForegroundColor Gray

$newEntries = @()

foreach ($domain in $domains) {
    Write-Host "🔍 Resolving $domain..." -NoNewline
    $ip = Get-CleanIP -domain $domain
    
    if ($ip) {
        Write-Host " FOUND ($ip)" -ForegroundColor Green
        $newEntries += "$ip $domain"
    }
    else {
        Write-Host " FAILED" -ForegroundColor Red
    }
}

if ($newEntries.Count -eq 0) {
    Write-Error "Could not resolve any domains. Check internet connection."
    exit
}

try {
    $currentHosts = Get-Content $hostsPath -Raw
    $backupPath = "$hostsPath.bak"
    $currentHosts | Out-File $backupPath -Encoding UTF8
    Write-Host "💾 Backup saved to $backupPath" -ForegroundColor Gray

    # Remove old entries for these domains to avoid duplicates
    $lines = $currentHosts -split "`r`n"
    $cleanLines = $lines | Where-Object { 
        $line = $_
        $match = $false
        foreach ($d in $domains) { if ($line -match $d) { $match = $true } }
        -not $match
    }

    $finalContent = $cleanLines -join "`r`n"
    $finalContent += "`r`n`r`n# --- VINTAGE SOLO WHITELIST ---`r`n"
    $finalContent += ($newEntries -join "`r`n")
    $finalContent += "`r`n# ------------------------------`r`n"

    $finalContent | Out-File $hostsPath -Encoding UTF8
    Write-Host "✅ Hosts file updated successfully." -ForegroundColor Green
    
    ipconfig /flushdns
    Write-Host "🚿 DNS Cache Flushed." -ForegroundColor Cyan

}
catch {
    Write-Error "Failed to write to Hosts file. Run as Administrator!"
}

Write-Host "`n✨ DONE. The app should now connect through your ad-blocker." -ForegroundColor Green
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
