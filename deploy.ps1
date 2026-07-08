# deploy.ps1
# Deploys ALL Vercel projects in this repo:
#   1. mcraesocial.com          (root folder)
#   2. political-gravity.vercel.app  (political-gravity/ subfolder)
#
# This does NOT deploy slides — use sync-slides.ps1 for that.
#
# NOTE: NODE_OPTIONS=--use-system-ca is required because the school network
# SSL proxy uses a local root CA that Node.js won't trust by default.
# This also works fine at home.

$env:NODE_OPTIONS = "--use-system-ca"

Write-Host "`n=== Deploying mcraesocial.com ===" -ForegroundColor Cyan
Push-Location $PSScriptRoot
vercel --prod --yes
Pop-Location

Write-Host "`n=== Deploying political-gravity.vercel.app ===" -ForegroundColor Cyan
Push-Location "$PSScriptRoot\political-gravity"
vercel --prod --yes
Pop-Location

Write-Host "`nAll done!" -ForegroundColor Green
Write-Host "  mcraesocial.com              -> live" -ForegroundColor Green
Write-Host "  political-gravity.vercel.app -> live" -ForegroundColor Green
