# sync-slides.ps1
# Syncs processed Keynote exports from OneDrive Dropzone → assets/slides → Firebase
# Run this after exporting new decks on your Mac and letting OneDrive sync.
#
# ARCHITECTURE (do not change):
#   - Slides are hosted on Firebase: mcraesocial-slides.web.app
#   - Site pages are hosted on Vercel project "socialsite" → mcraesocial.com
#   - Vercel does NOT serve slides (they're in .vercelignore)
#   - All iframe src attributes point to mcraesocial-slides.web.app

$oneDrive = "C:\Users\Owner\OneDrive - Rocky View Schools\McRae Dropzone"
$target   = "$PSScriptRoot\assets\slides"

Write-Host "`n=== McRae Slides Sync ===" -ForegroundColor Cyan
Write-Host "Source: $oneDrive"
Write-Host "Target: $target`n"

# Step 1: Sync all _processed decks from OneDrive to assets/slides
$synced = 0
Get-ChildItem $oneDrive -Recurse -Directory -Filter "_processed" | ForEach-Object {
  $unitRelPath  = $_.Parent.FullName.Replace("$oneDrive\", "")
  $processedDir = $_.FullName

  Get-ChildItem $processedDir -Directory | ForEach-Object {
    $deckSlug = $_.Name.ToLower() -replace '\s+', '-'
    $src = $_.FullName
    $dst = "$target\$unitRelPath\$deckSlug"

    Write-Host "  Syncing $unitRelPath/$deckSlug..." -NoNewline
    robocopy $src $dst /E /NFL /NDL /NJH /NJS /NC /NS /NP | Out-Null
    Write-Host " done" -ForegroundColor Green
    $synced++
  }
}

Write-Host "`n$synced deck(s) synced." -ForegroundColor Cyan

# Step 2: Flatten UUID subdirectory files to flat paths
# The Keynote player (main.js) loads slide data via: assets/UUID/UUID.json
# The OneDrive exports already have this structure, but we also flatten
# json/jsonp to the assets/ root for compatibility with older player versions.
Write-Host "`n=== Flattening slide data files ===" -ForegroundColor Cyan
$flattened = 0
Get-ChildItem $target -Recurse -Directory | Where-Object {
  $_.Name -match '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$'
} | ForEach-Object {
  $uuid = $_.Name; $assetDir = $_.Parent.FullName
  foreach ($ext in @("json","jsonp")) {
    $src = "$($_.FullName)\$uuid.$ext"; $dst = "$assetDir\$uuid.$ext"
    if ((Test-Path $src) -and -not (Test-Path $dst)) { Copy-Item $src $dst; $flattened++ }
  }
}
Write-Host "$flattened file(s) flattened.`n" -ForegroundColor Cyan

# Step 3: Deploy slides to Firebase
Write-Host "=== Deploying slides to Firebase ===" -ForegroundColor Cyan
Push-Location $PSScriptRoot
firebase deploy --only hosting:mcraesocial-slides --project project-7910201586224417193
Pop-Location

Write-Host "`nAll done! Slides are live at https://mcraesocial-slides.web.app" -ForegroundColor Green
