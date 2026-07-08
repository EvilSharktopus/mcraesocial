# deploy.ps1
# Deploys the site pages to Vercel (mcraesocial.com).
# This does NOT deploy slides — use sync-slides.ps1 for that.
#
# IMPORTANT: This folder is linked to Vercel project "socialsite" which
# serves mcraesocial.com. Do NOT relink to a different project.
#
# NOTE: NODE_OPTIONS=--use-system-ca is required on the school network
# because the SSL inspection proxy uses a local root CA that Node.js
# won't trust by default.

Push-Location $PSScriptRoot

Write-Host "`n=== Deploying site to mcraesocial.com ===" -ForegroundColor Cyan
$env:NODE_OPTIONS = "--use-system-ca"
vercel --prod --yes

Pop-Location
Write-Host "`nDone! Site is live at https://mcraesocial.com" -ForegroundColor Green
