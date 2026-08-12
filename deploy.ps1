# deploy.ps1
# Deploys ALL Vercel projects in this repo:
#   1. mcraesocial.com          (root folder)
#   2. political-gravity.vercel.app  (political-gravity/ subfolder)
#
# Political Gravity now lives at mcraesocial.com/gravity/ and the
# political-gravity.vercel.app project only serves a redirect there.
# It needs deploying once to pick that redirect up; after that it can be
# skipped with:  .\deploy.ps1 -SkipGravityRedirect
#
# This does NOT deploy slides — use sync-slides.ps1 for that.
#
# NOTE: NODE_OPTIONS=--use-system-ca is required because the school network
# SSL proxy uses a local root CA that Node.js won't trust by default.
# This also works fine at home.

param(
    [switch]$SkipGravityRedirect
)

$env:NODE_OPTIONS = "--use-system-ca"

Write-Host "`n=== Deploying mcraesocial.com ===" -ForegroundColor Cyan
Push-Location $PSScriptRoot
vercel --prod --yes
Pop-Location

if (-not $SkipGravityRedirect) {
    Write-Host "`n=== Deploying political-gravity.vercel.app (redirect only) ===" -ForegroundColor Cyan
    Push-Location "$PSScriptRoot\political-gravity"
    vercel --prod --yes
    Pop-Location
}

Write-Host "`nAll done!" -ForegroundColor Green
Write-Host "  mcraesocial.com              -> live (includes /gravity/)" -ForegroundColor Green
if (-not $SkipGravityRedirect) {
    Write-Host "  political-gravity.vercel.app -> redirects to mcraesocial.com/gravity/" -ForegroundColor Green
}
