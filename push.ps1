# Prahari — Git Push Setup Script
# Run this script from PowerShell in the Prahari directory:
#   cd "C:\Users\HP\OneDrive\Desktop\Prahari"
#   .\push.ps1

$TOKEN = Read-Host "Paste your new GitHub PAT token" -AsSecureString
$PLAIN_TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($TOKEN)
)

$REMOTE_URL = "https://Rashij-17:$PLAIN_TOKEN@github.com/Rashij-17/Prahari.git"

Write-Host "`n[1/5] Setting remote URL..." -ForegroundColor Cyan
git remote remove origin 2>$null
git remote add origin $REMOTE_URL

Write-Host "[2/5] Staging all files..." -ForegroundColor Cyan
git add .

Write-Host "[3/5] Creating commit..." -ForegroundColor Cyan
git commit -m "feat: Prahari health companion - Phase 1-5 complete"

Write-Host "[4/5] Pushing to GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host "`n[5/5] Cleaning credentials from remote URL..." -ForegroundColor Yellow
git remote set-url origin https://github.com/Rashij-17/Prahari.git

Write-Host "`nDone! Check https://github.com/Rashij-17/Prahari" -ForegroundColor Green
